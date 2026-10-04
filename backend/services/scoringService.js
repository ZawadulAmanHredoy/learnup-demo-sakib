/**
 * Scoring & Tournament Rules Engine
 * Implements mathematical formulas specified in doc/Rules.md
 */

/**
 * Calculate streak multiplier based on consecutive correct answers
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
 * @param {number} params.currentStreak
 * @returns {Object} score breakdown
 */
function calculateScore({
  isCorrect,
  timeTakenMs,
  timeLimitSec = 20,
  basePoints = 1000,
  speedBonusEnabled = true,
  negativeMarking = false,
  negativeRatio = 0.5,
  currentStreak = 0,
}) {
  if (!isCorrect) {
    const penaltyPoints = negativeMarking ? Math.round(basePoints * negativeRatio) : 0;
    return {
      isCorrect: false,
      basePoints: 0,
      speedBonusPoints: 0,
      penaltyPoints,
      totalPointsAwarded: -penaltyPoints,
      newStreak: 0,
      multiplier: 1.0,
      badge: '',
    };
  }

  const timeLimitMs = timeLimitSec * 1000;
  const clampedTimeTaken = Math.min(Math.max(timeTakenMs, 200), timeLimitMs);

  let rawPoints = basePoints;
  let speedBonus = 0;

  if (speedBonusEnabled) {
    // Formula: BasePoints * (1 - (T_response / (2 * T_limit)))
    const speedFactor = 1 - (clampedTimeTaken / (2 * timeLimitMs));
    rawPoints = Math.round(basePoints * speedFactor);
    speedBonus = Math.max(0, rawPoints - Math.round(basePoints * 0.5));
  }

  const nextStreak = currentStreak + 1;
  const { multiplier, badge } = getStreakMultiplier(nextStreak);
  const totalPointsAwarded = Math.round(rawPoints * multiplier);

  return {
    isCorrect: true,
    basePoints,
    speedBonusPoints: speedBonus,
    penaltyPoints: 0,
    totalPointsAwarded,
    newStreak: nextStreak,
    multiplier,
    badge,
  };
}

module.exports = {
  calculateScore,
  getStreakMultiplier,
};
