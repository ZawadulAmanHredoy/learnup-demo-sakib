const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  pin: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    minlength: 6, 
    maxlength: 6 
  },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: [
      'LOBBY', 
      'COUNTDOWN', 
      'QUESTION_ACTIVE', 
      'QUESTION_LOCKED', 
      'ANSWER_REVEAL', 
      'LEADERBOARD', 
      'PAUSED', 
      'FINISHED'
    ], 
    default: 'LOBBY' 
  },
  currentQuestionIndex: { type: Number, default: 0 },
  currentQuestionStartedAt: { type: Date, default: null },
  currentQuestionLockedAt: { type: Date, default: null },
  settings: {
    speedBonus: { type: Boolean, default: true },
    allowLateJoin: { type: Boolean, default: true },
    maxTeams: { type: Number, default: 200 }
  },
  startedAt: { type: Date },
  endedAt: { type: Date }
}, { timestamps: true });


RoomSchema.index({ status: 1 });

module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);
