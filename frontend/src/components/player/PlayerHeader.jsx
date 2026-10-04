import React from 'react';
import { Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';

export default function PlayerHeader({ teamName, score, rank, totalTeams, connected, joined, soundMuted, onToggleSound }) {
  return (
    <header className="px-4 py-3 bg-arena-card/95 backdrop-blur border-b border-arena-border flex items-center justify-between gap-3 sticky top-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="min-w-0">
        <h1 className="text-sm font-black text-white font-heading tracking-wide leading-tight">
          LearnUp <span className="text-arena-gold">Arena</span>
        </h1>
        <span className="text-[11px] text-slate-400 font-semibold truncate block max-w-[170px]">
          {teamName || 'Contestant App'}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {joined && (
          <div className="text-right leading-tight">
            <span className="text-sm font-black text-arena-gold font-heading tabular-nums block">
              {(score || 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-semibold">pts</span>
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {rank ? `Rank #${rank}${totalTeams ? ` / ${totalTeams}` : ''}` : 'Unranked'}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => onToggleSound(!soundMuted)}
          className="w-9 h-9 rounded-xl bg-arena-elevated border border-arena-border flex items-center justify-center text-slate-300 active:scale-90 transition"
          aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-arena-gold" />}
        </button>
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/40 bg-red-500/10 text-red-400 animate-pulse'}`}
          title={connected ? 'Connected' : 'Reconnecting…'}
        >
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </span>
      </div>
    </header>
  );
}
