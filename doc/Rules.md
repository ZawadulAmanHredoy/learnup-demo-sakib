# Game Engine & Tournament Rules Engine (Rules)
## Project: LearnUp Live Arena

---

## 1. Scoring Mathematics & Formulas

The platform utilizes a dynamic, competitive scoring formula that rewards both accuracy and speed, while penalizing incorrect guesses when negative marking is activated.

### 1.1 Standard MCQ Scoring Formula (Round 2 & Quarter Finals)

If a participant selects the **correct** answer within the allotted time limit:

$$\text{Total Points} = \text{Round}\left(\text{Base Points} \times \left(1 - \frac{T_{\text{response}}}{2 \times T_{\text{limit}}}\right)\right) \times M_{\text{streak}}$$

Where:
- $\text{Base Points} = 1,000$ (configurable per question).
- $T_{\text{response}} = \text{Time taken from question activation to answer receipt (ms)}$.
- $T_{\text{limit}} = \text{Question time limit (ms)}$.
- $M_{\text{streak}} = \text{Streak Multiplier based on consecutive correct answers}$.

#### Streak Multipliers:
| Consecutive Correct Answers | Multiplier ($M_{\text{streak}}$) | UI Badge |
| :---: | :---: | :---: |
| 1 | $1.0\times$ | — |
| 2 | $1.1\times$ | 🔥 On Fire |
| 3 | $1.2\times$ | ⚡ Super Streak |
| 4+ | $1.3\times$ | 👑 Unstoppable |

*Example Calculation*:
- Base Points = 1,000 pts.
- Time Limit = 20s ($20,000\text{ ms}$).
- Response Time = 3.2s ($3,200\text{ ms}$).
- Current Streak = 3 ($1.2\times$).
- $\text{Raw Points} = 1000 \times \left(1 - \frac{3200}{40000}\right) = 1000 \times (1 - 0.08) = 920\text{ pts}$.
- $\text{Final Points} = 920 \times 1.2 = 1,104\text{ pts}$.

---

### 1.2 Negative Marking Rules

Negative marking is toggled per round or per question:
- If a question has **Negative Marking = False**:
  - Incorrect answer $\rightarrow 0\text{ points}$. Streak resets to 0.
- If a question has **Negative Marking = True**:
  - Penalty Ratio $\lambda = 0.5$ (configurable, e.g., 25% or 50% of Base Points).
  - Penalty Points deducted: $-\lambda \times \text{Base Points}$.
  - Streak resets to 0. Total score can drop below previous value, but cannot go below 0 (optional floor toggle).

---

## 2. Round-Specific Tournament Rules (BUFT Flow)

### 2.1 Round 2: Team MCQ Screening (133 Teams / 399 Persons)
- **Format**: 50 MCQs.
- **Time per Question**: 20 seconds.
- **Negative Marking**: Disabled.
- **Speed Bonus**: Enabled.
- **Advancement Threshold**: Top 20 teams advance to Quarter Finals.

### 2.2 Quarter Finals: High-Pressure MCQ (20 Teams / 60 Persons)
- **Format**: 30 MCQs.
- **Time per Question**: 15 seconds.
- **Negative Marking**: Enabled ($-25\text{ pts}$ on 100-pt base).
- **Speed Bonus**: Enabled.
- **Advancement Threshold**: Top 6 teams advance to Semi-Finals.

### 2.3 Semi-Finals: Buzzer / Podium Switch Round (6 Teams / 18 Persons)
- **Format**: 30 MCQs, Buzzer Lockout.
- **Mechanics**:
  1. Question is read aloud or displayed on the auditorium stage screen.
  2. Buzzer opens. Contestants hit the mobile buzzer button.
  3. First team to buzz locks the floor for all other teams.
  4. Team has 10 seconds to verbally state their answer.
  5. **Host Judgment**:
     - If **Correct**: $+100\text{ points}$.
     - If **Incorrect**: $-50\text{ points}$ (Negative penalty).
  6. **Re-Open Buzzer**: If the first team is wrong, host clicks "Pass/Re-open". The question is reopened for the remaining 5 teams.
- **Advancement Threshold**: Top 4 teams advance to the Grand Finale.

### 2.4 Grand Finale: Audio/Visual & Rapid Fire (4 Teams / 12 Persons)
- **Phase A: Audio / Visual Round**:
  - 10 Audio / Visual clue questions.
  - 30 seconds per question.
  - $+150\text{ points}$ for correct answer.
- **Phase B: Rapid Fire Round (The Final Showdown)**:
  - Each team takes the hot seat individually.
  - **Master Timer**: Strictly 60 seconds countdown.
  - **Question Bank**: 30 rapid-fire questions queued.
  - Contestant can tap: `Answer` (Correct = $+50$), `Pass` (0 pts), or `Wrong` ($-25$ pts).
  - System cycles questions instantaneously until the 60s expires.

---

## 3. Tie-Breaking Hierarchy

In the event that two or more teams finish with identical total points at the end of a round:

```
┌─────────────────────────────────────────────────────────────┐
│                    TIE-BREAKING ALGORITHM                   │
├──────┬──────────────────────────────────────────────────────┤
│ Rank │ Criterion                                            │
├──────┼──────────────────────────────────────────────────────┤
│ 1st  │ Higher Accuracy (Count of total correct answers)     │
├──────┼──────────────────────────────────────────────────────┤
│ 2nd  │ Lower Cumulative Response Time (Fastest cumulative) │
├──────┼──────────────────────────────────────────────────────┤
│ 3rd  │ Highest single question score (Peak speed bonus)     │
├──────┼──────────────────────────────────────────────────────┤
│ 4th  │ Sudden Death: 1-Question Golden Buzzer Round         │
└──────┴──────────────────────────────────────────────────────┘
```

---

## 4. Host Discretion & Emergency Overrides

The Tournament Host holds final authority and is supported by software emergency mechanisms:
1. **Dispute Resolution (Dual-Correct Options)**: If an administrative mistake resulted in two valid answers, the Host Cockpit allows marking both options as correct; the system retroactively recalculates affected scores.
2. **Question Void**: Host can void a question. Any points awarded or penalties applied for that specific question are rolled back automatically across all participants.
3. **Disqualification (Cheating/Misconduct)**: Setting a team to `isDisqualified: true` immediately zeroes their score, disconnects their active socket, and removes them from the stage leaderboard display.
