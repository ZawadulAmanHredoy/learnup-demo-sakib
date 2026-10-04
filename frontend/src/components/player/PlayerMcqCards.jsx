import React, { useCallback } from 'react';
import { Image as ImageIcon, Headphones, Film, PauseCircle, MinusCircle } from 'lucide-react';
import CircularTimer from '../ui/CircularTimer';
import { quadrantFor } from './quadrants';
import { sound } from '../../utils/audio';

function MediaHint({ media }) {
  if (!media || media.type === 'NONE' || !media.url) return null;
  if (media.type === 'IMAGE') {
    return (
      <img
        src={media.url}
        alt="Question clue"
        className="w-full max-h-40 object-contain rounded-xl bg-black/30 border border-arena-border"
        loading="eager"
      />
    );
  }
  const Icon = media.type === 'AUDIO' ? Headphones : media.type === 'VIDEO' ? Film : ImageIcon;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-arena-elevated border border-arena-border text-xs text-slate-300 font-semibold">
      <Icon className="w-4 h-4 text-arena-gold" />
      {media.type === 'AUDIO' ? 'Listen to the clip on stage' : 'Watch the clip on the stage screen'}
    </div>
  );
}

export default function PlayerMcqCards({
  question,
  deadline,
  isPaused,
  pausedRemainingMs,
  answer,
  score,
  onSelect,
}) {
  const locked = answer.status !== 'idle';
  const handleSecond = useCallback((s) => {
    if (s > 0 && s <= 5) sound.playTick();
  }, []);

  return (
    <div className="flex flex-col gap-3 flex-1 animate-fadeIn">
      {/* Header: Q number · synchronized timer · score */}
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold block">Question</span>
          <span className="text-lg font-black text-arena-gold font-heading tabular-nums">
            {question.questionIndex + 1}
            {question.totalQuestions ? <span className="text-slate-500 text-sm"> / {question.totalQuestions}</span> : null}
          </span>
        </div>
        <CircularTimer
          deadline={deadline}
          durationMs={(question.timeLimitSec || 20) * 1000}
          paused={isPaused}
          pausedRemainingMs={pausedRemainingMs}
          size={60}
          onSecond={handleSecond}
        />
        <div className="text-right leading-tight">
          <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold block">Score</span>
          <span className="text-lg font-black text-white font-heading tabular-nums">{(score || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Question body */}
      <div className="p-4 rounded-2xl glass-panel space-y-3">
        <p className="text-base font-bold text-white leading-snug">{question.questionText}</p>
        <MediaHint media={question.media} />
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
          <span className="px-2 py-0.5 rounded-full bg-arena-gold/10 text-arena-gold border border-arena-gold/30">
            {question.points || 1000} pts
          </span>
          {question.negativeMarking && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30 inline-flex items-center gap-1">
              <MinusCircle className="w-3 h-3" /> Negative marking
            </span>
          )}
        </div>
      </div>

      {/* 4-color tactile quadrant */}
      <div className="relative grid grid-cols-2 grid-rows-2 gap-3 flex-1 min-h-[300px]">
        {question.options?.map((opt, idx) => {
          const q = quadrantFor(idx);
          const isSelected = answer.selectedOptionId === opt.id;
          const dimmed = locked && !isSelected;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={locked || isPaused}
              onClick={() => onSelect(opt.id)}
              aria-label={`Option ${q.letter}: ${opt.text}`}
              className={`relative rounded-3xl ${q.bg} p-4 flex flex-col justify-between text-left shadow-xl ${q.shadow}
                border-b-[6px] border-black/25 transition-all duration-150 select-none touch-manipulation
                active:scale-[0.96] active:border-b-2 active:translate-y-1
                ${dimmed ? 'opacity-25 scale-95 grayscale-[40%]' : ''}
                ${isSelected ? `ring-4 ${q.ring} animate-pulse-fast` : ''}`}
            >
              <span className="flex items-center justify-between">
                <span className="text-3xl font-black text-white/90 drop-shadow">{q.symbol}</span>
                <span className="text-xs font-black text-white/70 font-heading">{q.letter}</span>
              </span>
              <span className="text-base font-bold text-white leading-snug line-clamp-4 drop-shadow-sm">
                {opt.text}
              </span>
            </button>
          );
        })}

        {isPaused && (
          <div className="absolute inset-0 rounded-3xl bg-arena-dark/90 backdrop-blur-md flex flex-col items-center justify-center text-center gap-2 animate-fadeIn">
            <PauseCircle className="w-14 h-14 text-arena-gold" />
            <span className="text-lg font-black text-white font-heading">Competition Paused by Host</span>
            <span className="text-xs text-slate-400">The clock is frozen — hold tight.</span>
          </div>
        )}
      </div>
    </div>
  );
}
