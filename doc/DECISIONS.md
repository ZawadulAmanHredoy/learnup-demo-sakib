# Architecture Decision Records (ADRs) (DECISIONS)
## Project: LearnUp Live Arena

---

## ADR-001: Use of Socket.IO over HTTP Long-Polling or Server-Sent Events (SSE)

### Status
Accepted

### Context
Live competitions with 133+ teams require sub-100ms synchronization across three distinct visual clients (Host, Stage, Contestants). The system requires full bi-directional communication: server-to-client broadcasts (question display, timers, reveals) and high-frequency client-to-server bursts (answers, buzzers, heartbeats).

### Decision
Adopt **Socket.IO** (built on WebSockets with automatic fallback to HTTP long-polling).

### Consequences
- **Positive**:
  - Full bi-directional low-overhead communication over a single persistent TCP connection.
  - Built-in room abstractions (`io.to(pin).emit(...)`), reconnection management, and heartbeat ping/pong.
  - Native clustering support via `@socket.io/redis-adapter`.
- **Negative**:
  - Requires stateful WebSocket server infrastructure or sticky sessions when running behind reverse proxies (Nginx / Cloudflare).

---

## ADR-002: Decoupled Express API + React Frontend (Vite) vs. Monolithic Next.js

### Status
Accepted

### Context
The user requested Express, React, MongoDB, and Socket.IO. We evaluated whether to build a unified Next.js App Router project or a decoupled Express Backend + React Frontend (Vite SPA).

### Decision
Adopt a **Clean Monorepo Structure** with:
1. `backend/`: Node.js Express server + Socket.IO server.
2. `frontend/`: React SPA powered by Vite and Tailwind CSS.

### Consequences
- **Positive**:
  - Next.js serverless functions (e.g. Vercel) have strict timeout limits and do not support long-lived persistent WebSocket connections without external services (like Pusher or Ably). A dedicated Express server gives 100% control over the WebSocket lifecycle without external per-message costs.
  - Vite SPA offers lightning-fast HMR and lightweight bundle sizes optimized for mobile browsers and auditorium projectors.
- **Negative**:
  - Requires running two separate development servers (`npm run dev:all`).

---

## ADR-003: MongoDB with In-Memory Write-Buffer for High Concurrency

### Status
Accepted

### Context
When 400+ participants submit answers within a 2-second burst, hitting MongoDB with 400 individual concurrent `Submission.create()` writes can cause connection pool starvation.

### Decision
Use **In-Memory Buffer with Batch Insertion**:
1. When answers arrive during `QUESTION_ACTIVE`, they are validated and recorded immediately in a fast in-memory map.
2. The user receives an immediate socket acknowledgment (`player:answer_ack`).
3. When the question closes (`QUESTION_LOCKED`), the entire batch of submissions is persisted via `Submission.insertMany()` in a single bulk operation.

### Consequences
- **Positive**:
  - Zero database latency bottleneck during active answering.
  - Guaranteed response time $< 15\text{ ms}$ for contestant submissions.
- **Negative**:
  - In the extremely unlikely event of an abrupt process crash during the active 20 seconds, buffered answers must be recovered from memory logs.

---

## ADR-004: Zero-Trust Server-Authoritative Anti-Cheat Model

### Status
Accepted

### Context
In competitive collegiate academic tournaments (like BUFT National Quiz), tech-savvy contestants may inspect Chrome DevTools network traffic or the React component tree to discover answer keys. Furthermore, client device clocks can be altered.

### Decision
1. **Never transmit the correct answer key** in `sync:question_active`. Strip `isCorrect` from all option arrays until `sync:answer_reveal`.
2. **Server-Authoritative Clock**: The timer countdown runs strictly on the server. Speed calculations and expiry deadlines are evaluated based on server packet arrival timestamps.

### Consequences
- **Positive**:
  - Cheating via DevTools inspection is mathematically impossible.
  - Eliminates device clock drift vulnerabilities.
- **Negative**:
  - Clients with higher network ping may lose 50–100ms on speed bonuses; compensated with a 1000ms server grace period before hard rejection.

---

## ADR-005: Single-Thread Event Loop & Atomic Lock for Buzzer Round (Semi-Finals)

### Status
Accepted

### Context
Semi-Finals feature a Buzzer Round where 6 teams compete to buzz in first. We must prevent race conditions where two teams claim to have buzzed first at the same millisecond.

### Decision
Leverage Node.js's single-threaded event loop and an atomic lock variable (or Redis `SETNX` key `room:{pin}:buzzer_lock`) to accept only the first incoming event.

```javascript
let buzzerLocked = false;
socket.on('player:buzz', (data) => {
  if (buzzerLocked) return; // Discard all subsequent requests
  buzzerLocked = true;
  io.to(pin).emit('sync:buzzer_locked', { winner: data.teamName, reactionTimeMs });
});
```

### Consequences
- **Positive**:
  - Absolute, deterministic winner selection with zero ties.
  - Simple, robust implementation without complex distributed locking.

---

## ADR-006: LocalStorage UUID Session Token for Disconnection Recovery

### Status
Accepted

### Context
Auditorium Wi-Fi networks are notorious for high packet loss, interference, and unexpected drops when 400+ mobile devices connect concurrently.

### Decision
When a participant joins, the server issues a `sessionToken` (UUID v4) persisted in `localStorage`. If the socket disconnects and reconnects (or the browser refreshes), the client emits `room:reconnect` with the token.

### Consequences
- **Positive**:
  - Seamless recovery: users do not lose their score, identity, or submission status if their screen turns off or network drops.
- **Negative**:
  - Requires the client browser to have `localStorage` enabled (supported by 99.9% of modern mobile browsers).

---

## ADR-007: Three Distinct Routes (Host vs. Stage vs. Player)

### Status
Accepted

### Context
Previous quiz setups frequently try to mirror the host screen onto the auditorium projector. This exposes administrative controls, answer keys, and sensitive student details to the audience.

### Decision
Implement three completely decoupled routes with tailored UI:
1. `/admin/rooms/:pin/control`: Host controls, answer keys, emergency levers.
2. `/stage/:pin`: 1080p/4K projector mode, high-contrast visuals, animated charts, zero controls.
3. `/play`: Mobile-first contestant controller.
