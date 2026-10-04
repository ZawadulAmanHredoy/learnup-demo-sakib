/**
 * Atomic Buzzer Lockout Engine (AppFlow §4.1, Rules §2.4, DECISIONS ADR-005, PROOFS §2)
 *
 * `tryBuzz` is fully synchronous: the check of `status === 'OPEN'` and the
 * transition to `LOCKED` happen in one tick of Node's event loop, so exactly
 * one team can ever win a buzzer window — no matter how many packets arrive
 * in the same millisecond. (For a multi-instance deployment, the same
 * contract maps onto Redis `SET room:{pin}:buzzer_lock <team> NX PX 10000`.)
 *
 * Teams that answered wrong (or passed) are excluded when the host re-opens
 * the buzzer, so the remaining teams get their chance.
 */

const DEFAULT_CORRECT_POINTS = 100;
const DEFAULT_PENALTY_POINTS = 50;

const buzzers = new Map(); // pin -> state

/**
 * Open (or re-open) the buzzer for a room.
 * Re-opening the same question keeps the excluded-team list.
 */
function open(pin, { questionId = null, correctPoints, penaltyPoints } = {}) {
  const previous = buzzers.get(pin);
  const sameQuestion = previous && String(previous.questionId) === String(questionId);
  const state = {
    status: 'OPEN',
    roundId: (previous?.roundId || 0) + 1,
    questionId,
    openedAt: Date.now(),
    correctPoints: correctPoints ?? previous?.correctPoints ?? DEFAULT_CORRECT_POINTS,
    penaltyPoints: penaltyPoints ?? previous?.penaltyPoints ?? DEFAULT_PENALTY_POINTS,
    excluded: sameQuestion ? previous.excluded : new Set(),
    winner: null,
    lockedOutCount: 0,
  };
  buzzers.set(pin, state);
  return state;
}

/**
 * Attempt to acquire the buzzer lock. SYNCHRONOUS — do not add awaits.
 * @param {string} pin
 * @param {{ participantId: string, teamName: string, isDisqualified?: boolean }} session
 * @param {number} [at] server receive time
 * @returns {{ status: 'WINNER'|'LOCKED_OUT'|'NOT_OPEN'|'EXCLUDED', winner?: Object, reactionTimeMs?: number }}
 */
function tryBuzz(pin, session, at = Date.now()) {
  const state = buzzers.get(pin);
  if (!state || state.status === 'CLOSED' || state.status === 'IDLE') {
    return { status: 'NOT_OPEN' };
  }
  if (session.isDisqualified || state.excluded.has(session.participantId)) {
    return { status: 'EXCLUDED', winner: state.winner };
  }
  if (state.status !== 'OPEN') {
    state.lockedOutCount += 1;
    return { status: 'LOCKED_OUT', winner: state.winner };
  }

  // ---- atomic acquire ----
  state.status = 'LOCKED';
  state.winner = {
    participantId: session.participantId,
    teamName: session.teamName,
    reactionTimeMs: at - state.openedAt,
    lockedAt: at,
  };
  return { status: 'WINNER', winner: state.winner, reactionTimeMs: state.winner.reactionTimeMs };
}

/**
 * Apply the host's verdict on the team holding the floor.
 * @param {'CORRECT'|'WRONG'|'PASS'} verdict
 * @returns {{ deltaPoints: number, outcome: string, shouldReopen: boolean } | null}
 */
function judge(pin, participantId, verdict) {
  const state = buzzers.get(pin);
  if (!state) return null;

  let deltaPoints = 0;
  let outcome = 'PASSED_NO_PENALTY';
  if (verdict === 'CORRECT') {
    deltaPoints = state.correctPoints;
    outcome = 'CORRECT_APPROVED';
  } else if (verdict === 'WRONG') {
    deltaPoints = -state.penaltyPoints;
    outcome = 'WRONG_PENALIZED';
  }

  if (participantId && verdict !== 'CORRECT') {
    state.excluded.add(String(participantId));
  }
  state.status = verdict === 'CORRECT' ? 'CLOSED' : 'JUDGED';
  state.winner = null;

  return { deltaPoints, outcome, shouldReopen: verdict !== 'CORRECT' };
}

function close(pin) {
  const state = buzzers.get(pin);
  if (state) {
    state.status = 'CLOSED';
    state.winner = null;
  }
}

/** Per-team view of the buzzer, used for reconnect hydration. */
function snapshot(pin, participantId) {
  const state = buzzers.get(pin);
  if (!state) return null;
  return {
    status: state.status,
    questionId: state.questionId,
    openedAt: state.openedAt,
    winner: state.winner
      ? {
          winnerTeamId: state.winner.participantId,
          winnerTeamName: state.winner.teamName,
          reactionTimeMs: state.winner.reactionTimeMs,
        }
      : null,
    isExcluded: participantId ? state.excluded.has(String(participantId)) : false,
    penaltyPoints: state.penaltyPoints,
    correctPoints: state.correctPoints,
  };
}

function excludedIds(pin) {
  const state = buzzers.get(pin);
  return state ? Array.from(state.excluded) : [];
}

function clear(pin) {
  buzzers.delete(pin);
}

module.exports = {
  open,
  tryBuzz,
  judge,
  close,
  snapshot,
  excludedIds,
  clear,
  DEFAULT_CORRECT_POINTS,
  DEFAULT_PENALTY_POINTS,
};
