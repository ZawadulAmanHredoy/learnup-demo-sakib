const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['superadmin', 'host', 'moderator'], 
    default: 'host' 
  },
  institution: { type: String, default: 'BUFT' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, { timestamps: true });



module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
