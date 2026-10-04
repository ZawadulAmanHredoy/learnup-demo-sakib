const express = require('express');
const router = express.Router();
const {
  getQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');

// Public or Protected depending on use case; public read for live stage display, protected write
router.get('/', getQuizzes);
router.get('/:id', getQuizById);

router.post('/', protect, createQuiz);
router.put('/:id', protect, updateQuiz);
router.delete('/:id', protect, deleteQuiz);

// Questions
router.post('/:id/questions', protect, addQuestion);
router.put('/questions/:questionId', protect, updateQuestion);
router.delete('/questions/:questionId', protect, deleteQuestion);

module.exports = router;
