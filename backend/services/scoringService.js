/**
 * Scoring & Tournament Rules Engine
 * Implements the formulas specified in doc/Rules.md:
 *   Total = Round(Base × (1 − T_response / (2 × T_limit))) × M_streak
 *
 * The breakdown returned is additive so the player UI can show
 * "Base + Speed + Streak = Total" without rounding drift:
 *   basePoints        → guaranteed half of the base (what a correct answer at T_limit earns)
 *   speedBonusPoints  → extra earned by answering faster
 *   streakBonusPoints → extra earned by the streak multiplier
 */

const MIN_RESPONSE_MS = 200; // Human floor: nobody legitimately answers faster than this
const DEFAULT_NEGATIVE_RATIO = 0.5;

/**
 * Streak multiplier for the Nth consecutive correct answer (Rules.md §1.1)
 * @param {number} streakCount
 * @returns {{ multiplier: number, badge: string }}
 */
function getStreakMultiplier(streakCount) {
  if (streakCount >= 4) {
    return { multiplier: 1.3, badge: '👑 Unstoppable' };
  }
  if (streakCount === 3) {
    return { multiplier: 1.2, badge: '⚡ Super Streak' };
  }
  if (streakCount === 2) {
    return { multiplier: 1.1, badge: '🔥 On Fire' };
  }
  return { multiplier: 1.0, badge: '' };
}

/**
 * Calculate total points awarded for an MCQ answer
 * @param {Object} params
 * @param {boolean} params.isCorrect
 * @param {number} params.timeTakenMs
 * @param {number} params.timeLimitSec
 * @param {number} params.basePoints
 * @param {boolean} params.speedBonusEnabled
 * @param {boolean} params.negativeMarking
 * @param {number} params.negativeRatio - e.g. 0.5 for 50%
 * @param {number} params.currentStreak - consecutive correct answers BEFORE this one
 * @returns {Object} score breakdown
 */
function calculateScore({
  isCorrect,
  timeTakenMs,
  timeLimitSec = 20,
  basePoints = 1000,
  speedBonusEnabled = true,
  negativeMarking = false,
  negativeRatio = DEFAULT_NEGATIVE_RATIO,
  currentStreak = 0,
}) {
  if (!isCorrect) {
    const ratio = negativeRatio > 0 ? negativeRatio : DEFAULT_NEGATIVE_RATIO;
    const penaltyPoints = negativeMarking ? Math.round(basePoints * ratio) : 0;
    return {
      isCorrect: false,
      basePoints: 0,
      speedBonusPoints: 0,
      streakBonusPoints: 0,
      penaltyPoints,
      totalPointsAwarded: penaltyPoints ? -penaltyPoints : 0,
      newStreak: 0,
      multiplier: 1.0,
      badge: '',
    };
  }

  const timeLimitMs = timeLimitSec * 1000;
  const clampedTimeTaken = Math.min(Math.max(timeTakenMs, MIN_RESPONSE_MS), timeLimitMs);

  let rawPoints = basePoints;
  let guaranteedPoints = basePoints;

  if (speedBonusEnabled) {
    // Formula: BasePoints * (1 - (T_response / (2 * T_limit)))
    const speedFactor = 1 - (clampedTimeTaken / (2 * timeLimitMs));
    rawPoints = Math.round(basePoints * speedFactor);
    guaranteedPoints = Math.round(basePoints * 0.5);
  }

  const nextStreak = currentStreak + 1;
  const { multiplier, badge } = getStreakMultiplier(nextStreak);
  const totalPointsAwarded = Math.round(rawPoints * multiplier);

  return {
    isCorrect: true,
    basePoints: guaranteedPoints,
    speedBonusPoints: Math.max(0, rawPoints - guaranteedPoints),
    streakBonusPoints: totalPointsAwarded - rawPoints,
    penaltyPoints: 0,
    totalPointsAwarded,
    newStreak: nextStreak,
    multiplier,
    badge,
  };
}

/**
 * Apply a point delta to a running total. Scores are floored at 0 (Rules.md §1.2).
 */
function applyDelta(currentScore, delta) {
  return Math.max(0, (currentScore || 0) + (delta || 0));
}

/**
 * Tie-breaking comparator (Rules.md §3):
 *   1. Higher total score
 *   2. Higher accuracy (count of correct answers)
 *   3. Lower cumulative response time
 *   4. Highest single question score
 *   (5. Sudden death is run manually by the host — fall back to join order for determinism)
 */
function compareParticipants(a, b) {
  return (
    (b.totalScore || 0) - (a.totalScore || 0) ||
    (b.correctAnswersCount || 0) - (a.correctAnswersCount || 0) ||
    (a.cumulativeResponseTimeMs || 0) - (b.cumulativeResponseTimeMs || 0) ||
    (b.bestQuestionScore || 0) - (a.bestQuestionScore || 0) ||
    new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
}

/**
 * Sort participants by the tie-breaking hierarchy and attach 1-based ranks.
 * Returns a new array; the input is not mutated.
 * @param {Array} participants
 * @returns {Array<Object & { rank: number }>}
 */
function rankParticipants(participants) {
  return [...participants]
    .filter(p => !p.isDisqualified)
    .sort(compareParticipants)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

module.exports = {
  calculateScore,
  getStreakMultiplier,
  applyDelta,
  compareParticipants,
  rankParticipants,
};
