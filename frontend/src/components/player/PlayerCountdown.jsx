import React, { useEffect, useState } from 'react';
import { sound } from '../../utils/audio';

export default function PlayerCountdown({ endsAt, questionIndex, totalQuestions }) {
  const secondsLeft = () => Math.max(0, Math.ceil(((endsAt || 0) - Date.now()) / 1000));
  const [count, setCount] = useState(secondsLeft);

  useEffect(() => {
    const id = setInterval(() => setCount(secondsLeft()), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  useEffect(() => {
    if (count > 0) sound.playTick();
  }, [count]);

  return (
    <div className="flex flex-col items-center justify-center text-center animate-fadeIn">
      <span className="text-xs uppercase font-extrabold tracking-[0.3em] text-arena-gold mb-1">Get Ready</span>
      {totalQuestions > 0 && (
        <span className="text-sm text-slate-400 font-semibold mb-8">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
      )}
      <div
        key={count}
        className="w-40 h-40 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center text-7xl font-black text-slate-950 shadow-2xl shadow-yellow-500/30 font-heading animate-pop"
      >
        {count || 'GO'}
      </div>
      <div className="mt-10 grid grid-cols-4 gap-2 opacity-60">
        {['bg-quadrant-red', 'bg-quadrant-blue', 'bg-quadrant-amber', 'bg-quadrant-green'].map(c => (
          <span key={c} className={`w-6 h-6 rounded-md ${c}`} />
        ))}
      </div>
    </div>
  );
}
