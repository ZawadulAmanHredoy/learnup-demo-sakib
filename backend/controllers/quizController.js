const storageService = require('../services/storageService');

// @desc    Get all quizzes
// @route   GET /api/quizzes
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await storageService.getQuizzes(req.user?._id);
    return res.status(200).json({
      success: true,
      data: quizzes,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to retrieve quizzes.',
    });
  }
};

// @desc    Get single quiz with its questions
// @route   GET /api/quizzes/:id
const getQuizById = async (req, res) => {
  try {
    const quiz = await storageService.getQuizById(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Quiz not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: quiz,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching quiz details:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to retrieve quiz details.',
    });
  }
};

// @desc    Create a new quiz
// @route   POST /api/quizzes
const createQuiz = async (req, res) => {
  try {
    const {
      title,
      description = '',
      category = 'Academic / Tech',
      roundType = 'TEAM_MCQ',
      defaultTimeLimitSec = 20,
      defaultBasePoints = 1000,
      speedBonusEnabled = true,
      negativeMarkingRatio = 0,
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Quiz title is required.',
      });
    }

    const quiz = await storageService.createQuiz({
      title: title.trim(),
      description,
      category,
      roundType,
      defaultTimeLimitSec: Number(defaultTimeLimitSec) || 20,
      defaultBasePoints: Number(defaultBasePoints) || 1000,
      speedBonusEnabled: Boolean(speedBonusEnabled),
      negativeMarkingRatio: Number(negativeMarkingRatio) || 0,
      createdBy: req.user?._id || 'usr_admin_001',
      isPublished: true,
    });

    return res.status(201).json({
      success: true,
      data: quiz,
      error: null,
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to create quiz.',
    });
  }
};

// @desc    Update quiz metadata
// @route   PUT /api/quizzes/:id
const updateQuiz = async (req, res) => {
  try {
    const updated = await storageService.updateQuiz(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Quiz not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
      error: null,
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to update quiz.',
    });
  }
};

// @desc    Delete quiz and questions
// @route   DELETE /api/quizzes/:id
const deleteQuiz = async (req, res) => {
  try {
    const deleted = await storageService.deleteQuiz(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Quiz not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Quiz deleted successfully.' },
      error: null,
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to delete quiz.',
    });
  }
};

// @desc    Add a question to a quiz
// @route   POST /api/quizzes/:id/questions
const addQuestion = async (req, res) => {
  try {
    const {
      questionText,
      type = 'MCQ',
      segment = 'GENERAL',
      media = { type: 'NONE', url: null, durationSec: 10 },
      options,
      timeLimitSec = 20,
      points = 1000,
      negativeMarking = false,
      explanation = '',
      orderIndex,
    } = req.body;

    if (!questionText || questionText.trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Question text is required.',
      });
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Question must have at least 2 options.',
      });
    }

    const hasCorrect = options.some(opt => opt.isCorrect);
    if (!hasCorrect) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'At least one option must be marked as correct.',
      });
    }

    const question = await storageService.addQuestion(req.params.id, {
      questionText: questionText.trim(),
      type,
      segment,
      media,
      options,
      timeLimitSec: Number(timeLimitSec) || 20,
      points: Number(points) || 1000,
      negativeMarking: Boolean(negativeMarking),
      explanation: explanation || '',
      orderIndex: orderIndex ? Number(orderIndex) : undefined,
    });

    return res.status(201).json({
      success: true,
      data: question,
      error: null,
    });
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to add question.',
    });
  }
};

// @desc    Update a question
// @route   PUT /api/quizzes/questions/:questionId
const updateQuestion = async (req, res) => {
  try {
    const updated = await storageService.updateQuestion(req.params.questionId, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Question not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
      error: null,
    });
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to update question.',
    });
  }
};

// @desc    Delete a question
// @route   DELETE /api/quizzes/questions/:questionId
const deleteQuestion = async (req, res) => {
  try {
    const deleted = await storageService.deleteQuestion(req.params.questionId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Question not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Question deleted successfully.' },
      error: null,
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to delete question.',
    });
  }
};

module.exports = {
  getQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
};
