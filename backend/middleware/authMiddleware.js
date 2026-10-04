const jwt = require('jsonwebtoken');
const storageService = require('../services/storageService');

const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Not authenticated. Please log in with a valid host/admin token.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'learnup_live_arena_secret_jwt_key_2025_academic_tournament');
    const user = await storageService.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'User session expired or account not found.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid or expired authorization token.',
    });
  }
};

const requireHostOrAdmin = (req, res, next) => {
  if (!req.user || !['superadmin', 'host', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: Requires host or tournament director privileges.',
    });
  }
  next();
};

module.exports = {
  protect,
  requireHostOrAdmin,
};
