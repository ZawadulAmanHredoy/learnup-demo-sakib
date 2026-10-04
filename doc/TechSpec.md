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
| `room:reconnected_ack` | Server $\rightarrow$ Player | `{ success, participant, roomStatus, snapshot, buzzer, finalSummary?, serverTime }` or `{ success: false, reason }` | Restores the exact screen: `snapshot.phase` (`COUNTDOWN`/`ACTIVE`/`PAUSED`/`CLOSING`/`LOCKED`/`REVEALED`), the sanitized question with `serverDeadline`/`remainingMs`, `hasAnswered` + `selectedOptionId`, and the private result if already revealed. Failure reasons: `SESSION_NOT_FOUND`, `ROOM_NOT_FOUND`, `DISQUALIFIED`, `INVALID_SESSION`. |
| `room:player_list` | Server $\rightarrow$ Admin/Stage | `{ totalCount, participants: [{ id, teamName, institution, score, rank, isConnected }] }` | Sent to the `:host` and `:stage` channels only (debounced 200 ms). Never contains session tokens or phone numbers. |
| `player:leave` | Player $\rightarrow$ Server | — | Unbinds this device from its team (team stays registered). |
| `time:sync` | Player $\rightarrow$ Server (ack) | `{ clientSentAt }` $\rightarrow$ `{ clientSentAt, serverTime }` | NTP-style probe; client keeps the lowest-RTT sample: `offset = serverTime − (sent + received) / 2`. |

**Registration rules (`room:join`)**: the server issues the `sessionToken` (UUID v4). `room:joined_ack` failures carry `error` + human `message`: `INVALID_PIN`, `INVALID_TEAMNAME`, `INVALID_INSTITUTION`, `INVALID_CAPTAINNAME`, `INVALID_PHONE`, `ROOM_NOT_FOUND`, `ROOM_CLOSED`, `ROOM_FULL`, `LATE_JOIN_DISABLED`, `TEAM_NAME_TAKEN` (case-insensitive, race-safe), `DISQUALIFIED`. After join/reconnect the socket is **bound** to that team; answers and buzzes are attributed to the binding, never to a token in the payload.
| `room:kick` | Admin $\rightarrow$ Server | `{ pin, participantId, reason }` | Admin boots a participant. Target socket is disconnected. |

---

### 2.2 Host Control & Game Sync Events

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `host:start_question` | Admin $\rightarrow$ Server | `{ pin, questionIndex }` | Host starts question. Server emits countdown. |
| `sync:countdown` | Server $\rightarrow$ Room | `{ durationMs: 3000, serverTimestamp }` | Signals 3-second ready countdown on all screens. |
| `sync:question_active` | Server $\rightarrow$ Room | `{ questionIndex, questionText, type, media, options, timeLimitSec, serverDeadline }` | **Crucial:** Options contain `id` and `text` only. `isCorrect` is strictly omitted. |
| `player:submit_answer` | Player $\rightarrow$ Server | `{ pin, sessionToken, questionId, selectedOptionId, clientSentAt }` | Player submits selected choice. |
| `player:answer_ack` | Server $\rightarrow$ Player | `{ success: true, received: true, timeTakenMs, selectedOptionId }` or `{ success: false, reason }` | Immediate receipt confirmation (also delivered as the emit ack callback). Teammates' devices receive a copy with `fromTeammate: true`. Reasons: `EXPIRED`, `ALREADY_SUBMITTED`, `PAUSED`, `NOT_STARTED`, `INVALID_OPTION`, `STALE_QUESTION`, `DISQUALIFIED`, `NOT_JOINED`. |
| `host:live_telemetry` | Server $\rightarrow$ Admin/Stage | `{ answeredCount, totalCount, distribution }` | Sent to `:host` and `:stage` only — players never see the live distribution. |
| `host:lock_question` | Admin $\rightarrow$ Server | `{ pin }` | Host triggers early answer cutoff. |
| `host:pause_timer` / `host:resume_timer` | Admin $\rightarrow$ Server | `{ pin }` | Freeze / resume the authoritative countdown. Paused time is excluded from response time. |
| `sync:timer_paused` | Server $\rightarrow$ Room | `{ remainingMs, serverTime }` | Inputs disabled, "Competition Paused by Host" banner. |
| `sync:timer_resumed` | Server $\rightarrow$ Room | `{ serverDeadline, remainingMs, serverTime }` | New deadline after the pause. |
| `sync:question_locked` | Server $\rightarrow$ Room | `{ totalAnswersReceived, serverLockedAt, reason }` | All answer inputs disabled across clients. `reason`: `TIME_UP`, `ALL_ANSWERED`, `HOST_LOCK`, `HOST_REVEAL`, `SUPERSEDED`. Packets already in flight are still accepted for 1000 ms (except `ALL_ANSWERED`); later ones get `EXPIRED`. |
| `host:reveal_answer` | Admin $\rightarrow$ Server | `{ pin }` | Host initiates reveal. |
| `sync:answer_reveal` | Server $\rightarrow$ Room | `{ correctOptionId, explanation, distribution: { [optionId]: count } }` | Transmits correct answer and aggregate stats. |
| `sync:player_result` | Server $\rightarrow$ Single Player | `{ isCorrect, missed, selectedOptionId, correctOptionId, correctOptionText, pointsEarned, basePoints, speedBonus, streakBonus, penaltyPoints, multiplier, streak, badge, timeTakenMs, currentScore, rank, previousRank, rankDelta, totalTeams }` | Private evaluation sent to each team's private channel (`{pin}:player:{sessionToken}`). `basePoints + speedBonus + streakBonus = pointsEarned`. |
| `host:show_leaderboard`| Admin $\rightarrow$ Server | `{ pin }` | Host triggers leaderboard view. |
| `sync:leaderboard` | Server $\rightarrow$ Room | `{ topTen: [{ rank, teamName, score, delta }], totalTeams }` | Stage and players view current tournament rankings (Rules §3 tie-break order). |
| `sync:player_rank` | Server $\rightarrow$ Single Player | `{ rank, totalTeams, score, delta, streak, isLastQuestion }` | Personal rank banner on the leaderboard step. |
| `sync:player_final_summary` | Server $\rightarrow$ Single Player | `{ teamName, institution, totalScore, rank, totalTeams, totalQuestions, answered, correct, incorrect, missed, accuracyPct, averageResponseTimeMs, bestQuestionScore }` | Sent with the final leaderboard; also returned in `room:reconnected_ack` once the room is `FINISHED`. |

---

### 2.3 Buzzer Mode Events (Semi-Finals)

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `host:activate_buzzer` | Admin $\rightarrow$ Server | `{ pin, questionId }` | Server unlocks buzzer for all connected contestants. |
| `sync:buzzer_ready` | Server $\rightarrow$ Room | `{ questionId, unlockedAt }` | Mobile screens illuminate giant buzzer button. |
| `player:buzz` | Player $\rightarrow$ Server | `{ pin, sessionToken, clientTimestamp }` | Contestant hits buzzer. |
| `sync:buzzer_locked` | Server $\rightarrow$ Room | `{ winnerTeamId, winnerTeamName, reactionTimeMs }` | Broadcast to all clients. Winner gets the floor; others locked out. |
| `player:buzz_ack` | Server $\rightarrow$ Winning Player | `{ status: 'WINNER', reactionTimeMs }` | The buzz acquired the atomic lock. |
| `player:buzz_lockout` | Server $\rightarrow$ Player | `{ status: 'LOCKED_OUT' \| 'EXCLUDED' \| 'NOT_OPEN' \| 'NOT_JOINED', winnerTeamName }` | The buzz lost the race, or this team already attempted the question. |
| `host:judge_buzzer` | Admin $\rightarrow$ Server | `{ pin, winnerTeamId, verdict: 'CORRECT' \| 'WRONG' \| 'PASS' }` | Host assigns marks or applies negative penalty. The server judges the team that actually holds the lock. CORRECT = +question points (default 100); WRONG = −50 % of that and the team is excluded; WRONG/PASS re-open the buzzer for the remaining teams. |
| `sync:buzzer_judged` | Server $\rightarrow$ Room | `{ teamId, teamName, verdict, deltaPoints, newScore }` | Verdict broadcast. |
| `sync:player_score` | Server $\rightarrow$ Single Player | `{ verdict, deltaPoints, currentScore, rank, totalTeams }` | Private score update for the judged team. |
| `sync:buzzer_closed` | Server $\rightarrow$ Room | `{ reason: 'NO_ELIGIBLE_TEAMS', questionId }` | Every team has attempted; nobody left to buzz. |

`sync:buzzer_ready` additionally carries `{ serverTime, roundId, reOpened, excludedTeamIds, correctPoints, penaltyPoints }`.

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
   - In memory, `submissionBuffer.ingest` performs the duplicate check and insert synchronously, so one team can never record two answers even before the batch reaches MongoDB.
4. **Public REST payloads**:
   - `GET /api/rooms/:pin/state` returns the full quiz (with answer keys) and participants only to an authenticated host. Anonymous callers (stage, players) get questions without `isCorrect`/`explanation` and participants without session tokens or phone numbers.

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
