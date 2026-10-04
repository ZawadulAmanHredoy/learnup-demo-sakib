# Project Tracker & Sprint Task Board (Tracker)
## Project: LearnUp Live Arena

---

## 1. Master Task Kanban Board

Legend: `[ ] TODO` | `[/] IN PROGRESS` | `[x] DONE`  
Priority: `P0` (Critical / Blocker), `P1` (High / Core Feature), `P2` (Polish / Enhancement)  
Assigned To: `Dev A` (Backend & Real-Time Engine), `Dev B` (Frontend & Stage UI/UX)

---

### Epic 1: Infrastructure & Monorepo Foundation

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **INF-01** | Dev A | P0 | Setup `backend/` Node.js Express server, dotEnv, and CORS config | [ ] | Server boots on port 5000 with `/api/health` returning 200 OK. |
| **INF-02** | Dev B | P0 | Setup `frontend/` React with Vite, Tailwind CSS, and React Router | [ ] | App renders with high-contrast color tokens and fonts loaded. |
| **INF-03** | Dev A | P0 | Configure MongoDB connection & Mongoose schemas | [ ] | Mongoose connects and creates collections (`users`, `quizzes`, etc.). |
| **INF-04** | Dev A | P0 | Setup Socket.IO server with namespace and room support | [ ] | Sockets can connect, exchange test ping/pong, and log connection. |
| **INF-05** | Dev B | P0 | Setup Socket.IO client context hook (`useSocket`) in React | [ ] | React client connects to backend and reflects `connected: true`. |

---

### Epic 2: Authentication & Host Administration

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **AUT-01** | Dev A | P0 | Build JWT Auth API (`/register`, `/login`, `/me`) with bcrypt hashing | [ ] | Password verified via bcrypt, JWT returned with 24h expiry. |
| **AUT-02** | Dev B | P0 | Build Admin Login UI (`/admin/login`) with error banners | [ ] | Host can log in, store JWT in cookie/storage, and redirect. |
| **AUT-03** | Dev A | P0 | Build Quiz CRUD APIs (`GET/POST/PUT/DELETE /api/quizzes`) | [ ] | Quizzes created, fetched, and edited with full validation. |
| **AUT-04** | Dev B | P1 | Build Quiz Manager UI (`/admin/quizzes`) with question editor | [ ] | Host can add/edit questions, options, point values, and timers. |

---

### Epic 3: Core Real-Time Synchronized Engine

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **ENG-01** | Dev A | P0 | Implement Room Finite State Machine (`LOBBY` $\rightarrow$ `ACTIVE` $\rightarrow$ `REVEAL`) | [ ] | State transitions emit structured payloads to room sockets. |
| **ENG-02** | Dev A | P0 | Implement Authoritative Server Countdown Timer | [ ] | Timer counts down to zero and automatically locks submissions. |
| **ENG-03** | Dev A | P0 | Implement Anti-Cheat answer sanitizer in `sync:question_active` | [ ] | `isCorrect` property is 100% stripped from outbound player packets. |
| **ENG-04** | Dev B | P0 | Build Host Cockpit UI (`/admin/rooms/:pin/control`) | [ ] | Host can see live joined count and trigger Next, Lock, Reveal. |
| **ENG-05** | Dev B | P0 | Build Mobile Player Screen (`/play`) with 4-color touch buttons | [ ] | Contestant sees synchronized question and colored tap cards. |
| **ENG-06** | Dev A | P0 | Implement Answer Submission handler with in-memory buffer | [ ] | Submissions registered with server timestamp and speed bonus. |
| **ENG-07** | Dev B | P0 | Build Mobile Locked State & Immediate Answer Feedback banners | [ ] | Tapping an option displays "Locked In" and disables further taps. |

---

### Epic 4: Stage Broadcast Screen & Analytics

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **STG-01** | Dev B | P0 | Build Stage Screen Lobby (`/stage/:pin`) with giant QR and PIN | [ ] | QR code renders, scans directly to `/play?pin=...`, teams appear. |
| **STG-02** | Dev B | P0 | Build Stage Active Question layout (48px font, circular timer ring) | [ ] | Screen readable from 30 meters away; timer smoothly depletes. |
| **STG-03** | Dev A | P1 | Compute live answer distribution stats `{ A: count, B: count ... }` | [ ] | Aggregate counts calculated and emitted in `sync:answer_reveal`. |
| **STG-04** | Dev B | P1 | Build Stage Answer Reveal with animated distribution bar chart | [ ] | Correct answer card expands in gold; charts animate upward. |
| **STG-05** | Dev A | P0 | Implement Leaderboard ranking service with streak multipliers | [ ] | Calculates Top 10 rankings sorted by score and speed. |
| **STG-06** | Dev B | P0 | Build Stage Leaderboard with sliding rank transitions & delta arrows | [ ] | Top 10 teams animate smoothly into their updated positions. |
| **STG-07** | Dev B | P1 | Integrate audio synthesizer & SFX triggers (tick, gong, fanfare) | [ ] | Sounds play in sync with state transitions on stage screen. |

---

### Epic 5: Special Tournament Rounds (Buzzer & Rapid Fire)

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **RND-01** | Dev A | P1 | Build atomic buzzer lockout handler (`player:buzz`) | [ ] | First incoming buzzer locks room; subsequent buzzes rejected. |
| **RND-02** | Dev B | P1 | Build Mobile Buzzer UI with giant haptic button | [ ] | Buzz button triggers vibration and sound; locks when opponent hits. |
| **RND-03** | Dev A | P1 | Build Buzzer judgment endpoint with negative marking ($-50\text{ pts}$) | [ ] | Host awards points or deducts negative penalty; updates score. |
| **RND-04** | Dev B | P2 | Build 60-second Rapid-Fire continuous stream mode UI | [ ] | Rapid-fire timer ticks down while questions cycle dynamically. |

---

### Epic 6: Resilience, Auditing & Pre-Ship Polish

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **REL-01** | Dev A | P0 | Build socket reconnection endpoint (`room:reconnect`) with UUID | [ ] | Disconnected user refreshes page and re-hydrates score and state. |
| **REL-02** | Dev B | P0 | Persist `sessionToken` in `localStorage` on mobile join | [ ] | Token persists across page reloads and tab closures. |
| **REL-03** | Dev A | P1 | Build Excel / CSV export service (`/api/rooms/:pin/export`) | [ ] | Downloads valid `.xlsx` file with team scores, accuracy, and latency. |
| **REL-04** | Dev B | P1 | Build Final Podium celebration with confetti canvas animation | [ ] | 1st, 2nd, and 3rd place podium displays with confetti blast. |
| **REL-05** | Both | P0 | Run 500-client simulated load test and end-to-end dress rehearsal | [ ] | Zero crashes, sub-50ms sync verified with 500 active sockets. |
