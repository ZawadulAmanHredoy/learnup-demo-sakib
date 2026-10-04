const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Academic / Tech' },
  roundType: { 
    type: String, 
    enum: ['PRELIMINARY_MCQ', 'TEAM_MCQ', 'SEMI_BUZZER', 'GRAND_RAPID_FIRE'], 
    default: 'TEAM_MCQ'
  },
  defaultTimeLimitSec: { type: Number, default: 20, min: 5, max: 180 },
  defaultBasePoints: { type: Number, default: 100 },
  speedBonusEnabled: { type: Boolean, default: true },
  negativeMarkingRatio: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });

QuizSchema.index({ createdBy: 1, roundType: 1 });

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);
