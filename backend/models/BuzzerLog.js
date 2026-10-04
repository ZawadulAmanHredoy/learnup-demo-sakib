const mongoose = require('mongoose');

const BuzzerLogSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  pin: { type: String, index: true },
  teamName: { type: String },
  reactionTimeMs: { type: Number, required: true },
  outcome: { 
    type: String, 
    enum: ['CORRECT_APPROVED', 'WRONG_PENALIZED', 'PASSED_NO_PENALTY', 'PENDING'], 
    default: 'PENDING' 
  },
  awardedScore: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.BuzzerLog || mongoose.model('BuzzerLog', BuzzerLogSchema);
