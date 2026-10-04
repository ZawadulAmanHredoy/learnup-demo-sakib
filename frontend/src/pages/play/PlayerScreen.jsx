import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ShieldOff, WifiOff } from 'lucide-react';
import { usePlayerSession } from '../../hooks/usePlayerSession';
import { useWakeLock } from '../../hooks/useWakeLock';
import PlayerHeader from '../../components/player/PlayerHeader';
import PlayerJoinForm from '../../components/player/PlayerJoinForm';
import PlayerWaiting from '../../components/player/PlayerWaiting';
import PlayerCountdown from '../../components/player/PlayerCountdown';
import PlayerMcqCards from '../../components/player/PlayerMcqCards';
import PlayerLocked from '../../components/player/PlayerLocked';
import PlayerResultBanner, { resultWashClass } from '../../components/player/PlayerResultBanner';
import PlayerRankBanner from '../../components/player/PlayerRankBanner';
import PlayerBuzzer from '../../components/player/PlayerBuzzer';
import PlayerFinalSummary from '../../components/player/PlayerFinalSummary';

/**
 * Mobile Player PWA (/play, /play?pin=784920)
 * Screen flow follows AppFlow §2.2; state lives in usePlayerSession.
 */
export default function PlayerScreen() {
  const [searchParams] = useSearchParams();
  const urlPin = (searchParams.get('pin') || '').replace(/\D/g, '').slice(0, 6);

  const { state, connected, soundMuted, actions } = usePlayerSession(urlPin);
  const { screen, session, profile } = state;
  const joined = !['JOIN', 'RECONNECTING', 'DISQUALIFIED'].includes(screen);

  useWakeLock(joined && screen !== 'FINAL');

  const fullBleed = screen === 'QUESTION';

  return (
    <div className="min-h-[100dvh] bg-arena-dark text-white flex flex-col max-w-md mx-auto relative select-none overflow-x-hidden">
      {screen === 'RESULT' && (
        <div className={`absolute inset-0 pointer-events-none animate-fadeIn ${resultWashClass(state.result)}`} aria-hidden="true" />
      )}

      <PlayerHeader
        teamName={session?.teamName}
        score={profile.score}
        rank={profile.rank}
        totalTeams={profile.totalTeams}
        connected={connected}
        joined={joined}
        soundMuted={soundMuted}
        onToggleSound={actions.setSoundMuted}
      />

      {!connected && joined && (
        <div className="px-4 py-2 bg-red-500/15 border-b border-red-500/30 text-xs text-red-300 font-semibold flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5" /> Connection lost — reconnecting. Your score is safe.
        </div>
      )}

      {state.notice && (
        <div
          role="status"
          className={`mx-4 mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold animate-fadeIn border ${
            state.notice.tone === 'warn' ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' : 'bg-arena-elevated border-arena-border text-slate-200'
          }`}
        >
          {state.notice.text}
        </div>
      )}

      <main className={`flex-1 flex flex-col ${fullBleed ? 'justify-start' : 'justify-center'} p-4 pb-[max(1rem,env(safe-area-inset-bottom))] relative z-10`}>
        {screen === 'JOIN' && (
          <PlayerJoinForm
            initialPin={urlPin || session?.pin || ''}
            onJoin={actions.join}
            joining={state.joining}
            joinError={state.joinError}
            connected={connected}
          />
        )}

        {screen === 'RECONNECTING' && (
          <div className="flex flex-col items-center text-center gap-3 animate-fadeIn">
            <Loader2 className="w-12 h-12 text-arena-gold animate-spin" />
            <h2 className="text-xl font-black font-heading">Restoring your session…</h2>
            <p className="text-xs text-slate-400">{session?.teamName ? `Rejoining as ${session.teamName}` : 'Rejoining your team'}</p>
          </div>
        )}

        {screen === 'LOBBY' && (
          <PlayerWaiting
            teamName={session?.teamName}
            institution={session?.institution}
            quizTitle={state.room?.quizTitle}
            soundMuted={soundMuted}
            onToggleSound={actions.setSoundMuted}
            onLeave={actions.leave}
          />
        )}

        {screen === 'COUNTDOWN' && (
          <PlayerCountdown
            endsAt={state.countdownEndsAt}
            questionIndex={state.questionIndex}
            totalQuestions={state.totalQuestions}
          />
        )}

        {screen === 'QUESTION' && state.question && (
          <PlayerMcqCards
            question={state.question}
            deadline={state.deadline}
            isPaused={state.isPaused}
            pausedRemainingMs={state.pausedRemainingMs}
            answer={state.answer}
            score={profile.score}
            onSelect={actions.submitAnswer}
          />
        )}

        {screen === 'LOCKED' && (
          <PlayerLocked question={state.question} answer={state.answer} lockReason={state.lockReason} />
        )}

        {screen === 'RESULT' && state.result && (
          <PlayerResultBanner result={state.result} question={state.question} reveal={state.reveal} />
        )}

        {screen === 'LEADERBOARD' && <PlayerRankBanner standing={state.standing} profile={profile} />}

        {screen === 'BUZZER' && <PlayerBuzzer buzzer={state.buzzer} onBuzz={actions.buzz} />}

        {screen === 'FINAL' && <PlayerFinalSummary summary={state.finalSummary} />}

        {screen === 'DISQUALIFIED' && (
          <div className="flex flex-col items-center text-center gap-3 animate-scaleUp">
            <div className="w-24 h-24 rounded-full bg-red-500/15 border-2 border-red-500/50 flex items-center justify-center">
              <ShieldOff className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-black font-heading text-red-300">Team Disqualified</h2>
            <p className="text-sm text-slate-400 max-w-xs">
              The tournament host has removed this team from the competition. Please speak to the organizers.
            </p>
            <button
              type="button"
              onClick={actions.leave}
              className="mt-4 px-5 py-2.5 rounded-xl border border-arena-border text-xs font-bold text-slate-300"
            >
              Back to join screen
            </button>
          </div>
        )}
      </main>

      <footer className="px-5 py-3 bg-arena-card border-t border-arena-border text-center text-[10px] text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        BUFT National Quiz 2025 &bull; Contestant Device
        {session?.pin && joined ? <> &bull; PIN {session.pin}</> : null}
      </footer>
    </div>
  );
}
