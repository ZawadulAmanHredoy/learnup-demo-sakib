# Implementation Plan & 2-Person Team Division (Vertical Full-Stack Slices)
## Project: LearnUp Live Arena

---

## 1. Vertical-Slice Engineering Strategy (Both Devs Full-Stack)

Rather than splitting horizontally (Frontend vs. Backend), the project is divided into **two balanced, full-stack vertical slices**. 

Both developers work across **Node.js, Express, MongoDB, Socket.IO, and React**, each owning a complete operational domain end-to-end:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FULL-STACK VERTICAL SLICE DIVISION                   │
├───────────────────────────────────┬────────────────────────────────────┤
│           DEVELOPER 1             │            DEVELOPER 2             │
│    Host Cockpit & Stage Broadcast │    Player Experience & Live Engine │
│            (Full-Stack)           │             (Full-Stack)           │
├───────────────────────────────────┼────────────────────────────────────┤
│ BACKEND:                          │ BACKEND:                           │
│ • Quiz & Question CRUD APIs       │ • Participant Auth & Reconnect     │
│ • Room Lifecycle & PIN Generator  │ • Answer Submission Ingest Buffer  │
│ • State Machine (FSM) Broadcasts  │ • Authoritative Server Timer       │
│ • Aggregation & Distribution Calc │ • Scoring, Speed Bonus & Streaks   │
│ • Excel / CSV Export Generator    │ • Atomic Buzzer Lockout Protocol   │
│                                   │                                    │
│ FRONTEND:                         │ FRONTEND:                          │
│ • Admin Dashboard & Quiz Builder  │ • Mobile Player Join & PWA Shell   │
│ • Host Live Cockpit Control Panel │ • 4-Color Tactile Touch Quadrant   │
│ • Stage 4K Projector Display      │ • Mobile Buzzer UI & Haptic Engine │
│ • Response Distribution Charts    │ • Real-time Feedback & Rank Banner │
│ • Animated Leaderboard & Podium   │ • LocalStorage Session Resilience  │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Detailed Responsibility Breakdown

### Developer 1: Host Orchestration & Stage Broadcast (Full-Stack)
**Core Goal**: Everything the quiz host controls and everything the auditorium audience sees on the big screen.

1. **Backend Responsibilities**:
   - `Quiz` & `Question` Mongoose schemas and REST APIs (`GET`, `POST`, `PUT`, `DELETE /api/quizzes`).
   - `Room` session generation (`POST /api/rooms` creating 6-digit PIN and initial state).
   - Host socket command handlers:
     - `host:start_question`, `host:lock_question`, `host:reveal_answer`, `host:show_leaderboard`.
   - Computing answer distribution stats (`{ A: 45%, B: 15%, C: 35%, D: 5% }`) for the reveal stage.
   - Comprehensive Excel / CSV export service (`/api/rooms/:pin/export`) using `exceljs`.
2. **Frontend Responsibilities**:
   - **Admin Management & Quiz Editor** (`/admin/quizzes`): Form to add questions, options, point values, timers, and media.
   - **Host Live Cockpit** (`/admin/rooms/:pin/control`): Live telemetry gauge (submitted vs waiting), question cards, Next/Lock/Reveal buttons, pause timer, emergency kick/dispute overrides.
   - **Stage / Projector Screen** (`/stage/:pin`):
     - Lobby Screen: Giant QR code and floating team name chips.
     - Question Screen: 48px readable fonts, circular SVG countdown ring, media clues.
     - Reveal Screen: Animated horizontal bar chart highlighting the correct answer.
     - Leaderboard & Podium: Top 10 sliding cards, rank movement indicators, and 1st/2nd/3rd confetti celebration canvas.

---

### Developer 2: Player Experience & Real-Time Engine (Full-Stack)
**Core Goal**: Everything the contestant experiences on mobile and the real-time scoring/buzzer computation.

1. **Backend Responsibilities**:
   - `Participant` and `Submission` Mongoose schemas.
   - Player socket connection lifecycle: `room:join`, `room:player_list` broadcast.
   - Anti-cheat payload sanitizer: strips `isCorrect` from `sync:question_active` before transmitting.
   - In-memory answer submission ingestion buffer (`player:submit_answer`) with sub-5ms acknowledgment.
   - Authoritative server timer loop with client clock drift compensation.
   - Scoring engine: $Base + SpeedBonus \times Streak$, negative marking deductions, and tie-breaking sort.
   - Atomic Buzzer Lockout protocol (Node single-thread atomic lock or Redis SETNX) for Semi-Finals.
   - Reconnection handler (`room:reconnect`) with UUID session token validation.
2. **Frontend Responsibilities**:
   - **Mobile Player Client Shell** (`/play`): Responsive mobile layout with PWA meta tags.
   - **Team Join Form**: Inputs for Team Name, College/Institution, Captain Name, Phone.
   - **Lobby Waiting Screen**: Animated pulse waiting card with team badge.
   - **Interactive MCQ Screen**: 4-quadrant tactile colored buttons (Crimson, Cobalt, Amber, Emerald) with sound and haptic vibration (`navigator.vibrate`).
   - **Locked State**: Immediate visual lock ("Answer Recorded! Waiting for others...").
   - **Result Screen**: Success/Error animations, points breakdown (+Base, +Speed), streak multiplier flame, and personal rank position badge.
   - **Mobile Buzzer UI**: Giant glowing buzzer button with sound and instant "LOCKED OUT" feedback.
   - **Session Persistence**: Automatic recovery via `localStorage.getItem('sessionToken')`.

---

## 3. Sprint Roadmap & Team Milestones

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT ROADMAP                             │
├─────────┬───────────────────────────────┬──────────────────────────────┤
│ Sprint  │ Developer 1 Deliverable       │ Developer 2 Deliverable      │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 1│ Monorepo Setup + Quiz APIs +  │ Socket.IO Server Setup +     │
│ (Days 1-3) Admin Login UI               │ Mobile Join Form & Socket Hook│
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 2│ Room Creation API + Host      │ Answer Ingestion Buffer +    │
│ (Days 4-7) Cockpit UI + FSM Emitters    │ Mobile 4-Color MCQ UI        │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 3│ Stage 4K Projector Screen +   │ Scoring Formula & Streaks +  │
│ (Days 8-10) Distribution Charts & Podium│ Result Banners & Reconnect   │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 4│ Excel Export Service + Host   │ Atomic Buzzer Lockout Engine │
│ (Days 11-13) Emergency Overrides        │ + Mobile Buzzer UI           │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ Sprint 5│ Joint 500-Socket Stress Test & Dress Rehearsal               │
│ (Days 14-16)                                                           │
└─────────┴──────────────────────────────────────────────────────────────┘
```

---

## 4. Contract-Driven Collaboration

Because both developers work full-stack, they interface cleanly at the **WebSocket and API contract level**:

1. **Shared Event Definitions**: Documented in [TechSpec.md](./TechSpec.md).
   - Dev 1 emits `sync:question_active` $\rightarrow$ Dev 2's mobile UI renders it.
   - Dev 2 emits `player:submit_answer` $\rightarrow$ Dev 2's backend scores it $\rightarrow$ Dev 1's stage chart displays the aggregate counts.
2. **Independent Testing**:
   - Dev 1 can test the Host Cockpit & Stage Screen by firing mock socket events without waiting for mobile players.
   - Dev 2 can test Mobile Player answering and buzzer clicks using automated mock host triggers.
