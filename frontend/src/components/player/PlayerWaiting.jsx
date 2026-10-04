import React from 'react';
import { Shield, Volume2, VolumeX, LogOut } from 'lucide-react';

export default function PlayerWaiting({ teamName, institution, quizTitle, soundMuted, onToggleSound, onLeave }) {
  return (
    <div className="flex flex-col items-center text-center px-2 animate-scaleUp">
      <div className="relative w-36 h-36 mb-7 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-arena-gold/20 animate-ring-ping" />
        <span className="absolute inset-3 rounded-full bg-arena-gold/10 animate-ring-ping [animation-delay:0.6s]" />
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-arena-elevated to-arena-card border-2 border-arena-gold/50 flex items-center justify-center shadow-xl shadow-yellow-500/10">
          <Shield className="w-14 h-14 text-arena-gold" />
        </div>
      </div>

      <span className="text-xs uppercase font-extrabold tracking-[0.25em] text-emerald-400 mb-2">You&apos;re in!</span>
      <h2 className="text-3xl font-black text-white font-heading leading-tight">
        Welcome {teamName}
      </h2>
      {institution && <p className="text-sm text-slate-400 font-semibold mt-1">{institution}</p>}

      {quizTitle && (
        <div className="mt-5 px-4 py-2 rounded-full bg-arena-elevated border border-arena-border text-[11px] text-slate-300 font-semibold">
          {quizTitle}
        </div>
      )}

      <div className="mt-6 p-4 rounded-2xl glass-panel text-xs text-slate-300 max-w-xs space-y-1.5 text-left">
        <p>📱 Keep this screen open — questions appear automatically.</p>
        <p>⚡ Faster correct answers score more points.</p>
        <p>🔥 Answer correctly in a row to build a streak multiplier.</p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggleSound(!soundMuted)}
          className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 transition ${
            soundMuted ? 'border-arena-border text-slate-400 bg-arena-card' : 'border-arena-gold/40 text-arena-gold bg-arena-gold/10'
          }`}
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {soundMuted ? 'Sound off' : 'Sound on'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Leave this room on this device? Your team stays registered.')) onLeave();
          }}
          className="px-4 py-2.5 rounded-xl border border-arena-border text-xs font-bold text-slate-400 flex items-center gap-2 active:scale-95 transition"
        >
          <LogOut className="w-4 h-4" /> Leave
        </button>
      </div>
    </div>
  );
}
