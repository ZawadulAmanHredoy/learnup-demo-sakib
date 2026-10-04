# Backend Service — LearnUp Live Arena
### Node.js + Express + Socket.IO + Mongoose

This directory contains the real-time game engine, REST APIs, and authoritative server timers.

#### Core Directories
- `config/`: Database and environment configuration.
- `controllers/`: Express request handlers for auth, quizzes, and rooms.
- `models/`: Mongoose schemas for User, Quiz, Question, Room, Participant, Submission.
- `routes/`: REST API endpoints (`/api/auth`, `/api/quizzes`, `/api/rooms`).
- `services/`: Scoring, streak calculations, and Excel export services.
  - `liveEngine.js`: question lifecycle (countdown → active ⇄ paused → locked → reveal), bulk score flush, buzzer orchestration.
  - `submissionBuffer.js`: in-memory answer ingest, one answer per team, drained in one bulk insert on lock.
  - `timerService.js`: authoritative countdown with pause/resume.
  - `buzzerService.js`: synchronous atomic buzzer lock with re-open exclusions.
  - `sessionRegistry.js`: in-memory sessionToken → team map used by the hot paths.
- `sockets/`: Socket.IO room lifecycle and game state machine handlers (`gameSocket.js` host/stage, `playerSocket.js` players).
- `tests/`: `npm test` — unit tests for the engine services plus a Socket.IO end-to-end player journey (in-memory store).

*Refer to [doc/TechSpec.md](../doc/TechSpec.md) and [doc/Schema.md](../doc/Schema.md) for full specifications.*
