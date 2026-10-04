import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { sound } from '../../utils/audio';
import { 
  Users, CheckCircle2, XCircle, Flame, Trophy, 
  Clock, Lock, Zap, ArrowRight, Shield 
} from 'lucide-react';

export default function PlayerScreen() {
  const [searchParams] = useSearchParams();
  const urlPin = searchParams.get('pin') || '';

  const { socket, connected } = useSocket();

  // Registration & Session
  const [pin, setPin] = useState(urlPin);
  const [teamName, setTeamName] = useState('');
  const [institution, setInstitution] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [sessionToken, setSessionToken] = useState('');

  // Game States: 'JOIN', 'LOBBY', 'COUNTDOWN', 'ACTIVE', 'LOCKED', 'REVEAL', 'BUZZER'
  const [playerState, setPlayerState] = useState('JOIN');
  const [countdown, setCountdown] = useState(3);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [timeLimit, setTimeLimit] = useState(20);

  // Result & Stats
  const [resultData, setResultData] = useState(null);
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const [currentRank, setCurrentRank] = useState(0);
  const [totalTeams, setTotalTeams] = useState(0);

  // Buzzer
  const [buzzerWinner, setBuzzerWinner] = useState(null);

  const timerRef = useRef(null);

  // Check existing session in localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('learnup_player_token');
    const savedPin = localStorage.getItem('learnup_player_pin');
    const savedTeam = localStorage.getItem('learnup_player_team');

    if (savedToken && savedPin) {
      setSessionToken(savedToken);
      setPin(savedPin);
      if (savedTeam) setTeamName(savedTeam);
      setIsJoined(true);
      setPlayerState('LOBBY');
    }
  }, []);

  // Socket event binding
  useEffect(() => {
    if (!socket) return;

    if (sessionToken && pin) {
      socket.emit('room:reconnect', { pin, sessionToken });
    }

    socket.on('room:joined_ack', (res) => {
      if (res.success) {
        setIsJoined(true);
        setPlayerState('LOBBY');
        localStorage.setItem('learnup_player_token', res.sessionToken);
        localStorage.setItem('learnup_player_pin', pin);
        localStorage.setItem('learnup_player_team', teamName);
      } else {
        alert(res.error || 'Failed to join room.');
      }
    });

    socket.on('room:reconnected_ack', (res) => {
      if (res.success) {
        setIsJoined(true);
        if (res.participant) {
          setTeamName(res.participant.teamName);
          setCumulativeScore(res.participant.totalScore || 0);
          setCurrentRank(res.participant.currentRank || 1);
        }
      }
    });

    // 3s Countdown
    socket.on('sync:countdown', () => {
      setPlayerState('COUNTDOWN');
      setSelectedOption(null);
      setResultData(null);
      setBuzzerWinner(null);
      setCountdown(3);
      sound.playTick();

      let count = 3;
      const interval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
          sound.playTick();
        } else {
          clearInterval(interval);
        }
      }, 1000);
    });

    // Question Active
    socket.on('sync:question_active', (qPacket) => {
      setCurrentQuestion(qPacket);
      setTimeLimit(qPacket.timeLimitSec);
      setTimeLeft(qPacket.timeLimitSec);
      setSelectedOption(null);
      setPlayerState('ACTIVE');

      // Vibrate mobile device if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((qPacket.serverDeadline - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
        }
      }, 200);
    });

    socket.on('player:answer_ack', () => {
      setPlayerState('LOCKED');
    });

    socket.on('sync:question_locked', () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(0);
      if (playerState === 'ACTIVE') {
        setPlayerState('LOCKED');
      }
    });

    // Individual Player Result
    socket.on('sync:player_result', (res) => {
      setPlayerState('REVEAL');
      setResultData(res);
      setCumulativeScore(res.currentScore);
      setCurrentRank(res.rank);
      setTotalTeams(res.totalTeams);

      if (res.isCorrect) {
        sound.playCorrect();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        sound.playWrong();
        if (navigator.vibrate) navigator.vibrate(200);
      }
    });

    // Buzzer events
    socket.on('sync:buzzer_ready', () => {
      setPlayerState('BUZZER');
      setBuzzerWinner(null);
      if (navigator.vibrate) navigator.vibrate(80);
    });

    socket.on('sync:buzzer_locked', (winner) => {
      setBuzzerWinner(winner);
      sound.playBuzzerHit();
    });

    return () => {
      socket.off('room:joined_ack');
      socket.off('room:reconnected_ack');
      socket.off('sync:countdown');
      socket.off('sync:question_active');
      socket.off('player:answer_ack');
      socket.off('sync:question_locked');
      socket.off('sync:player_result');
      socket.off('sync:buzzer_ready');
      socket.off('sync:buzzer_locked');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, sessionToken, pin, teamName, playerState]);

  // Join Room
  const handleJoin = (e) => {
    e.preventDefault();
    if (!pin || !teamName) return;
    const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionToken(token);

    if (socket) {
      socket.emit('room:join', {
        pin,
        teamName,
        institution,
        captainName: captainName || teamName,
        sessionToken: token,
      });
    }
  };

  // Submit Answer
  const handleSelectOption = (optId) => {
    if (selectedOption || playerState !== 'ACTIVE' || !socket) return;
    setSelectedOption(optId);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(40);

    socket.emit('player:submit_answer', {
      pin,
      sessionToken,
      questionId: currentQuestion.questionId,
      selectedOptionId: optId,
      clientSentAt: Date.now(),
    });
  };

  // Hit Buzzer
  const handleBuzz = () => {
    if (!socket || buzzerWinner) return;
    if (navigator.vibrate) navigator.vibrate([150]);

    socket.emit('player:buzz', {
      pin,
      sessionToken,
      clientTimestamp: Date.now(),
    });
  };

  const quadrantStyles = [
    { bg: 'bg-[#EF4444] active:bg-red-600', border: 'border-red-400', name: 'A', symbol: '▲' },
    { bg: 'bg-[#3B82F6] active:bg-blue-600', border: 'border-blue-400', name: 'B', symbol: '◆' },
    { bg: 'bg-[#F59E0B] active:bg-amber-600', border: 'border-amber-400', name: 'C', symbol: '●' },
    { bg: 'bg-[#10B981] active:bg-emerald-600', border: 'border-emerald-400', name: 'D', symbol: '■' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col justify-between max-w-md mx-auto relative select-none">
      {/* Top Mobile Bar */}
      <header className="px-5 py-3.5 bg-[#131D31] border-b border-slate-800 flex items-center justify-between shadow-md sticky top-0 z-30">
        <div>
          <h1 className="text-sm font-black text-white font-heading tracking-wide">
            LearnUp <span className="text-yellow-400">Arena</span>
          </h1>
          <span className="text-[11px] text-slate-400 font-semibold truncate block max-w-[160px]">
            {teamName || 'Contestant App'}
          </span>
        </div>

        {isJoined && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-bold text-yellow-400 font-mono block">
                {cumulativeScore.toLocaleString()} pts
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                Rank #{currentRank || '-'}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Body */}
      <main className="flex-1 flex flex-col justify-center p-5 relative z-10">
        {/* =============================================================== */}
        {/* 1. JOIN FORM */}
        {/* =============================================================== */}
        {playerState === 'JOIN' && (
          <div className="glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-300 mx-auto flex items-center justify-center font-black text-slate-950 text-lg mb-3 shadow-lg shadow-yellow-500/20">
                LA
              </div>
              <h2 className="text-xl font-bold text-white font-heading">
                Enter Competition Arena
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your 6-digit PIN and team details
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  6-Digit Room PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 784920"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0F1D] border border-slate-700 rounded-xl text-yellow-400 font-mono font-bold text-lg text-center tracking-widest focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Official Team Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUFT Falcon"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0A0F1D] border border-slate-700 rounded-xl text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Institution / College
                </label>
                <input
                  type="text"
                  placeholder="e.g. BUFT CSE"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0A0F1D] border border-slate-700 rounded-xl text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Captain Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sheikh Sakib"
                  value={captainName}
                  onChange={(e) => setCaptainName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0A0F1D] border border-slate-700 rounded-xl text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-bold text-sm shadow-lg shadow-yellow-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Join Live Lobby</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* =============================================================== */}
        {/* 2. LOBBY WAITING SCREEN */}
        {/* =============================================================== */}
        {playerState === 'LOBBY' && (
          <div className="flex flex-col items-center justify-center text-center p-6 animate-scaleUp">
            <div className="w-24 h-24 rounded-full bg-yellow-500/10 border-2 border-yellow-500/40 flex items-center justify-center mb-6 animate-pulse">
              <Shield className="w-12 h-12 text-yellow-400" />
            </div>

            <h2 className="text-2xl font-black text-white font-heading mb-1">
              You&apos;re in the Arena!
            </h2>
            <h3 className="text-lg font-bold text-yellow-400 mb-4">
              {teamName}
            </h3>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-300 max-w-xs space-y-1">
              <p>Keep your phone screen on.</p>
              <p>The host will start the questions on stage shortly!</p>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 3. COUNTDOWN SCREEN */}
        {/* =============================================================== */}
        {playerState === 'COUNTDOWN' && (
          <div className="flex flex-col items-center justify-center text-center animate-scaleUp">
            <span className="text-xs uppercase font-extrabold tracking-widest text-yellow-400 mb-3">
              Get Ready
            </span>
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center text-6xl font-black text-slate-950 shadow-xl shadow-yellow-500/30 animate-pulse-fast">
              {countdown}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 4. ACTIVE MCQ SCREEN (4-COLOR TOUCH QUADRANT) */}
        {/* =============================================================== */}
        {playerState === 'ACTIVE' && currentQuestion && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Header / Timer */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-yellow-400">
                Q {currentQuestion.questionIndex + 1}
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-white font-mono font-bold">
                <Clock className="w-3 h-3 text-yellow-400" />
                <span>{timeLeft}s</span>
              </div>
            </div>

            {/* Question Text */}
            <div className="p-4 rounded-2xl glass-panel border border-slate-700 text-sm font-bold text-white">
              {currentQuestion.questionText}
            </div>

            {/* 4 Tactile Touch Cards */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              {currentQuestion.options?.map((opt, idx) => {
                const style = quadrantStyles[idx % 4];
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`h-36 rounded-2xl ${style.bg} p-4 flex flex-col justify-between text-left shadow-lg active:scale-95 transition cursor-pointer`}
                  >
                    <span className="text-2xl font-black text-white/80">
                      {style.symbol}
                    </span>
                    <span className="text-sm font-bold text-white line-clamp-3 leading-snug">
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 5. LOCKED IN STATE */}
        {/* =============================================================== */}
        {playerState === 'LOCKED' && (
          <div className="flex flex-col items-center justify-center text-center p-6 animate-scaleUp">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center mb-5 animate-bounce-subtle">
              <Lock className="w-10 h-10 text-emerald-400" />
            </div>

            <h2 className="text-2xl font-black text-white font-heading mb-1">
              Answer Locked In!
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mt-2">
              Your submission timestamp has been recorded by the server. Waiting for the stage reveal...
            </p>
          </div>
        )}

        {/* =============================================================== */}
        {/* 6. ANSWER REVEAL & RESULT */}
        {/* =============================================================== */}
        {playerState === 'REVEAL' && resultData && (
          <div className="flex flex-col items-center justify-center text-center p-6 animate-scaleUp">
            {resultData.isCorrect ? (
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center mb-4">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
            )}

            <h2 className={`text-2xl font-black font-heading mb-1 ${
              resultData.isCorrect ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {resultData.isCorrect ? 'CORRECT!' : 'INCORRECT'}
            </h2>

            <div className="text-3xl font-black text-white font-mono my-2">
              {resultData.pointsEarned > 0 ? `+${resultData.pointsEarned}` : resultData.pointsEarned} Pts
            </div>

            {/* Breakdown */}
            {resultData.isCorrect && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                <span>Base: {resultData.basePoints}</span>
                <span>•</span>
                <span className="text-yellow-400 font-bold">Speed: +{resultData.speedBonus}</span>
              </div>
            )}

            {resultData.streak >= 2 && (
              <div className="px-3.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5 mb-4">
                <Flame className="w-4 h-4 fill-orange-400" />
                <span>Streak: {resultData.streak} in a row!</span>
              </div>
            )}

            {/* Current Standing Badge */}
            <div className="w-full p-4 rounded-2xl glass-panel border border-slate-700/80 mt-2">
              <span className="text-xs text-slate-400 uppercase font-bold block mb-1">
                Current Position
              </span>
              <div className="text-xl font-black text-yellow-400 font-heading">
                #{resultData.rank} of {resultData.totalTeams} Teams
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 7. BUZZER MODE */}
        {/* =============================================================== */}
        {playerState === 'BUZZER' && (
          <div className="flex flex-col items-center justify-center text-center p-4 animate-scaleUp">
            {!buzzerWinner ? (
              <div className="flex flex-col items-center gap-6">
                <span className="text-xs uppercase font-extrabold tracking-widest text-yellow-400">
                  ⚡ BUZZER ROUND LIVE ⚡
                </span>
                <button
                  onClick={handleBuzz}
                  className="w-56 h-56 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-red-600 border-4 border-red-300 shadow-2xl shadow-red-600/50 flex flex-col items-center justify-center active:scale-90 transition cursor-pointer select-none"
                >
                  <Zap className="w-14 h-14 text-white fill-white mb-2" />
                  <span className="text-3xl font-black text-white font-heading tracking-wider">
                    BUZZ!
                  </span>
                </button>
                <p className="text-xs text-slate-400 max-w-xs">
                  Tap as fast as you can when you know the answer! Wrong answer: -50 pts.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-2xl glass-panel border border-yellow-500/40 text-center">
                <span className="text-xs uppercase text-slate-400 block mb-2">Buzzer Acquired By:</span>
                <h3 className="text-2xl font-black text-yellow-400 font-heading mb-1">
                  {buzzerWinner.winnerTeamName}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Reaction: {(buzzerWinner.reactionTimeMs / 1000).toFixed(2)}s
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-5 py-3 bg-[#131D31] border-t border-slate-800 text-center text-[10px] text-slate-500">
        BUFT National Quiz 2025 &bull; Contestant Device
      </footer>
    </div>
  );
}
