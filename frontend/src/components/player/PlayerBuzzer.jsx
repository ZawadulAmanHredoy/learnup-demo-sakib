import React from 'react';
import { Zap, Lock, Mic, Ban, CheckCircle2, XCircle, Hourglass } from 'lucide-react';

function Panel({ icon: Icon, tone, title, children }) {
  return (
    <div className={`w-full p-6 rounded-3xl glass-panel border ${tone} text-center animate-scaleUp`}>
      <Icon className="w-12 h-12 mx-auto mb-3" />
      <h3 className="text-2xl font-black font-heading mb-2">{title}</h3>
      <div className="text-sm text-slate-300">{children}</div>
    </div>
  );
}

export default function PlayerBuzzer({ buzzer, onBuzz }) {
  const { status } = buzzer;
  const canBuzz = status === 'OPEN';

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="leading-tight">
        <span className="text-xs uppercase font-extrabold tracking-[0.25em] text-arena-gold block">Semi-Final · Buzzer Round</span>
        <span className="text-[11px] text-slate-400 font-semibold">
          Correct +{buzzer.correctPoints} · Wrong −{buzzer.penaltyPoints}
        </span>
      </div>

      {(status === 'OPEN' || status === 'PENDING') && (
        <>
          <div className="relative w-64 h-64 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-red-500/25 animate-ring-ping" />
            <button
              type="button"
              onPointerDown={canBuzz ? onBuzz : undefined}
              onClick={(e) => { if (e.detail === 0 && canBuzz) onBuzz(); /* keyboard activation */ }}
              disabled={!canBuzz}
              aria-label="Buzz in"
              className="relative w-60 h-60 rounded-full bg-gradient-to-br from-red-500 via-rose-600 to-red-700 border-[6px] border-red-300/80
                flex flex-col items-center justify-center select-none touch-manipulation animate-glow-pulse
                active:scale-90 transition-transform duration-75 disabled:opacity-80"
            >
              <Zap className="w-16 h-16 text-white fill-white mb-1 drop-shadow" />
              <span className="text-4xl font-black text-white font-heading tracking-wider drop-shadow">
                {status === 'PENDING' ? '…' : 'BUZZ!'}
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-400 max-w-xs">
            Tap the moment you know the answer. The first team to buzz gets the floor.
          </p>
        </>
      )}

      {status === 'WON' && (
        <Panel icon={Mic} tone="border-emerald-400/60 text-emerald-400" title="You have the floor!">
          <p className="text-white font-semibold">Speak your answer to the host now.</p>
          {buzzer.reactionTimeMs != null && (
            <p className="mt-2 font-mono text-arena-gold">Reaction: {(buzzer.reactionTimeMs / 1000).toFixed(3)}s</p>
          )}
        </Panel>
      )}

      {status === 'LOCKED_OUT' && (
        <Panel icon={Lock} tone="border-red-500/50 text-red-400" title="LOCKED OUT">
          <p><b className="text-white">{buzzer.winnerTeamName || 'Another team'}</b> buzzed in first!</p>
          {buzzer.reactionTimeMs != null && (
            <p className="mt-1 text-xs font-mono text-slate-400">Their reaction: {(buzzer.reactionTimeMs / 1000).toFixed(3)}s</p>
          )}
          <p className="mt-3 text-xs text-slate-400">Stay ready — the host may re-open the buzzer.</p>
        </Panel>
      )}

      {status === 'EXCLUDED' && (
        <Panel icon={Ban} tone="border-slate-500/50 text-slate-400" title="Sitting this one out">
          Your team already attempted this question. The other teams can buzz now.
        </Panel>
      )}

      {status === 'JUDGED' && (
        <Panel
          icon={buzzer.verdict === 'CORRECT' ? CheckCircle2 : buzzer.verdict === 'WRONG' ? XCircle : Hourglass}
          tone={buzzer.verdict === 'CORRECT' ? 'border-emerald-400/60 text-emerald-400' : buzzer.verdict === 'WRONG' ? 'border-red-500/50 text-red-400' : 'border-slate-500/50 text-slate-300'}
          title={buzzer.isMine
            ? (buzzer.verdict === 'CORRECT' ? 'Correct!' : buzzer.verdict === 'WRONG' ? 'Incorrect' : 'Passed')
            : `${buzzer.judgedTeamName}: ${buzzer.verdict === 'CORRECT' ? 'Correct' : buzzer.verdict === 'WRONG' ? 'Wrong' : 'Passed'}`}
        >
          {buzzer.isMine && buzzer.deltaPoints !== 0 && (
            <p className="text-3xl font-black text-white font-heading">
              {buzzer.deltaPoints > 0 ? `+${buzzer.deltaPoints}` : buzzer.deltaPoints} pts
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">Waiting for the host…</p>
        </Panel>
      )}

      {(status === 'CLOSED' || status === 'IDLE') && (
        <Panel icon={Hourglass} tone="border-arena-border text-slate-400" title="Buzzer closed">
          Watch the stage for the next question.
        </Panel>
      )}
    </div>
  );
}
