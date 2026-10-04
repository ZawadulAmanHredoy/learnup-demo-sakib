# Database Schema & Data Models Specification (Schema)
## Project: LearnUp Live Arena

---

## 1. Data Layer Overview

The application utilizes **MongoDB with Mongoose ODM** for long-term persistence, historical records, and audits, paired with **In-Memory / Redis state caching** for low-latency live game operations and sub-millisecond leaderboard updates.

```
┌────────────────────────────────────────────────────────┐
│                   PERSISTENT STORAGE                   │
├───────────────┬───────────────────┬────────────────────┤
│ Users & Auth  │ Quizzes & Content │ Historical Records │
│ - Admins      │ - Quizzes         │ - Rooms / Sessions │
│ - Host Staff  │ - Questions Bank  │ - Submissions Log  │
│               │ - Media Assets    │ - Audit Trail      │
└───────────────┴───────────────────┴────────────────────┘
                           ▲
                           │ State Sync / Hydration
                           ▼
┌────────────────────────────────────────────────────────┐
│                   IN-MEMORY / REDIS                    │
├───────────────────────────────────┬────────────────────┤
│ Active Room States & Timers       │ Live Leaderboard   │
│ Socket ID <-> SessionToken Map    │ Buzzer Atomic Lock │
└───────────────────────────────────┴────────────────────┘
```

---

## 2. Persistent Schemas (Mongoose / MongoDB)

### 2.1 User Schema (`models/User.js`)
Stores administrators, tournament directors, and host staff.

```javascript
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

UserSchema.index({ email: 1 });
module.exports = mongoose.model('User', UserSchema);
```

---

### 2.2 Quiz Schema (`models/Quiz.js`)
Groups a collection of questions designated for an event or round.

```javascript
const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, // e.g., "BUFT National 2025 - Quarter Finals"
  description: { type: String },
  category: { type: String, default: 'Academic / Tech' },
  roundType: { 
    type: String, 
    enum: ['PRELIMINARY_MCQ', 'TEAM_MCQ', 'SEMI_BUZZER', 'GRAND_RAPID_FIRE'], 
    required: true 
  },
  defaultTimeLimitSec: { type: Number, default: 20, min: 5, max: 180 },
  defaultBasePoints: { type: Number, default: 100 },
  speedBonusEnabled: { type: Boolean, default: true },
  negativeMarkingRatio: { type: Number, default: 0 }, // e.g. 0.5 means -50% of base points
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublished: { type: Boolean, default: false }
}, { timestamps: true });

QuizSchema.index({ createdBy: 1, roundType: 1 });
module.exports = mongoose.model('Quiz', QuizSchema);
```

---

### 2.3 Question Schema (`models/Question.js`)
Stores individual questions belonging to a quiz.

```javascript
const OptionSchema = new mongoose.Schema({
  id: { type: String, required: true }, // e.g., "opt_a", "opt_b"
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true } // STRIPPED from player payloads!
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  orderIndex: { type: Number, required: true }, // Sequential order (1, 2, 3...)
  questionText: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['MCQ', 'BUZZER', 'AUDIO_VISUAL', 'RAPID_FIRE'], 
    default: 'MCQ' 
  },
  media: {
    type: { type: String, enum: ['NONE', 'IMAGE', 'AUDIO', 'VIDEO'], default: 'NONE' },
    url: { type: String, default: null }
  },
  options: { 
    type: [OptionSchema], 
    validate: [val => val.length >= 2, 'Question must have at least 2 options']
  },
  timeLimitSec: { type: Number, default: 20 },
  points: { type: Number, default: 100 },
  negativeMarking: { type: Boolean, default: false },
  explanation: { type: String, default: '' } // Revealed after question is closed
}, { timestamps: true });

QuestionSchema.index({ quizId: 1, orderIndex: 1 }, { unique: true });
module.exports = mongoose.model('Question', QuestionSchema);
```

---

### 2.4 Room / Session Schema (`models/Room.js`)
Represents an active or finished live room session.

```javascript
const RoomSchema = new mongoose.Schema({
  pin: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    minlength: 6, 
    maxlength: 6 
  }, // e.g. "784920"
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    allowLateJoin: { type: Boolean, default: false },
    maxTeams: { type: Number, default: 200 }
  },
  startedAt: { type: Date },
  endedAt: { type: Date }
}, { timestamps: true });

RoomSchema.index({ pin: 1 });
RoomSchema.index({ status: 1 });
module.exports = mongoose.model('Room', RoomSchema);
```

---

### 2.5 Team / Participant Schema (`models/Participant.js`)
Represents an entered team or student competing in a room.

```javascript
const ParticipantSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  pin: { type: String, required: true, index: true },
  sessionToken: { type: String, required: true, unique: true, index: true }, // UUID stored in localStorage
  teamName: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  captainName: { type: String, required: true },
  contactPhone: { type: String, required: true },
  contactEmail: { type: String, lowercase: true },
  teamMembers: [{ type: String }], // Up to 3 persons per BUFT rules
  
  // Game Performance Metrics
  totalScore: { type: Number, default: 0, index: true },
  currentRank: { type: Number, default: 0 },
  correctAnswersCount: { type: Number, default: 0 },
  incorrectAnswersCount: { type: Number, default: 0 },
  averageResponseTimeMs: { type: Number, default: 0 },
  
  isDisqualified: { type: Boolean, default: false },
  disqualificationReason: { type: String, default: null },
  socketId: { type: String, default: null }, // Current active socket
  isConnected: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index for room rank queries:
ParticipantSchema.index({ roomId: 1, totalScore: -1 });
module.exports = mongoose.model('Participant', ParticipantSchema);
```

---

### 2.6 Submission Schema (`models/Submission.js`)
Granular record of every single answer submitted for telemetry and audit.

```javascript
const SubmissionSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true, index: true },
  selectedOptionId: { type: String, required: true },
  
  clientSentAt: { type: Date },
  serverReceivedAt: { type: Date, required: true, default: Date.now },
  timeTakenMs: { type: Number, required: true }, // Exact response latency
  
  isCorrect: { type: Boolean, required: true },
  basePoints: { type: Number, default: 0 },
  speedBonusPoints: { type: Number, default: 0 },
  penaltyPoints: { type: Number, default: 0 },
  totalPointsAwarded: { type: Number, required: true }
}, { timestamps: true });

// Prevent duplicate answers by the same participant on the same question
SubmissionSchema.index({ roomId: 1, questionId: 1, participantId: 1 }, { unique: true });
module.exports = mongoose.model('Submission', SubmissionSchema);
```

---

### 2.7 BuzzerLog Schema (`models/BuzzerLog.js`)
Specifically used during Semi-Final buzzer rounds to resolve atomic click timing.

```javascript
const BuzzerLogSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  reactionTimeMs: { type: Number, required: true },
  outcome: { 
    type: String, 
    enum: ['CORRECT_APPROVED', 'WRONG_PENALIZED', 'PASSED_NO_PENALTY', 'PENDING'], 
    default: 'PENDING' 
  },
  awardedScore: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('BuzzerLog', BuzzerLogSchema);
```

---

## 3. In-Memory / Redis Data Structures

To deliver $\le 50\text{ms}$ updates to hundreds of clients, real-time transient state is tracked in memory:

```
Key Pattern                                 Data Type    Purpose
-----------------------------------------------------------------------------------------
room:{pin}:state                           Hash         Current state, qIndex, startTime
room:{pin}:leaderboard                     Sorted Set   teamId -> score (ZREVRANGE for Top 10)
room:{pin}:q:{qId}:answers                 Hash         optionId -> count (for live chart)
room:{pin}:q:{qId}:buzzer_lock             String       SETNX key to lock first buzz atomic
session:{sessionToken}                     Hash         socketId, teamId, teamName, pin
socket:{socketId}                          String       sessionToken
```
