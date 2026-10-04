import React from 'react';
import { CheckCircle2, XCircle, Flame, Zap, Clock } from 'lucide-react';
import { RankBadge } from './PlayerRankBanner';
import { optionMeta } from './quadrants';

/** Soft full-screen wash behind the result: green for correct, red for wrong (AppFlow §2.2.5). */
export function resultWashClass(result) {
  if (!result) return '';
  if (result.isCorrect) return 'bg-gradient-to-b from-emerald-500/25 via-emerald-500/10 to-transparent';
  if (result.missed) return 'bg-gradient-to-b from-amber-500/15 to-transparent';
  return 'bg-gradient-to-b from-red-500/20 via-red-500/5 to-transparent';
}

export default function PlayerResultBanner({ result, question, reveal }) {
  const correctId = result.correctOptionId || reveal?.correctOptionId;
  const correct = optionMeta(question, correctId);
  const points = result.pointsEarned;

  const tone = result.isCorrect
    ? { ring: 'border-emerald-400/60 bg-emerald-500/15', text: 'text-emerald-400', glow: 'bg-emerald-500/30' }
    : result.missed
      ? { ring: 'border-amber-400/50 bg-amber-500/10', text: 'text-amber-400', glow: 'bg-amber-500/20' }
      : { ring: 'border-red-400/50 bg-red-500/10', text: 'text-red-400', glow: 'bg-red-500/20' };

  const Icon = result.isCorrect ? CheckCircle2 : result.missed ? Clock : XCircle;
  const title = result.isCorrect ? 'Correct!' : result.missed ? 'No Answer' : 'Incorrect';

  return (
    <div className={`flex flex-col items-center text-center gap-4 ${result.isCorrect ? 'animate-scaleUp' : 'animate-shake'}`}>
      <div className="relative w-28 h-28 flex items-center justify-center">
        {result.isCorrect && <span className={`absolute inset-0 rounded-full ${tone.glow} animate-burst`} />}
        <div className={`relative w-24 h-24 rounded-full border-2 ${tone.ring} flex items-center justify-center`}>
          <Icon className={`w-14 h-14 ${tone.text}`} />
        </div>
      </div>

      <h2 className={`text-4xl font-black font-heading uppercase ${tone.text}`}>{title}</h2>

      <div className="text-5xl font-black text-white font-heading tabular-nums animate-pop">
        {points > 0 ? `+${points.toLocaleString()}` : points.toLocaleString()} <span className="text-xl text-slate-400">pts</span>
      </div>

      {result.isCorrect && (
        <div className="flex flex-wrap justify-center gap-2 text-xs font-bold">
          <span className="px-3 py-1 rounded-full bg-arena-elevated border border-arena-border text-slate-300">
            Base {result.basePoints}
          </span>
          {result.speedBonus > 0 && (
            <span className="px-3 py-1 rounded-full bg-arena-gold/10 border border-arena-gold/40 text-arena-gold inline-flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" /> Speed Bonus +{result.speedBonus}
            </span>
          )}
          {result.streakBonus > 0 && (
            <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/40 text-orange-300">
              Streak ×{result.multiplier} +{result.streakBonus}
            </span>
          )}
        </div>
      )}

      {!result.isCorrect && correct && (
        <div className="text-sm text-slate-300">
          Option <b className="text-white">{correct.letter}</b> was correct:
          <div className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${correct.bg} text-white font-bold`}>
            <span>{correct.symbol}</span> {correct.option.text}
          </div>
        </div>
      )}
      {!result.isCorrect && result.penaltyPoints > 0 && (
        <p className="text-xs text-red-300">Negative marking: −{result.penaltyPoints} pts</p>
      )}

      {result.streak >= 2 && (
        <div className="px-4 py-1.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-sm font-black flex items-center gap-1.5 animate-pop">
          <Flame className="w-4 h-4 fill-orange-400 text-orange-400" />
          Streak: {result.streak} {result.badge ? `· ${result.badge}` : '🔥'}
        </div>
      )}

      {result.isCorrect && result.timeTakenMs != null && (
        <p className="text-[11px] text-slate-500">Answered in {(result.timeTakenMs / 1000).toFixed(2)}s</p>
      )}

      <RankBadge rank={result.rank} totalTeams={result.totalTeams} delta={result.rankDelta} />
    </div>
  );
}
