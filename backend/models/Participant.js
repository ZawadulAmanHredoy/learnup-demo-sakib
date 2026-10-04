const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  pin: { type: String, required: true, index: true },
  sessionToken: { type: String, required: true, unique: true, index: true },
  teamName: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  captainName: { type: String, required: true },
  contactPhone: { type: String, default: '' },
  contactEmail: { type: String, lowercase: true, default: '' },
  teamMembers: [{ type: String }],
  
  totalScore: { type: Number, default: 0, index: true },
  currentRank: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  correctAnswersCount: { type: Number, default: 0 },
  incorrectAnswersCount: { type: Number, default: 0 },
  averageResponseTimeMs: { type: Number, default: 0 },
  
  isDisqualified: { type: Boolean, default: false },
  disqualificationReason: { type: String, default: null },
  socketId: { type: String, default: null },
  isConnected: { type: Boolean, default: true }
}, { timestamps: true });

ParticipantSchema.index({ roomId: 1, totalScore: -1 });

module.exports = mongoose.models.Participant || mongoose.model('Participant', ParticipantSchema);
