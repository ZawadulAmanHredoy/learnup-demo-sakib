# Implementation Plan & 2-Person Team Division (ImplementationPlan)
## Project: LearnUp Live Arena

---

## 1. Project Roadmap & Milestone Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT ROADMAP                             │
├─────────┬───────────────────────────────┬──────────────────────────────┤
│ Sprint  │ Milestone                     │ Deliverable                  │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 1│ Foundation & Architecture     │ Monorepo, DB Schemas, Auth,  │
│ (Days 1-3)                              │ Socket Protocol Skeleton     │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 2│ Core Synchronized MCQ Engine  │ State Machine (FSM), Timers, │
│ (Days 4-7)                              │ Mobile Play & Admin Controls │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 3│ Stage Broadcast & Scoring     │ 4K Projector Display, Charts,│
│ (Days 8-10)                             │ Leaderboard & Speed Bonuses  │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 4│ Special Competition Rounds    │ Semi-Final Buzzer Lockout,   │
│ (Days 11-13)                            │ Rapid-Fire 60s, Media Clues  │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 5│ Hardening, Audits & Exports   │ Reconnection, Anti-Cheat,    │
│ (Days 14-16)                            │ Excel Report Generator       │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 6│ Rehearsal & Load Testing      │ 500-Socket Stress Simulation,│
│ (Days 17-18)                            │ Stage Audio/Video Run-through│
└─────────┴───────────────────────────────┴──────────────────────────────┘
```

---

## 2. 2-Person Team Division of Responsibilities

To ensure maximum development speed and zero blocked dependencies, the work is cleanly split across two distinct domain specializations:

```
┌────────────────────────────────────────────────────────────────────────┐
│                 DEVELOPER A                     DEVELOPER B            │
│         Backend & Real-Time Engine       Frontend & UI/UX Experience   │
├────────────────────────────────────────────────────────────────────────┤
│ • Node.js / Express Architecture         • React (Vite) App Setup      │
│ • Socket.IO Engine & Event Handlers      • Tailwind Theme & CSS System │
│ • Room Finite State Machine (FSM)        • Admin Host Cockpit UI       │
│ • MongoDB Schemas & Mongoose Models      • Stage Projector 4K Screen   │
│ • Authoritative Server Timer             • Mobile Player Client UI     │
│ • Scoring & Streak Formula Engine        • Responsive Touch Buttons    │
│ • Atomic Buzzer Lockout Concurrency      • Chart Animations (Recharts) │
│ • Anti-Cheat Payload Sanitizer           • Audio SFX & Haptics         │
│ • REST API Endpoints & Auth Middleware   • LocalStorage Token Recovery │
│ • Excel / CSV Export Generator           • Confetti & Podium Animator  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sprint-by-Sprint Work Breakdown

### Sprint 1: Foundation, Data Contracts & Environment Setup
- **Developer A (Backend)**:
  - Initialize `backend/` project, Express server, and environment configuration.
  - Setup MongoDB connection with Mongoose.
  - Create Schemas: `User`, `Quiz`, `Question`, `Room`, `Participant`, `Submission`.
  - Implement Auth API: `/api/auth/register`, `/api/auth/login`, and JWT middleware.
  - Initialize Socket.IO instance with CORS and basic room join/leave logic.
- **Developer B (Frontend)**:
  - Initialize `frontend/` with Vite (React), TypeScript, and Tailwind CSS.
  - Configure Design System: color tokens (Crimson, Cobalt, Amber, Emerald, Deep Space), typography (`Outfit` / `Inter`).
  - Build common UI components: `Button`, `Input`, `Card`, `Modal`, `Badge`.
  - Implement Client Router:
    - `/admin/login` & `/admin/dashboard`
    - `/stage/:pin`
    - `/play`
  - Setup Socket.IO client context and connection manager (`useSocket` hook).

*Integration Checkpoint 1*: Developer B connects client socket to Developer A's server and verifies `room:join` and `room:player_list` broadcast.

---

### Sprint 2: Core Real-Time Synchronized MCQ Gameplay
- **Developer A (Backend)**:
  - Implement Room Finite State Machine (`LOBBY` $\rightarrow$ `COUNTDOWN` $\rightarrow$ `QUESTION_ACTIVE` $\rightarrow$ `QUESTION_LOCKED` $\rightarrow$ `ANSWER_REVEAL` $\rightarrow$ `LEADERBOARD`).
  - Implement Authoritative Server Countdown Timer (`setInterval` with drift correction).
  - Implement `sync:question_active` with **answer stripping** (zero-trust security).
  - Implement `player:submit_answer` handler with in-memory buffer and duplicate rejection.
  - Implement answer evaluation and base points + speed bonus calculation.
- **Developer B (Frontend)**:
  - Build **Admin Host Cockpit** (`/admin/rooms/:pin/control`):
    - Question viewer, live responses counter, "Next Question", "Lock", "Reveal" buttons.
  - Build **Mobile Player Controller** (`/play`):
    - Join form (Team Name, College, Captain, Phone).
    - 4-quadrant tactile answer buttons matching universal colors.
    - Locked submission state ("Answer Recorded").
    - Result banner with correct/wrong feedback.

*Integration Checkpoint 2*: Run a full 5-question mock MCQ game with Developer A running the host controls and Developer B playing on a mobile device.

---

### Sprint 3: Stage Broadcast Display, Analytics & Leaderboards
- **Developer A (Backend)**:
  - Implement real-time leaderboard aggregation (Sorted Set logic / MongoDB aggregation).
  - Calculate option distribution stats `{ A: 45%, B: 15%, C: 35%, D: 5% }`.
  - Emit `sync:answer_reveal` and `sync:leaderboard` events.
  - Persist submissions in batch to MongoDB upon question lock.
- **Developer B (Frontend)**:
  - Build **Stage Screen** (`/stage/:pin`):
    - Lobby Screen with giant QR code generator (`qrcode.react`) and floating team chips.
    - Active Question Screen with 48px fonts and circular SVG countdown ring.
    - Reveal Screen with animated horizontal bar chart.
    - Animated Leaderboard with sliding rank positions and streak badges.
  - Integrate sound effects: tick, buzzer, correct, wrong, fanfare.

*Integration Checkpoint 3*: Project Stage Screen onto a full-screen external monitor; verify latency and audio-visual synchronization during a mock round.

---

### Sprint 4: Special Competition Rounds (Buzzer & Rapid Fire)
- **Developer A (Backend)**:
  - Implement **Buzzer Mode Protocol** (Semi-Finals):
    - Single-thread atomic lockout logic.
    - Host judgment endpoint (`host:judge_buzzer` with $+100$ or $-50$ negative penalty).
    - Re-open buzzer event handler.
  - Implement **Rapid-Fire Engine** (Grand Finale):
    - 60-second continuous timer loop.
    - Instant question cycling on `pass` or `submit`.
- **Developer B (Frontend)**:
  - Build **Mobile Buzzer UI**:
    - Giant glowing, tactile buzzer button with vibration and touch sound.
    - "LOCKED OUT" overlay when another team buzzes first.
  - Build **Stage Buzzer & Rapid-Fire Screens**:
    - Spotlights team that buzzed with reaction time in milliseconds.
    - Rapid-fire 60-second timer bar and dynamic question feed.

*Integration Checkpoint 4*: Test 6-device buzzer competition simulating concurrent taps within 10ms to verify zero race conditions.

---

### Sprint 5: Resilience, Anti-Cheat, and Audit Reports
- **Developer A (Backend)**:
  - Implement `room:reconnect` with UUID session verification and state restoration.
  - Create Excel / CSV export service using `exceljs` (`/api/rooms/:pin/export`).
  - Implement rate limiting and input sanitization (`express-mongo-sanitize`).
- **Developer B (Frontend)**:
  - Implement `localStorage` session persistence on mobile player client.
  - Build Post-Round Admin Report Viewer and one-click "Download Excel Report" button.
  - Build Final Podium celebration with celebratory confetti (`canvas-confetti`).

---

### Sprint 6: Load Testing, Rehearsal & Pre-Ship Audit
- **Both Developers**:
  - Run 500-client simulated socket stress test script (`scratch/load_test.js`).
  - Full end-to-end dress rehearsal of the complete BUFT National Quiz Tournament flow (Round 2 $\rightarrow$ Quarter Final $\rightarrow$ Semi-Final Buzzer $\rightarrow$ Grand Finale).
  - Final code review, pre-ship checklist sign-off, and deployment setup.
