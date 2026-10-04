# Discovery, Operational Q&A & Edge Cases (INTERVIEW)
## Project: LearnUp Live Arena

---

## 1. Stakeholder Discovery & Operational Q&A

This document records the architectural and operational questions, decisions, and assumptions derived from the BUFT National Quiz Competition flow ([prev_year_flow.txt](file:///home/sakib/ppProject/learnup-demo/doc/prev_year_flow.txt)).

### Q1: In team rounds (3 members per team), how many devices are used per team?
- **Decision / Standard Practice**: **1 Official Device per Team**.
- **Rationale**:
  - The team captain operates a single mobile phone placed on the team desk or podium.
  - Eliminates intra-team answer collisions and simplifies leaderboard calculations.
  - The team name, college, captain name, and co-member names are entered during registration on that single device.

---

### Q2: How does the system handle auditorium Wi-Fi congestion and packet loss?
- **Decision**: **Dual-Network Resilience + Compact Sockets**.
  1. Payload sizes are minimized to under 2 KB per packet.
  2. Mobile browsers use both local cellular data (4G/5G) and venue Wi-Fi seamlessly.
  3. Every client maintains a `sessionToken` in `localStorage`. If a connection drops, Socket.IO auto-reconnects and sends `room:reconnect`. The server re-syncs state immediately without resetting points.

---

### Q3: Should the live leaderboard be visible after every question?
- **Decision**: **Host-Controlled Visibility with Suspense Mode**.
  - In normal questions, the host can display the leaderboard to build excitement.
  - For the **final 3 questions of any round**, the host can toggle **"Suspense / Blind Mode"**, hiding the stage leaderboard until the final announcement to maintain maximum audience suspense.

---

### Q4: How is the Semi-Final Buzzer Round arbitrated?
- **Decision**: **Software Atomic Buzzer with Verbal Answer + Host Confirmation**.
  - Contestants hit the giant buzzer on their phones.
  - The first socket received by the server locks out all other 5 teams within milliseconds.
  - The stage screen flashes: "Team Alpha buzzed in! Reaction: 0.84s".
  - The team gives their answer verbally to the host.
  - The host clicks "Correct (+100)" or "Wrong (-50)". If wrong, the host clicks "Re-Open Buzzer", and the remaining 5 teams can buzz again.

---

### Q5: What happens if the host's laptop crashes or browser closes mid-quiz?
- **Decision**: **Stateless Host Architecture**.
  - The game state is stored in the Node.js process and MongoDB.
  - If the host laptop reboots, the host navigates to `/admin/rooms/:pin/control`, authenticates via JWT, and the server returns the exact active state. Connected contestants experience zero disruption.

---

### Q6: Can a team change their answer after tapping?
- **Decision**: **First Tap is Final ("Locked In")**.
  - In competitive tournaments, allowing answer switching encourages guessing. Once an option card is tapped, it immediately locks and transmits.

---

## 2. Tournament Day Risk Mitigation Matrix

| Potential Failure | Impact | Mitigation Strategy Built Into Platform |
| :--- | :--- | :--- |
| **Auditorium Wi-Fi Router Crashes** | High | Contestants switch to mobile cellular data (4G/5G). Server is hosted on high-bandwidth public cloud (e.g. AWS / DigitalOcean / Vercel+Railway). |
| **Stage Projector Disconnects** | Medium | Host cockpit displays all telemetry and question states independently. Reconnecting HDMI restores stage view instantly. |
| **Disputed Question on Stage** | Medium | Host Cockpit provides "Void Question" (rolls back points) or "Accept Alternate Option" buttons with real-time recalculation. |
| **Malicious Team Names** | Low | Host Cockpit has a 1-click "Rename Team" or "Kick Team" feature in the lobby. |
| **Browser Accidental Refresh by Player** | Medium | Automatic state hydration via `localStorage.getItem('sessionToken')` restores team state in $< 1\text{ second}$. |

---

## 3. Checklist for Event Organizers Prior to Competition Day

- [ ] **Venue Audio Test**: Connect Stage Laptop HDMI/Aux to the auditorium sound mixer. Test tick, gong, and fanfare sound volumes.
- [ ] **Projector Resolution Check**: Ensure Stage Screen laptop is set to native 1080p (1920x1080) and browser is in full-screen mode (`F11`).
- [ ] **Sample Test Run**: Conduct a 3-question mock quiz with volunteers during the rehearsal on November 9th (as scheduled in event plan).
- [ ] **Backup Host Device**: Keep a second laptop or iPad logged into the Admin Cockpit in case the primary host laptop fails.
- [ ] **Export Verification**: Verify that clicking "Export Results" produces the full team-wise Excel breakdown with accuracy and response times.
