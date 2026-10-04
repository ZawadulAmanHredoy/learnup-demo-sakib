const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true, index: true },
  selectedOptionId: { type: String, required: true },
  
  clientSentAt: { type: Date },
  serverReceivedAt: { type: Date, required: true, default: Date.now },
  timeTakenMs: { type: Number, required: true },
  
  isCorrect: { type: Boolean, required: true },
  basePoints: { type: Number, default: 0 },
  speedBonusPoints: { type: Number, default: 0 },
  penaltyPoints: { type: Number, default: 0 },
  totalPointsAwarded: { type: Number, required: true }
}, { timestamps: true });

SubmissionSchema.index({ roomId: 1, questionId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
