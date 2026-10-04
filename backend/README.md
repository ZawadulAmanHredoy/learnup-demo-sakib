# Backend Service — LearnUp Live Arena
### Node.js + Express + Socket.IO + Mongoose

This directory contains the real-time game engine, REST APIs, and authoritative server timers.

#### Core Directories
- `config/`: Database and environment configuration.
- `controllers/`: Express request handlers for auth, quizzes, and rooms.
- `models/`: Mongoose schemas for User, Quiz, Question, Room, Participant, Submission.
- `routes/`: REST API endpoints (`/api/auth`, `/api/quizzes`, `/api/rooms`).
- `services/`: Scoring, streak calculations, and Excel export services.
- `sockets/`: Socket.IO room lifecycle and game state machine handlers.

*Refer to [doc/TechSpec.md](../doc/TechSpec.md) and [doc/Schema.md](../doc/Schema.md) for full specifications.*
