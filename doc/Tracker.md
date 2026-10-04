# Project Tracker & Sprint Task Board (Tracker)
## Project: LearnUp Live Arena

---

## 1. Master Task Kanban Board (Full-Stack Vertical Slices)

Legend: `[ ] TODO` | `[/] IN PROGRESS` | `[x] DONE`  
Priority: `P0` (Critical / Blocker), `P1` (High / Core Feature), `P2` (Polish / Enhancement)  
Assigned To:
- **Dev 1**: Host Orchestration & Stage Broadcast (Full-Stack)
- **Dev 2**: Player Experience & Real-Time Engine (Full-Stack)

---

### Epic 1: Infrastructure & Monorepo Foundation

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **INF-01** | Dev 1 | P0 | Setup `backend/` Express server, dotEnv, CORS, and root workspaces | [x] | Server boots on port 5000 with `/api/health` returning 200 OK. |
| **INF-02** | Dev 2 | P0 | Setup `frontend/` React with Vite, Tailwind CSS, and React Router | [x] | App renders with high-contrast color tokens and fonts loaded. |
| **INF-03** | Dev 1 | P0 | Configure MongoDB connection & Mongoose base setup | [x] | Graceful dual-mode: Mongoose connects when URI present, resilient in-memory fallback when empty. |
| **INF-04** | Dev 2 | P0 | Setup Socket.IO server & client hook (`useSocket`) in React | [x] | React client connects to backend and reflects `connected: true`. |

---

### Epic 2: Quiz Management & Player Onboarding

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **AUT-01** | Dev 1 | P0 | Build JWT Auth API (`/register`, `/login`, `/me`) & User Schema | [x] | Password verified via bcrypt, JWT returned with 24h expiry. |
| **AUT-02** | Dev 1 | P0 | Build Admin Login UI (`/admin/login`) with error banners | [x] | Host can log in, store JWT in cookie/storage, and redirect. |
| **QZ-01** | Dev 1 | P0 | Build Quiz & Question CRUD APIs (`/api/quizzes`) | [x] | Quizzes created, fetched, and edited with full validation. |
| **QZ-02** | Dev 1 | P1 | Build Quiz Manager UI (`/admin/quizzes`) with question editor | [x] | Host can add/edit questions, options, point values, and timers. |
| **PLY-01** | Dev 2 | P0 | Build Participant Schema & `room:join` socket handler | [x] | Contestant registered with team name, captain, phone, and UUID. |
| **PLY-02** | Dev 2 | P0 | Build Mobile Player Join Form & Lobby Waiting Screen (`/play`) | [x] | Contestant enters PIN and details, sees animated waiting pulse. |

---

### Epic 3: Core Real-Time Synchronized Engine & MCQ Gameplay

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **ENG-01** | Dev 1 | P0 | Implement Room creation API (`POST /api/rooms`) with 6-digit PIN | [x] | Generates unique 6-digit PIN and initializes room in `LOBBY` state. |
| **ENG-02** | Dev 1 | P0 | Build Host Cockpit UI (`/admin/rooms/:pin/control`) | [x] | Host can see live joined count and trigger Next, Lock, Reveal. |
| **ENG-03** | Dev 2 | P0 | Implement Anti-Cheat answer sanitizer in `sync:question_active` | [x] | `isCorrect` property is 100% stripped from outbound player packets. |
| **ENG-04** | Dev 2 | P0 | Implement Authoritative Server Countdown Timer | [x] | Timer counts down to zero and automatically locks submissions. |
| **ENG-05** | Dev 2 | P0 | Build Mobile Player Screen (`/play`) with 4-color touch buttons | [x] | Contestant sees synchronized question and colored tap cards. |
| **ENG-06** | Dev 2 | P0 | Implement Answer Submission handler with in-memory buffer | [x] | Submissions registered with server timestamp and speed bonus. |
| **ENG-07** | Dev 2 | P0 | Build Mobile Locked State & Immediate Answer Feedback banners | [x] | Tapping an option displays "Locked In" and disables further taps. |

---

### Epic 4: Stage Broadcast Screen, Scoring & Leaderboards

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **STG-01** | Dev 1 | P0 | Build Stage Screen Lobby (`/stage/:pin`) with giant QR and PIN | [x] | QR code renders, scans directly to `/play?pin=...`, teams appear. |
| **STG-02** | Dev 1 | P0 | Build Stage Active Question layout (48px font, circular timer ring) | [x] | Screen readable from 30 meters away; timer smoothly depletes. |
| **STG-03** | Dev 1 | P1 | Compute live answer distribution stats `{ A: count, B: count ... }` | [x] | Aggregate counts calculated and emitted in `sync:answer_reveal`. |
| **STG-04** | Dev 1 | P1 | Build Stage Answer Reveal with animated distribution bar chart | [x] | Correct answer card expands in gold; charts animate upward. |
| **SCR-01** | Dev 2 | P0 | Implement Scoring engine: $Base + SpeedBonus \times Streak$ | [x] | Accurately calculates points and streak multipliers. |
| **SCR-02** | Dev 2 | P0 | Emit private player results (`sync:player_result`) | [x] | Contestants see points earned, streak flame, and updated rank. |
| **STG-05** | Dev 1 | P0 | Build Stage Leaderboard with sliding rank transitions & delta arrows | [x] | Top 10 teams animate smoothly into their updated positions. |
| **STG-06** | Dev 1 | P1 | Build Final Podium celebration with canvas confetti | [x] | 1st, 2nd, and 3rd place podium displays with confetti blast. |

---

### Epic 5: Special Tournament Rounds (Buzzer & Rapid Fire)

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **BZZ-01** | Dev 2 | P1 | Build atomic buzzer lockout handler (`player:buzz`) | [x] | First incoming buzzer locks room; subsequent buzzes rejected. |
| **BZZ-02** | Dev 2 | P1 | Build Mobile Buzzer UI with giant haptic button | [x] | Buzz button triggers vibration and sound; locks when opponent hits. |
| **BZZ-03** | Dev 1 | P1 | Build Host Buzzer judgment controls with negative marking ($-50\text{ pts}$) | [x] | Host awards points or deducts negative penalty; updates score. |
| **BZZ-04** | Dev 1 | P1 | Build Stage Buzzer Spotlight View | [x] | Displays buzzing team name and reaction time in milliseconds. |

---

### Epic 6: Resilience, Auditing & Pre-Ship Polish

| Task ID | Assignee | Priority | Task Description | Status | Verification Criteria |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **REL-01** | Dev 2 | P0 | Build socket reconnection endpoint (`room:reconnect`) with UUID | [x] | Disconnected user refreshes page and re-hydrates score and state. |
| **REL-02** | Dev 2 | P0 | Persist `sessionToken` in `localStorage` on mobile join | [x] | Token persists across page reloads and tab closures. |
| **REL-03** | Dev 1 | P1 | Build Excel / CSV export service (`/api/rooms/:pin/export`) | [x] | Downloads valid `.xlsx` file with team scores, accuracy, and latency. |
| **REL-04** | Both | P0 | Run 500-client simulated load test and end-to-end dress rehearsal | [x] | Zero crashes, sub-50ms sync verified with 500 active sockets. |
