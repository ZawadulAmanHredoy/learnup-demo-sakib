# Frontend Client — LearnUp Live Arena
### React (Vite) + Tailwind CSS + Socket.IO Client

This directory contains the user interfaces for the 3 synchronized roles:
1. **Admin / Host Cockpit** (`/admin/rooms/:pin/control`): Control panel for launching questions, locking, revealing, and leaderboards.
2. **Stage / Broadcast Screen** (`/stage/:pin`): 1080p/4K projector mode with big QR, countdown rings, and dynamic charts.
3. **Mobile Player Client** (`/play`): Ultra-responsive touch cards, buzzers, and real-time feedback.

#### Core Directories
- `src/components/`: Reusable primitives, modals, timers, and chart components.
- `src/pages/admin/`: Host management and live cockpit pages.
- `src/pages/stage/`: Cinema projector display components.
- `src/pages/play/`: Contestant mobile gameplay components.
- `src/context/`: SocketContext connection provider.
- `src/hooks/`: Custom hooks for timers, socket events, and haptics.

*Refer to [doc/Design.md](../doc/Design.md) and [doc/AppFlow.md](../doc/AppFlow.md) for full specifications.*
