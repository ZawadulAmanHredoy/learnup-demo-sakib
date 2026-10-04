/**
 * End-to-end test of the Developer 2 slice over real Socket.IO connections:
 * registration, anti-cheat payloads, ingest buffer, grace window, scoring,
 * private results, reconnection, pause/resume, buzzer lockout, disqualification.
 *
 * Runs against the in-memory store (MONGODB_URI is blanked).
 */
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');

const { server, io, startServer } = require('../server');
const storageService = require('../services/storageService');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let baseUrl;
let pin;
let quiz;
const sockets = [];

function connect() {
  const s = ioClient(baseUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

function waitFor(socket, event, { predicate = () => true, timeout = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

/** Resolves true if the event arrives within `ms`, false otherwise. */
function receivesWithin(socket, event, ms) {
  return waitFor(socket, event, { timeout: ms }).then(() => true, () => false);
}

function emitAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

async function join(teamName, extra = {}) {
  const s = await connect();
  const res = await emitAck(s, 'room:join', {
    pin,
    teamName,
    institution: 'BUFT CSE',
    captainName: `${teamName} Captain`,
    contactPhone: '+8801700000000',
    ...extra,
  });
  return { socket: s, res };
}

async function startQuestion(host, players, questionIndex) {
  const actives = players.map(p => waitFor(p.socket, 'sync:question_active', { timeout: 8000 }));
  host.emit('host:start_question', { pin, questionIndex });
  return Promise.all(actives);
}

const optionIdOf = (question, correct) => question.options.find(o => o.isCorrect === correct).id;

before(async () => {
  await startServer(0);
  baseUrl = `http://localhost:${server.address().port}`;

  quiz = await storageService.createQuiz({
    title: 'Integration Quiz',
    roundType: 'TEAM_MCQ',
    speedBonusEnabled: true,
    negativeMarkingRatio: 0.5,
    createdBy: 'usr_admin_001',
  });
  const mk = (orderIndex, extra = {}) => storageService.addQuestion(quiz._id, {
    orderIndex,
    questionText: `Question ${orderIndex}?`,
    type: 'MCQ',
    segment: 'GENERAL',
    media: { type: 'NONE', url: null, durationSec: 10 },
    options: [
      { id: 'opt_a', text: 'Alpha', isCorrect: false },
      { id: 'opt_b', text: 'Bravo', isCorrect: true },
      { id: 'opt_c', text: 'Charlie', isCorrect: false },
      { id: 'opt_d', text: 'Delta', isCorrect: false },
    ],
    timeLimitSec: 10,
    points: 1000,
    negativeMarking: true,
    explanation: 'Bravo is right.',
    ...extra,
  });
  await mk(1);
  await mk(2);
  await mk(3, { timeLimitSec: 1 });
  await mk(4, { type: 'BUZZER', points: 100 });
  quiz = await storageService.getQuizById(quiz._id);

  pin = '987654';
  await storageService.createRoom({
    pin,
    quizId: quiz._id,
    hostId: 'usr_admin_001',
    status: 'LOBBY',
    currentQuestionIndex: 0,
    settings: { speedBonus: true, allowLateJoin: true, maxTeams: 200 },
  });
});

after(() => {
  sockets.forEach(s => s.disconnect());
  io.close();
  server.close();
});

test('full player journey', async (t) => {
  const host = await connect();
  host.emit('room:join_host', { pin });
  await waitFor(host, 'host:init_state');

  const stage = await connect();
  stage.emit('room:join_stage', { pin });
  const stageInit = await waitFor(stage, 'stage:init_state');
  assert.equal(stageInit.participants.length, 0);

  let falcon; let knights; let ninjas; let squad;

  await t.test('registration validates input and issues a UUID v4 session token', async () => {
    const bad = await join('X');
    assert.equal(bad.res.success, false);
    assert.equal(bad.res.error, 'INVALID_TEAMNAME');

    const badPin = await connect();
    const r = await emitAck(badPin, 'room:join', { pin: '12ab', teamName: 'Team', institution: 'BUFT' });
    assert.equal(r.error, 'INVALID_PIN');

    const missing = await connect();
    const r2 = await emitAck(missing, 'room:join', { pin: '111111', teamName: 'Team Ghost', institution: 'BUFT' });
    assert.equal(r2.error, 'ROOM_NOT_FOUND');

    falcon = await join('Team Falcon');
    assert.equal(falcon.res.success, true);
    assert.match(falcon.res.sessionToken, UUID_V4);
    assert.equal(falcon.res.participant.teamName, 'Team Falcon');
    assert.equal(falcon.res.participant.contactPhone, undefined, 'phone is not echoed back');

    knights = await join('Cyber Knights');
    ninjas = await join('Neural Ninjas');
    assert.equal(knights.res.success && ninjas.res.success, true);
  });

  await t.test('duplicate team names are rejected, even when racing', async () => {
    const dup = await join('team falcon');
    assert.equal(dup.res.error, 'TEAM_NAME_TAKEN');

    const [a, b] = await Promise.all([join('Syntax Squad'), join('SYNTAX SQUAD')]);
    const wins = [a, b].filter(x => x.res.success);
    assert.equal(wins.length, 1);
    squad = wins[0];
  });

  await t.test('host and stage get a sanitized player list', async () => {
    const list = await waitFor(host, 'room:player_list', { predicate: l => l.totalCount === 4 });
    assert.equal(list.participants.length, 4);
    assert.equal(JSON.stringify(list).includes('sessionToken'), false);
    await waitFor(stage, 'room:player_list', { predicate: l => l.totalCount === 4 });
  });

  await t.test('public room state never exposes answer keys or session tokens', async () => {
    const res = await fetch(`${baseUrl}/api/rooms/${pin}/state`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.equal(body.includes('isCorrect'), false);
    assert.equal(body.includes(falcon.res.sessionToken), false);
    assert.equal(body.includes('Bravo is right'), false);
  });

  const players = () => [falcon, knights, ninjas, squad];
  const q0 = () => quiz.questions[0];

  await t.test('countdown then a sanitized question with an authoritative deadline', async () => {
    const countdown = waitFor(falcon.socket, 'sync:countdown');
    const actives = startQuestion(host, players(), 0);
    const cd = await countdown;
    assert.equal(cd.durationMs, 3000);
    assert.equal(typeof cd.serverTime, 'number');

    const [packet] = await actives;
    const raw = JSON.stringify(packet);
    assert.equal(raw.includes('isCorrect'), false);
    assert.equal(raw.includes('explanation'), false);
    assert.equal(packet.serverDeadline - packet.serverStartTime, 10000);
    assert.equal(packet.options.length, 4);
  });

  await t.test('ingest buffer ACKs immediately and enforces one answer per team', async () => {
    const correct = optionIdOf(q0(), true);
    const wrong = optionIdOf(q0(), false);

    const telemetry = waitFor(host, 'host:live_telemetry', { predicate: m => m.answeredCount === 1 });
    const playerSawTelemetry = receivesWithin(knights.socket, 'host:live_telemetry', 300);

    const t0 = Date.now();
    const ack = await emitAck(falcon.socket, 'player:submit_answer', { pin, questionId: q0()._id, selectedOptionId: correct, clientSentAt: Date.now() });
    assert.equal(ack.success, true);
    assert.ok(Date.now() - t0 < 100, 'ACK should be near-instant');

    const t1 = await telemetry;
    assert.equal(t1.totalCount, 4);
    assert.equal(await playerSawTelemetry, false, 'players must not see the live distribution');

    const dup = await emitAck(falcon.socket, 'player:submit_answer', { pin, questionId: q0()._id, selectedOptionId: wrong });
    assert.equal(dup.reason, 'ALREADY_SUBMITTED');

    const bogus = await emitAck(knights.socket, 'player:submit_answer', { pin, questionId: q0()._id, selectedOptionId: 'opt_z' });
    assert.equal(bogus.reason, 'INVALID_OPTION');

    const stranger = await connect();
    const nj = await emitAck(stranger, 'player:submit_answer', { pin, sessionToken: falcon.res.sessionToken, selectedOptionId: correct });
    assert.equal(nj.reason, 'NOT_JOINED', 'a token in the payload is not enough to answer for a team');

    const k = await emitAck(knights.socket, 'player:submit_answer', { pin, questionId: q0()._id, selectedOptionId: wrong });
    assert.equal(k.success, true);
  });

  await t.test('reconnect mid-question restores the exact screen state', async () => {
    const again = await connect();
    const res = await emitAck(again, 'room:reconnect', { pin, sessionToken: falcon.res.sessionToken });
    assert.equal(res.success, true);
    assert.equal(res.snapshot.phase, 'ACTIVE');
    assert.equal(res.snapshot.hasAnswered, true);
    assert.equal(res.snapshot.selectedOptionId, optionIdOf(q0(), true));
    assert.ok(res.snapshot.remainingMs > 0 && res.snapshot.remainingMs <= 10000);
    assert.equal(JSON.stringify(res).includes('isCorrect'), false);

    const ninjaRe = await connect();
    const nres = await emitAck(ninjaRe, 'room:reconnect', { pin, sessionToken: ninjas.res.sessionToken });
    assert.equal(nres.snapshot.hasAnswered, false);
    assert.equal(nres.snapshot.question.questionText, q0().questionText);

    const bad = await emitAck(again, 'room:reconnect', { pin, sessionToken: 'not-a-token' });
    assert.equal(bad.reason, 'SESSION_NOT_FOUND');
    again.disconnect();
    ninjaRe.disconnect();
  });

  await t.test('host lock keeps a 1s grace window, then rejects late packets as EXPIRED', async () => {
    const locked = waitFor(ninjas.socket, 'sync:question_locked');
    host.emit('host:lock_question', { pin });
    const lockMsg = await locked;
    assert.equal(lockMsg.reason, 'HOST_LOCK');

    const inGrace = await emitAck(ninjas.socket, 'player:submit_answer', { pin, questionId: q0()._id, selectedOptionId: optionIdOf(q0(), true) });
    assert.equal(inGrace.success, true, 'packet in flight during lock is accepted');

    await new Promise(r => setTimeout(r, 1100));
    const late = await emitAck(squad.socket, 'player:submit_answer', { pin, questionId: q0()._id, selectedOptionId: optionIdOf(q0(), true) });
    assert.deepEqual(late, { success: false, reason: 'EXPIRED' });
  });

  await t.test('reveal sends each team only its own result', async () => {
    const results = players().map(p => waitFor(p.socket, 'sync:player_result'));
    const reveal = waitFor(stage, 'sync:answer_reveal');
    host.emit('host:reveal_answer', { pin });

    const rv = await reveal;
    assert.equal(rv.correctOptionId, optionIdOf(q0(), true));
    assert.equal(rv.totalAnswers, 3);
    assert.equal(rv.fastestTeam.name, 'Team Falcon');

    const [f, k, n, s] = await Promise.all(results);
    assert.equal(f.isCorrect, true);
    assert.ok(f.pointsEarned > 500 && f.pointsEarned <= 1000);
    assert.equal(f.basePoints + f.speedBonus + f.streakBonus, f.pointsEarned);
    assert.equal(f.streak, 1);
    assert.equal(f.rank, 1);
    assert.equal(f.totalTeams, 4);

    assert.equal(k.isCorrect, false);
    assert.equal(k.pointsEarned, -500, 'negative marking 50%');
    assert.equal(k.currentScore, 0, 'score floors at 0');
    assert.equal(k.correctOptionId, optionIdOf(q0(), true));

    assert.equal(n.isCorrect, true);
    assert.ok(n.pointsEarned < f.pointsEarned, 'slower correct answer earns less');
    assert.equal(n.rank, 2);

    assert.equal(s.missed, true);
    assert.equal(s.pointsEarned, 0);
  });

  await t.test('leaderboard pushes a private rank banner', async () => {
    const rank = waitFor(falcon.socket, 'sync:player_rank');
    host.emit('host:show_leaderboard', { pin });
    const r = await rank;
    assert.equal(r.rank, 1);
    assert.equal(r.totalTeams, 4);
    assert.equal(r.isLastQuestion, false);
  });

  await t.test('pause freezes the timer and blocks answers; resume extends the deadline', async () => {
    const [packet] = await startQuestion(host, players(), 1);
    const paused = waitFor(falcon.socket, 'sync:timer_paused');
    host.emit('host:pause_timer', { pin });
    const p = await paused;
    assert.ok(p.remainingMs > 0 && p.remainingMs <= 10000);

    const blocked = await emitAck(falcon.socket, 'player:submit_answer', { pin, questionId: packet.questionId, selectedOptionId: 'opt_b' });
    assert.equal(blocked.reason, 'PAUSED');

    await new Promise(r => setTimeout(r, 400));
    const resumed = waitFor(falcon.socket, 'sync:timer_resumed');
    host.emit('host:resume_timer', { pin });
    const rs = await resumed;
    assert.ok(rs.serverDeadline >= packet.serverDeadline + 350, 'deadline pushed back by the pause');
  });

  await t.test('all teams answered → automatic early lock', async () => {
    const locked = waitFor(host, 'sync:question_locked');
    for (const p of players()) {
      await emitAck(p.socket, 'player:submit_answer', { pin, selectedOptionId: 'opt_b' });
    }
    const msg = await locked;
    assert.equal(msg.reason, 'ALL_ANSWERED');

    const results = players().map(p => waitFor(p.socket, 'sync:player_result'));
    host.emit('host:reveal_answer', { pin });
    const [f] = await Promise.all(results);
    assert.equal(f.streak, 2);
    assert.equal(f.badge, '🔥 On Fire');
  });

  await t.test('server timer auto-locks when the countdown reaches zero', async () => {
    await startQuestion(host, players(), 2); // 1-second question
    const locked = await waitFor(falcon.socket, 'sync:question_locked', { timeout: 3000 });
    assert.equal(locked.reason, 'TIME_UP');
  });

  await t.test('buzzer: exactly one team wins a simultaneous burst', async () => {
    const buzzerQ = quiz.questions[3];
    const ready = waitFor(falcon.socket, 'sync:buzzer_ready');
    host.emit('host:activate_buzzer', { pin, questionId: buzzerQ._id });
    const rd = await ready;
    assert.equal(rd.correctPoints, 100);
    assert.equal(rd.penaltyPoints, 50);

    const locked = waitFor(stage, 'sync:buzzer_locked');
    const outcomes = players().map(p => Promise.race([
      waitFor(p.socket, 'player:buzz_ack').then(() => 'WINNER'),
      waitFor(p.socket, 'player:buzz_lockout').then(m => m.status),
    ]));
    players().forEach(p => p.socket.emit('player:buzz', { pin }));

    const statuses = await Promise.all(outcomes);
    assert.equal(statuses.filter(s => s === 'WINNER').length, 1);
    assert.equal(statuses.filter(s => s === 'LOCKED_OUT').length, 3);

    const lk = await locked;
    assert.equal(typeof lk.reactionTimeMs, 'number');
    t.winnerName = lk.winnerTeamName;
  });

  await t.test('buzzer: WRONG penalises, re-opens without that team; CORRECT awards points', async () => {
    const winner = players().find(p => p.res.participant.teamName === t.winnerName);
    const others = players().filter(p => p !== winner);

    const before = (await storageService.getParticipantsByPin(pin)).find(p => p.teamName === t.winnerName).totalScore;
    const score = waitFor(winner.socket, 'sync:player_score');
    const reopened = waitFor(others[0].socket, 'sync:buzzer_ready', { predicate: m => m.reOpened });
    host.emit('host:judge_buzzer', { pin, verdict: 'WRONG' });
    const sc = await score;
    assert.equal(sc.deltaPoints, -50);
    assert.equal(sc.currentScore, Math.max(0, before - 50));
    const ro = await reopened;
    assert.ok(ro.excludedTeamIds.includes(String(winner.res.participantId)));

    const excluded = waitFor(winner.socket, 'player:buzz_lockout');
    winner.socket.emit('player:buzz', { pin });
    assert.equal((await excluded).status, 'EXCLUDED');

    const ack = waitFor(others[0].socket, 'player:buzz_ack');
    others[0].socket.emit('player:buzz', { pin });
    await ack;

    const good = waitFor(others[0].socket, 'sync:player_score');
    host.emit('host:judge_buzzer', { pin, verdict: 'CORRECT' });
    assert.equal((await good).deltaPoints, 100);
  });

  await t.test('disqualified team is locked out and cannot recover its session', async () => {
    const notice = waitFor(squad.socket, 'sync:team_disqualified');
    host.emit('host:emergency_action', { pin, action: 'KICK_TEAM', targetParticipantId: squad.res.participantId });
    const dq = await notice;
    assert.equal(String(dq.participantId), String(squad.res.participantId));

    const back = await connect();
    const res = await emitAck(back, 'room:reconnect', { pin, sessionToken: squad.res.sessionToken });
    assert.equal(res.success, false);
    assert.equal(res.reason, 'DISQUALIFIED');
  });

  await t.test('submissions are persisted with the bulk flush', async () => {
    const subs = await storageService.getSubmissionsByPin(pin);
    assert.ok(subs.length >= 7, `expected persisted submissions, got ${subs.length}`);
    assert.ok(subs.every(s => s.pin === pin && s.participantId && typeof s.timeTakenMs === 'number'));
  });

  await t.test('last leaderboard delivers the final summary', async () => {
    await storageService.updateRoomByPin(pin, { currentQuestionIndex: quiz.questions.length - 1 });
    const summary = waitFor(falcon.socket, 'sync:player_final_summary');
    host.emit('host:show_leaderboard', { pin });
    const s = await summary;
    assert.equal(s.teamName, 'Team Falcon');
    assert.equal(s.totalQuestions, 4);
    assert.ok(s.correct >= 2);
    assert.ok(s.accuracyPct > 0 && s.accuracyPct <= 100);
    assert.ok(s.rank >= 1);
  });
});
