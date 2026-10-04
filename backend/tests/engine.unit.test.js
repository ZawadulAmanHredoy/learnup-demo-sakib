const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { calculateScore, rankParticipants, applyDelta } = require('../services/scoringService');
const submissionBuffer = require('../services/submissionBuffer');
const buzzer = require('../services/buzzerService');
const timer = require('../services/timerService');

describe('scoringService', () => {
  test('matches the worked example in Rules.md §1.1 (920 × 1.2 = 1104)', () => {
    const r = calculateScore({
      isCorrect: true,
      timeTakenMs: 3200,
      timeLimitSec: 20,
      basePoints: 1000,
      currentStreak: 2, // this answer is the 3rd in a row
    });
    assert.equal(r.totalPointsAwarded, 1104);
    assert.equal(r.newStreak, 3);
    assert.equal(r.multiplier, 1.2);
    assert.equal(r.badge, '⚡ Super Streak');
  });

  test('breakdown is additive: base + speed + streak = total', () => {
    const r = calculateScore({ isCorrect: true, timeTakenMs: 5000, timeLimitSec: 20, basePoints: 1000, currentStreak: 5 });
    assert.equal(r.basePoints + r.speedBonusPoints + r.streakBonusPoints, r.totalPointsAwarded);
  });

  test('answer at the time limit earns half the base points', () => {
    const r = calculateScore({ isCorrect: true, timeTakenMs: 99999, timeLimitSec: 20, basePoints: 1000 });
    assert.equal(r.totalPointsAwarded, 500);
    assert.equal(r.speedBonusPoints, 0);
  });

  test('speed bonus disabled awards full base points', () => {
    const r = calculateScore({ isCorrect: true, timeTakenMs: 15000, basePoints: 1000, speedBonusEnabled: false });
    assert.equal(r.totalPointsAwarded, 1000);
  });

  test('wrong answer with negative marking deducts 50% and resets streak', () => {
    const r = calculateScore({ isCorrect: false, timeTakenMs: 1000, basePoints: 100, negativeMarking: true, currentStreak: 4 });
    assert.equal(r.totalPointsAwarded, -50);
    assert.equal(r.newStreak, 0);
  });

  test('wrong answer without negative marking scores 0', () => {
    const r = calculateScore({ isCorrect: false, timeTakenMs: 1000, basePoints: 100, negativeMarking: false });
    assert.equal(r.totalPointsAwarded, 0);
  });

  test('score never drops below zero', () => {
    assert.equal(applyDelta(30, -50), 0);
    assert.equal(applyDelta(100, -50), 50);
  });

  test('tie-break: accuracy, then cumulative time, then best single score', () => {
    const ranked = rankParticipants([
      { _id: 'a', totalScore: 900, correctAnswersCount: 2, cumulativeResponseTimeMs: 5000, bestQuestionScore: 500 },
      { _id: 'b', totalScore: 900, correctAnswersCount: 3, cumulativeResponseTimeMs: 9000, bestQuestionScore: 300 },
      { _id: 'c', totalScore: 900, correctAnswersCount: 2, cumulativeResponseTimeMs: 4000, bestQuestionScore: 400 },
      { _id: 'd', totalScore: 900, correctAnswersCount: 2, cumulativeResponseTimeMs: 4000, bestQuestionScore: 450 },
      { _id: 'e', totalScore: 1200 },
      { _id: 'x', totalScore: 5000, isDisqualified: true },
    ]);
    assert.deepEqual(ranked.map(p => p._id), ['e', 'b', 'd', 'c', 'a']);
    assert.deepEqual(ranked.map(p => p.rank), [1, 2, 3, 4, 5]);
  });
});

describe('submissionBuffer', () => {
  const pin = '100001';

  test('accepts one answer per team and tracks distribution', () => {
    submissionBuffer.open(pin, { questionId: 'q1', optionIds: ['a', 'b'] });
    assert.equal(submissionBuffer.ingest(pin, 't1', { questionId: 'q1', selectedOptionId: 'a' }).ok, true);
    const dup = submissionBuffer.ingest(pin, 't1', { questionId: 'q1', selectedOptionId: 'b' });
    assert.deepEqual(dup, { ok: false, reason: 'ALREADY_SUBMITTED' });
    assert.equal(submissionBuffer.ingest(pin, 't2', { questionId: 'q1', selectedOptionId: 'a' }).ok, true);
    assert.deepEqual(submissionBuffer.stats(pin), { answeredCount: 2, distribution: { a: 2, b: 0 } });
  });

  test('rejects unknown options and stale questions', () => {
    submissionBuffer.open(pin, { questionId: 'q2', optionIds: ['a', 'b'] });
    assert.equal(submissionBuffer.ingest(pin, 't1', { questionId: 'q2', selectedOptionId: 'zzz' }).reason, 'INVALID_OPTION');
    assert.equal(submissionBuffer.ingest(pin, 't1', { questionId: 'q1', selectedOptionId: 'a' }).reason, 'STALE_QUESTION');
  });

  test('drain closes the buffer to further answers', () => {
    submissionBuffer.open(pin, { questionId: 'q3', optionIds: ['a'] });
    submissionBuffer.ingest(pin, 't1', { questionId: 'q3', selectedOptionId: 'a' });
    assert.equal(submissionBuffer.drain(pin).length, 1);
    assert.equal(submissionBuffer.ingest(pin, 't2', { questionId: 'q3', selectedOptionId: 'a' }).reason, 'EXPIRED');
    // Drained entries stay readable for reconnect hydration
    assert.equal(submissionBuffer.get(pin, 't1').selectedOptionId, 'a');
  });
});

describe('buzzerService (atomic lockout)', () => {
  const pin = '200002';
  const team = (id) => ({ participantId: id, teamName: `Team ${id}` });

  test('exactly one winner out of 100 simultaneous buzzes (PROOFS §2)', () => {
    buzzer.open(pin, { questionId: 'bq1' });
    const results = [];
    for (let i = 1; i <= 100; i++) results.push(buzzer.tryBuzz(pin, team(`t${i}`)));
    assert.equal(results.filter(r => r.status === 'WINNER').length, 1);
    assert.equal(results.filter(r => r.status === 'LOCKED_OUT').length, 99);
    assert.equal(results[0].status, 'WINNER');
    assert.equal(results[50].winner.teamName, 'Team t1');
  });

  test('wrong answer penalises, excludes the team and allows re-open for the rest', () => {
    buzzer.open(pin, { questionId: 'bq2', correctPoints: 100, penaltyPoints: 50 });
    buzzer.tryBuzz(pin, team('t1'));
    const verdict = buzzer.judge(pin, 't1', 'WRONG');
    assert.deepEqual(verdict, { deltaPoints: -50, outcome: 'WRONG_PENALIZED', shouldReopen: true });

    buzzer.open(pin, { questionId: 'bq2' });
    assert.equal(buzzer.tryBuzz(pin, team('t1')).status, 'EXCLUDED');
    assert.equal(buzzer.tryBuzz(pin, team('t2')).status, 'WINNER');
    assert.equal(buzzer.judge(pin, 't2', 'CORRECT').deltaPoints, 100);
    assert.equal(buzzer.tryBuzz(pin, team('t3')).status, 'NOT_OPEN');
  });

  test('a new question clears the excluded list', () => {
    buzzer.open(pin, { questionId: 'bq3' });
    buzzer.tryBuzz(pin, team('t1'));
    buzzer.judge(pin, 't1', 'PASS');
    buzzer.open(pin, { questionId: 'bq4' });
    assert.equal(buzzer.tryBuzz(pin, team('t1')).status, 'WINNER');
  });

  test('disqualified teams cannot buzz', () => {
    buzzer.open(pin, { questionId: 'bq5' });
    assert.equal(buzzer.tryBuzz(pin, { ...team('t9'), isDisqualified: true }).status, 'EXCLUDED');
  });
});

describe('timerService (authoritative countdown)', () => {
  test('fires onExpire at the deadline', async () => {
    let fired = false;
    const { deadline, startedAt } = timer.start('300003', 50, () => { fired = true; });
    assert.equal(deadline - startedAt, 50);
    await new Promise(r => setTimeout(r, 90));
    assert.equal(fired, true);
    timer.clear('300003');
  });

  test('pause freezes remaining time and is excluded from response time', async () => {
    const pin = '300004';
    let fired = false;
    timer.start(pin, 200, () => { fired = true; });
    await new Promise(r => setTimeout(r, 40));
    const paused = timer.pause(pin);
    assert.ok(paused.remainingMs <= 165 && paused.remainingMs >= 140, `remaining ${paused.remainingMs}`);
    await new Promise(r => setTimeout(r, 250));
    assert.equal(fired, false, 'must not expire while paused');
    const elapsedWhilePaused = timer.activeElapsedMs(pin);
    assert.ok(elapsedWhilePaused < 70, `elapsed ${elapsedWhilePaused}`);

    const resumed = timer.resume(pin);
    assert.ok(Math.abs(resumed.remainingMs - paused.remainingMs) <= 2);
    await new Promise(r => setTimeout(r, paused.remainingMs + 40));
    assert.equal(fired, true);
    timer.clear(pin);
  });

  test('stop prevents expiry', async () => {
    let fired = false;
    timer.start('300005', 30, () => { fired = true; });
    timer.stop('300005');
    await new Promise(r => setTimeout(r, 60));
    assert.equal(fired, false);
    timer.clear('300005');
  });
});
