import React from 'react';
import { Check, Clock, Loader2, XOctagon } from 'lucide-react';
import { optionMeta } from './quadrants';

const REJECTION_TEXT = {
  EXPIRED: 'Your answer arrived after time was up, so it was not counted.',
  DISQUALIFIED: 'This team can no longer submit answers.',
  INVALID_OPTION: 'That option was not valid for this question.',
  STALE_QUESTION: 'That answer was for a previous question.',
};

export default function PlayerLocked({ question, answer, lockReason }) {
  const meta = optionMeta(question, answer.selectedOptionId);

  if (answer.status === 'rejected' || (answer.status === 'idle' && lockReason)) {
    const timeUp = answer.status === 'idle';
    return (
      <div className="flex flex-col items-center text-center animate-scaleUp">
        <div className="w-24 h-24 rounded-full bg-amber-500/15 border-2 border-amber-500/50 flex items-center justify-center mb-5">
          {timeUp ? <Clock className="w-12 h-12 text-amber-400" /> : <XOctagon className="w-12 h-12 text-amber-400" />}
        </div>
        <h2 className="text-3xl font-black text-white font-heading mb-2">Time&apos;s Up!</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          {timeUp ? 'No answer was recorded for your team on this question.' : (REJECTION_TEXT[answer.reason] || 'Your answer could not be recorded.')}
        </p>
        <p className="text-xs text-slate-500 mt-4">Waiting for the answer reveal…</p>
      </div>
    );
  }

  const pending = answer.status === 'pending';
  return (
    <div className="flex flex-col items-center text-center animate-scaleUp">
      <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
        {!pending && <span className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ring-ping" />}
        <div className="relative w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center">
          {pending ? <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" /> : <Check className="w-14 h-14 text-emerald-400 animate-pop" strokeWidth={3} />}
        </div>
      </div>

      <h2 className="text-3xl font-black text-white font-heading mb-1">
        {pending ? 'Sending…' : 'Answer Recorded!'}
      </h2>
      <p className="text-sm text-slate-400 mb-6">Waiting for results…</p>

      {meta && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${meta.bg} shadow-lg ${meta.shadow} max-w-xs`}>
          <span className="text-2xl font-black text-white">{meta.symbol}</span>
          <span className="text-sm font-bold text-white text-left line-clamp-2">{meta.option.text}</span>
        </div>
      )}
      <p className="text-[11px] text-slate-500 mt-6 max-w-xs">
        Your answer is time-stamped by the server. It can’t be changed.
      </p>
    </div>
  );
}
