import React from 'react';
import { ArrowUp, ArrowDown, Minus, Trophy } from 'lucide-react';

/** "Current Position: #6 of 133 Teams" with movement indicator. */
export function RankBadge({ rank, totalTeams, delta = 0, compact = false }) {
  const Arrow = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const deltaColor = delta > 0 ? 'text-emerald-400 bg-emerald-500/10' : delta < 0 ? 'text-red-400 bg-red-500/10' : 'text-slate-400 bg-slate-500/10';
  return (
    <div className={`w-full rounded-2xl glass-panel ${compact ? 'p-3' : 'p-4'} flex items-center justify-between`}>
      <div className="text-left">
        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Current Position</span>
        <span className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-arena-gold font-heading tabular-nums`}>
          #{rank || '–'} <span className="text-sm text-slate-400 font-bold">of {totalTeams || '–'} Teams</span>
        </span>
      </div>
      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${deltaColor}`}>
        <Arrow className="w-3.5 h-3.5" />
        {delta !== 0 ? Math.abs(delta) : ''}
      </span>
    </div>
  );
}

export default function PlayerRankBanner({ standing, profile }) {
  const rank = standing?.rank ?? profile.rank;
  const totalTeams = standing?.totalTeams ?? profile.totalTeams;
  const score = standing?.score ?? profile.score;
  const delta = standing?.delta ?? 0;
  const podium = rank >= 1 && rank <= 3;

  return (
    <div className="flex flex-col items-center text-center gap-5 animate-scaleUp">
      <span className="text-xs uppercase font-extrabold tracking-[0.3em] text-slate-400">Standings</span>
      <div className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center border-4 ${
        podium ? 'border-arena-gold bg-arena-gold/10 shadow-2xl shadow-yellow-500/20' : 'border-arena-border bg-arena-card'
      }`}>
        {podium && <Trophy className="w-7 h-7 text-arena-gold mb-1" />}
        <span className="text-6xl font-black text-white font-heading tabular-nums">#{rank || '–'}</span>
        <span className="text-xs text-slate-400 font-semibold">of {totalTeams || '–'} teams</span>
      </div>

      {delta !== 0 && (
        <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black ${delta > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          {delta > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          {delta > 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`} place{Math.abs(delta) === 1 ? '' : 's'}
        </span>
      )}

      <div className="text-3xl font-black text-arena-gold font-heading tabular-nums">
        {(score || 0).toLocaleString()} <span className="text-base text-slate-400">pts</span>
      </div>
      <p className="text-xs text-slate-500">Watch the stage — the next question is coming up.</p>
    </div>
  );
}
