import React, { useEffect, useRef, useState } from 'react';

/**
 * Circular countdown ring driven by a local-clock deadline.
 * The deadline is server-authoritative (converted via useServerClock);
 * this component only renders it.
 */
export default function CircularTimer({
  deadline,
  durationMs,
  paused = false,
  pausedRemainingMs = null,
  size = 64,
  stroke = 6,
  onSecond,
}) {
  const remainingAt = () => (paused && pausedRemainingMs != null
    ? pausedRemainingMs
    : Math.max(0, (deadline || 0) - Date.now()));
  const [remainingMs, setRemainingMs] = useState(remainingAt);
  const lastSecondRef = useRef(null);

  useEffect(() => {
    setRemainingMs(remainingAt());
    if (paused) return undefined;
    const id = setInterval(() => setRemainingMs(remainingAt()), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, paused, pausedRemainingMs]);

  const seconds = Math.ceil(remainingMs / 1000);
  useEffect(() => {
    if (lastSecondRef.current !== seconds) {
      lastSecondRef.current = seconds;
      if (!paused) onSecond?.(seconds);
    }
  }, [seconds, paused, onSecond]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = durationMs > 0 ? Math.min(1, remainingMs / durationMs) : 0;
  const color = seconds <= 3 ? '#EF4444' : seconds <= 5 ? '#F59E0B' : '#FACC15';

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1E2B45" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-heading font-black tabular-nums ${seconds <= 5 && !paused ? 'animate-pulse-fast' : ''}`}
        style={{ color, fontSize: size * 0.36 }}
      >
        {paused ? '❚❚' : seconds}
      </span>
    </div>
  );
}
