# Technical Specification & System Architecture (TechSpec)
## Project: LearnUp Live Arena

---

## 1. System Architecture Overview

LearnUp Live Arena is engineered around an **Event-Driven, Authoritative Server Model** built with **Node.js/Express, Socket.IO, and MongoDB**, consumed by modern **React frontends** (Admin, Stage, Player).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           REACT CLIENTS                                │
 │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
 │  │ Admin Dashboard  │  │ Stage Screen 4K  │  │ Mobile Player App    │  │
 │  │ (Host Cockpit)   │  │ (Auditorium TV)  │  │ (Contestant PWA)     │  │
 │  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
 └───────────┼─────────────────────┼───────────────────────┼──────────────┘
             │                     │                       │
             ▼                     ▼                       ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      EXPRESS & SOCKET.IO SERVER                        │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ REST API Layer (Express)                                         │  │
 │  │ - /api/auth: JWT issuance & verification                         │  │
 │  │ - /api/quizzes: Quiz CRUD & Media upload handling                │  │
 │  │ - /api/rooms: Room initialization, pin allocation & CSV exports  │  │
 │  └──────────────────────────────────────────────────────────────────┘  │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ Real-Time Game Engine (Socket.IO)                                │  │
 │  │ - Room State Machine (Lobby, Active, Locked, Reveal, Leaderboard)│  │
 │  │ - Authoritative Server Timer & Countdown Synchronizer            │  │
 │  │ - Atomic Buzzer Lockout Manager                                  │  │
 │  │ - Anti-Cheat Answer Evaluator (Strips answers until reveal)      │  │
 │  │ - Real-time Score & Streak Calculator                            │  │
 │  └──────────────────────────────────────────────────────────────────┘  │
 └───────────────────┬─────────────────────────────────┬──────────────────┘
                     │                                 │
                     ▼                                 ▼
 ┌───────────────────────────────────┐ ┌──────────────────────────────────┐
 │       REDIS / IN-MEMORY CACHE     │ │         MONGODB CLUSTER          │
 │ - Active Room State & Timers      │ │ - Question Bank & Media Refs     │
 │ - Real-time Leaderboard ZSET      │ │ - Persistent Room Records        │
 │ - Atomic Buzzer Lock (SETNX)      │ │ - Audited Submissions & Logs     │
 └───────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 2. WebSocket Protocol & Event Dictionary

Communication is partitioned into distinct Socket.IO rooms by PIN (`room:pin`).

### 2.1 Room & Session Lifecycle Events

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `room:join` | Player $\rightarrow$ Server | `{ pin, teamName, institution, captainName, contactPhone, sessionToken }` | Contestant enters room lobby. |
| `room:joined_ack` | Server $\rightarrow$ Player | `{ success: true, participantId, sessionToken, currentRoomState }` | Returns assigned participant ID and current room state. |
| `room:reconnect` | Player $\rightarrow$ Server | `{ pin, sessionToken }` | Auto-invoked on network reconnection or page refresh. |
| `room:player_list` | Server $\rightarrow$ Admin/Stage | `{ totalCount, participants: [{ teamName, institution }] }` | Broadcast to lobby display when a team joins or leaves. |
| `room:kick` | Admin $\rightarrow$ Server | `{ pin, participantId, reason }` | Admin boots a participant. Target socket is disconnected. |

---

### 2.2 Host Control & Game Sync Events

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `host:start_question` | Admin $\rightarrow$ Server | `{ pin, questionIndex }` | Host starts question. Server emits countdown. |
| `sync:countdown` | Server $\rightarrow$ Room | `{ durationMs: 3000, serverTimestamp }` | Signals 3-second ready countdown on all screens. |
| `sync:question_active` | Server $\rightarrow$ Room | `{ questionIndex, questionText, type, media, options, timeLimitSec, serverDeadline }` | **Crucial:** Options contain `id` and `text` only. `isCorrect` is strictly omitted. |
| `player:submit_answer` | Player $\rightarrow$ Server | `{ pin, sessionToken, questionId, selectedOptionId, clientSentAt }` | Player submits selected choice. |
| `player:answer_ack` | Server $\rightarrow$ Player | `{ received: true, timeTakenMs }` | Immediate receipt confirmation to client. |
| `host:lock_question` | Admin $\rightarrow$ Server | `{ pin }` | Host triggers early answer cutoff. |
| `sync:question_locked` | Server $\rightarrow$ Room | `{ totalAnswersReceived, serverLockedAt }` | All answer inputs disabled across clients. |
| `host:reveal_answer` | Admin $\rightarrow$ Server | `{ pin }` | Host initiates reveal. |
| `sync:answer_reveal` | Server $\rightarrow$ Room | `{ correctOptionId, explanation, distribution: { [optionId]: count } }` | Transmits correct answer and aggregate stats. |
| `sync:player_result` | Server $\rightarrow$ Single Player | `{ isCorrect, pointsEarned, speedBonus, currentScore, rank }` | Private evaluation sent to each participant. |
| `host:show_leaderboard`| Admin $\rightarrow$ Server | `{ pin }` | Host triggers leaderboard view. |
| `sync:leaderboard` | Server $\rightarrow$ Room | `{ topTen: [{ rank, teamName, score, delta }], totalTeams }` | Stage and players view current tournament rankings. |

---

### 2.3 Buzzer Mode Events (Semi-Finals)

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `host:activate_buzzer` | Admin $\rightarrow$ Server | `{ pin, questionId }` | Server unlocks buzzer for all connected contestants. |
| `sync:buzzer_ready` | Server $\rightarrow$ Room | `{ questionId, unlockedAt }` | Mobile screens illuminate giant buzzer button. |
| `player:buzz` | Player $\rightarrow$ Server | `{ pin, sessionToken, clientTimestamp }` | Contestant hits buzzer. |
| `sync:buzzer_locked` | Server $\rightarrow$ Room | `{ winnerTeamId, winnerTeamName, reactionTimeMs }` | Broadcast to all clients. Winner gets the floor; others locked out. |
| `host:judge_buzzer` | Admin $\rightarrow$ Server | `{ pin, winnerTeamId, verdict: 'CORRECT' \| 'WRONG' \| 'PASS' }` | Host assigns marks or applies negative penalty. |

---

## 3. Anti-Cheat & Security Architecture

1. **Payload Stripping (Zero-Trust Client)**:
   - When `sync:question_active` is generated, the server runs:
     ```javascript
     const sanitizedOptions = question.options.map(opt => ({
       id: opt.id,
       text: opt.text
     })); // isCorrect is NEVER leaked
     ```
2. **Server-Authoritative Clock**:
   - Scores with speed bonuses are calculated using:
     $$\Delta t = T_{\text{server\_received}} - T_{\text{question\_started}}$$
   - Any packet arriving after $T_{\text{question\_started}} + \text{TimeLimit} + 1000\text{ms}$ grace period is flagged as `EXPIRED` and awarded 0 points.
3. **Atomic Answer Lock**:
   - In MongoDB, a unique compound index `{ roomId: 1, questionId: 1, participantId: 1 }` prevents concurrent double submissions from a single team.

---

## 4. REST API Endpoint Specifications

All administrative endpoints require an `Authorization: Bearer <JWT>` header.

### 4.1 Authentication (`/api/auth`)
- `POST /api/auth/login`: `{ email, password }` $\rightarrow$ `{ token, user: { id, name, role } }`
- `POST /api/auth/register`: `{ name, email, password, institution }` $\rightarrow$ `{ token, user }`
- `GET /api/auth/me`: $\rightarrow$ returns authenticated user profile.

### 4.2 Quizzes & Questions (`/api/quizzes`)
- `GET /api/quizzes`: Returns list of all quizzes created by the user with question counts.
- `POST /api/quizzes`: Creates a new quiz template with settings and round types.
- `GET /api/quizzes/:id`: Retrieves quiz metadata and associated questions.
- `PUT /api/quizzes/:id`: Updates title, round types, negative marking settings.
- `DELETE /api/quizzes/:id`: Deletes quiz and cascaded questions.
- `POST /api/quizzes/:id/questions`: Appends a new question (text, media, options, timeLimit).
- `PUT /api/questions/:questionId`: Updates an existing question.
- `DELETE /api/questions/:questionId`: Removes a question.

### 4.3 Room Sessions (`/api/rooms`)
- `POST /api/rooms`: Body: `{ quizId, settings }` $\rightarrow$ Allocates a random 6-digit numeric PIN, creates Room document in `LOBBY` state, returns `{ pin, roomId }`.
- `GET /api/rooms/:pin`: Fetches public room metadata for joining contestants.
- `GET /api/rooms/:pin/state`: Host restoration endpoint to recover state after page reload.
- `GET /api/rooms/:pin/export`: Generates downloadable Excel/CSV file with full submission breakdown, accuracy, and final team rankings.

---

## 5. Scalability & High-Concurrency Strategy

During the BUFT Competition, 133 teams (399+ participants) plus stage monitors will be connected concurrently:

1. **Lightweight Socket Payloads**:
   - Payloads are minimized ($\le 2\text{ KB}$) to eliminate network congestion on venue Wi-Fi.
2. **Horizontal Scaling via Redis Adapter**:
   - If scaling to multiple Node.js worker instances, `@socket.io/redis-adapter` handles cross-instance broadcasts seamlessly:
     ```javascript
     const { createAdapter } = require('@socket.io/redis-adapter');
     const { createClient } = require('redis');
     io.adapter(createAdapter(pubClient, subClient));
     ```
3. **Database Write Throttling**:
   - During live question answering, submissions are registered in an in-memory queue/batch buffer and flushed to MongoDB via `Submission.insertMany()` immediately upon question lock, ensuring zero database bottlenecks during active answering.
