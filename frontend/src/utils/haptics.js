/**
 * Mobile Haptic Engine (Design.md §1.3)
 * Silently no-ops on devices without the Vibration API (e.g. iOS Safari).
 */

function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Some browsers throw if called without a user gesture — ignore
  }
}

export const haptics = {
  tap: () => vibrate([40]),
  questionLive: () => vibrate([60]),
  timeUp: () => vibrate([150, 50, 150]),
  correct: () => vibrate([100, 50, 100]),
  wrong: () => vibrate([220]),
  buzz: () => vibrate([150]),
  buzzWon: () => vibrate([80, 40, 80, 40, 200]),
  lockedOut: () => vibrate([300]),
};
