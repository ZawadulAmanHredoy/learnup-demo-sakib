/**
 * Live Game Engine — question lifecycle, scoring flush, buzzer orchestration.
 *
 * FSM (AppFlow §3):
 *   COUNTDOWN ─3s─▶ ACTIVE ⇄ PAUSED
 *   ACTIVE ─(timer 0 | all answered | host lock)─▶ CLOSING ─grace─▶ LOCKED ─▶ REVEALED
 *
 * - Answers are ingested into the in-memory buffer (submissionBuffer) with no DB I/O.
 * - On lock, a 1000 ms grace window accepts packets already in flight (AppFlow §5.3),
 *   then the buffer is drained and persisted in one bulk write, scores/streaks/ranks
 *   are applied, and each team's private result is prepared.
 * - Reveal broadcasts the answer and pushes each team its private `sync:player_result`.
 */

const storageService = require('./storageService');
const scoring = require('./scoringService');
const registry = require('./sessionRegistry');
const timer = require('./timerService');
const submissionBuffer = require('./submissionBuffer');
const buzzer = require('./buzzerService');

const COUNTDOWN_MS = 3000;
const LATE_GRACE_MS = 1000;
const PLAYER_LIST_DEBOUNCE_MS = 200;

const liveQuestions = new Map(); // pin -> question state
const buzzerMeta = new Map(); // pin -> { roomId, questionId, logPromise }
const playerListTimers = new Map(); // pin -> debounce handle

const channels = {
  host: pin => `${pin}:host`,
  stage: pin => `${pin}:stage`,
  players: pin => `${pin}:players`,
};

function logError(context) {
  return err => console.error(`⚠️ [LiveEngine:${context}]`, err?.message || err);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toPlain(doc) {
  if (!doc) return doc;
  return typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

async function resolveQuiz(room) {
  if (!room) return null;
  if (typeof room.quizId === 'object' && room.quizId !== null && room.quizId.questions) {
    return room.quizId;
  }
  const quizId = room.quizId?._id || room.quizId;
  return storageService.getQuizById(quizId);
}

/** Anti-cheat: the only shape of a question that ever leaves the server before reveal. */
function sanitizeQuestion(question) {
  return {
    questionId: String(question._id),
    questionText: question.questionText,
    type: question.type,
    segment: question.segment,
    media: question.media,
    options: (question.options || []).map(opt => ({ id: opt.id, text: opt.text })),
    timeLimitSec: question.timeLimitSec || 20,
    points: question.points || 1000,
    negativeMarking: !!question.negativeMarking,
  };
}

/** Strip secrets (session tokens, phones, socket ids) before sending participants to public screens. */
function publicParticipant(p) {
  const plain = toPlain(p);
  return {
    id: plain._id,
    teamName: plain.teamName,
    institution: plain.institution,
    score: plain.totalScore || 0,
    rank: plain.currentRank || 0,
    isConnected: plain.isConnected !== false,
  };
}

// ============================================================================
// Player list broadcast (debounced so a burst of 133 joins is one update/200ms)
// ============================================================================

function broadcastPlayerList(io, pin) {
  if (playerListTimers.has(pin)) return;
  playerListTimers.set(pin, setTimeout(async () => {
    playerListTimers.delete(pin);
    try {
      const participants = await storageService.getParticipantsByPin(pin);
      io.to(channels.host(pin)).to(channels.stage(pin)).emit('room:player_list', {
        totalCount: participants.length,
        participants: participants.map(publicParticipant),
      });
    } catch (err) {
      logError('playerList')(err);
    }
  }, PLAYER_LIST_DEBOUNCE_MS));
}

// ============================================================================
// MCQ question lifecycle
// ============================================================================

async function startQuestion(io, pin, questionIndex = 0) {
  const room = await storageService.findRoomByPin(pin);
  if (!room) return { ok: false, error: 'Room not found.' };

  const quiz = await resolveQuiz(room);
  if (!quiz?.questions?.length) return { ok: false, error: 'Quiz has no questions.' };

  const qIndex = Number(questionIndex);
  const question = quiz.questions[qIndex];
  if (!question) return { ok: false, error: `Question not found at index ${qIndex}` };

  // Close out whatever was running so its answers are scored, not lost
  const previous = liveQuestions.get(pin);
  if (previous) {
    clearTimeout(previous.countdownHandle);
    if (previous.phase === 'ACTIVE' || previous.phase === 'PAUSED') {
      lockQuestion(io, pin, { reason: 'SUPERSEDED', graceMs: 0 });
    }
    await previous.flushPromise;
  }
  timer.clear(pin);
  submissionBuffer.clear(pin);

  const startedCountdownAt = Date.now();
  const correctOptions = (question.options || []).filter(o => o.isCorrect);
  const state = {
    pin,
    roomId: room._id,
    questionIndex: qIndex,
    totalQuestions: quiz.questions.length,
    question,
    correctOptionIds: new Set(correctOptions.map(o => o.id)),
    correctOption: correctOptions[0] || null,
    scoringConfig: {
      speedBonusEnabled: room.settings?.speedBonus !== false && quiz.speedBonusEnabled !== false,
      negativeRatio: quiz.negativeMarkingRatio || 0,
    },
    phase: 'COUNTDOWN',
    countdownEndsAt: startedCountdownAt + COUNTDOWN_MS,
    countdownHandle: null,
    packet: null,
    lockedAt: null,
    graceMs: 0,
    lockReason: null,
    flushStarted: false,
    flushPromise: null,
    records: [],
    results: new Map(),
    revealPacket: null,
  };
  liveQuestions.set(pin, state);
  buzzer.close(pin);

  await storageService.updateRoomByPin(pin, { status: 'COUNTDOWN', currentQuestionIndex: qIndex });

  io.to(pin).emit('sync:countdown', {
    durationMs: COUNTDOWN_MS,
    serverTimestamp: startedCountdownAt,
    serverTime: Date.now(),
    questionIndex: qIndex,
    totalQuestions: state.totalQuestions,
  });

  state.countdownHandle = setTimeout(() => {
    activateQuestion(io, pin, state).catch(logError('activate'));
  }, COUNTDOWN_MS);

  return { ok: true };
}

async function activateQuestion(io, pin, state) {
  if (liveQuestions.get(pin) !== state || state.phase !== 'COUNTDOWN') return;

  // Make sure every registered team is known to the hot path (covers server restarts)
  const participants = await storageService.getParticipantsByPin(pin);
  registry.hydrate(pin, participants);
  if (liveQuestions.get(pin) !== state) return;

  const { question } = state;
  const sanitized = sanitizeQuestion(question);
  submissionBuffer.open(pin, {
    questionId: sanitized.questionId,
    optionIds: sanitized.options.map(o => o.id),
  });

  const { startedAt, deadline } = timer.start(pin, sanitized.timeLimitSec * 1000, () => {
    lockQuestion(io, pin, { reason: 'TIME_UP', graceMs: LATE_GRACE_MS });
  });

  state.phase = 'ACTIVE';
  state.packet = {
    questionIndex: state.questionIndex,
    totalQuestions: state.totalQuestions,
    ...sanitized,
    serverStartTime: startedAt,
    serverDeadline: deadline,
  };

  io.to(pin).emit('sync:question_active', { ...state.packet, serverTime: Date.now() });
  emitTelemetry(io, pin);

  storageService.updateRoomByPin(pin, {
    status: 'QUESTION_ACTIVE',
    currentQuestionStartedAt: new Date(startedAt),
  }).catch(logError('roomActive'));
}

/**
 * Ingest one answer. SYNCHRONOUS — validation, timing and the duplicate guard
 * all run in one tick so the ACK can go back immediately.
 */
function submitAnswer(pin, session, { questionId, selectedOptionId, clientSentAt } = {}) {
  const state = liveQuestions.get(pin);
  if (!state || !['ACTIVE', 'PAUSED', 'CLOSING'].includes(state.phase)) {
    return { success: false, reason: state?.phase === 'COUNTDOWN' ? 'NOT_STARTED' : 'EXPIRED' };
  }
  if (!session || session.isDisqualified) return { success: false, reason: 'DISQUALIFIED' };
  if (state.phase === 'PAUSED') return { success: false, reason: 'PAUSED' };

  const receivedAt = Date.now();
  if (state.phase === 'CLOSING' && receivedAt > state.lockedAt + state.graceMs) {
    return { success: false, reason: 'EXPIRED' };
  }

  const timeTakenMs = timer.activeElapsedMs(pin, receivedAt) ?? 0;
  const isCorrect = state.correctOptionIds.has(selectedOptionId);
  const score = scoring.calculateScore({
    isCorrect,
    timeTakenMs,
    timeLimitSec: state.question.timeLimitSec || 20,
    basePoints: state.question.points || 1000,
    speedBonusEnabled: state.scoringConfig.speedBonusEnabled,
    negativeMarking: !!state.question.negativeMarking,
    negativeRatio: state.scoringConfig.negativeRatio,
    currentStreak: session.currentStreak || 0,
  });

  const record = {
    questionId: questionId || String(state.question._id),
    participantId: session.participantId,
    sessionToken: session.sessionToken,
    teamName: session.teamName,
    selectedOptionId,
    clientSentAt: Number.isFinite(clientSentAt) ? new Date(clientSentAt) : null,
    serverReceivedAt: new Date(receivedAt),
    timeTakenMs,
    ...score,
  };

  const res = submissionBuffer.ingest(pin, session.sessionToken, record);
  if (!res.ok) return { success: false, reason: res.reason };

  return { success: true, received: true, timeTakenMs, selectedOptionId };
}

/** Telemetry + early auto-lock once every active team has answered. */
function afterSubmit(io, pin) {
  const { answeredCount, totalCount } = emitTelemetry(io, pin);
  const state = liveQuestions.get(pin);
  if (state?.phase === 'ACTIVE' && totalCount > 0 && answeredCount >= totalCount) {
    lockQuestion(io, pin, { reason: 'ALL_ANSWERED', graceMs: 0 });
  }
}

function emitTelemetry(io, pin) {
  const { answeredCount, distribution } = submissionBuffer.stats(pin);
  const totalCount = registry.listActive(pin).length;
  io.to(channels.host(pin)).to(channels.stage(pin)).emit('host:live_telemetry', {
    answeredCount,
    totalCount,
    distribution,
  });
  return { answeredCount, totalCount };
}

/**
 * Close a question to new answers. Answers already in flight are still
 * accepted for `graceMs`, after which the buffer is flushed.
 * Idempotent: returns the existing flush promise if already locked.
 */
function lockQuestion(io, pin, { reason = 'HOST_LOCK', graceMs = LATE_GRACE_MS } = {}) {
  const state = liveQuestions.get(pin);
  if (!state) return Promise.resolve();
  if (state.phase !== 'ACTIVE' && state.phase !== 'PAUSED') {
    return state.flushPromise || Promise.resolve();
  }

  state.phase = 'CLOSING';
  state.lockedAt = Date.now();
  state.graceMs = graceMs;
  state.lockReason = reason;
  timer.stop(pin);

  io.to(pin).emit('sync:question_locked', {
    totalAnswersReceived: submissionBuffer.stats(pin).answeredCount,
    serverLockedAt: state.lockedAt,
    reason,
  });

  storageService.updateRoomByPin(pin, {
    status: 'QUESTION_LOCKED',
    currentQuestionLockedAt: new Date(state.lockedAt),
  }).catch(logError('roomLocked'));

  state.flushPromise = delay(graceMs)
    .then(() => flushQuestion(io, pin, state))
    .catch(logError('flush'));
  return state.flushPromise;
}

/** Drain the buffer, persist it in bulk, and apply scores, streaks and ranks. */
async function flushQuestion(io, pin, state) {
  if (state.flushStarted) return;
  state.flushStarted = true;

  const records = submissionBuffer.drain(pin);
  state.records = records;
  state.phase = 'LOCKED';

  const participants = (await storageService.getParticipantsByPin(pin)).map(toPlain);
  const recordsByToken = new Map(records.map(r => [r.sessionToken, r]));

  const nextStates = participants.map(p => {
    const rec = recordsByToken.get(p.sessionToken);
    const next = { ...p, previousRank: p.currentRank || 0 };
    if (!rec) {
      next.currentStreak = 0; // Missing a question breaks the streak
      return next;
    }
    next.totalScore = scoring.applyDelta(p.totalScore, rec.totalPointsAwarded);
    next.currentStreak = rec.newStreak;
    next.correctAnswersCount = (p.correctAnswersCount || 0) + (rec.isCorrect ? 1 : 0);
    next.incorrectAnswersCount = (p.incorrectAnswersCount || 0) + (rec.isCorrect ? 0 : 1);
    next.cumulativeResponseTimeMs = (p.cumulativeResponseTimeMs || 0) + rec.timeTakenMs;
    const answered = next.correctAnswersCount + next.incorrectAnswersCount;
    next.averageResponseTimeMs = Math.round(next.cumulativeResponseTimeMs / answered);
    next.bestQuestionScore = Math.max(p.bestQuestionScore || 0, rec.totalPointsAwarded);
    return next;
  });

  const ranked = scoring.rankParticipants(nextStates);
  const totalTeams = ranked.length;
  const correctOptionId = state.correctOption?.id || null;
  const correctOptionText = state.correctOption?.text || '';

  const updates = [];
  for (const p of ranked) {
    updates.push({
      id: p._id,
      update: {
        totalScore: p.totalScore || 0,
        currentStreak: p.currentStreak || 0,
        correctAnswersCount: p.correctAnswersCount || 0,
        incorrectAnswersCount: p.incorrectAnswersCount || 0,
        cumulativeResponseTimeMs: p.cumulativeResponseTimeMs || 0,
        averageResponseTimeMs: p.averageResponseTimeMs || 0,
        bestQuestionScore: p.bestQuestionScore || 0,
        currentRank: p.rank,
      },
    });
    registry.update(pin, p.sessionToken, { currentStreak: p.currentStreak || 0 });

    const rec = recordsByToken.get(p.sessionToken);
    state.results.set(p.sessionToken, {
      questionIndex: state.questionIndex,
      missed: !rec,
      isCorrect: !!rec?.isCorrect,
      selectedOptionId: rec?.selectedOptionId || null,
      correctOptionId,
      correctOptionText,
      pointsEarned: rec?.totalPointsAwarded || 0,
      basePoints: rec?.basePoints || 0,
      speedBonus: rec?.speedBonusPoints || 0,
      streakBonus: rec?.streakBonusPoints || 0,
      penaltyPoints: rec?.penaltyPoints || 0,
      multiplier: rec?.multiplier || 1,
      streak: p.currentStreak || 0,
      badge: rec?.badge || '',
      timeTakenMs: rec?.timeTakenMs ?? null,
      currentScore: p.totalScore || 0,
      rank: p.rank,
      previousRank: p.previousRank || 0,
      rankDelta: p.previousRank ? p.previousRank - p.rank : 0,
      totalTeams,
    });
  }

  const rankedIds = new Set(ranked.map(p => String(p._id)));
  const submissionDocs = records
    .filter(r => rankedIds.has(String(r.participantId)))
    .map(r => ({
      roomId: state.roomId,
      questionId: r.questionId,
      participantId: r.participantId,
      pin,
      teamName: r.teamName,
      selectedOptionId: r.selectedOptionId,
      clientSentAt: r.clientSentAt,
      serverReceivedAt: r.serverReceivedAt,
      timeTakenMs: r.timeTakenMs,
      isCorrect: r.isCorrect,
      basePoints: r.basePoints,
      speedBonusPoints: r.speedBonusPoints,
      streakBonusPoints: r.streakBonusPoints,
      streakMultiplier: r.multiplier,
      penaltyPoints: r.penaltyPoints,
      totalPointsAwarded: r.totalPointsAwarded,
    }));

  await Promise.all([
    storageService.insertSubmissions(submissionDocs),
    storageService.bulkUpdateParticipants(updates),
  ]);

  emitTelemetry(io, pin);
  broadcastPlayerList(io, pin);
}

async function revealAnswer(io, pin) {
  const state = liveQuestions.get(pin);
  if (!state || state.phase === 'COUNTDOWN') return { ok: false, error: 'No active question to reveal.' };

  if (state.phase === 'ACTIVE' || state.phase === 'PAUSED') {
    lockQuestion(io, pin, { reason: 'HOST_REVEAL', graceMs: 0 });
  }
  await state.flushPromise;
  if (liveQuestions.get(pin) !== state) return { ok: false, error: 'Question was superseded.' };

  if (!state.revealPacket) {
    let fastestTeam = null;
    for (const rec of state.records) {
      if (rec.isCorrect && (!fastestTeam || rec.timeTakenMs < fastestTeam.timeTakenMs)) {
        fastestTeam = {
          name: rec.teamName,
          timeTakenMs: rec.timeTakenMs,
          latencySec: (rec.timeTakenMs / 1000).toFixed(2),
        };
      }
    }
    state.revealPacket = {
      questionIndex: state.questionIndex,
      correctOptionId: state.correctOption?.id || null,
      correctOptionIds: Array.from(state.correctOptionIds),
      correctOptionText: state.correctOption?.text || '',
      explanation: state.question.explanation || '',
      distribution: submissionBuffer.stats(pin).distribution,
      totalAnswers: state.records.length,
      fastestTeam,
    };
  }
  state.phase = 'REVEALED';

  await storageService.updateRoomByPin(pin, { status: 'ANSWER_REVEAL' });
  io.to(pin).emit('sync:answer_reveal', state.revealPacket);

  for (const [sessionToken, result] of state.results) {
    io.to(registry.playerChannel(pin, sessionToken)).emit('sync:player_result', result);
  }
  return { ok: true };
}

async function pauseQuestion(io, pin) {
  const state = liveQuestions.get(pin);
  if (!state || state.phase !== 'ACTIVE') return { ok: false, error: 'No running question to pause.' };
  const paused = timer.pause(pin);
  if (!paused) return { ok: false, error: 'Timer is not running.' };

  state.phase = 'PAUSED';
  io.to(pin).emit('sync:timer_paused', {
    remainingMs: paused.remainingMs,
    serverTime: Date.now(),
  });
  await storageService.updateRoomByPin(pin, { status: 'PAUSED' });
  return { ok: true };
}

async function resumeQuestion(io, pin) {
  const state = liveQuestions.get(pin);
  if (!state || state.phase !== 'PAUSED') return { ok: false, error: 'Question is not paused.' };
  const resumed = timer.resume(pin);
  if (!resumed) return { ok: false, error: 'Timer is not paused.' };

  state.phase = 'ACTIVE';
  state.packet.serverDeadline = resumed.deadline;
  io.to(pin).emit('sync:timer_resumed', {
    serverDeadline: resumed.deadline,
    remainingMs: resumed.remainingMs,
    serverTime: Date.now(),
  });
  await storageService.updateRoomByPin(pin, { status: 'QUESTION_ACTIVE' });
  return { ok: true };
}

/**
 * Everything a reconnecting player needs to land on the right screen (AppFlow §5.1).
 */
function getPlayerSnapshot(pin, sessionToken) {
  const state = liveQuestions.get(pin);
  if (!state) return { phase: null };

  const base = {
    phase: state.phase,
    questionIndex: state.questionIndex,
    totalQuestions: state.totalQuestions,
  };

  if (state.phase === 'COUNTDOWN') {
    return { ...base, countdownEndsAt: state.countdownEndsAt };
  }

  const submission = submissionBuffer.get(pin, sessionToken);
  const answer = {
    hasAnswered: !!submission,
    selectedOptionId: submission?.selectedOptionId || null,
  };

  if (state.phase === 'ACTIVE' || state.phase === 'PAUSED') {
    const t = timer.snapshot(pin);
    return {
      ...base,
      ...answer,
      question: { ...state.packet, serverDeadline: t?.deadline ?? state.packet.serverDeadline },
      remainingMs: t?.remainingMs ?? 0,
      isPaused: state.phase === 'PAUSED',
    };
  }

  if (state.phase === 'CLOSING' || state.phase === 'LOCKED') {
    return { ...base, ...answer, question: state.packet };
  }

  // REVEALED
  return {
    ...base,
    ...answer,
    question: state.packet,
    reveal: state.revealPacket,
    result: state.results.get(sessionToken) || null,
  };
}

// ============================================================================
// Standings & final summary pushed privately to every team
// ============================================================================

function buildFinalSummary(participant, { totalQuestions, totalTeams }) {
  const p = toPlain(participant);
  const correct = p.correctAnswersCount || 0;
  const incorrect = p.incorrectAnswersCount || 0;
  const answered = correct + incorrect;
  return {
    teamName: p.teamName,
    institution: p.institution,
    totalScore: p.totalScore || 0,
    rank: p.rank || p.currentRank || 0,
    totalTeams,
    totalQuestions,
    answered,
    correct,
    incorrect,
    missed: Math.max(0, totalQuestions - answered),
    accuracyPct: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0,
    averageResponseTimeMs: p.averageResponseTimeMs || 0,
    bestQuestionScore: p.bestQuestionScore || 0,
  };
}

/**
 * @param {Array} ranked participants with `rank` (scoring.rankParticipants)
 * @param {{ isLastQuestion: boolean, totalQuestions: number, deltas: Map<string, number> }} opts
 */
function emitPlayerStandings(io, pin, ranked, { isLastQuestion, totalQuestions, deltas }) {
  const totalTeams = ranked.length;
  for (const p of ranked) {
    const channel = registry.playerChannel(pin, p.sessionToken);
    io.to(channel).emit('sync:player_rank', {
      rank: p.rank,
      totalTeams,
      score: p.totalScore || 0,
      delta: deltas?.get(String(p._id)) || 0,
      streak: p.currentStreak || 0,
      isLastQuestion,
    });
    if (isLastQuestion) {
      io.to(channel).emit('sync:player_final_summary', buildFinalSummary(p, { totalQuestions, totalTeams }));
    }
  }
}

async function rerank(pin) {
  const participants = (await storageService.getParticipantsByPin(pin)).map(toPlain);
  const ranked = scoring.rankParticipants(participants);
  await storageService.bulkUpdateParticipants(
    ranked
      .filter(p => p.currentRank !== p.rank)
      .map(p => ({ id: p._id, update: { currentRank: p.rank } }))
  );
  return ranked;
}

// ============================================================================
// Semi-Final Buzzer orchestration
// ============================================================================

async function openBuzzer(io, pin, questionId) {
  const room = await storageService.findRoomByPin(pin);
  if (!room) return { ok: false, error: 'Room not found.' };
  const quiz = await resolveQuiz(room);
  const question = quiz?.questions?.find(q => String(q._id) === String(questionId)) || null;
  const correctPoints = question?.points || buzzer.DEFAULT_CORRECT_POINTS;
  const penaltyPoints = Math.round(correctPoints * 0.5);

  const participants = await storageService.getParticipantsByPin(pin);
  registry.hydrate(pin, participants);

  const previous = buzzer.snapshot(pin);
  const state = buzzer.open(pin, { questionId: questionId || null, correctPoints, penaltyPoints });
  const reOpened = !!previous && String(previous.questionId) === String(questionId || null) && state.roundId > 1;
  buzzerMeta.set(pin, { roomId: room._id, questionId: questionId || null, logPromise: null });

  const eligible = registry.listActive(pin).filter(s => !state.excluded.has(s.participantId));
  if (eligible.length === 0) {
    buzzer.close(pin);
    io.to(pin).emit('sync:buzzer_closed', { reason: 'NO_ELIGIBLE_TEAMS', questionId });
    return { ok: true, closed: true };
  }

  io.to(pin).emit('sync:buzzer_ready', {
    questionId,
    unlockedAt: state.openedAt,
    serverTime: Date.now(),
    roundId: state.roundId,
    reOpened,
    excludedTeamIds: Array.from(state.excluded),
    correctPoints,
    penaltyPoints,
  });
  return { ok: true };
}

/** Atomic buzz. The lock is taken synchronously before anything else happens. */
function handleBuzz(io, socket, pin, session) {
  const result = buzzer.tryBuzz(pin, session);

  if (result.status !== 'WINNER') {
    socket.emit('player:buzz_lockout', {
      status: result.status,
      winnerTeamName: result.winner?.teamName || null,
    });
    return result;
  }

  const { winner } = result;
  socket.emit('player:buzz_ack', { status: 'WINNER', reactionTimeMs: winner.reactionTimeMs });
  io.to(pin).emit('sync:buzzer_locked', {
    winnerTeamId: winner.participantId,
    winnerTeamName: winner.teamName,
    reactionTimeMs: winner.reactionTimeMs,
  });

  const meta = buzzerMeta.get(pin);
  if (meta) {
    meta.logPromise = storageService.createBuzzerLog({
      roomId: meta.roomId,
      questionId: meta.questionId,
      participantId: winner.participantId,
      pin,
      teamName: winner.teamName,
      reactionTimeMs: winner.reactionTimeMs,
      outcome: 'PENDING',
    }).catch(err => {
      logError('buzzerLog')(err);
      return null;
    });
  }
  return result;
}

async function judgeBuzzer(io, pin, verdict) {
  if (!['CORRECT', 'WRONG', 'PASS'].includes(verdict)) {
    return { ok: false, error: 'Verdict must be CORRECT, WRONG or PASS.' };
  }
  const snap = buzzer.snapshot(pin);
  if (!snap || snap.status !== 'LOCKED' || !snap.winner) {
    return { ok: false, error: 'No team currently holds the buzzer.' };
  }

  const winnerId = String(snap.winner.winnerTeamId);
  const outcome = buzzer.judge(pin, winnerId, verdict);

  const participants = (await storageService.getParticipantsByPin(pin)).map(toPlain);
  const target = participants.find(p => String(p._id) === winnerId);

  let newScore = 0;
  if (target) {
    newScore = scoring.applyDelta(target.totalScore, outcome.deltaPoints);
    const update = { totalScore: newScore };
    if (verdict === 'CORRECT') {
      update.correctAnswersCount = (target.correctAnswersCount || 0) + 1;
      update.bestQuestionScore = Math.max(target.bestQuestionScore || 0, outcome.deltaPoints);
    } else if (verdict === 'WRONG') {
      update.incorrectAnswersCount = (target.incorrectAnswersCount || 0) + 1;
    }
    await storageService.updateParticipant(target._id, update);
  }

  const ranked = await rerank(pin);
  const targetRanked = ranked.find(p => String(p._id) === winnerId);

  io.to(pin).emit('sync:buzzer_judged', {
    teamId: winnerId,
    teamName: snap.winner.winnerTeamName,
    verdict,
    deltaPoints: outcome.deltaPoints,
    newScore,
  });
  if (target) {
    io.to(registry.playerChannel(pin, target.sessionToken)).emit('sync:player_score', {
      verdict,
      deltaPoints: outcome.deltaPoints,
      currentScore: newScore,
      rank: targetRanked?.rank || 0,
      totalTeams: ranked.length,
    });
  }

  const meta = buzzerMeta.get(pin);
  const log = await meta?.logPromise;
  if (log?._id) {
    storageService.updateBuzzerLog(log._id, {
      outcome: outcome.outcome,
      awardedScore: outcome.deltaPoints,
    }).catch(logError('buzzerLogUpdate'));
  }
  broadcastPlayerList(io, pin);

  if (outcome.shouldReopen) {
    await openBuzzer(io, pin, snap.questionId);
  }
  return { ok: true };
}

// ============================================================================

function getQuestionState(pin) {
  return liveQuestions.get(pin) || null;
}

function resetRoom(pin) {
  const state = liveQuestions.get(pin);
  if (state) clearTimeout(state.countdownHandle);
  liveQuestions.delete(pin);
  timer.clear(pin);
  submissionBuffer.clear(pin);
  buzzer.clear(pin);
  buzzerMeta.delete(pin);
  registry.clearRoom(pin);
}

module.exports = {
  COUNTDOWN_MS,
  LATE_GRACE_MS,
  channels,
  resolveQuiz,
  sanitizeQuestion,
  publicParticipant,
  broadcastPlayerList,
  startQuestion,
  submitAnswer,
  afterSubmit,
  lockQuestion,
  revealAnswer,
  pauseQuestion,
  resumeQuestion,
  getPlayerSnapshot,
  buildFinalSummary,
  emitPlayerStandings,
  rerank,
  openBuzzer,
  handleBuzz,
  judgeBuzzer,
  getQuestionState,
  resetRoom,
};
