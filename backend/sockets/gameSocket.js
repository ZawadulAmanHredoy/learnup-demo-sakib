const storageService = require('../services/storageService');
const { calculateScore } = require('../services/scoringService');

// Active in-memory session tracking for sub-millisecond execution
const activeTimers = new Map(); // pin -> timer timeout
const activeQuestionData = new Map(); // pin -> { question, startedAt, deadline, submissions: Map, distribution: {} }
const buzzerLocks = new Map(); // pin -> { locked: boolean, winner: Object }
const roomPreviousRanks = new Map(); // pin -> Map(teamId -> rank)

function setupGameSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room for Host Cockpit
    socket.on('room:join_host', async ({ pin }) => {
      socket.join(pin);
      socket.join(`${pin}:host`);
      console.log(`[Host Joined] Socket ${socket.id} joined host channel for PIN ${pin}`);

      const room = await storageService.findRoomByPin(pin);
      const participants = await storageService.getParticipantsByPin(pin);
      socket.emit('host:init_state', { room, participantsCount: participants.length });
    });

    // Join room for Stage Display
    socket.on('room:join_stage', async ({ pin }) => {
      socket.join(pin);
      socket.join(`${pin}:stage`);
      console.log(`[Stage Joined] Socket ${socket.id} joined stage channel for PIN ${pin}`);

      const room = await storageService.findRoomByPin(pin);
      const participants = await storageService.getParticipantsByPin(pin);
      socket.emit('stage:init_state', { room, participants });
    });

    // Player joins the room lobby
    socket.on('room:join', async (data) => {
      const { pin, teamName, institution, captainName, contactPhone, sessionToken } = data;
      if (!pin || !teamName) return;

      socket.join(pin);
      socket.sessionToken = sessionToken;
      socket.pin = pin;

      const room = await storageService.findRoomByPin(pin);
      if (!room) {
        return socket.emit('room:joined_ack', { success: false, error: 'Room does not exist' });
      }

      let participant = await storageService.findParticipantBySessionToken(pin, sessionToken);
      if (!participant) {
        participant = await storageService.createParticipant({
          pin,
          sessionToken,
          teamName,
          institution: institution || 'BUFT',
          captainName: captainName || teamName,
          contactPhone: contactPhone || '',
          socketId: socket.id,
          isConnected: true,
        });
      } else {
        await storageService.updateParticipant(participant._id, {
          socketId: socket.id,
          isConnected: true,
        });
      }

      socket.emit('room:joined_ack', {
        success: true,
        participantId: participant._id,
        sessionToken,
        currentRoomState: room.status,
      });

      // Broadcast updated participant list to Host and Stage displays
      const allParticipants = await storageService.getParticipantsByPin(pin);
      io.to(pin).emit('room:player_list', {
        totalCount: allParticipants.length,
        participants: allParticipants.map(p => ({
          id: p._id,
          teamName: p.teamName,
          institution: p.institution,
          score: p.totalScore,
        })),
      });
    });

    // Reconnection handling with sessionToken
    socket.on('room:reconnect', async ({ pin, sessionToken }) => {
      if (!pin || !sessionToken) return;
      socket.join(pin);
      socket.sessionToken = sessionToken;
      socket.pin = pin;

      const room = await storageService.findRoomByPin(pin);
      const participant = await storageService.findParticipantBySessionToken(pin, sessionToken);

      if (participant) {
        await storageService.updateParticipant(participant._id, {
          socketId: socket.id,
          isConnected: true,
        });
      }

      const qData = activeQuestionData.get(pin);
      const hasAnswered = qData ? qData.submissions.has(sessionToken) : false;

      socket.emit('room:reconnected_ack', {
        success: true,
        roomStatus: room?.status || 'LOBBY',
        currentQuestionIndex: room?.currentQuestionIndex || 0,
        hasAnswered,
        participant,
      });
    });

    // =========================================================================
    // DEVELOPER 1: HOST ORCHESTRATION & STAGE BROADCAST HANDLERS
    // =========================================================================

    // Host triggers a question: 3-Second countdown starts
    socket.on('host:start_question', async ({ pin, questionIndex = 0 }) => {
      const room = await storageService.findRoomByPin(pin);
      if (!room) return;

      let quiz = null;
      if (typeof room.quizId === 'object' && room.quizId !== null && room.quizId.questions) {
        quiz = room.quizId;
      } else {
        quiz = await storageService.getQuizById(room.quizId);
      }

      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        return socket.emit('host:error', { message: 'Quiz has no questions.' });
      }

      const qIndex = Number(questionIndex);
      const question = quiz.questions[qIndex];
      if (!question) {
        return socket.emit('host:error', { message: 'Question not found at index ' + qIndex });
      }

      // Step 1: Set room state to COUNTDOWN
      await storageService.updateRoomByPin(pin, {
        status: 'COUNTDOWN',
        currentQuestionIndex: qIndex,
      });

      io.to(pin).emit('sync:countdown', {
        durationMs: 3000,
        serverTimestamp: Date.now(),
        questionIndex: qIndex,
        totalQuestions: quiz.questions.length,
      });

      // Clear any previous timer
      if (activeTimers.has(pin)) {
        clearTimeout(activeTimers.get(pin));
        activeTimers.delete(pin);
      }

      // Step 2: After 3 seconds, activate question
      const timer = setTimeout(async () => {
        const timeLimitSec = question.timeLimitSec || 20;
        const serverStartTime = Date.now();
        const serverDeadline = serverStartTime + (timeLimitSec * 1000);

        // Crucial Anti-Cheat: Strip `isCorrect` from options before sending to contestants/stage
        const sanitizedOptions = (question.options || []).map(opt => ({
          id: opt.id,
          text: opt.text,
        }));

        // Reset distribution map
        const distribution = {};
        (question.options || []).forEach(opt => {
          distribution[opt.id] = 0;
        });

        activeQuestionData.set(pin, {
          question,
          startedAt: serverStartTime,
          deadline: serverDeadline,
          submissions: new Map(), // sessionToken -> submission
          distribution,
          isLocked: false,
        });

        await storageService.updateRoomByPin(pin, {
          status: 'QUESTION_ACTIVE',
          currentQuestionStartedAt: new Date(serverStartTime),
        });

        // Broadcast active question to all screens
        io.to(pin).emit('sync:question_active', {
          questionIndex: qIndex,
          totalQuestions: quiz.questions.length,
          questionId: question._id,
          questionText: question.questionText,
          type: question.type,
          segment: question.segment,
          media: question.media,
          options: sanitizedOptions,
          timeLimitSec,
          points: question.points || 1000,
          serverStartTime,
          serverDeadline,
        });

        // Set authoritative server timer for auto-lock when time reaches 0
        const lockTimer = setTimeout(() => {
          lockQuestionForRoom(io, pin);
        }, timeLimitSec * 1000 + 400); // 400ms tolerance

        activeTimers.set(pin, lockTimer);
      }, 3000);

      activeTimers.set(pin, timer);
    });

    // Player submits answer
    socket.on('player:submit_answer', async (data) => {
      const { pin, sessionToken, questionId, selectedOptionId, clientSentAt } = data;
      const qData = activeQuestionData.get(pin);

      if (!qData || qData.isLocked) {
        return socket.emit('player:answer_ack', { success: false, reason: 'EXPIRED' });
      }

      // Check if player already submitted
      if (qData.submissions.has(sessionToken)) {
        return socket.emit('player:answer_ack', { success: false, reason: 'ALREADY_SUBMITTED' });
      }

      const serverReceivedAt = Date.now();
      const timeTakenMs = serverReceivedAt - qData.startedAt;

      // Verify correct option against full question stored on server
      const correctOption = qData.question.options.find(o => o.isCorrect);
      const isCorrect = correctOption ? (correctOption.id === selectedOptionId) : false;

      const participant = await storageService.findParticipantBySessionToken(pin, sessionToken);
      const currentStreak = participant?.currentStreak || 0;

      const scoreResult = calculateScore({
        isCorrect,
        timeTakenMs,
        timeLimitSec: qData.question.timeLimitSec,
        basePoints: qData.question.points || 1000,
        speedBonusEnabled: true,
        negativeMarking: qData.question.negativeMarking || false,
        currentStreak,
      });

      const submissionRecord = {
        pin,
        questionId,
        participantId: participant?._id,
        sessionToken,
        teamName: participant?.teamName || 'Unknown Team',
        selectedOptionId,
        clientSentAt: clientSentAt ? new Date(clientSentAt) : new Date(),
        serverReceivedAt: new Date(serverReceivedAt),
        timeTakenMs,
        isCorrect,
        ...scoreResult,
      };

      qData.submissions.set(sessionToken, submissionRecord);

      // Increment distribution for stage chart
      if (qData.distribution[selectedOptionId] !== undefined) {
        qData.distribution[selectedOptionId] += 1;
      } else {
        qData.distribution[selectedOptionId] = 1;
      }

      // Immediate socket ACK to mobile player
      socket.emit('player:answer_ack', {
        received: true,
        timeTakenMs,
      });

      // Emit live telemetry update to host cockpit & stage
      const participants = await storageService.getParticipantsByPin(pin);
      const answeredCount = qData.submissions.size;
      const totalCount = participants.length;

      io.to(pin).emit('host:live_telemetry', {
        answeredCount,
        totalCount,
        distribution: qData.distribution,
      });

      // Auto-lock if all registered teams have answered early!
      if (totalCount > 0 && answeredCount >= totalCount) {
        lockQuestionForRoom(io, pin);
      }
    });

    // Host manually locks submissions early
    socket.on('host:lock_question', async ({ pin }) => {
      lockQuestionForRoom(io, pin);
    });

    // Host reveals answer & distribution stats
    socket.on('host:reveal_answer', async ({ pin }) => {
      const qData = activeQuestionData.get(pin);
      if (!qData) return;

      const correctOption = qData.question.options.find(o => o.isCorrect);
      const correctOptionId = correctOption?.id || null;

      await storageService.updateRoomByPin(pin, { status: 'ANSWER_REVEAL' });

      // Find fastest correct team
      let fastestTeam = null;
      let fastestTimeMs = Infinity;

      for (const sub of qData.submissions.values()) {
        if (sub.isCorrect && sub.timeTakenMs < fastestTimeMs) {
          fastestTimeMs = sub.timeTakenMs;
          fastestTeam = {
            name: sub.teamName,
            latencySec: (sub.timeTakenMs / 1000).toFixed(2),
          };
        }
      }

      // Persist submissions and update participant scores
      for (const sub of qData.submissions.values()) {
        await storageService.createSubmission(sub);
        if (sub.participantId) {
          const part = await storageService.findParticipantBySessionToken(pin, sub.sessionToken);
          if (part) {
            const newTotalScore = Math.max(0, (part.totalScore || 0) + sub.totalPointsAwarded);
            const newCorrect = (part.correctAnswersCount || 0) + (sub.isCorrect ? 1 : 0);
            const newIncorrect = (part.incorrectAnswersCount || 0) + (sub.isCorrect ? 0 : 1);
            const totalAns = newCorrect + newIncorrect;
            const newAvgTime = totalAns > 0 ? Math.round(((part.averageResponseTimeMs * (totalAns - 1)) + sub.timeTakenMs) / totalAns) : sub.timeTakenMs;

            await storageService.updateParticipant(part._id, {
              totalScore: newTotalScore,
              currentStreak: sub.newStreak,
              correctAnswersCount: newCorrect,
              incorrectAnswersCount: newIncorrect,
              averageResponseTimeMs: newAvgTime,
            });
          }
        }
      }

      // Recalculate rank order
      const participants = await storageService.getParticipantsByPin(pin);
      participants.sort((a, b) => b.totalScore - a.totalScore);

      for (let i = 0; i < participants.length; i++) {
        await storageService.updateParticipant(participants[i]._id, { currentRank: i + 1 });
      }

      // Broadcast answer reveal to all screens (Stage charts & options)
      io.to(pin).emit('sync:answer_reveal', {
        correctOptionId,
        correctOptionText: correctOption?.text || '',
        explanation: qData.question.explanation || '',
        distribution: qData.distribution,
        totalAnswers: qData.submissions.size,
        fastestTeam,
      });

      // Emit private player result packets to each connected socket
      const sockets = await io.in(pin).fetchSockets();
      for (const s of sockets) {
        if (s.sessionToken) {
          const sub = qData.submissions.get(s.sessionToken);
          const part = participants.find(p => p.sessionToken === s.sessionToken);
          if (sub) {
            s.emit('sync:player_result', {
              isCorrect: sub.isCorrect,
              pointsEarned: sub.totalPointsAwarded,
              basePoints: sub.basePoints,
              speedBonus: sub.speedBonusPoints,
              penaltyPoints: sub.penaltyPoints,
              streak: sub.newStreak,
              badge: sub.badge,
              currentScore: part?.totalScore || 0,
              rank: part?.currentRank || 1,
              totalTeams: participants.length,
            });
          } else {
            s.emit('sync:player_result', {
              isCorrect: false,
              pointsEarned: 0,
              basePoints: 0,
              speedBonus: 0,
              penaltyPoints: 0,
              streak: 0,
              badge: '',
              currentScore: part?.totalScore || 0,
              rank: part?.currentRank || 1,
              totalTeams: participants.length,
              missed: true,
            });
          }
        }
      }
    });

    // Host shows Leaderboard (Top 10 with rank delta arrows)
    socket.on('host:show_leaderboard', async ({ pin }) => {
      const room = await storageService.findRoomByPin(pin);
      if (!room) return;

      let quiz = null;
      if (typeof room.quizId === 'object' && room.quizId !== null && room.quizId.questions) {
        quiz = room.quizId;
      } else {
        quiz = await storageService.getQuizById(room.quizId);
      }

      const participants = await storageService.getParticipantsByPin(pin);
      participants.sort((a, b) => b.totalScore - a.totalScore);

      const prevRanks = roomPreviousRanks.get(pin) || new Map();
      const topTen = participants.slice(0, 10).map((p, idx) => {
        const currentRank = idx + 1;
        const prevRank = prevRanks.get(p._id.toString()) || currentRank;
        const delta = prevRank - currentRank; // positive = climbed up, negative = fell down
        return {
          id: p._id,
          rank: currentRank,
          teamName: p.teamName,
          institution: p.institution,
          score: p.totalScore,
          delta,
          streak: p.currentStreak || 0,
        };
      });

      // Update stored previous ranks for next delta calculation
      const newRankMap = new Map();
      participants.forEach((p, idx) => newRankMap.set(p._id.toString(), idx + 1));
      roomPreviousRanks.set(pin, newRankMap);

      const isLastQuestion = (room.currentQuestionIndex + 1) >= (quiz?.questions?.length || 1);

      await storageService.updateRoomByPin(pin, {
        status: isLastQuestion ? 'FINISHED' : 'LEADERBOARD',
      });

      io.to(pin).emit('sync:leaderboard', {
        topTen,
        totalTeams: participants.length,
        isLastQuestion,
      });

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
      buzzerLocks.set(pin, { locked: false, winner: null, startedAt: Date.now() });
      io.to(pin).emit('sync:buzzer_ready', {
        questionId,
        unlockedAt: Date.now(),
      });
    });

    // Contestant hits the buzzer (Atomic lock check)
    socket.on('player:buzz', async ({ pin, sessionToken, clientTimestamp }) => {
      const lockState = buzzerLocks.get(pin);
      if (!lockState || lockState.locked) {
        return socket.emit('player:buzz_lockout', { status: 'LOCKED_OUT' });
      }

      // First socket event in Node's single-threaded event loop wins atomically!
      lockState.locked = true;
      const participant = await storageService.findParticipantBySessionToken(pin, sessionToken);
      const reactionTimeMs = Date.now() - lockState.startedAt;

      lockState.winner = {
        participantId: participant?._id,
        teamName: participant?.teamName || 'Unknown Team',
        reactionTimeMs,
      };

      // Broadcast immediately to Stage Spotlight and all players
      io.to(pin).emit('sync:buzzer_locked', {
        winnerTeamId: participant?._id,
        winnerTeamName: participant?.teamName,
        reactionTimeMs,
      });
    });

    // Host judges buzzer answer: Correct (+Base), Wrong (-50 Negative), Pass (Re-open)
    socket.on('host:judge_buzzer', async ({ pin, winnerTeamId, verdict }) => {
      const lockState = buzzerLocks.get(pin);
      const participant = (await storageService.getParticipantsByPin(pin)).find(p => p._id.toString() === winnerTeamId?.toString());

      if (participant) {
        let deltaPoints = 0;
        if (verdict === 'CORRECT') {
          deltaPoints = 100;
        } else if (verdict === 'WRONG') {
          deltaPoints = -50; // Negative marking per rules
        }

        const newScore = Math.max(0, (participant.totalScore || 0) + deltaPoints);
        await storageService.updateParticipant(participant._id, { totalScore: newScore });

        io.to(pin).emit('sync:buzzer_judged', {
          teamName: participant.teamName,
          verdict,
          deltaPoints,
          newScore,
        });
      }

      if (verdict === 'WRONG' || verdict === 'PASS') {
        // Re-open buzzer for remaining teams
        buzzerLocks.set(pin, { locked: false, winner: null, startedAt: Date.now() });
        io.to(pin).emit('sync:buzzer_ready', { reOpened: true });
      }
    });

    // Emergency Cockpit Action: Kick team, adjust score, or void question
    socket.on('host:emergency_action', async ({ pin, action, targetParticipantId, deltaPoints }) => {
      if (action === 'KICK_TEAM') {
        await storageService.updateParticipant(targetParticipantId, {
          isDisqualified: true,
          disqualificationReason: 'Host Disqualification',
        });
        io.to(pin).emit('sync:team_disqualified', { participantId: targetParticipantId });
      } else if (action === 'ADJUST_SCORE' && deltaPoints) {
        const parts = await storageService.getParticipantsByPin(pin);
        const target = parts.find(p => p._id.toString() === targetParticipantId?.toString());
        if (target) {
          const newScore = Math.max(0, (target.totalScore || 0) + Number(deltaPoints));
          await storageService.updateParticipant(target._id, { totalScore: newScore });
          io.to(pin).emit('sync:score_adjusted', { participantId: targetParticipantId, newScore });
        }
      }

      const updatedParticipants = await storageService.getParticipantsByPin(pin);
      io.to(pin).emit('room:player_list', {
        totalCount: updatedParticipants.length,
        participants: updatedParticipants.map(p => ({
          id: p._id,
          teamName: p.teamName,
          score: p.totalScore,
        })),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

function lockQuestionForRoom(io, pin) {
  const qData = activeQuestionData.get(pin);
  if (!qData || qData.isLocked) return;

  qData.isLocked = true;
  if (activeTimers.has(pin)) {
    clearTimeout(activeTimers.get(pin));
    activeTimers.delete(pin);
  }

  storageService.updateRoomByPin(pin, {
    status: 'QUESTION_LOCKED',
    currentQuestionLockedAt: new Date(),
  });

  io.to(pin).emit('sync:question_locked', {
    totalAnswersReceived: qData.submissions.size,
    serverLockedAt: Date.now(),
  });
}

module.exports = { setupGameSockets };
