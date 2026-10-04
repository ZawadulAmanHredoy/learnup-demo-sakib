/**
 * Player Socket Handlers (Developer 2 — Player Experience & Live Engine)
 *
 * room:join            Participant registration (server-issued UUID v4 session token)
 * room:reconnect       Session recovery after refresh / network drop (AppFlow §5.1)
 * player:submit_answer In-memory ingest with immediate ACK
 * player:buzz          Atomic buzzer lockout
 * time:sync            NTP-style clock offset probe for drift compensation (PROOFS §3)
 * player:leave         Unbind this device from its team
 *
 * After join/reconnect the socket is bound to one team (`socket.data.player`).
 * Answers and buzzes are attributed to that binding — never to a token in the
 * payload — so one device cannot act on behalf of another team.
 */

const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');
const registry = require('../services/sessionRegistry');
const buzzer = require('../services/buzzerService');
const liveEngine = require('../services/liveEngine');

const PIN_RE = /^\d{6}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;
const LIMITS = { teamName: [2, 40], institution: [2, 80], captainName: [2, 60] };

const pendingTeamNames = new Map(); // pin -> Set(lowercased names being created right now)

function clean(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function reply(socket, event, payload, ack) {
  socket.emit(event, payload);
  if (typeof ack === 'function') ack(payload);
}

function toPlain(doc) {
  return doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

/** The private profile a team sees about itself. */
function selfProfile(participant) {
  const p = toPlain(participant);
  return {
    id: p._id,
    teamName: p.teamName,
    institution: p.institution,
    captainName: p.captainName,
    totalScore: p.totalScore || 0,
    currentRank: p.currentRank || 0,
    currentStreak: p.currentStreak || 0,
    correctAnswersCount: p.correctAnswersCount || 0,
    incorrectAnswersCount: p.incorrectAnswersCount || 0,
    averageResponseTimeMs: p.averageResponseTimeMs || 0,
  };
}

function validateRegistration(data) {
  const pin = clean(String(data?.pin ?? ''));
  const teamName = clean(data?.teamName);
  const institution = clean(data?.institution);
  const captainName = clean(data?.captainName) || teamName;
  const contactPhone = clean(data?.contactPhone);

  if (!PIN_RE.test(pin)) return { error: 'INVALID_PIN', message: 'PIN must be 6 digits.' };
  const checkLen = (field, value, label) => {
    const [min, max] = LIMITS[field];
    if (value.length < min || value.length > max) {
      return { error: `INVALID_${field.toUpperCase()}`, message: `${label} must be ${min}–${max} characters.` };
    }
    return null;
  };
  const lengthError =
    checkLen('teamName', teamName, 'Team name') ||
    checkLen('institution', institution, 'Institution') ||
    checkLen('captainName', captainName, 'Captain name');
  if (lengthError) return lengthError;
  if (contactPhone && !PHONE_RE.test(contactPhone)) {
    return { error: 'INVALID_PHONE', message: 'Enter a valid mobile number.' };
  }
  return { value: { pin, teamName, institution, captainName, contactPhone } };
}

/** Attach this socket to a team: public room, players channel and the team's private channel. */
function bindSocket(socket, pin, participant) {
  const previous = socket.data.player;
  if (previous && (previous.pin !== pin || previous.sessionToken !== participant.sessionToken)) {
    socket.leave(registry.playerChannel(previous.pin, previous.sessionToken));
  }
  socket.join(pin);
  socket.join(liveEngine.channels.players(pin));
  socket.join(registry.playerChannel(pin, participant.sessionToken));
  socket.data.player = {
    pin,
    sessionToken: participant.sessionToken,
    participantId: String(participant._id),
  };
}

/** Full state a (re)joining device needs to render the right screen. */
async function buildSessionState(pin, room, participant) {
  const p = toPlain(participant);
  const quiz = await liveEngine.resolveQuiz(room);
  const totalQuestions = quiz?.questions?.length || 0;
  const state = {
    roomStatus: room.status,
    currentQuestionIndex: room.currentQuestionIndex || 0,
    totalQuestions,
    quizTitle: quiz?.title || 'Live Quiz',
    roundType: quiz?.roundType || 'TEAM_MCQ',
    snapshot: liveEngine.getPlayerSnapshot(pin, p.sessionToken),
    buzzer: buzzer.snapshot(pin, String(p._id)),
    serverTime: Date.now(),
  };
  if (room.status === 'FINISHED') {
    const participants = await storageService.getParticipantsByPin(pin);
    state.finalSummary = liveEngine.buildFinalSummary(p, {
      totalQuestions,
      totalTeams: participants.length,
    });
  }
  return state;
}

function registerPlayerHandlers(io, socket) {
  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------
  socket.on('room:join', async (data, ack) => {
    const fail = (error, message) =>
      reply(socket, 'room:joined_ack', { success: false, error, message: message || error }, ack);

    try {
      const { error, message, value } = validateRegistration(data);
      if (error) return fail(error, message);
      const { pin, teamName, institution, captainName, contactPhone } = value;

      const room = await storageService.findRoomByPin(pin);
      if (!room) return fail('ROOM_NOT_FOUND', 'No live room with this PIN.');
      if (room.status === 'FINISHED') return fail('ROOM_CLOSED', 'This competition has ended.');

      // Same device re-submitting the form: treat as a rejoin, not a new team
      const existingToken = typeof data?.sessionToken === 'string' ? data.sessionToken : null;
      if (existingToken) {
        const existing = await storageService.findParticipantBySessionToken(pin, existingToken);
        if (existing?.isDisqualified) return fail('DISQUALIFIED', 'This team has been disqualified.');
        if (existing) return handleReconnect({ pin, sessionToken: existingToken }, ack, 'room:joined_ack');
      }

      if (room.status !== 'LOBBY' && room.settings?.allowLateJoin === false) {
        return fail('LATE_JOIN_DISABLED', 'Registration closed — the competition has started.');
      }
      const maxTeams = room.settings?.maxTeams || 200;
      if ((await storageService.countParticipants(pin)) >= maxTeams) {
        return fail('ROOM_FULL', 'This room has reached its team limit.');
      }

      const nameKey = teamName.toLowerCase();
      if (!pendingTeamNames.has(pin)) pendingTeamNames.set(pin, new Set());
      const pending = pendingTeamNames.get(pin);
      if (pending.has(nameKey)) {
        return fail('TEAM_NAME_TAKEN', 'That team name is already registered in this room.');
      }

      // Reserve the name synchronously so two simultaneous joins can't both claim it
      pending.add(nameKey);
      let participant;
      try {
        if (await storageService.findParticipantByTeamName(pin, teamName)) {
          return fail('TEAM_NAME_TAKEN', 'That team name is already registered in this room.');
        }
        participant = await storageService.createParticipant({
          roomId: room._id,
          pin,
          sessionToken: uuidv4(),
          teamName,
          institution,
          captainName,
          contactPhone,
          socketId: socket.id,
          isConnected: true,
        });
      } finally {
        pending.delete(nameKey);
      }

      registry.register(pin, toPlain(participant));
      bindSocket(socket, pin, participant);

      const sessionState = await buildSessionState(pin, room, participant);
      reply(socket, 'room:joined_ack', {
        success: true,
        participantId: participant._id,
        sessionToken: participant.sessionToken,
        currentRoomState: room.status,
        participant: selfProfile(participant),
        ...sessionState,
      }, ack);

      liveEngine.broadcastPlayerList(io, pin);
    } catch (err) {
      console.error('[room:join] error', err);
      fail('SERVER_ERROR', 'Could not join right now. Please try again.');
    }
  });

  // --------------------------------------------------------------------------
  // Reconnection & session recovery
  // --------------------------------------------------------------------------
  async function handleReconnect(data, ack, ackEvent = 'room:reconnected_ack') {
    const fail = (reason) => reply(socket, ackEvent, { success: false, reason, error: reason }, ack);
    try {
      const pin = clean(String(data?.pin ?? ''));
      const sessionToken = typeof data?.sessionToken === 'string' ? data.sessionToken : '';
      if (!PIN_RE.test(pin) || !sessionToken) return fail('INVALID_SESSION');

      const room = await storageService.findRoomByPin(pin);
      if (!room) return fail('ROOM_NOT_FOUND');

      const participant = await storageService.findParticipantBySessionToken(pin, sessionToken);
      if (!participant) return fail('SESSION_NOT_FOUND');
      if (participant.isDisqualified) return fail('DISQUALIFIED');

      await storageService.updateParticipant(participant._id, { socketId: socket.id, isConnected: true });
      registry.register(pin, toPlain(participant));
      bindSocket(socket, pin, participant);

      const sessionState = await buildSessionState(pin, room, participant);
      const snapshot = sessionState.snapshot;
      reply(socket, ackEvent, {
        success: true,
        participantId: participant._id,
        sessionToken,
        currentRoomState: room.status,
        hasAnswered: !!snapshot?.hasAnswered,
        participant: selfProfile(participant),
        ...sessionState,
      }, ack);

      liveEngine.broadcastPlayerList(io, pin);
    } catch (err) {
      console.error('[room:reconnect] error', err);
      fail('SERVER_ERROR');
    }
  }

  socket.on('room:reconnect', (data, ack) => handleReconnect(data, ack));

  // --------------------------------------------------------------------------
  // Answer ingest
  // --------------------------------------------------------------------------
  socket.on('player:submit_answer', (data, ack) => {
    const bound = socket.data.player;
    const pin = clean(String(data?.pin ?? bound?.pin ?? ''));
    const session = bound && bound.pin === pin ? registry.get(pin, bound.sessionToken) : null;
    if (!session) {
      return reply(socket, 'player:answer_ack', { success: false, reason: 'NOT_JOINED' }, ack);
    }

    const result = liveEngine.submitAnswer(pin, session, {
      questionId: data?.questionId,
      selectedOptionId: data?.selectedOptionId,
      clientSentAt: Number(data?.clientSentAt),
    });
    reply(socket, 'player:answer_ack', result, ack);

    if (result.success) {
      // Team-mates on other devices lock in too
      socket.to(registry.playerChannel(pin, session.sessionToken)).emit('player:answer_ack', {
        ...result,
        fromTeammate: true,
      });
      liveEngine.afterSubmit(io, pin);
    }
  });

  // --------------------------------------------------------------------------
  // Buzzer
  // --------------------------------------------------------------------------
  socket.on('player:buzz', (data) => {
    const bound = socket.data.player;
    const pin = clean(String(data?.pin ?? bound?.pin ?? ''));
    const session = bound && bound.pin === pin ? registry.get(pin, bound.sessionToken) : null;
    if (!session) {
      return socket.emit('player:buzz_lockout', { status: 'NOT_JOINED' });
    }
    liveEngine.handleBuzz(io, socket, pin, session);
  });

  // --------------------------------------------------------------------------
  // Clock sync: client computes offset = serverTime - (sent + received) / 2
  // --------------------------------------------------------------------------
  socket.on('time:sync', (data, ack) => {
    if (typeof ack === 'function') {
      ack({ clientSentAt: data?.clientSentAt ?? null, serverTime: Date.now() });
    }
  });

  socket.on('player:leave', () => {
    const bound = socket.data.player;
    if (!bound) return;
    socket.leave(registry.playerChannel(bound.pin, bound.sessionToken));
    socket.leave(liveEngine.channels.players(bound.pin));
    socket.leave(bound.pin);
    socket.data.player = null;
  });

  socket.on('disconnect', async () => {
    const bound = socket.data.player;
    if (!bound) return;
    try {
      // Another device of the same team may still be online
      const stillOnline = await io.in(registry.playerChannel(bound.pin, bound.sessionToken)).fetchSockets();
      if (stillOnline.length === 0) {
        await storageService.updateParticipant(bound.participantId, { isConnected: false });
        liveEngine.broadcastPlayerList(io, bound.pin);
      }
    } catch (err) {
      console.error('[disconnect] error', err.message);
    }
  });
}

module.exports = { registerPlayerHandlers, validateRegistration };
