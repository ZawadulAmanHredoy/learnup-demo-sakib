const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { isDbConnected } = require('../config/db');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Room = require('../models/Room');
const Participant = require('../models/Participant');
const Submission = require('../models/Submission');
const BuzzerLog = require('../models/BuzzerLog');

// In-Memory Data Storage (Active when MongoDB URI is empty)
const memoryStore = {
  users: new Map(),
  quizzes: new Map(),
  questions: new Map(),
  rooms: new Map(),
  participants: new Map(),
  submissions: new Map(),
  buzzerLogs: new Map(),
};

// Seed default initial data for instant development without requiring external database
const seedInitialData = async () => {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);

  const defaultAdmin = {
    _id: 'usr_admin_001',
    name: 'Tournament Director',
    email: 'admin@learnup.com',
    passwordHash,
    role: 'superadmin',
    institution: 'BUFT',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.users.set(defaultAdmin._id, defaultAdmin);

  // 1. Campus MCQ Quiz (133 Teams)
  const quiz1Id = 'qz_campus_mcq_2025';
  const quiz1 = {
    _id: quiz1Id,
    title: 'BUFT National Quiz 2025 — Campus MCQ Round (133 Teams)',
    description: 'Campus Live Synchronized MCQ Exam — 50 Questions | 30 Minutes',
    category: 'Collegiate National Tournament',
    roundType: 'TEAM_MCQ',
    defaultTimeLimitSec: 20,
    defaultBasePoints: 1000,
    speedBonusEnabled: true,
    negativeMarkingRatio: 0,
    createdBy: defaultAdmin._id,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.quizzes.set(quiz1Id, quiz1);

  const q1Questions = [
    {
      _id: 'q1_01',
      quizId: quiz1Id,
      orderIndex: 1,
      questionText: 'Which data structure provides O(1) average time complexity for key-value insertion, lookup, and deletion?',
      type: 'MCQ',
      segment: 'SCIENCE_TECH',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: 'Binary Search Tree (BST)', isCorrect: false },
        { id: 'opt_b', text: 'Hash Table (Hash Map)', isCorrect: true },
        { id: 'opt_c', text: 'Doubly Linked List', isCorrect: false },
        { id: 'opt_d', text: 'AVL Tree', isCorrect: false },
      ],
      timeLimitSec: 20,
      points: 1000,
      negativeMarking: false,
      explanation: 'Hash tables use hash functions to index keys into buckets, providing expected O(1) average amortized time complexity.',
    },
    {
      _id: 'q1_02',
      quizId: quiz1Id,
      orderIndex: 2,
      questionText: 'পদ্মা বহুমুখী সেতুর মোট দৈর্ঘ্য কত কিলোমিটার? (What is the total length of the Padma Multipurpose Bridge?)',
      type: 'MCQ',
      segment: 'BANGLADESH',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: '৬.১৫ কিলোমিটার (6.15 km)', isCorrect: true },
        { id: 'opt_b', text: '৭.২০ কিলোমিটার (7.20 km)', isCorrect: false },
        { id: 'opt_c', text: '৫.৮০ কিলোমিটার (5.80 km)', isCorrect: false },
        { id: 'opt_d', text: '৬.৮৫ কিলোমিটার (6.85 km)', isCorrect: false },
      ],
      timeLimitSec: 20,
      points: 1000,
      negativeMarking: false,
      explanation: 'The Padma Multipurpose Bridge main span is 6.15 km long, connecting Mawa in Munshiganj to Janjira in Shariatpur.',
    },
    {
      _id: 'q1_03',
      quizId: quiz1Id,
      orderIndex: 3,
      questionText: 'In computer networking, what is the default TCP port utilized for secure HTTPS communication?',
      type: 'MCQ',
      segment: 'SCIENCE_TECH',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: 'Port 80', isCorrect: false },
        { id: 'opt_b', text: 'Port 8080', isCorrect: false },
        { id: 'opt_c', text: 'Port 443', isCorrect: true },
        { id: 'opt_d', text: 'Port 22', isCorrect: false },
      ],
      timeLimitSec: 20,
      points: 1000,
      negativeMarking: false,
      explanation: 'Port 443 is the standard TCP port for HTTPS encrypted traffic, while Port 80 is used for unencrypted HTTP.',
    },
    {
      _id: 'q1_04',
      quizId: quiz1Id,
      orderIndex: 4,
      questionText: 'Which country won the ICC Men\'s T20 Cricket World Cup 2024?',
      type: 'MCQ',
      segment: 'SPORTS_AFFAIRS',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: 'South Africa', isCorrect: false },
        { id: 'opt_b', text: 'India', isCorrect: true },
        { id: 'opt_c', text: 'Australia', isCorrect: false },
        { id: 'opt_d', text: 'England', isCorrect: false },
      ],
      timeLimitSec: 20,
      points: 1000,
      negativeMarking: false,
      explanation: 'India defeated South Africa by 7 runs in the final held in Bridgetown, Barbados to win the 2024 ICC Men\'s T20 World Cup.',
    },
    {
      _id: 'q1_05',
      quizId: quiz1Id,
      orderIndex: 5,
      questionText: 'Which Nobel laureate is known as the "Father of the Microcredit" and founded Grameen Bank in Bangladesh?',
      type: 'MCQ',
      segment: 'BANGLADESH',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: 'Sir Fazle Hasan Abed', isCorrect: false },
        { id: 'opt_b', text: 'Professor Muhammad Yunus', isCorrect: true },
        { id: 'opt_c', text: 'Dr. Atiur Rahman', isCorrect: false },
        { id: 'opt_d', text: 'Amartya Sen', isCorrect: false },
      ],
      timeLimitSec: 20,
      points: 1000,
      negativeMarking: false,
      explanation: 'Professor Muhammad Yunus was awarded the Nobel Peace Prize in 2006 jointly with Grameen Bank for grassroots economic development.',
    }
  ];

  q1Questions.forEach(q => memoryStore.questions.set(q._id, q));

  // 2. Semi-Final Buzzer Quiz (6 Teams)
  const quiz2Id = 'qz_semi_buzzer_2025';
  const quiz2 = {
    _id: quiz2Id,
    title: 'BUFT National Quiz 2025 — Semi-Final Buzzer Round (6 Teams)',
    description: 'Fast-paced buzzer round with negative marking (-50 pts) and verbal floor control.',
    category: 'Semi-Finals',
    roundType: 'SEMI_BUZZER',
    defaultTimeLimitSec: 15,
    defaultBasePoints: 100,
    speedBonusEnabled: false,
    negativeMarkingRatio: 0.5,
    createdBy: defaultAdmin._id,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.quizzes.set(quiz2Id, quiz2);

  const q2Questions = [
    {
      _id: 'q2_01',
      quizId: quiz2Id,
      orderIndex: 1,
      questionText: 'What is the highest mountain peak in the world, situated in the Himalayas between Nepal and China?',
      type: 'BUZZER',
      segment: 'WORLD',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: 'Mount Everest (Sagarmatha / Chomolungma)', isCorrect: true },
        { id: 'opt_b', text: 'K2 (Godwin-Austen)', isCorrect: false },
        { id: 'opt_c', text: 'Kangchenjunga', isCorrect: false },
        { id: 'opt_d', text: 'Lhotse', isCorrect: false },
      ],
      timeLimitSec: 15,
      points: 100,
      negativeMarking: true,
      explanation: 'Mount Everest stands at 8,848.86 meters above sea level.',
    },
    {
      _id: 'q2_02',
      quizId: quiz2Id,
      orderIndex: 2,
      questionText: 'In artificial intelligence, what does the acronym "LLM" stand for?',
      type: 'BUZZER',
      segment: 'SCIENCE_TECH',
      media: { type: 'NONE', url: null, durationSec: 10 },
      options: [
        { id: 'opt_a', text: 'Large Language Model', isCorrect: true },
        { id: 'opt_b', text: 'Linear Logic Machine', isCorrect: false },
        { id: 'opt_c', text: 'Low-Latency Matrix', isCorrect: false },
        { id: 'opt_d', text: 'Logical Learning Module', isCorrect: false },
      ],
      timeLimitSec: 15,
      points: 100,
      negativeMarking: true,
      explanation: 'LLM stands for Large Language Model, representing deep learning models trained on vast text corpora.',
    }
  ];
  q2Questions.forEach(q => memoryStore.questions.set(q._id, q));
};

seedInitialData();

// Storage Service Facade
const storageService = {
  // Database Seeding for MongoDB
  async seedDatabase() {
    if (!isDbConnected()) return;

    try {
      // 1. Seed Admin
      const existingAdmin = await User.findOne({ email: 'admin@learnup.com' });
      let adminId = existingAdmin?._id;

      if (!existingAdmin) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('admin123', salt);
        const newAdmin = await User.create({
          name: 'Tournament Director',
          email: 'admin@learnup.com',
          passwordHash,
          role: 'superadmin',
          institution: 'BUFT',
          isActive: true,
        });
        adminId = newAdmin._id;
        console.log('✅ [MongoDB Seed] Created default host admin: admin@learnup.com');
      }

      // 2. Seed Sample Quizzes if none exist
      const quizCount = await Quiz.countDocuments();
      if (quizCount === 0) {
        for (const [id, qData] of memoryStore.quizzes.entries()) {
          const { _id, ...cleanQuiz } = qData;
          const createdQuiz = await Quiz.create({
            ...cleanQuiz,
            createdBy: adminId || 'usr_admin_001',
          });

          // Insert questions for this quiz
          const quizQuestions = Array.from(memoryStore.questions.values()).filter(ques => ques.quizId === id);
          for (const q of quizQuestions) {
            const { _id: qId, quizId, ...cleanQuestion } = q;
            await Question.create({
              ...cleanQuestion,
              quizId: createdQuiz._id,
            });
          }
        }
        console.log('✅ [MongoDB Seed] Seeded official BUFT tournament quizzes and questions.');
      }
    } catch (err) {
      console.error('⚠️ [MongoDB Seed Error]', err.message);
    }
  },

  // Users
  async findUserByEmail(email) {
    if (isDbConnected()) {
      let user = await User.findOne({ email: email.toLowerCase() });
      if (!user && email.toLowerCase() === 'admin@learnup.com') {
        await this.seedDatabase();
        user = await User.findOne({ email: email.toLowerCase() });
      }
      return user;
    }
    for (const user of memoryStore.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  },

  async findUserById(id) {
    if (isDbConnected()) {
      return await User.findById(id).select('-passwordHash');
    }
    const user = memoryStore.users.get(id);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },

  async createUser(userData) {
    if (isDbConnected()) {
      return await User.create(userData);
    }
    const newUser = {
      _id: `usr_${uuidv4().substring(0, 8)}`,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.users.set(newUser._id, newUser);
    return newUser;
  },

  // Quizzes
  async getQuizzes(creatorId) {
    if (isDbConnected()) {
      const count = await Quiz.countDocuments();
      if (count === 0) {
        await this.seedDatabase();
      }
      const filter = creatorId ? { createdBy: creatorId } : {};
      const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).lean();
      for (const q of quizzes) {
        q.questionCount = await Question.countDocuments({ quizId: q._id });
      }
      return quizzes;
    }
    const quizzes = Array.from(memoryStore.quizzes.values()).sort((a, b) => b.createdAt - a.createdAt);
    return quizzes.map(q => {
      const qCount = Array.from(memoryStore.questions.values()).filter(ques => ques.quizId === q._id).length;
      return { ...q, questionCount: qCount };
    });
  },

  async getQuizById(id) {
    if (isDbConnected()) {
      const quiz = await Quiz.findById(id).lean();
      if (!quiz) return null;
      quiz.questions = await Question.find({ quizId: id }).sort({ orderIndex: 1 }).lean();
      return quiz;
    }
    const quiz = memoryStore.quizzes.get(id);
    if (!quiz) return null;
    const questions = Array.from(memoryStore.questions.values())
      .filter(q => q.quizId === id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return { ...quiz, questions };
  },

  async createQuiz(quizData) {
    if (isDbConnected()) {
      return await Quiz.create(quizData);
    }
    const newQuiz = {
      _id: `qz_${uuidv4().substring(0, 8)}`,
      ...quizData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.quizzes.set(newQuiz._id, newQuiz);
    return newQuiz;
  },

  async updateQuiz(id, updateData) {
    if (isDbConnected()) {
      return await Quiz.findByIdAndUpdate(id, updateData, { new: true });
    }
    const existing = memoryStore.quizzes.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updateData, updatedAt: new Date() };
    memoryStore.quizzes.set(id, updated);
    return updated;
  },

  async deleteQuiz(id) {
    if (isDbConnected()) {
      await Question.deleteMany({ quizId: id });
      return await Quiz.findByIdAndDelete(id);
    }
    memoryStore.quizzes.delete(id);
    for (const [qId, q] of memoryStore.questions.entries()) {
      if (q.quizId === id) {
        memoryStore.questions.delete(qId);
      }
    }
    return true;
  },

  // Questions
  async addQuestion(quizId, questionData) {
    if (isDbConnected()) {
      const count = await Question.countDocuments({ quizId });
      const orderIndex = questionData.orderIndex || (count + 1);
      return await Question.create({ ...questionData, quizId, orderIndex });
    }
    const currentQuestions = Array.from(memoryStore.questions.values()).filter(q => q.quizId === quizId);
    const orderIndex = questionData.orderIndex || (currentQuestions.length + 1);
    const newQ = {
      _id: `q_${uuidv4().substring(0, 8)}`,
      ...questionData,
      quizId,
      orderIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.questions.set(newQ._id, newQ);
    return newQ;
  },

  async updateQuestion(questionId, updateData) {
    if (isDbConnected()) {
      return await Question.findByIdAndUpdate(questionId, updateData, { new: true });
    }
    const existing = memoryStore.questions.get(questionId);
    if (!existing) return null;
    const updated = { ...existing, ...updateData, updatedAt: new Date() };
    memoryStore.questions.set(questionId, updated);
    return updated;
  },

  async deleteQuestion(questionId) {
    if (isDbConnected()) {
      return await Question.findByIdAndDelete(questionId);
    }
    return memoryStore.questions.delete(questionId);
  },

  // Rooms
  async createRoom(roomData) {
    if (isDbConnected()) {
      return await Room.create(roomData);
    }
    const newRoom = {
      _id: `rm_${uuidv4().substring(0, 8)}`,
      ...roomData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.rooms.set(newRoom.pin, newRoom);
    return newRoom;
  },

  async findRoomByPin(pin) {
    if (isDbConnected()) {
      return await Room.findOne({ pin }).populate('quizId');
    }
    return memoryStore.rooms.get(pin) || null;
  },

  async updateRoomByPin(pin, updateData) {
    if (isDbConnected()) {
      return await Room.findOneAndUpdate({ pin }, updateData, { new: true });
    }
    const room = memoryStore.rooms.get(pin);
    if (!room) return null;
    const updated = { ...room, ...updateData, updatedAt: new Date() };
    memoryStore.rooms.set(pin, updated);
    return updated;
  },

  // Participants
  async getParticipantsByPin(pin) {
    if (isDbConnected()) {
      return await Participant.find({ pin, isDisqualified: false }).sort({ totalScore: -1 }).lean();
    }
    return Array.from(memoryStore.participants.values())
      .filter(p => p.pin === pin && !p.isDisqualified)
      .sort((a, b) => b.totalScore - a.totalScore);
  },

  async findParticipantBySessionToken(pin, sessionToken) {
    if (isDbConnected()) {
      return await Participant.findOne({ pin, sessionToken });
    }
    for (const p of memoryStore.participants.values()) {
      if (p.pin === pin && p.sessionToken === sessionToken) {
        return p;
      }
    }
    return null;
  },

  // Case-insensitive team name lookup (includes disqualified teams so a kicked name can't be reused)
  async findParticipantByTeamName(pin, teamName) {
    const target = String(teamName || '').trim().toLowerCase();
    if (isDbConnected()) {
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return await Participant.findOne({ pin, teamName: { $regex: `^${escaped}$`, $options: 'i' } }).lean();
    }
    for (const p of memoryStore.participants.values()) {
      if (p.pin === pin && String(p.teamName).trim().toLowerCase() === target) {
        return p;
      }
    }
    return null;
  },

  async countParticipants(pin) {
    if (isDbConnected()) {
      return await Participant.countDocuments({ pin, isDisqualified: false });
    }
    return Array.from(memoryStore.participants.values())
      .filter(p => p.pin === pin && !p.isDisqualified).length;
  },

  /**
   * Apply many participant updates in one round-trip (score flush after each question).
   * @param {Array<{ id: string, update: Object }>} updates
   */
  async bulkUpdateParticipants(updates) {
    if (!updates.length) return;
    if (isDbConnected()) {
      await Participant.bulkWrite(
        updates.map(({ id, update }) => ({
          updateOne: { filter: { _id: id }, update: { $set: update } },
        })),
        { ordered: false }
      );
      return;
    }
    for (const { id, update } of updates) {
      const part = memoryStore.participants.get(id);
      if (part) {
        memoryStore.participants.set(id, { ...part, ...update, updatedAt: new Date() });
      }
    }
  },

  async createParticipant(partData) {
    if (isDbConnected()) {
      return await Participant.create(partData);
    }
    const newPart = {
      _id: `part_${uuidv4().substring(0, 8)}`,
      ...partData,
      totalScore: 0,
      currentRank: 0,
      currentStreak: 0,
      correctAnswersCount: 0,
      incorrectAnswersCount: 0,
      averageResponseTimeMs: 0,
      cumulativeResponseTimeMs: 0,
      bestQuestionScore: 0,
      isDisqualified: false,
      isConnected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.participants.set(newPart._id, newPart);
    return newPart;
  },

  async updateParticipant(id, updateData) {
    if (isDbConnected()) {
      return await Participant.findByIdAndUpdate(id, updateData, { new: true });
    }
    const part = memoryStore.participants.get(id);
    if (!part) return null;
    const updated = { ...part, ...updateData, updatedAt: new Date() };
    memoryStore.participants.set(id, updated);
    return updated;
  },

  // Submissions
  async getSubmissionsByQuestion(pin, questionId) {
    if (isDbConnected()) {
      return await Submission.find({ questionId }).lean();
    }
    return Array.from(memoryStore.submissions.values()).filter(s => s.questionId === questionId && s.pin === pin);
  },

  // Bulk persist a drained submission buffer (ADR-003: one insertMany per question)
  async insertSubmissions(records) {
    if (!records.length) return [];
    if (isDbConnected()) {
      try {
        return await Submission.insertMany(records, { ordered: false });
      } catch (err) {
        // Duplicate-key errors (unique room/question/participant index) are expected on replays
        console.error('⚠️ [Submission insertMany]', err.message);
        return err.insertedDocs || [];
      }
    }
    return records.map(r => {
      const newSub = { _id: `sub_${uuidv4().substring(0, 8)}`, ...r, createdAt: new Date() };
      memoryStore.submissions.set(newSub._id, newSub);
      return newSub;
    });
  },

  async getSubmissionsByPin(pin) {
    if (isDbConnected()) {
      return await Submission.find({ pin }).lean();
    }
    return Array.from(memoryStore.submissions.values()).filter(s => s.pin === pin);
  },

  // Buzzer audit log (Semi-Final)
  async createBuzzerLog(logData) {
    if (isDbConnected()) {
      return await BuzzerLog.create(logData);
    }
    const newLog = { _id: `bzl_${uuidv4().substring(0, 8)}`, ...logData, createdAt: new Date() };
    memoryStore.buzzerLogs.set(newLog._id, newLog);
    return newLog;
  },

  async updateBuzzerLog(id, updateData) {
    if (isDbConnected()) {
      return await BuzzerLog.findByIdAndUpdate(id, updateData, { new: true });
    }
    const log = memoryStore.buzzerLogs.get(id);
    if (!log) return null;
    const updated = { ...log, ...updateData };
    memoryStore.buzzerLogs.set(id, updated);
    return updated;
  },

  async createSubmission(subData) {
    if (isDbConnected()) {
      return await Submission.create(subData);
    }
    const newSub = {
      _id: `sub_${uuidv4().substring(0, 8)}`,
      ...subData,
      createdAt: new Date(),
    };
    memoryStore.submissions.set(newSub._id, newSub);
    return newSub;
  },

  // Full Room Export Data
  async getRoomExportData(pin) {
    const room = await this.findRoomByPin(pin);
    if (!room) return null;

    let quiz = null;
    if (typeof room.quizId === 'object' && room.quizId !== null && room.quizId.title) {
      quiz = room.quizId;
    } else {
      quiz = await this.getQuizById(room.quizId);
    }

    const participants = await this.getParticipantsByPin(pin);
    const submissions = await this.getSubmissionsByPin(pin);

    return {
      room,
      quiz,
      participants,
      submissions,
    };
  }
};

module.exports = storageService;
