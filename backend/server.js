const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');

const { connectDB, isDbConnected } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const roomRoutes = require('./routes/roomRoutes');
const { setupGameSockets } = require('./sockets/gameSocket');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with cross-origin resilience
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check Endpoint (INF-01)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LearnUp Live Arena Server is healthy and active.',
    database: isDbConnected() ? 'connected (MongoDB)' : 'in-memory-resilience-mode (URI empty)',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rooms', roomRoutes);

// Centralized Error Handling Middleware (per Fullstack Standards Section 4.10)
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An internal server error occurred.';
  res.status(statusCode).json({
    success: false,
    data: null,
    error: message,
  });
});

const storageService = require('./services/storageService');

// Initialize Socket Engine
setupGameSockets(io);

// Connect DB and Start HTTP Server
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  await storageService.seedDatabase();

  server.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 LearnUp Live Arena Server running on port ${PORT}`);
    console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📡 Socket.IO Real-time Engine initialized`);
    console.log(`👤 Default Admin: admin@learnup.com | Password: admin123`);
    console.log(`=============================================================\n`);
  });
}

// Graceful Shutdown Handlers (Section 4.14)
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP and Socket server');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP and Socket server');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };
