const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const storageService = require('../services/storageService');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'learnup_live_arena_secret_jwt_key_2025_academic_tournament',
    { expiresIn: '24h' }
  );
};

// @desc    Register a new tournament administrator/host
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, institution = 'BUFT', role = 'host' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Please provide name, email, and password.',
      });
    }

    const existingUser = await storageService.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'An account with this email already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await storageService.createUser({
      name,
      email: email.toLowerCase(),
      passwordHash,
      institution,
      role,
      isActive: true,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          institution: user.institution,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Server error during registration.',
    });
  }
};

// @desc    Host/Admin login
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Please provide email and password.',
      });
    }

    const user = await storageService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid credentials.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid credentials.',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          institution: user.institution,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Server error during authentication.',
    });
  }
};

// @desc    Get current authenticated profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        institution: req.user.institution,
      },
    },
    error: null,
  });
};

module.exports = {
  register,
  login,
  getMe,
};
