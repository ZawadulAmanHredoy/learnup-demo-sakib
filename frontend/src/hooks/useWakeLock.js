import { useEffect } from 'react';

/** Keep the phone screen on while `active` (Screen Wake Lock API, where supported). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let released = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Denied (battery saver, no user gesture yet) — non-critical
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
