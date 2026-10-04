# Frontend Client — LearnUp Live Arena
### React (Vite) + Tailwind CSS + Socket.IO Client

This directory contains the user interfaces for the 3 synchronized roles:
1. **Admin / Host Cockpit** (`/admin/rooms/:pin/control`): Control panel for launching questions, locking, revealing, and leaderboards.
2. **Stage / Broadcast Screen** (`/stage/:pin`): 1080p/4K projector mode with big QR, countdown rings, and dynamic charts.
3. **Mobile Player Client** (`/play`): Ultra-responsive touch cards, buzzers, and real-time feedback.

#### Core Directories
- `src/components/`: Reusable primitives, modals, timers, and chart components (`player/` holds the contestant screens, `ui/CircularTimer.jsx` the countdown ring).
- `src/pages/admin/`: Host management and live cockpit pages.
- `src/pages/stage/`: Cinema projector display components.
- `src/pages/play/`: Contestant mobile gameplay components.
- `src/context/`: SocketContext connection provider.
- `src/hooks/`: Custom hooks for timers, socket events, and haptics (`usePlayerSession`, `useServerClock`, `useWakeLock`).
- `public/`: PWA manifest, icons and service worker for the installable contestant app.

#### Backend URL
Phones on the venue Wi-Fi reach the backend at `<host that served the page>:5000`. Set `VITE_SERVER_URL` (e.g. `https://arena.example.com`) when the API is served elsewhere.

*Refer to [doc/Design.md](../doc/Design.md) and [doc/AppFlow.md](../doc/AppFlow.md) for full specifications.*
