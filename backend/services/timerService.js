/**
 * Authoritative Server Countdown Timer (TechSpec §3.2, DECISIONS ADR-004)
 *
 * The countdown lives only on the server. Clients receive `serverDeadline` plus
 * `serverTime` and render against their measured clock offset (PROOFS §3), so a
 * tampered device clock cannot buy extra time.
 *
 * Supports pause/resume: paused time is excluded from a team's response time.
 */

const timers = new Map(); // pin -> timer state

function now() {
  return Date.now();
}

function schedule(state) {
  clearTimeout(state.handle);
  const delay = Math.max(0, state.deadline - now());
  state.handle = setTimeout(() => {
    state.status = 'EXPIRED';
    state.onExpire?.();
  }, delay);
}

/**
 * Start a countdown for a room. Replaces any running timer.
 * @returns {{ startedAt: number, deadline: number, durationMs: number }}
 */
function start(pin, durationMs, onExpire) {
  clear(pin);
  const startedAt = now();
  const state = {
    status: 'RUNNING',
    durationMs,
    startedAt,
    deadline: startedAt + durationMs,
    pausedAt: null,
    pausedTotalMs: 0,
    remainingAtPauseMs: null,
    onExpire,
    handle: null,
  };
  timers.set(pin, state);
  schedule(state);
  return { startedAt, deadline: state.deadline, durationMs };
}

/** Freeze the countdown. Returns the remaining ms, or null if nothing was running. */
function pause(pin) {
  const state = timers.get(pin);
  if (!state || state.status !== 'RUNNING') return null;
  clearTimeout(state.handle);
  state.status = 'PAUSED';
  state.pausedAt = now();
  state.remainingAtPauseMs = Math.max(0, state.deadline - state.pausedAt);
  return { remainingMs: state.remainingAtPauseMs };
}

/** Resume a paused countdown. Returns the new deadline. */
function resume(pin) {
  const state = timers.get(pin);
  if (!state || state.status !== 'PAUSED') return null;
  const t = now();
  state.pausedTotalMs += t - state.pausedAt;
  state.deadline = t + state.remainingAtPauseMs;
  state.pausedAt = null;
  state.remainingAtPauseMs = null;
  state.status = 'RUNNING';
  schedule(state);
  return { deadline: state.deadline, remainingMs: state.deadline - t };
}

/**
 * Milliseconds the question has been live at time `at`, excluding pauses.
 * This is T_response for the scoring formula.
 */
function activeElapsedMs(pin, at = now()) {
  const state = timers.get(pin);
  if (!state) return null;
  const pausedNow = state.status === 'PAUSED' ? at - state.pausedAt : 0;
  return Math.max(0, at - state.startedAt - state.pausedTotalMs - pausedNow);
}

function snapshot(pin, at = now()) {
  const state = timers.get(pin);
  if (!state) return null;
  const remainingMs = state.status === 'PAUSED'
    ? state.remainingAtPauseMs
    : Math.max(0, state.deadline - at);
  return {
    status: state.status,
    startedAt: state.startedAt,
    deadline: state.deadline,
    durationMs: state.durationMs,
    remainingMs,
  };
}

/** Stop the countdown without firing onExpire. Keeps elapsed-time bookkeeping. */
function stop(pin) {
  const state = timers.get(pin);
  if (!state) return;
  clearTimeout(state.handle);
  if (state.status === 'RUNNING' || state.status === 'PAUSED') {
    if (state.status === 'PAUSED') state.pausedTotalMs += now() - state.pausedAt;
    state.status = 'STOPPED';
  }
}

function clear(pin) {
  const state = timers.get(pin);
  if (state) clearTimeout(state.handle);
  timers.delete(pin);
}

module.exports = {
  start,
  pause,
  resume,
  stop,
  clear,
  activeElapsedMs,
  snapshot,
};
