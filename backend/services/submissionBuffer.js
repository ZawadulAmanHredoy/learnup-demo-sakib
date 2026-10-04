/**
 * In-Memory Submission Ingest Buffer (DECISIONS ADR-003, PROOFS §4)
 *
 * While a question is live, answers are validated and recorded here
 * synchronously — no database round-trip — so the contestant gets an ACK in
 * a few milliseconds. The whole batch is drained and persisted in a single
 * bulk write when the question locks.
 *
 * Because `ingest` runs synchronously on Node's single thread, the
 * duplicate check and the insert can never interleave: one answer per team.
 */

const buffers = new Map(); // pin -> buffer

/**
 * Open a fresh buffer for a question, discarding any previous one.
 * @param {string} pin
 * @param {{ questionId: string, optionIds: string[] }} meta
 */
function open(pin, { questionId, optionIds }) {
  const distribution = {};
  optionIds.forEach(id => { distribution[id] = 0; });
  const buffer = {
    questionId: String(questionId),
    optionIds: new Set(optionIds),
    entries: new Map(), // sessionToken -> record
    distribution,
    drained: false,
  };
  buffers.set(pin, buffer);
  return buffer;
}

/**
 * Record an answer. Synchronous check-and-set.
 * @returns {{ ok: true, record: Object } | { ok: false, reason: string }}
 */
function ingest(pin, sessionToken, record) {
  const buffer = buffers.get(pin);
  if (!buffer || buffer.drained) return { ok: false, reason: 'EXPIRED' };
  if (record.questionId && String(record.questionId) !== buffer.questionId) {
    return { ok: false, reason: 'STALE_QUESTION' };
  }
  if (!buffer.optionIds.has(record.selectedOptionId)) {
    return { ok: false, reason: 'INVALID_OPTION' };
  }
  if (buffer.entries.has(sessionToken)) {
    return { ok: false, reason: 'ALREADY_SUBMITTED' };
  }

  buffer.entries.set(sessionToken, record);
  buffer.distribution[record.selectedOptionId] += 1;
  return { ok: true, record };
}

function get(pin, sessionToken) {
  return buffers.get(pin)?.entries.get(sessionToken) || null;
}

function stats(pin) {
  const buffer = buffers.get(pin);
  if (!buffer) return { answeredCount: 0, distribution: {} };
  return {
    answeredCount: buffer.entries.size,
    distribution: { ...buffer.distribution },
  };
}

/**
 * Close the buffer to new answers and hand back every record for persistence.
 * Further `ingest` calls are rejected as EXPIRED.
 */
function drain(pin) {
  const buffer = buffers.get(pin);
  if (!buffer) return [];
  buffer.drained = true;
  return Array.from(buffer.entries.values());
}

function clear(pin) {
  buffers.delete(pin);
}

module.exports = {
  open,
  ingest,
  get,
  stats,
  drain,
  clear,
};
