# Product Requirements Document (PRD)
## Project: LearnUp Live Arena — Real-Time Interactive Quiz & Competition Platform

---

## 1. Executive Summary & Vision

**LearnUp Live Arena** is a real-time, synchronized quiz and tournament platform engineered specifically for live auditorium competitions, academic tournaments, and broadcasted events. Inspired by platforms like Kahoot and Mentimeter, but enhanced for formal collegiate competitions (e.g., the BUFT National Quiz Competition), the platform enables a host/administrator to control question delivery, while hundreds of participants (or teams) compete synchronously on mobile devices, and a live audience watches an immersive, high-resolution stage broadcast.

The system supports standard multi-round MCQs, fast-paced Buzzer rounds with negative marking, and high-intensity Rapid-Fire formats with zero-trust anti-cheat guarantees and resilient auditorium network handling.

---

## 2. Core User Personas

| Persona | Role | Primary Goals & Behaviors |
| :--- | :--- | :--- |
| **Quiz Administrator / Host** | Event Controller | Pre-configures quizzes, creates game rooms, generates PINs/QR codes, controls question pace, oversees live telemetry, arbitrates disputes, triggers buzzer rounds, and exports final audited scores. |
| **Participant / Team** | Contestant | Joins instantly via 6-digit numeric PIN or QR scan on mobile browser; submits answers under timed pressure; views personal points, correctness feedback, and real-time rank. |
| **Stage / Audience Display** | Big Screen Broadcast | Rendered on auditorium projectors/LED walls (1080p/4K); displays live join QR codes, active questions, countdown animations, live response distributions, dynamic leaderboards, and podium celebrations. |

---

## 3. Tournament Phases (Official 5-Tier Competition Structure)

The platform is designed to seamlessly run the 5 distinct tournament tiers as specified in the official competition roadmap:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OFFICIAL 5-TIER TOURNAMENT ROUNDS                     │
├────────────────────┬────────────────────┬───────────────────────────────────────┤
│ Tier / Round       │ Participants       │ Core Rules & Mechanics                │
├────────────────────┼────────────────────┼───────────────────────────────────────┤
│ 1. National        │ Nationwide Teams   │ Online / College Screening:           │
│    Qualifying      │ (Hundreds)         │ Image, Video, Audio & Current Affairs │
├────────────────────┼────────────────────┼───────────────────────────────────────┤
│ 2. Campus MCQ      │ Selected Teams     │ Host-Synchronized Campus Live MCQ:    │
│    Quick Quiz      │ (133 Teams / 399p) │ 50 Questions | 30 Minutes             │
│                    │                    │ ➔ Top 20 Teams advance to Quarterfinal │
├────────────────────┼────────────────────┼───────────────────────────────────────┤
│ 3. Quarter Final   │ 20 Teams           │ 5 Categorized Segments:               │
│    (5 Segments)    │ (60 persons)       │ A: Bangladesh, B: World,              │
│                    │                    │ C: Science & Tech, D: History/Culture,│
│                    │                    │ E: Sports & Current Affairs           │
│                    │                    │ ➔ Top 6 Teams advance to Semifinal   │
├────────────────────┼────────────────────┼───────────────────────────────────────┤
│ 4. Semifinal       │ 6 Teams            │ Synchronized Buzzer Lockout:          │
│    (Buzzer Round)  │ (18 persons)       │ First to buzz locks out other 5 teams │
│                    │                    │ Correct = +Points, Wrong = -Negative  │
│                    │                    │ ➔ Top 4 Teams advance to Grand Finale │
├────────────────────┼────────────────────┼───────────────────────────────────────┤
│ 5. Grand Finale    │ 4 Finalist Teams   │ Segment A: Audio-Visual Clues         │
│                    │ (12 persons)       │   (10s video clips, photos, music)    │
│                    │                    │ Segment B: Rapid-Fire Showdown        │
│                    │                    │   (60s per team, +10 / 0 / Pass)      │
│                    │                    │ ➔ Champion, 1st & 2nd Runner-up       │
└────────────────────┴────────────────────┴───────────────────────────────────────┘
```

---

## 4. Functional Requirements

### 4.1 Admin & Quiz Management
- **Quiz Builder**:
  - WYSIWYG question editor supporting text, image URLs/uploads, and audio clips.
  - Configurable points per question (e.g., 100 base points, custom multiplier).
  - Configurable time limits (10s to 120s per question).
  - Support for negative marking toggles (e.g., -25%, -50% penalty).
  - Categorization into rounds (Preliminary, Quarter Final, Semi-Final Buzzer, Grand Finale).
- **Session / Room Orchestration**:
  - One-click Room generation producing a unique 6-digit numeric Room PIN and matching QR code.
  - Host Cockpit controls: `Start Room`, `Next Question`, `Lock Submissions Early`, `Reveal Answer`, `Show Leaderboard`, `Skip Question`, and `End Session`.
  - Emergency host controls: Kick/disqualify participant, pause/resume timer, and manual score adjustment for disputed questions.
- **Reporting & Auditing**:
  - Full CSV / Excel export of team-wise and question-wise results.
  - Telemetry breakdown: time taken per question, option chosen, and timestamp of receipt.

### 4.2 Contestant / Player Experience (Mobile-First)
- **Zero-Friction Onboarding**:
  - Direct URL `/play?pin=123456` or scan QR code.
  - Input: Team Name, Institution / College, Captain Name, Contact Phone/Email.
  - Reconnection Token stored in browser `localStorage` ensuring that page reloads or network drops restore current game state immediately.
- **Synchronized Game Interaction**:
  - Real-time question screen rendering four colored tactile cards (matching Stage Screen).
  - Immediate visual/haptic feedback on submission ("Locked In").
  - Answer reveal state displaying result ("Correct! +950 Pts" or "Incorrect! +0 Pts"), streak counters, and current standing.
- **Buzzer Mode (Semi-Finals)**:
  - Giant tactile buzzer button. First team to buzz locks the room for all competitors with sub-millisecond precision.
  - Audible and visual confirmation of who holds the floor.

### 4.3 Stage / Broadcast Screen (Projector/TV Display)
- **Lobby State**:
  - Large QR code and readable 6-digit PIN.
  - Dynamic participant ticker showing joined teams and count in real-time.
- **Question State**:
  - High-contrast, large-font question presentation visible from 30+ meters away.
  - Synchronized circular countdown timer with color shift (Green -> Yellow -> Pulsing Red).
  - Media display for audio visual questions.
- **Result & Reveal State**:
  - Animated bar chart showing aggregate player distribution across options A, B, C, and D.
  - Highlight of the verified correct answer.
- **Leaderboard & Podium**:
  - Smooth animated transitions showing Top 5 / Top 10 rankings.
  - Rank movement indicators (🔼 +3, 🔻 -1, 🔥 Streak).
  - Final Grand Podium animation for 1st, 2nd, and 3rd place with celebratory confetti and SFX.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Latency & Real-Time Performance
- WebSocket message broadcast latency to 500 concurrent connections $\le 50\text{ ms}$.
- Buzzer resolution lock time $\le 10\text{ ms}$.
- Server-authoritative timing clock drift compensated within $\pm 100\text{ ms}$.

### 5.2 Anti-Cheat & Security
- **Zero-Trust Client**: The correct answer option ID is **never** sent to any client (player or stage) during `QUESTION_ACTIVE`. It is only transmitted during `ANSWER_REVEAL`.
- **Server-Side Timestamping**: Speed bonuses are strictly evaluated using the server's arrival time, preventing clock tampering on contestants' phones.
- **Input Sanitization & Rate Limiting**: All inputs sanitized against NoSQL injection; socket message rate limits (maximum 5 submissions per second to prevent spamming).

### 5.3 Reliability & Auditorium Resilience
- Heartbeat / ping-pong socket reconnection with persistent session UUID.
- If a mobile device switches between Wi-Fi and 4G/5G, reconnect packet rejoins existing team session without score loss.
- Graceful degradation: in case of total internet loss, local offline deployment capability via LAN server.

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

1. **Zero Downtime During Live Rounds**: 100% room uptime during scheduled rounds.
2. **Sub-100ms Event Sync**: All connected screens receive state transitions within 100ms of host trigger.
3. **100% Submission Accuracy**: Zero dropped answers during peak 400+ concurrent submissions.
4. **Fast Re-entry**: Disconnected players recover state in $< 2$ seconds upon page refresh.
