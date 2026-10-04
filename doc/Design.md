# UI/UX System & Screen Architecture Specification (Design)
## Project: LearnUp Live Arena

---

## 1. Visual Identity & Design System

The platform's design philosophy centers on **high contrast, cinema-grade readability, and instant tactile feedback**. It avoids plain, generic styling in favor of modern, vibrant dark-mode aesthetics with glassmorphic cards and dynamic micro-interactions.

### 1.1 Color Palette

```
/* Primary Theme Tokens */
--bg-deep-space:       #0A0F1D;   /* Master Dark Background */
--bg-surface-card:     #131D31;   /* Card Background with subtle border */
--bg-surface-elevated: #1E2B45;   /* Elevated Modals / Dropdowns */
--border-subtle:       #2A3B5C;   /* Card Borders */

/* Game Action Color Quadrant (Universal across Stage & Mobile) */
--color-option-a:      #EF4444;   /* Vibrant Crimson (Red Triangle) */
--color-option-b:      #3B82F6;   /* Electric Cobalt (Blue Diamond) */
--color-option-c:      #F59E0B;   /* Radiant Amber   (Yellow Circle) */
--color-option-d:      #10B981;   /* Emerald Green   (Green Square) */

/* Accents & Status Indicators */
--accent-gold:         #FACC15;   /* Leaderboard #1 & Podium Gold */
--accent-silver:       #CBD5E1;   /* Leaderboard #2 */
--accent-bronze:       #F97316;   /* Leaderboard #3 */
--status-correct:      #10B981;   /* Positive Feedback */
--status-wrong:        #EF4444;   /* Negative Feedback */
--status-warning:      #F59E0B;   /* Timer Running Out Warning */
```

### 1.2 Typography
- **Headings & Numbers**: `Outfit`, sans-serif (Geometric, high-energy, clean tabular numbers).
- **Body & Controls**: `Inter` or `Plus Jakarta Sans`, sans-serif (High legibility at distance).
- **Scale**:
  - Stage Projector Questions: `32px` to `54px` (font-bold).
  - Stage Countdown: `72px` tabular font.
  - Mobile Buttons: `20px` to `24px` font-semibold.

### 1.3 Audio & Haptic Feedback Architecture
Auditory cues amplify live tension in the auditorium. The system includes an audio synthesizer / asset manager:
- `sfx_countdown_tick.mp3`: Subtle tick on last 5 seconds.
- `sfx_time_up.mp3`: Distinct buzzer gong.
- `sfx_correct.mp3`: Harmonious ascending chime.
- `sfx_wrong.mp3`: Low dull double-buzz.
- `sfx_buzzer_hit.mp3`: High-priority bell chime when contestant buzzes.
- `sfx_podium_fanfare.mp3`: Orchestral celebration fanfare with confetti trigger.
- **Mobile Haptic Feedback**: `navigator.vibrate([40])` on button tap; `navigator.vibrate([150, 50, 150])` on time up.

---

## 2. The 3-Screen Design Specifications

### 2.1 Screen 1: Admin Host Cockpit (`/admin/rooms/:pin/control`)

The host control screen is dense, information-rich, and optimized for high-pressure control without cognitive overload.

#### ASCII Layout Wireframe:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LearnUp ARENA HOST COCKPIT  |  PIN: 784-920  |  Teams: 133  | Status: ACTIVE │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ ACTIVE QUESTION (Q 5 of 30)       │ LIVE TELEMETRY & SUBMISSIONS            │
│ "What is the primary function...?"│ [████████████████░░░░] 112/133 (84%)    │
│ Time Left: 14s [=====>        ]   │                                         │
│ Options:                          │ Option Breakdown:                       │
│ [A] Compilation Engine            │ [A] 64  [B] 12  [C] 32  [D] 4           │
│ [B] Memory Allocator              │                                         │
│ [C] Virtual Machine [CORRECT]     │ Fastest Submissions:                    │
│ [D] Garbage Collector             │ 1. Team Falcon (1.4s)  2. Team Alpha    │
├───────────────────────────────────┴─────────────────────────────────────────┤
│ PRIMARY CONTROL ACTIONS                                                     │
│ [  PAUSE TIMER  ]  [ LOCK SUBMISSIONS ]  [ REVEAL ANSWER ]  [ NEXT QUESTION »]│
├─────────────────────────────────────────────────────────────────────────────┤
│ EMERGENCY ACTIONS                                                           │
│ [ Disqualify Team ▾ ]   [ Adjust Points / Dispute ▾ ]   [ Mute Audio ▾ ]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Functional Components:
1. **Telemetry Bar**: Displays active room PIN, total connected sockets, and live count of submitted answers vs. waiting teams.
2. **Current Question Inspector**: Shows question text, assigned point value, media thumbnail, and marks the verified correct answer in green.
3. **Action Button Bar**: Large, distinct primary and secondary action triggers. Disabled states prevent accidental double-skips.
4. **Emergency Drawer**: Dropdown to select any team to kick or manually add/subtract marks.

---

### 2.2 Screen 2: Stage / Projector Screen (`/stage/:pin`)

Designed specifically for 1080p and 4K displays viewed by an audience from 10 to 50 meters away. Clean, minimal text clutter, high-impact visuals.

#### ASCII Layout Wireframe (Question Active State):
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BUFT NATIONAL QUIZ ARENA 2025                       PIN: 784-920  |  Q 05/30 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     Which data structure provides O(1) average time complexity              │
│     for insertion, deletion, and lookup operations?                         │
│                                                                             │
│                                  ╭──────╮                                   │
│                                  │  18  │  SECONDS                          │
│                                  ╰──────╯                                   │
│                                                                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  ▲ A. Binary Search Tree             │  ◆ B. Hash Table                     │
│  (Red Card #EF4444)                  │  (Blue Card #3B82F6)                 │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  ● C. Doubly Linked List             │  ■ D. AVL Tree                       │
│  (Amber Card #F59E0B)                │  (Emerald Card #10B981)              │
├──────────────────────────────────────┴──────────────────────────────────────┤
│  Teams Responded: 118 / 133                                 LearnUp Arena   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### ASCII Layout Wireframe (Answer Reveal & Chart State):
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANSWER REVEAL                                                       Q 05/30│
├─────────────────────────────────────────────────────────────────────────────┤
│  Correct Answer: [ ◆ B. Hash Table ]                                        │
│                                                                             │
│  AUDIENCE RESPONSE DISTRIBUTION:                                            │
│                                                                             │
│  A [████] 12%                                                               │
│  B [████████████████████████████████████████████████████████] 78% (CORRECT) │
│  C [██████] 8%                                                              │
│  D [█] 2%                                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fastest Correct: Team BUFT Warriors (1.12s)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### ASCII Layout Wireframe (Leaderboard State):
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP TEAMS STANDING — AFTER ROUND 2                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│   #1   👑  Team Technocrats        9,450 pts   [+950 pts]  🔼 2             │
│   #2   🥈  BUFT Cyber Knights      9,120 pts   [+890 pts]  🔻 1             │
│   #3   🥉  Neural Ninjas           8,850 pts   [+920 pts]  --               │
│   #4       Syntax Squad            8,400 pts   [+840 pts]  🔼 1             │
│   #5       Quantum Leapers         8,210 pts   [  0 pts]   🔻 2             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Next Question starting in 5s...                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Screen 3: Mobile Player Client (`/play`)

Ultra-responsive, thumb-friendly mobile layout. When a question is live, the buttons are oversized to make selection fast and error-free on 5" to 6.7" smartphone screens.

#### ASCII Layout Wireframe (Question Active & Buzzer):
```
    [ MOBILE: MCQ ACTIVE ]                 [ MOBILE: BUZZER ROUND ]
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ LearnUp Arena    Team Falcon│         │ LearnUp Arena    Team Falcon│
│ Q 5/30   ⏱ 18s   Pts: 3,420 │         │ Round 3: Buzzer Round       │
├─────────────────────────────┤         ├─────────────────────────────┤
│ Which data structure        │         │                             │
│ provides O(1) average lookup│         │                             │
│ complexity?                 │         │         ╭─────────╮         │
├──────────────┬──────────────┤         │        │  BUZZ!   │         │
│              │              │         │        │  🔥 ⚡   │         │
│   ▲ A. BST   │  ◆ B. Hash   │         │         ╰─────────╯         │
│  (Crimson)   │  (Cobalt)    │         │                             │
│              │              │         │   Tap immediately when      │
├──────────────┼──────────────┤         │   you know the answer!      │
│              │              │         │                             │
│   ● C. DLL   │  ■ D. AVL    │         │   Penalty for wrong: -50pts │
│   (Amber)    │  (Emerald)   │         │                             │
└──────────────┴──────────────┘         └─────────────────────────────┘
```

#### ASCII Layout Wireframe (Submitted & Result State):
```
    [ MOBILE: LOCKED IN ]                  [ MOBILE: ANSWER REVEAL ]
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ LearnUp Arena    Team Falcon│         │ LearnUp Arena    Team Falcon│
├─────────────────────────────┤         ├─────────────────────────────┤
│                             │         │      🎉 CORRECT!            │
│         ╭─────────╮         │         │                             │
│         │    ✓    │         │         │       +950 Points           │
│         ╰─────────╯         │         │  (Base: 700 + Speed: 250)   │
│                             │         │                             │
│      Answer Locked In!      │         │   Your Current Rank:        │
│   Waiting for other teams...│         │   # 4  of 133 Teams         │
│                             │         │   Streak: 3 in a row 🔥     │
└─────────────────────────────┘         └─────────────────────────────┘
```

---

## 3. UI Component Architecture

```
frontend/
├── components/
│   ├── stage/
│   │   ├── StageLobby.tsx            # Giant QR, PIN, and animated participant bubbles
│   │   ├── StageQuestion.tsx         # High-visibility question & countdown ring
│   │   ├── StageChart.tsx            # Animated bar chart of option distribution
│   │   ├── StageLeaderboard.tsx      # Top 10 sliding cards with rank movements
│   │   └── StagePodium.tsx           # 1st, 2nd, 3rd podium with canvas confetti
│   ├── player/
│   │   ├── PlayerJoinForm.tsx        # Team name, contact, institution inputs
│   │   ├── PlayerWaiting.tsx         # Lobby pulse state with team badge
│   │   ├── PlayerMcqCards.tsx        # 2x2 high-contrast touch quadrant
│   │   ├── PlayerBuzzer.tsx          # Massive circular haptic buzzer button
│   │   └── PlayerResultBanner.tsx    # Success/error explosion with rank change
│   ├── admin/
│   │   ├── HostTelemetryGauge.tsx    # Radial / bar indicator of responses received
│   │   ├── HostActionControls.tsx    # Primary buttons (Next, Lock, Reveal, Pause)
│   │   ├── HostEmergencyModal.tsx    # Disqualify, kick, or point adjustment dialog
│   │   └── HostQuestionList.tsx      # Quick sidebar to jump/skip questions
│   └── ui/
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Badge.tsx
│       └── CircularTimer.tsx
```
