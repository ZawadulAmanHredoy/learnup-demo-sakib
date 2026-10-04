import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useServerClock } from './useServerClock';
import { sound } from '../utils/audio';
import { haptics } from '../utils/haptics';
import {
  loadSession, saveSession, clearSession, loadSoundMuted, saveSoundMuted,
} from '../utils/playerStorage';

/**
 * Player client state machine (AppFlow §2.2 / §3).
 *
 * Screens: JOIN → RECONNECTING → LOBBY → COUNTDOWN → QUESTION → LOCKED → RESULT
 *          → LEADERBOARD → … → FINAL, plus BUZZER and DISQUALIFIED.
 *
 * All server timestamps are converted to the local clock via useServerClock,
 * so countdowns stay correct even on phones with a wrong system clock.
 */

const IDLE_ANSWER = { selectedOptionId: null, status: 'idle', reason: null };
const IDLE_BUZZER = {
  status: 'IDLE', // IDLE | OPEN | PENDING | WON | LOCKED_OUT | EXCLUDED | JUDGED | CLOSED
  winnerTeamName: null,
  reactionTimeMs: null,
  verdict: null,
  deltaPoints: 0,
  judgedTeamName: null,
  correctPoints: 100,
  penaltyPoints: 50,
};

const SESSION_LOST_MESSAGES = {
  SESSION_NOT_FOUND: 'Your previous session has expired. Please join again.',
  ROOM_NOT_FOUND: 'That room has closed. Ask the host for the new PIN.',
  INVALID_SESSION: 'Your saved session was invalid. Please join again.',
};

function createInitialState(urlPin) {
  let saved = loadSession();
  if (saved && urlPin && saved.pin !== urlPin) {
    // Scanned a QR for a different room — the old session doesn't apply
    clearSession();
    saved = null;
  }
  return {
    screen: saved ? 'RECONNECTING' : 'JOIN',
    session: saved,
    room: null,
    profile: { score: 0, rank: 0, totalTeams: 0, streak: 0 },
    questionIndex: 0,
    totalQuestions: 0,
    countdownEndsAt: null,
    question: null,
    deadline: null,
    isPaused: false,
    pausedRemainingMs: null,
    answer: IDLE_ANSWER,
    lockReason: null,
    reveal: null,
    result: null,
    standing: null,
    buzzer: IDLE_BUZZER,
    finalSummary: null,
    notice: null,
    joining: false,
    joinError: null,
  };
}

/** Land a (re)joined player on the correct screen from the server snapshot. */
function hydrate(state, ack, toLocal) {
  const p = ack.participant || {};
  const session = {
    pin: state.session?.pin || ack.pin,
    sessionToken: ack.sessionToken,
    participantId: String(ack.participantId),
    teamName: p.teamName,
    institution: p.institution,
  };
  const snap = ack.snapshot || {};
  const base = {
    ...state,
    session,
    room: { quizTitle: ack.quizTitle, roundType: ack.roundType },
    totalQuestions: ack.totalQuestions || snap.totalQuestions || 0,
    questionIndex: snap.questionIndex ?? ack.currentQuestionIndex ?? 0,
    profile: {
      ...state.profile,
      score: p.totalScore || 0,
      rank: p.currentRank || 0,
      streak: p.currentStreak || 0,
    },
    joining: false,
    joinError: null,
    answer: IDLE_ANSWER,
    question: null,
    result: null,
    reveal: null,
    buzzer: IDLE_BUZZER,
    isPaused: false,
  };

  if (ack.finalSummary) {
    return { ...base, screen: 'FINAL', finalSummary: ack.finalSummary };
  }

  const bz = ack.buzzer;
  const questionLive = ['COUNTDOWN', 'ACTIVE', 'PAUSED'].includes(snap.phase);
  if (bz && (bz.status === 'OPEN' || bz.status === 'LOCKED') && !questionLive) {
    let status = bz.status === 'OPEN' ? 'OPEN' : 'LOCKED_OUT';
    if (bz.isExcluded) status = 'EXCLUDED';
    if (bz.winner && String(bz.winner.winnerTeamId) === session.participantId) status = 'WON';
    return {
      ...base,
      screen: 'BUZZER',
      buzzer: {
        ...IDLE_BUZZER,
        status,
        winnerTeamName: bz.winner?.winnerTeamName || null,
        reactionTimeMs: bz.winner?.reactionTimeMs ?? null,
        correctPoints: bz.correctPoints,
        penaltyPoints: bz.penaltyPoints,
      },
    };
  }

  if (ack.roomStatus === 'LEADERBOARD' && !questionLive) {
    return {
      ...base,
      screen: 'LEADERBOARD',
      standing: { rank: p.currentRank || 0, totalTeams: state.profile.totalTeams, score: p.totalScore || 0, delta: 0 },
    };
  }

  const answer = snap.hasAnswered
    ? { selectedOptionId: snap.selectedOptionId, status: 'confirmed', reason: null }
    : IDLE_ANSWER;

  switch (snap.phase) {
    case 'COUNTDOWN':
      return { ...base, screen: 'COUNTDOWN', countdownEndsAt: toLocal(snap.countdownEndsAt) };
    case 'ACTIVE':
    case 'PAUSED':
      return {
        ...base,
        screen: snap.hasAnswered ? 'LOCKED' : 'QUESTION',
        question: snap.question,
        deadline: toLocal(snap.question.serverDeadline),
        isPaused: !!snap.isPaused,
        pausedRemainingMs: snap.isPaused ? snap.remainingMs : null,
        answer,
      };
    case 'CLOSING':
    case 'LOCKED':
      return {
        ...base,
        screen: 'LOCKED',
        question: snap.question,
        answer,
        lockReason: snap.hasAnswered ? null : 'TIME_UP',
      };
    case 'REVEALED':
      if (snap.result) {
        return { ...base, screen: 'RESULT', question: snap.question, result: snap.result, reveal: snap.reveal, answer };
      }
      return { ...base, screen: 'LOBBY', reveal: snap.reveal };
    default:
      return { ...base, screen: 'LOBBY' };
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'JOIN_START':
      return { ...state, joining: true, joinError: null, session: { pin: action.pin } };
    case 'JOIN_FAILED':
      return { ...state, joining: false, joinError: { code: action.error, message: action.message }, session: null };
    case 'SESSION_READY':
      return hydrate(state, action.ack, action.toLocal);
    case 'SESSION_LOST':
      return {
        ...createInitialState(null),
        screen: 'JOIN',
        session: null,
        notice: { tone: 'warn', text: SESSION_LOST_MESSAGES[action.reason] || 'Please join again.' },
      };
    case 'DISQUALIFIED':
      return { ...state, screen: 'DISQUALIFIED' };
    case 'LEAVE':
      return { ...createInitialState(null), screen: 'JOIN', session: null };

    case 'COUNTDOWN':
      return {
        ...state,
        screen: 'COUNTDOWN',
        countdownEndsAt: action.endsAt,
        questionIndex: action.questionIndex,
        totalQuestions: action.totalQuestions || state.totalQuestions,
        answer: IDLE_ANSWER,
        result: null,
        reveal: null,
        lockReason: null,
        isPaused: false,
        buzzer: IDLE_BUZZER,
      };
    case 'QUESTION_ACTIVE':
      return {
        ...state,
        screen: 'QUESTION',
        question: action.packet,
        deadline: action.deadline,
        questionIndex: action.packet.questionIndex,
        totalQuestions: action.packet.totalQuestions || state.totalQuestions,
        answer: IDLE_ANSWER,
        isPaused: false,
        pausedRemainingMs: null,
        lockReason: null,
      };
    case 'ANSWER_PENDING':
      return { ...state, answer: { selectedOptionId: action.optionId, status: 'pending', reason: null } };
    case 'ANSWER_CONFIRMED':
      return {
        ...state,
        screen: state.screen === 'QUESTION' ? 'LOCKED' : state.screen,
        answer: { selectedOptionId: action.optionId ?? state.answer.selectedOptionId, status: 'confirmed', reason: null },
      };
    case 'ANSWER_REJECTED': {
      // Retryable rejections put the cards back; final ones lock the screen
      if (action.reason === 'PAUSED' || action.reason === 'NOT_JOINED') {
        return { ...state, answer: IDLE_ANSWER, notice: { tone: 'warn', text: action.reason === 'PAUSED' ? 'Paused by host — answer not sent.' : 'Reconnecting… tap again in a moment.' } };
      }
      if (action.reason === 'ALREADY_SUBMITTED') {
        return { ...state, screen: 'LOCKED', answer: { ...state.answer, status: 'confirmed' } };
      }
      return {
        ...state,
        screen: 'LOCKED',
        answer: { ...state.answer, status: 'rejected', reason: action.reason },
        lockReason: action.reason,
      };
    }
    case 'TIMER_PAUSED':
      return { ...state, isPaused: true, pausedRemainingMs: action.remainingMs };
    case 'TIMER_RESUMED':
      return { ...state, isPaused: false, pausedRemainingMs: null, deadline: action.deadline };
    case 'QUESTION_LOCKED':
      if (state.screen !== 'QUESTION' && state.screen !== 'LOCKED') return state;
      return {
        ...state,
        screen: 'LOCKED',
        isPaused: false,
        lockReason: state.answer.status === 'idle' ? 'TIME_UP' : state.lockReason,
      };
    case 'ANSWER_REVEAL':
      return { ...state, reveal: action.reveal };
    case 'PLAYER_RESULT':
      return {
        ...state,
        screen: 'RESULT',
        result: action.result,
        profile: {
          score: action.result.currentScore,
          rank: action.result.rank,
          totalTeams: action.result.totalTeams,
          streak: action.result.streak,
        },
      };
    case 'LEADERBOARD':
      return { ...state, screen: state.screen === 'FINAL' ? 'FINAL' : 'LEADERBOARD', standing: null };
    case 'PLAYER_RANK':
      return {
        ...state,
        standing: action.standing,
        profile: { ...state.profile, rank: action.standing.rank, totalTeams: action.standing.totalTeams, score: action.standing.score },
      };
    case 'FINAL_PODIUM':
      return { ...state, screen: 'FINAL' };
    case 'FINAL_SUMMARY':
      return { ...state, screen: 'FINAL', finalSummary: action.summary };

    case 'BUZZER_READY': {
      const excluded = (action.payload.excludedTeamIds || []).includes(state.session?.participantId);
      return {
        ...state,
        screen: 'BUZZER',
        buzzer: {
          ...IDLE_BUZZER,
          status: excluded ? 'EXCLUDED' : 'OPEN',
          correctPoints: action.payload.correctPoints ?? 100,
          penaltyPoints: action.payload.penaltyPoints ?? 50,
          verdict: state.buzzer.verdict,
          judgedTeamName: state.buzzer.judgedTeamName,
          deltaPoints: state.buzzer.deltaPoints,
        },
      };
    }
    case 'BUZZ_PENDING':
      return state.buzzer.status === 'OPEN' ? { ...state, buzzer: { ...state.buzzer, status: 'PENDING' } } : state;
    case 'BUZZ_WON':
      return { ...state, screen: 'BUZZER', buzzer: { ...state.buzzer, status: 'WON', reactionTimeMs: action.reactionTimeMs, winnerTeamName: state.session?.teamName } };
    case 'BUZZER_LOCKED': {
      const isMe = String(action.payload.winnerTeamId) === state.session?.participantId;
      if (isMe) {
        return { ...state, screen: 'BUZZER', buzzer: { ...state.buzzer, status: 'WON', reactionTimeMs: action.payload.reactionTimeMs, winnerTeamName: action.payload.winnerTeamName } };
      }
      return {
        ...state,
        screen: 'BUZZER',
        buzzer: {
          ...state.buzzer,
          status: state.buzzer.status === 'EXCLUDED' ? 'EXCLUDED' : 'LOCKED_OUT',
          winnerTeamName: action.payload.winnerTeamName,
          reactionTimeMs: action.payload.reactionTimeMs,
        },
      };
    }
    case 'BUZZ_LOCKOUT': {
      if (action.status === 'NOT_OPEN') return { ...state, buzzer: { ...state.buzzer, status: 'CLOSED' } };
      if (action.status === 'NOT_JOINED') return { ...state, buzzer: { ...state.buzzer, status: 'OPEN' } };
      return {
        ...state,
        buzzer: {
          ...state.buzzer,
          status: action.status === 'EXCLUDED' ? 'EXCLUDED' : 'LOCKED_OUT',
          winnerTeamName: action.winnerTeamName || state.buzzer.winnerTeamName,
        },
      };
    }
    case 'BUZZER_JUDGED':
      return {
        ...state,
        buzzer: {
          ...state.buzzer,
          status: 'JUDGED',
          verdict: action.payload.verdict,
          deltaPoints: action.payload.deltaPoints,
          judgedTeamName: action.payload.teamName,
          isMine: String(action.payload.teamId) === state.session?.participantId,
        },
      };
    case 'BUZZER_CLOSED':
      return { ...state, buzzer: { ...state.buzzer, status: 'CLOSED' } };
    case 'PLAYER_SCORE':
      return {
        ...state,
        profile: { ...state.profile, score: action.payload.currentScore, rank: action.payload.rank, totalTeams: action.payload.totalTeams },
      };
    case 'SCORE_ADJUSTED':
      return { ...state, profile: { ...state.profile, score: action.newScore } };

    case 'NOTICE':
      return { ...state, notice: action.notice };
    case 'CLEAR_NOTICE':
      return { ...state, notice: null };
    default:
      return state;
  }
}

export function usePlayerSession(urlPin) {
  const { socket, connected } = useSocket();
  const { toLocal, observe } = useServerClock(socket, connected);
  const [state, dispatch] = useReducer(reducer, urlPin, createInitialState);
  const [soundMuted, setSoundMutedState] = useReducer((_, v) => v, undefined, loadSoundMuted);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    sound.setMuted(soundMuted);
  }, [soundMuted]);

  // --------------------------------------------------------------------------
  // Session recovery (REL-01): on every (re)connect, re-attach to our team
  // --------------------------------------------------------------------------
  const resumeSession = useCallback(() => {
    const session = stateRef.current.session;
    if (!socket || !session?.sessionToken) return;
    socket.timeout(8000).emit('room:reconnect', { pin: session.pin, sessionToken: session.sessionToken }, (err, ack) => {
      if (err) {
        // Server didn't answer — socket.io will retry on the next reconnect
        dispatch({ type: 'NOTICE', notice: { tone: 'warn', text: 'Server is slow to respond — retrying…' } });
        setTimeout(() => socket.connected && resumeSession(), 2000);
        return;
      }
      observe(ack.serverTime);
      if (ack.success) {
        saveSession({ ...session, participantId: ack.participantId, teamName: ack.participant?.teamName });
        dispatch({ type: 'SESSION_READY', ack: { ...ack, pin: session.pin }, toLocal });
      } else if (ack.reason === 'DISQUALIFIED') {
        clearSession();
        dispatch({ type: 'DISQUALIFIED' });
      } else if (ack.reason === 'SERVER_ERROR') {
        setTimeout(() => socket.connected && resumeSession(), 2000);
      } else {
        clearSession();
        dispatch({ type: 'SESSION_LOST', reason: ack.reason });
      }
    });
  }, [socket, observe, toLocal]);

  useEffect(() => {
    if (!socket) return undefined;
    const onConnect = () => resumeSession();
    socket.on('connect', onConnect);
    if (socket.connected) resumeSession();
    return () => socket.off('connect', onConnect);
  }, [socket, resumeSession]);

  // --------------------------------------------------------------------------
  // Live game events
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return undefined;
    const mine = (id) => String(id) === stateRef.current.session?.participantId;

    const handlers = {
      'sync:countdown': (m) => {
        observe(m.serverTime);
        dispatch({
          type: 'COUNTDOWN',
          endsAt: toLocal(m.serverTimestamp + m.durationMs),
          questionIndex: m.questionIndex,
          totalQuestions: m.totalQuestions,
        });
      },
      'sync:question_active': (packet) => {
        observe(packet.serverTime);
        haptics.questionLive();
        dispatch({ type: 'QUESTION_ACTIVE', packet, deadline: toLocal(packet.serverDeadline) });
      },
      'player:answer_ack': (m) => {
        // Our own ACK is handled by the emit callback; this one is a teammate's device
        if (m.fromTeammate && m.success) dispatch({ type: 'ANSWER_CONFIRMED', optionId: m.selectedOptionId });
      },
      'sync:timer_paused': (m) => dispatch({ type: 'TIMER_PAUSED', remainingMs: m.remainingMs }),
      'sync:timer_resumed': (m) => {
        observe(m.serverTime);
        dispatch({ type: 'TIMER_RESUMED', deadline: toLocal(m.serverDeadline) });
      },
      'sync:question_locked': () => {
        const s = stateRef.current;
        if (s.screen === 'QUESTION' && s.answer.status === 'idle') {
          haptics.timeUp();
          sound.playTimeUp();
        }
        dispatch({ type: 'QUESTION_LOCKED' });
      },
      'sync:answer_reveal': (reveal) => dispatch({ type: 'ANSWER_REVEAL', reveal }),
      'sync:player_result': (result) => {
        if (result.isCorrect) {
          sound.playCorrect();
          haptics.correct();
        } else {
          sound.playWrong();
          haptics.wrong();
        }
        dispatch({ type: 'PLAYER_RESULT', result });
      },
      'sync:leaderboard': () => dispatch({ type: 'LEADERBOARD' }),
      'sync:player_rank': (standing) => dispatch({ type: 'PLAYER_RANK', standing }),
      'sync:final_podium': () => {
        sound.playFanfare();
        dispatch({ type: 'FINAL_PODIUM' });
      },
      'sync:player_final_summary': (summary) => dispatch({ type: 'FINAL_SUMMARY', summary }),

      'sync:buzzer_ready': (payload) => {
        haptics.questionLive();
        dispatch({ type: 'BUZZER_READY', payload });
      },
      'player:buzz_ack': (m) => {
        sound.playBuzzerHit();
        haptics.buzzWon();
        dispatch({ type: 'BUZZ_WON', reactionTimeMs: m.reactionTimeMs });
      },
      'sync:buzzer_locked': (payload) => {
        if (!mine(payload.winnerTeamId)) {
          sound.playBuzzerHit();
          haptics.lockedOut();
        }
        dispatch({ type: 'BUZZER_LOCKED', payload });
      },
      'player:buzz_lockout': (m) => dispatch({ type: 'BUZZ_LOCKOUT', status: m.status, winnerTeamName: m.winnerTeamName }),
      'sync:buzzer_judged': (payload) => {
        if (mine(payload.teamId)) {
          if (payload.verdict === 'CORRECT') { sound.playCorrect(); haptics.correct(); }
          if (payload.verdict === 'WRONG') { sound.playWrong(); haptics.wrong(); }
        }
        dispatch({ type: 'BUZZER_JUDGED', payload });
      },
      'sync:player_score': (payload) => dispatch({ type: 'PLAYER_SCORE', payload }),
      'sync:buzzer_closed': () => dispatch({ type: 'BUZZER_CLOSED' }),

      'sync:score_adjusted': (m) => {
        if (mine(m.participantId)) dispatch({ type: 'SCORE_ADJUSTED', newScore: m.newScore });
      },
      'sync:team_disqualified': (m) => {
        if (mine(m.participantId)) {
          clearSession();
          haptics.wrong();
          dispatch({ type: 'DISQUALIFIED' });
        }
      },
    };

    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));
    return () => Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
  }, [socket, toLocal, observe]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!state.notice) return undefined;
    const id = setTimeout(() => dispatch({ type: 'CLEAR_NOTICE' }), 4000);
    return () => clearTimeout(id);
  }, [state.notice]);

  // --------------------------------------------------------------------------
  // Player actions
  // --------------------------------------------------------------------------
  const join = useCallback((form) => {
    if (!socket) return;
    sound.ensureContext(); // Unlock Web Audio on this user gesture
    dispatch({ type: 'JOIN_START', pin: form.pin });
    socket.timeout(10000).emit('room:join', form, (err, ack) => {
      if (err) {
        dispatch({ type: 'JOIN_FAILED', error: 'TIMEOUT', message: 'The server did not respond. Check your Wi-Fi and try again.' });
        return;
      }
      if (!ack.success) {
        dispatch({ type: 'JOIN_FAILED', error: ack.error, message: ack.message });
        return;
      }
      observe(ack.serverTime);
      saveSession({
        pin: form.pin,
        sessionToken: ack.sessionToken,
        participantId: String(ack.participantId),
        teamName: ack.participant?.teamName,
        institution: ack.participant?.institution,
      });
      haptics.correct();
      dispatch({ type: 'SESSION_READY', ack: { ...ack, pin: form.pin }, toLocal });
    });
  }, [socket, observe, toLocal]);

  const submitAnswer = useCallback((optionId) => {
    const s = stateRef.current;
    if (!socket || s.screen !== 'QUESTION' || s.answer.status !== 'idle' || s.isPaused) return;
    haptics.tap();
    dispatch({ type: 'ANSWER_PENDING', optionId });
    socket.timeout(5000).emit('player:submit_answer', {
      pin: s.session.pin,
      questionId: s.question.questionId,
      selectedOptionId: optionId,
      clientSentAt: Date.now(),
    }, (err, ack) => {
      if (err) {
        // Unknown outcome: ask the server what it recorded
        resumeSession();
        return;
      }
      if (ack.success) dispatch({ type: 'ANSWER_CONFIRMED', optionId });
      else {
        if (ack.reason === 'NOT_JOINED') resumeSession();
        dispatch({ type: 'ANSWER_REJECTED', reason: ack.reason });
      }
    });
  }, [socket, resumeSession]);

  const buzz = useCallback(() => {
    const s = stateRef.current;
    if (!socket || s.buzzer.status !== 'OPEN') return;
    haptics.buzz();
    dispatch({ type: 'BUZZ_PENDING' });
    socket.emit('player:buzz', { pin: s.session.pin, clientTimestamp: Date.now() });
  }, [socket]);

  const leave = useCallback(() => {
    socket?.emit('player:leave');
    clearSession();
    dispatch({ type: 'LEAVE' });
  }, [socket]);

  const setSoundMuted = useCallback((muted) => {
    if (!muted) sound.ensureContext();
    saveSoundMuted(muted);
    setSoundMutedState(muted);
  }, []);

  return {
    state,
    connected,
    soundMuted,
    actions: { join, submitAnswer, buzz, leave, setSoundMuted },
  };
}
