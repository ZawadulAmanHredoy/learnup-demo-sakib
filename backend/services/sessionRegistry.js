/**
 * Live Session Registry (Schema.md §3 — `session:{sessionToken}`)
 *
 * In-memory map of sessionToken -> participant identity for every live room.
 * Hot paths (answer ingest, buzzer lock) read from here synchronously so that
 * they never wait on MongoDB and cannot interleave with another request.
 */

const rooms = new Map(); // pin -> Map(sessionToken -> session)

function toSession(participant) {
  return {
    participantId: String(participant._id),
    sessionToken: participant.sessionToken,
    teamName: participant.teamName,
    institution: participant.institution,
    currentStreak: participant.currentStreak || 0,
    isDisqualified: !!participant.isDisqualified,
  };
}

function roomSessions(pin) {
  if (!rooms.has(pin)) rooms.set(pin, new Map());
  return rooms.get(pin);
}

/** Register (or refresh) a participant's live session. */
function register(pin, participant) {
  const session = toSession(participant);
  const existing = roomSessions(pin).get(session.sessionToken);
  // Keep the in-memory streak if we already track it (it is authoritative mid-round)
  if (existing) {
    session.currentStreak = existing.currentStreak;
    session.isDisqualified = existing.isDisqualified || session.isDisqualified;
  }
  roomSessions(pin).set(session.sessionToken, session);
  return session;
}

/** Bulk-load participants from storage (e.g. after a server restart). */
function hydrate(pin, participants) {
  for (const p of participants) {
    if (p.sessionToken) register(pin, p);
  }
}

function get(pin, sessionToken) {
  if (!sessionToken) return null;
  return rooms.get(pin)?.get(sessionToken) || null;
}

function getByParticipantId(pin, participantId) {
  const sessions = rooms.get(pin);
  if (!sessions || !participantId) return null;
  for (const s of sessions.values()) {
    if (s.participantId === String(participantId)) return s;
  }
  return null;
}

/** All non-disqualified sessions in a room. */
function listActive(pin) {
  const sessions = rooms.get(pin);
  if (!sessions) return [];
  return Array.from(sessions.values()).filter(s => !s.isDisqualified);
}

function update(pin, sessionToken, patch) {
  const s = get(pin, sessionToken);
  if (s) Object.assign(s, patch);
  return s;
}

function markDisqualified(pin, participantId) {
  const s = getByParticipantId(pin, participantId);
  if (s) s.isDisqualified = true;
  return s;
}

function clearRoom(pin) {
  rooms.delete(pin);
}

/** Socket.IO room that only this team's devices join (private result packets). */
function playerChannel(pin, sessionToken) {
  return `${pin}:player:${sessionToken}`;
}

module.exports = {
  register,
  hydrate,
  get,
  getByParticipantId,
  listActive,
  update,
  markDisqualified,
  clearRoom,
  playerChannel,
};
