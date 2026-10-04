# LearnUp Live Arena 🎯
### Real-Time Interactive Quiz & Competition Platform

A synchronized, low-latency live quiz tournament platform engineered for academic competitions, auditoriums, and broadcasted events (inspired by the BUFT National Quiz Competition flow). 

The platform implements an **authoritative server model** connecting three synchronized views:
1. **Host Cockpit**: Live control panel for the quiz administrator.
2. **Stage Screen (Projector/TV)**: 1080p/4K high-contrast broadcast view with animated leaderboards and aggregate response charts.
3. **Mobile Player Client**: Ultra-responsive, thumb-friendly contestant interface with tactile 4-color cards and haptic buzzer buttons.

---

## 📚 Architectural & Technical Documentation

All foundational specifications and plans are documented in the [`doc/`](./doc) directory:

- 📄 [**PRD.md**](./doc/PRD.md) — Product Requirements Document, tournament tiers, and user personas.
- 🔄 [**AppFlow.md**](./doc/AppFlow.md) — Screen-by-screen user journeys, Finite State Machine (FSM), and edge case recovery.
- 🎨 [**Design.md**](./doc/Design.md) — Universal design system, color tokens, typography, audio cues, and 3-screen wireframes.
- 🗄️ [**Schema.md**](./doc/Schema.md) — Mongoose schemas for MongoDB and In-Memory / Redis caching structures.
- ⚙️ [**TechSpec.md**](./doc/TechSpec.md) — WebSocket event protocol dictionary, zero-trust anti-cheat, and REST APIs.
- ⚖️ [**DECISIONS.md**](./doc/DECISIONS.md) — Architecture Decision Records (ADRs) explaining core design choices.
- 📏 [**Rules.md**](./doc/Rules.md) — Scoring formulas ($Base + SpeedBonus \times Streak$), negative marking, and buzzer rules.
- 🗺️ [**ImplementationPlan.md**](./doc/ImplementationPlan.md) — Sprint roadmap and 2-person full-stack vertical slice division.
- ❓ [**INTERVIEW.md**](./doc/INTERVIEW.md) — Operational Q&A, network resilience strategies, and tournament day checklists.
- 🚀 [**Modernize.md**](./doc/Modernize.md) — Future-proof enhancements (PWA, AI question generation, automated certificates).
- 🧪 [**PROOFS.md**](./doc/PROOFS.md) — 500-socket concurrency benchmarks, atomic buzzer lockout proofs, and timer synchronization.
- 📋 [**Tracker.md**](./doc/Tracker.md) — Master sprint task board with assigned developer roles and acceptance criteria.

---

## 👥 2-Person Team Division (Full-Stack Vertical Slices)

Both developers work across **Node.js, Express, MongoDB, Socket.IO, and React**, each owning an entire user domain end-to-end:

| Role | Domain Focus | Full-Stack Responsibilities |
| :--- | :--- | :--- |
| **Developer 1** | **Host Cockpit & Stage Broadcast** *(Full-Stack)* | **Backend**: Quiz & Question CRUD APIs, Room generation, State Machine emitters, Answer distribution analytics, Excel export service.<br>**Frontend**: Admin Quiz Editor, Host Live Cockpit, 4K Stage Screen (Projector), Response distribution charts, Leaderboard podium. |
| **Developer 2** | **Player Experience & Live Engine** *(Full-Stack)* | **Backend**: Participant registration, In-memory submission ingest buffer, Server countdown timer, Scoring & Streak engine, Atomic buzzer lockout, Reconnection session recovery.<br>**Frontend**: Mobile Player PWA shell, Join form, 4-color tactile cards, Mobile Buzzer UI with haptics, Personal feedback & rank banners. |

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, Socket.IO, Mongoose / MongoDB, Redis (optional for clustering)
- **Frontend**: React (Vite), Tailwind CSS, Socket.IO Client, Framer Motion / Recharts, Canvas Confetti
- **Communication Protocol**: Persistent bidirectional WebSockets with server-authoritative state synchronization

---

## 🚀 Quick Start (Development)

```bash
# Clone the repository
git clone git@github.com:sheikh-sa-kib/learnup-demo-sakib.git
cd learnup-demo-sakib
```
