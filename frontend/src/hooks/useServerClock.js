import { useCallback, useEffect, useRef } from 'react';

const PROBES = 5;
const RESYNC_MS = 30000;

/**
 * Server clock offset estimation (PROOFS §3 — drift compensation).
 *
 * Fires a few `time:sync` probes and keeps the one with the lowest round-trip:
 *   offset = serverTime − (sentAt + receivedAt) / 2
 * Until a probe completes, the `serverTime` stamped on each broadcast is used
 * as a coarse estimate. Server timestamps are converted to the local clock
 * with `toLocal`, so a device whose clock is hours off still counts down correctly.
 */
export function useServerClock(socket, connected) {
  const offsetRef = useRef(0); // serverClock − localClock
  const bestRttRef = useRef(Infinity);

  useEffect(() => {
    if (!socket || !connected) return undefined;
    let cancelled = false;
    bestRttRef.current = Infinity;

    const probe = () => new Promise(resolve => {
      const sentAt = Date.now();
      socket.timeout(2000).emit('time:sync', { clientSentAt: sentAt }, (err, res) => {
        if (!err && res?.serverTime) {
          const receivedAt = Date.now();
          const rtt = receivedAt - sentAt;
          if (rtt < bestRttRef.current) {
            bestRttRef.current = rtt;
            offsetRef.current = res.serverTime - (sentAt + receivedAt) / 2;
          }
        }
        resolve();
      });
    });

    (async () => {
      for (let i = 0; i < PROBES && !cancelled; i++) {
        await probe();
        await new Promise(r => setTimeout(r, 120));
      }
    })();
    const id = setInterval(() => {
      bestRttRef.current = Infinity; // Re-measure: network conditions change
      probe();
    }, RESYNC_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [socket, connected]);

  /** Coarse fallback from a broadcast's `serverTime` until a probe lands. */
  const observe = useCallback((serverTime) => {
    if (typeof serverTime === 'number' && bestRttRef.current === Infinity) {
      offsetRef.current = serverTime - Date.now();
    }
  }, []);

  const toLocal = useCallback((serverTimestamp) => serverTimestamp - offsetRef.current, []);

  return { toLocal, observe };
}
