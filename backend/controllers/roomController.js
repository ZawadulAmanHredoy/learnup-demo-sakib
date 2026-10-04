const storageService = require('../services/storageService');
const { generateRoomReportExcel } = require('../services/exportService');
const { sanitizeQuestion, publicParticipant } = require('../services/liveEngine');

// Anti-cheat (ADR-004): anonymous viewers (stage, players) never receive answer keys or session tokens
function sanitizeQuizForPublic(quiz) {
  if (!quiz) return quiz;
  const plain = typeof quiz.toObject === 'function' ? quiz.toObject() : quiz;
  return {
    ...plain,
    questions: (plain.questions || []).map(q => ({ _id: q._id, orderIndex: q.orderIndex, ...sanitizeQuestion(q) })),
  };
}

function sanitizeRoomForPublic(room) {
  const plain = typeof room.toObject === 'function' ? room.toObject() : { ...room };
  if (plain.quizId && typeof plain.quizId === 'object') {
    plain.quizId = plain.quizId._id;
  }
  return plain;
}

// Helper to generate unique 6-digit numeric PIN
function generateNumericPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// @desc    Create new live room with unique 6-digit PIN
// @route   POST /api/rooms
const createRoom = async (req, res) => {
  try {
    const { quizId, settings = {} } = req.body;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Please provide a valid quizId to launch a room.',
      });
    }

    const quiz = await storageService.getQuizById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Selected quiz not found.',
      });
    }

    // Allocate unique 6-digit PIN
    let pin = generateNumericPin();
    let existingRoom = await storageService.findRoomByPin(pin);
    while (existingRoom) {
      pin = generateNumericPin();
      existingRoom = await storageService.findRoomByPin(pin);
    }

    const room = await storageService.createRoom({
      pin,
      quizId: quiz._id,
      hostId: req.user?._id || 'usr_admin_001',
      status: 'LOBBY',
      currentQuestionIndex: 0,
      settings: {
        speedBonus: settings.speedBonus !== undefined ? settings.speedBonus : quiz.speedBonusEnabled,
        allowLateJoin: settings.allowLateJoin !== undefined ? settings.allowLateJoin : true,
        maxTeams: settings.maxTeams || 200,
      },
      startedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        pin: room.pin,
        roomId: room._id,
        status: room.status,
        quiz: {
          id: quiz._id,
          title: quiz.title,
          roundType: quiz.roundType,
          questionsCount: quiz.questions?.length || 0,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error('Error creating live room:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to launch live room.',
    });
  }
};

// @desc    Get public room info by PIN
// @route   GET /api/rooms/:pin
const getRoomByPin = async (req, res) => {
  try {
    const { pin } = req.params;
    const room = await storageService.findRoomByPin(pin);

    if (!room) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Room with this PIN does not exist or has closed.',
      });
    }

    let quiz = null;
    if (typeof room.quizId === 'object' && room.quizId !== null && room.quizId.title) {
      quiz = room.quizId;
    } else {
      quiz = await storageService.getQuizById(room.quizId);
    }

    const participants = await storageService.getParticipantsByPin(pin);

    return res.status(200).json({
      success: true,
      data: {
        pin: room.pin,
        status: room.status,
        currentQuestionIndex: room.currentQuestionIndex,
        totalQuestions: quiz?.questions?.length || 0,
        quizTitle: quiz?.title || 'Live Quiz',
        roundType: quiz?.roundType || 'TEAM_MCQ',
        participantCount: participants.length,
      },
      error: null,
    });
  } catch (error) {
    console.error('Error getting room:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to get room details.',
    });
  }
};

// @desc    Get complete room state for Host Cockpit & Stage recovery
// @route   GET /api/rooms/:pin/state
const getRoomState = async (req, res) => {
  try {
    const { pin } = req.params;
    const room = await storageService.findRoomByPin(pin);

    if (!room) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Room not found.',
      });
    }

    let quiz = null;
    if (typeof room.quizId === 'object' && room.quizId !== null && room.quizId.title) {
      quiz = room.quizId;
    } else {
      quiz = await storageService.getQuizById(room.quizId);
    }

    const participants = await storageService.getParticipantsByPin(pin);
    const isHost = !!req.user;

    return res.status(200).json({
      success: true,
      data: {
        room: isHost ? room : sanitizeRoomForPublic(room),
        quiz: isHost ? quiz : sanitizeQuizForPublic(quiz),
        participants: isHost ? participants : participants.map(publicParticipant),
      },
      error: null,
    });
  } catch (error) {
    console.error('Error fetching room state:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to retrieve room state.',
    });
  }
};

// @desc    Download Excel report of room results
// @route   GET /api/rooms/:pin/export
const exportRoomResults = async (req, res) => {
  try {
    const { pin } = req.params;
    const exportData = await storageService.getRoomExportData(pin);

    if (!exportData || !exportData.room) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Room not found for export.',
      });
    }

    const buffer = await generateRoomReportExcel(exportData);

    const filename = `LearnUp_Arena_${pin}_Results_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting room results:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to generate Excel export.',
    });
  }
};

module.exports = {
  createRoom,
  getRoomByPin,
  getRoomState,
  exportRoomResults,
};
