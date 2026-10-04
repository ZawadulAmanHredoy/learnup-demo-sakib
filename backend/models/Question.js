const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  id: { type: String, required: true }, // e.g. "opt_a", "opt_b"
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  orderIndex: { type: Number, required: true },
  questionText: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['MCQ', 'BUZZER', 'AUDIO_VISUAL', 'RAPID_FIRE'], 
    default: 'MCQ' 
  },
  segment: {
    type: String,
    enum: [
      'GENERAL',
      'BANGLADESH',
      'WORLD',
      'SCIENCE_TECH',
      'HISTORY_CULTURE',
      'SPORTS_AFFAIRS',
      'AUDIO_VISUAL',
      'RAPID_FIRE'
    ],
    default: 'GENERAL'
  },
  media: {
    type: { type: String, enum: ['NONE', 'IMAGE', 'AUDIO', 'VIDEO'], default: 'NONE' },
    url: { type: String, default: null },
    durationSec: { type: Number, default: 10 }
  },
  options: { 
    type: [OptionSchema], 
    validate: [val => val.length >= 2, 'Question must have at least 2 options']
  },
  timeLimitSec: { type: Number, default: 20 },
  points: { type: Number, default: 100 },
  negativeMarking: { type: Boolean, default: false },
  explanation: { type: String, default: '' }
}, { timestamps: true });

QuestionSchema.index({ quizId: 1, orderIndex: 1 });

module.exports = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
