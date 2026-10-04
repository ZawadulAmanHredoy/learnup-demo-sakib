const storageService = require('../services/storageService');
const { rankParticipants } = require('../services/scoringService');
const registry = require('../services/sessionRegistry');
const liveEngine = require('../services/liveEngine');
const { registerPlayerHandlers } = require('./playerSocket');

const roomPreviousRanks = new Map(); // pin -> Map(teamId -> rank)

function setupGameSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Player-side handlers: join, reconnect, submit, buzz, clock sync (Developer 2)
    registerPlayerHandlers(io, socket);

    // Join room for Host Cockpit
    socket.on('room:join_host', async ({ pin }) => {
      socket.join(pin);
      socket.join(liveEngine.channels.host(pin));
      console.log(`[Host Joined] Socket ${socket.id} joined host channel for PIN ${pin}`);

      const room = await storageService.findRoomByPin(pin);
      const participants = await storageService.getParticipantsByPin(pin);
      socket.emit('host:init_state', { room, participantsCount: participants.length });
    });

    // Join room for Stage Display
    socket.on('room:join_stage', async ({ pin }) => {
      socket.join(pin);
      socket.join(liveEngine.channels.stage(pin));
      console.log(`[Stage Joined] Socket ${socket.id} joined stage channel for PIN ${pin}`);

      const room = await storageService.findRoomByPin(pin);
      const participants = await storageService.getParticipantsByPin(pin);
      socket.emit('stage:init_state', {
        room,
        participants: participants.map(liveEngine.publicParticipant),
      });
    });

    // =========================================================================
    // DEVELOPER 1: HOST ORCHESTRATION & STAGE BROADCAST HANDLERS
    // Question lifecycle is executed by the live engine (services/liveEngine.js)
    // =========================================================================

    // Host triggers a question: 3-Second countdown, then authoritative timer
    socket.on('host:start_question', async ({ pin, questionIndex = 0 }) => {
      const result = await liveEngine.startQuestion(io, pin, questionIndex);
      if (!result.ok) socket.emit('host:error', { message: result.error });
    });

    // Host manually locks submissions early (1s grace for answers already in flight)
    socket.on('host:lock_question', ({ pin }) => {
      liveEngine.lockQuestion(io, pin, { reason: 'HOST_LOCK', graceMs: liveEngine.LATE_GRACE_MS });
    });

    // Host pauses / resumes the countdown across all screens
    socket.on('host:pause_timer', async ({ pin }) => {
      const result = await liveEngine.pauseQuestion(io, pin);
      if (!result.ok) socket.emit('host:error', { message: result.error });
    });

    socket.on('host:resume_timer', async ({ pin }) => {
      const result = await liveEngine.resumeQuestion(io, pin);
      if (!result.ok) socket.emit('host:error', { message: result.error });
    });

    // Host reveals answer & distribution stats; each team receives its private result
    socket.on('host:reveal_answer', async ({ pin }) => {
      const result = await liveEngine.revealAnswer(io, pin);
      if (!result.ok) socket.emit('host:error', { message: result.error });
    });

    // Host shows Leaderboard (Top 10 with rank delta arrows)
    socket.on('host:show_leaderboard', async ({ pin }) => {
      const room = await storageService.findRoomByPin(pin);
      if (!room) return;

      const quiz = await liveEngine.resolveQuiz(room);
      const participants = rankParticipants(await storageService.getParticipantsByPin(pin));

      const prevRanks = roomPreviousRanks.get(pin) || new Map();
      const deltas = new Map();
      participants.forEach(p => {
        const prevRank = prevRanks.get(p._id.toString()) || p.rank;
        deltas.set(p._id.toString(), prevRank - p.rank); // positive = climbed up, negative = fell down
      });

      const topTen = participants.slice(0, 10).map(p => ({
        id: p._id,
        rank: p.rank,
        teamName: p.teamName,
        institution: p.institution,
        score: p.totalScore,
        delta: deltas.get(p._id.toString()),
        streak: p.currentStreak || 0,
      }));

      // Update stored previous ranks for next delta calculation
      const newRankMap = new Map();
      participants.forEach(p => newRankMap.set(p._id.toString(), p.rank));
      roomPreviousRanks.set(pin, newRankMap);

      const totalQuestions = quiz?.questions?.length || 1;
      const isLastQuestion = (room.currentQuestionIndex + 1) >= totalQuestions;

      await storageService.updateRoomByPin(pin, {
        status: isLastQuestion ? 'FINISHED' : 'LEADERBOARD',
        ...(isLastQuestion ? { endedAt: new Date() } : {}),
      });

      io.to(pin).emit('sync:leaderboard', {
        topTen,
        totalTeams: participants.length,
        isLastQuestion,
      });

      // Private rank banner (and final summary on the last question) for every team
      liveEngine.emitPlayerStandings(io, pin, participants, { isLastQuestion, totalQuestions, deltas });

      if (isLastQuestion) {
        // Emit Grand Podium celebration
        io.to(pin).emit('sync:final_podium', {
          first: topTen[0] || null,
          second: topTen[1] || null,
          third: topTen[2] || null,
          topTen,
        });
      }
    });

    // =========================================================================
    // DEVELOPER 1: BUZZER & EMERGENCY OVERRIDE CONTROLS
    // =========================================================================

    // Host opens the buzzer for Semi-Finals
    socket.on('host:activate_buzzer', async ({ pin, questionId }) => {
      const result = await liveEngine.openBuzzer(io, pin, questionId);
      if (!result.ok) socket.emit('host:error', { message: result.error });
    });

    // Host judges buzzer answer: Correct (+Base), Wrong (-50% Negative), Pass (Re-open)
    socket.on('host:judge_buzzer', async ({ pin, verdict }) => {
      const result = await liveEngine.judgeBuzzer(io, pin, verdict);
      if (!result.ok) socket.emit('host:error', { message: result.error });
    });

    // Emergency Cockpit Action: Kick team, adjust score, or void question
    socket.on('host:emergency_action', async ({ pin, action, targetParticipantId, deltaPoints }) => {
      if (action === 'KICK_TEAM') {
        // Rules §4.3: disqualification zeroes the score and drops the team's sockets
        await storageService.updateParticipant(targetParticipantId, {
          isDisqualified: true,
          disqualificationReason: 'Host Disqualification',
          totalScore: 0,
        });
        const session = registry.markDisqualified(pin, targetParticipantId);
        io.to(pin).emit('sync:team_disqualified', { participantId: targetParticipantId });
        if (session) {
          const teamChannel = registry.playerChannel(pin, session.sessionToken);
          io.in(teamChannel).socketsLeave([pin, liveEngine.channels.players(pin)]);
        }
        await liveEngine.rerank(pin);
      } else if (action === 'ADJUST_SCORE' && deltaPoints) {
        const parts = await storageService.getParticipantsByPin(pin);
        const target = parts.find(p => p._id.toString() === targetParticipantId?.toString());
        if (target) {
          const newScore = Math.max(0, (target.totalScore || 0) + Number(deltaPoints));
          await storageService.updateParticipant(target._id, { totalScore: newScore });
          io.to(pin).emit('sync:score_adjusted', { participantId: targetParticipantId, newScore });
          await liveEngine.rerank(pin);
        }
      }

      const updatedParticipants = await storageService.getParticipantsByPin(pin);
      io.to(pin).emit('room:player_list', {
        totalCount: updatedParticipants.length,
        participants: updatedParticipants.map(liveEngine.publicParticipant),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupGameSockets };
