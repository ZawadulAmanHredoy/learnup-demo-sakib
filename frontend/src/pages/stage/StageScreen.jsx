import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { useSocket } from '../../context/SocketContext';
import { apiRequest } from '../../utils/api';
import { sound } from '../../utils/audio';
import { 
  Trophy, Users, Clock, Maximize2, Minimize2, 
  ArrowUp, ArrowDown, Minus, Flame, Sparkles, Zap, CheckCircle2 
} from 'lucide-react';

export default function StageScreen() {
  const { pin } = useParams();
  const { socket, connected } = useSocket();

  const [room, setRoom] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState('LOBBY'); // LOBBY, COUNTDOWN, QUESTION_ACTIVE, QUESTION_LOCKED, ANSWER_REVEAL, LEADERBOARD, FINAL_PODIUM
  const [countdown, setCountdown] = useState(3);
  const [fullscreen, setFullscreen] = useState(false);

  // Active Question
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [timeLimit, setTimeLimit] = useState(20);
  const [answeredCount, setAnsweredCount] = useState(0);

  // Answer Reveal
  const [revealData, setRevealData] = useState(null);

  // Leaderboard
  const [topTen, setTopTen] = useState([]);
  const [podium, setPodium] = useState(null);

  // Buzzer Spotlight
  const [buzzerWinner, setBuzzerWinner] = useState(null);

  const timerRef = useRef(null);

  // Fetch initial room data
  const loadInitialData = async () => {
    try {
      const res = await apiRequest(`/rooms/${pin}/state`);
      if (res.success) {
        setRoom(res.data.room);
        setQuiz(res.data.quiz);
        setParticipants(res.data.participants || []);
        setStatus(res.data.room.status || 'LOBBY');
      }
    } catch (err) {
      console.error('Error fetching stage data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [pin]);

  // Connect socket and bind to stage events
  useEffect(() => {
    if (!socket) return;

    socket.emit('room:join_stage', { pin });

    socket.on('room:player_list', ({ participants }) => {
      setParticipants(participants || []);
    });

    // 3-Second countdown before question starts
    socket.on('sync:countdown', ({ durationMs, questionIndex }) => {
      setStatus('COUNTDOWN');
      setCountdown(3);
      setRevealData(null);
      setBuzzerWinner(null);

      let counter = 3;
      const countInterval = setInterval(() => {
        counter -= 1;
        if (counter > 0) {
          setCountdown(counter);
          sound.playTick();
        } else {
          clearInterval(countInterval);
        }
      }, 1000);
    });

    // Active Question broadcast (Options stripped of isCorrect)
    socket.on('sync:question_active', (qPacket) => {
      setStatus('QUESTION_ACTIVE');
      setCurrentQuestion(qPacket);
      setTimeLimit(qPacket.timeLimitSec);
      setTimeLeft(qPacket.timeLimitSec);
      setAnsweredCount(0);

      // Local countdown tick aligned with server deadline
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((qPacket.serverDeadline - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 5 && remaining > 0) {
          sound.playTick();
        }
        if (remaining <= 0) {
          clearInterval(timerRef.current);
        }
      }, 200);
    });

    // Live submissions counter from host
    socket.on('host:live_telemetry', ({ answeredCount }) => {
      setAnsweredCount(answeredCount);
    });

    // Question locked
    socket.on('sync:question_locked', () => {
      setStatus('QUESTION_LOCKED');
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(0);
      sound.playTimeUp();
    });

    // Answer Reveal with Distribution Charts
    socket.on('sync:answer_reveal', (revealPacket) => {
      setStatus('ANSWER_REVEAL');
      setRevealData(revealPacket);
      sound.playCorrect();
    });

    // Leaderboard Display
    socket.on('sync:leaderboard', ({ topTen: leaders, isLastQuestion }) => {
      setTopTen(leaders || []);
      if (!isLastQuestion) {
        setStatus('LEADERBOARD');
      }
    });

    // Grand Finale Podium
    socket.on('sync:final_podium', (podiumPacket) => {
      setStatus('FINAL_PODIUM');
      setPodium(podiumPacket);
      sound.playFanfare();

      // Launch full canvas confetti explosion
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 60 * (timeLeft / duration);
        confetti({
          particleCount,
          startVelocity: 35,
          spread: 360,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: ['#FACC15', '#3B82F6', '#EF4444', '#10B981', '#FFFFFF'],
        });
      }, 250);
    });

    // Buzzer Spotlight
    socket.on('sync:buzzer_locked', (winner) => {
      setBuzzerWinner(winner);
      sound.playBuzzerHit();
    });

    return () => {
      socket.off('room:player_list');
      socket.off('sync:countdown');
      socket.off('sync:question_active');
      socket.off('host:live_telemetry');
      socket.off('sync:question_locked');
      socket.off('sync:answer_reveal');
      socket.off('sync:leaderboard');
      socket.off('sync:final_podium');
      socket.off('sync:buzzer_locked');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, pin]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  const playUrl = `${window.location.origin}/play?pin=${pin}`;

  // Quadrant visual details
  const quadrantColors = [
    { bg: 'bg-[#EF4444]', border: 'border-red-500', name: 'A', symbol: '▲' },
    { bg: 'bg-[#3B82F6]', border: 'border-blue-500', name: 'B', symbol: '◆' },
    { bg: 'bg-[#F59E0B]', border: 'border-amber-500', name: 'C', symbol: '●' },
    { bg: 'bg-[#10B981]', border: 'border-emerald-500', name: 'D', symbol: '■' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col justify-between overflow-hidden relative select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Stage Header */}
      <header className="relative z-20 px-8 py-5 flex items-center justify-between border-b border-slate-800/80 bg-[#131D31]/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-yellow-500/20">
            LA
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider uppercase font-heading text-glow-gold">
              BUFT National Quiz Arena 2025
            </h1>
            <p className="text-xs tracking-widest text-slate-400 uppercase font-semibold">
              Official Live Stage Broadcast &bull; 1080p / 4K Mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* PIN */}
          <div className="bg-[#131D31] border border-slate-700/80 px-5 py-2 rounded-2xl flex items-center gap-3 shadow-lg">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Game PIN:
            </span>
            <span className="text-3xl font-black tracking-widest text-yellow-400 font-mono">
              {pin}
            </span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Toggle Fullscreen (F11)"
          >
            {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Dynamic Stage View */}
      <main className="flex-1 flex flex-col justify-center items-center px-10 py-6 relative z-10 w-full max-w-7xl mx-auto">
        {/* ================================================================= */}
        {/* 1. LOBBY VIEW (STG-01) */}
        {/* ================================================================= */}
        {status === 'LOBBY' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center animate-fadeIn">
            {/* Left: Giant QR Code & Instructions */}
            <div className="lg:col-span-5 flex flex-col items-center text-center">
              <div className="p-6 rounded-3xl bg-white shadow-2xl shadow-yellow-500/10 border-4 border-yellow-400/80 mb-6">
                <QRCodeSVG
                  value={playUrl}
                  size={260}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <span className="text-xs uppercase font-extrabold tracking-widest text-yellow-400 mb-1">
                Scan with Mobile Camera to Join
              </span>
              <p className="text-base text-slate-300 font-medium">
                Or navigate to <b className="text-white font-mono">{window.location.host}/play</b>
              </p>
            </div>

            {/* Right: Floating Joined Teams Grid */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <Users className="w-6 h-6 text-yellow-400" />
                  <span>Contestant Arena Lobby</span>
                </h2>
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-sm font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>{participants.length} Teams Registered</span>
                </div>
              </div>

              {participants.length === 0 ? (
                <div className="p-12 rounded-3xl border border-dashed border-slate-800 text-center text-slate-500 text-base">
                  Waiting for teams to scan the QR code and join the lobby...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-2">
                  {participants.map((p, i) => (
                    <div
                      key={p.id || p._id || i}
                      className="p-3.5 rounded-2xl glass-panel border border-slate-700/60 shadow-md flex items-center gap-3 animate-scaleUp"
                    >
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow">
                        {i + 1}
                      </div>
                      <div className="truncate">
                        <h4 className="text-sm font-bold text-white truncate">{p.teamName}</h4>
                        <span className="text-[11px] text-slate-400 truncate block">{p.institution || 'BUFT'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. COUNTDOWN VIEW */}
        {/* ================================================================= */}
        {status === 'COUNTDOWN' && (
          <div className="flex flex-col items-center justify-center text-center animate-scaleUp">
            <span className="text-lg uppercase tracking-widest font-extrabold text-yellow-400 mb-4">
              Get Ready For Next Question
            </span>
            <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center text-8xl font-black text-slate-950 shadow-2xl shadow-yellow-500/30 font-heading animate-pulse-fast">
              {countdown}
            </div>
            <p className="text-slate-400 text-base mt-6">All mobile screens are ready</p>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. ACTIVE QUESTION VIEW (STG-02) */}
        {/* ================================================================= */}
        {(status === 'QUESTION_ACTIVE' || status === 'QUESTION_LOCKED') && currentQuestion && (
          <div className="w-full flex flex-col gap-8 animate-fadeIn">
            {/* Top Question Bar & Circular SVG Countdown Timer */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3.5 py-1 rounded-xl bg-yellow-500/20 text-yellow-400 font-black text-sm uppercase tracking-wider border border-yellow-500/30">
                    Question {currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">
                    {currentQuestion.segment}
                  </span>
                </div>
                {/* 48px Readable Typography */}
                <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-white leading-tight font-heading">
                  {currentQuestion.questionText}
                </h2>
              </div>

              {/* Circular SVG Timer Ring */}
              <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke="#1E2B45"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke={timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#F59E0B' : '#10B981'}
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={2 * Math.PI * 52 * (1 - timeLeft / (timeLimit || 20))}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-black font-mono ${
                    timeLeft <= 5 ? 'text-red-400 animate-pulse-fast' : 'text-white'
                  }`}>
                    {timeLeft}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Seconds
                  </span>
                </div>
              </div>
            </div>

            {/* 4-Color High Contrast Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
              {currentQuestion.options?.map((opt, idx) => {
                const color = quadrantColors[idx % 4];
                return (
                  <div
                    key={opt.id}
                    className={`p-6 rounded-3xl ${color.bg} shadow-2xl flex items-center gap-5 transition transform hover:scale-[1.01]`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-black/25 flex items-center justify-center text-2xl font-black text-white flex-shrink-0 shadow-inner">
                      {color.symbol} {color.name}
                    </div>
                    <span className="text-xl sm:text-2xl font-bold text-white leading-snug">
                      {opt.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Live Submissions Status Footer */}
            <div className="flex items-center justify-between text-sm font-semibold text-slate-400 pt-2">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-yellow-400" />
                <span>Teams Responded: <b className="text-white text-base">{answeredCount}</b> / {participants.length}</span>
              </span>
              <span>LearnUp Live Arena &bull; BUFT Tournament</span>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. ANSWER REVEAL & DISTRIBUTION CHARTS (STG-03, STG-04) */}
        {/* ================================================================= */}
        {status === 'ANSWER_REVEAL' && revealData && currentQuestion && (
          <div className="w-full flex flex-col gap-8 animate-fadeIn">
            {/* Header / Fastest Callout */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 block mb-1">
                  Official Answer Reveal
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-heading">
                  Correct Answer: <span className="text-yellow-400">{revealData.correctOptionText}</span>
                </h2>
              </div>

              {revealData.fastestTeam && (
                <div className="px-5 py-2.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
                  <Flame className="w-6 h-6 text-yellow-400 animate-bounce" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Fastest Correct Team</span>
                    <span className="text-sm font-bold text-yellow-300">
                      {revealData.fastestTeam.name} ({revealData.fastestTeam.latencySec}s)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Animated Horizontal Response Distribution Bar Chart */}
            <div className="glass-panel rounded-3xl p-8 border border-slate-700 space-y-5">
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-4">
                Audience Response Distribution ({revealData.totalAnswers} total submissions)
              </h3>

              {currentQuestion.options?.map((opt, idx) => {
                const isCorrect = opt.id === revealData.correctOptionId;
                const count = revealData.distribution?.[opt.id] || 0;
                const total = revealData.totalAnswers || 1;
                const percentage = Math.round((count / total) * 100);
                const color = quadrantColors[idx % 4];

                return (
                  <div key={opt.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-slate-800 font-bold text-xs flex items-center justify-center">
                          {color.name}
                        </span>
                        <span className={`font-semibold ${isCorrect ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                          {opt.text}
                        </span>
                        {isCorrect && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Correct Answer</span>
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-300">
                        {count} teams ({percentage}%)
                      </span>
                    </div>

                    <div className="w-full bg-[#0A0F1D] h-5 rounded-full overflow-hidden border border-slate-800 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isCorrect ? 'bg-gradient-to-r from-emerald-500 to-teal-300 shadow-lg shadow-emerald-500/30' : color.bg
                        }`}
                        style={{ width: `${Math.max(2, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {revealData.explanation && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-200">
                💡 <b>Academic Note:</b> {revealData.explanation}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. STAGE LEADERBOARD (STG-05) */}
        {/* ================================================================= */}
        {status === 'LEADERBOARD' && (
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-fadeIn">
            <div className="text-center pb-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-yellow-400 block mb-1">
                Live Tournament Rankings
              </span>
              <h2 className="text-3xl font-black text-white font-heading">
                Top Contenders &bull; Live Standings
              </h2>
            </div>

            <div className="space-y-3">
              {topTen.map((team, idx) => {
                const isPodium = idx < 3;
                return (
                  <div
                    key={team.id || idx}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition transform hover:scale-[1.01] ${
                      idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-transparent border-yellow-500/60 shadow-lg shadow-yellow-500/10' :
                      idx === 1 ? 'bg-slate-800/80 border-slate-500/50' :
                      idx === 2 ? 'bg-orange-950/20 border-orange-500/40' :
                      'glass-panel border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank Position */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                        idx === 0 ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/30' :
                        idx === 1 ? 'bg-slate-300 text-slate-950' :
                        idx === 2 ? 'bg-orange-500 text-slate-950' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        #{team.rank}
                      </div>

                      <div>
                        <h4 className="text-lg font-bold text-white flex items-center gap-2">
                          <span>{team.teamName}</span>
                          {idx === 0 && <Trophy className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          {team.streak >= 2 && (
                            <span className="text-xs text-orange-400 flex items-center gap-0.5">
                              <Flame className="w-3.5 h-3.5 fill-orange-400" />
                              <span>{team.streak}</span>
                            </span>
                          )}
                        </h4>
                        <span className="text-xs text-slate-400">{team.institution}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Delta Movement Arrow */}
                      <div className="flex items-center gap-1 text-xs font-bold">
                        {team.delta > 0 ? (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <ArrowUp className="w-4 h-4" />
                            <span>+{team.delta}</span>
                          </span>
                        ) : team.delta < 0 ? (
                          <span className="text-red-400 flex items-center gap-0.5">
                            <ArrowDown className="w-4 h-4" />
                            <span>{team.delta}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center">
                            <Minus className="w-4 h-4" />
                          </span>
                        )}
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <span className="text-2xl font-black text-yellow-400 font-mono">
                          {team.score.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Points</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 6. GRAND FINALE PODIUM CELEBRATION (STG-06) */}
        {/* ================================================================= */}
        {status === 'FINAL_PODIUM' && podium && (
          <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-10 animate-scaleUp">
            <div className="text-center">
              <span className="text-sm uppercase font-black tracking-widest text-yellow-400 block mb-2 animate-bounce">
                👑 Tournament Champions 👑
              </span>
              <h2 className="text-4xl sm:text-5xl font-black text-white font-heading text-glow-gold">
                Grand Finale Victory Podium
              </h2>
            </div>

            {/* 3 Columns: 2nd, 1st, 3rd */}
            <div className="grid grid-cols-3 gap-6 items-end w-full max-w-3xl pt-8">
              {/* 2nd Place (Silver) */}
              <div className="flex flex-col items-center">
                <div className="mb-3 text-center">
                  <span className="text-2xl">🥈</span>
                  <h4 className="text-lg font-bold text-slate-200">{podium.second?.teamName || 'Runner Up'}</h4>
                  <span className="text-xs text-slate-400">{podium.second?.institution}</span>
                  <span className="text-sm font-black text-yellow-400 block mt-1 font-mono">
                    {podium.second?.score?.toLocaleString()} pts
                  </span>
                </div>
                <div className="w-full h-44 rounded-t-3xl bg-gradient-to-t from-slate-700 to-slate-500 flex items-center justify-center text-4xl font-black text-slate-950 shadow-xl border-t-2 border-slate-300">
                  #2
                </div>
              </div>

              {/* 1st Place (Gold Champion) */}
              <div className="flex flex-col items-center">
                <div className="mb-3 text-center">
                  <Trophy className="w-10 h-10 text-yellow-400 fill-yellow-400 mx-auto animate-bounce mb-1" />
                  <h3 className="text-2xl font-black text-yellow-400 font-heading">
                    {podium.first?.teamName || 'Champion'}
                  </h3>
                  <span className="text-xs text-slate-300 font-semibold">{podium.first?.institution}</span>
                  <span className="text-lg font-black text-yellow-300 block mt-1 font-mono">
                    {podium.first?.score?.toLocaleString()} pts
                  </span>
                </div>
                <div className="w-full h-64 rounded-t-3xl bg-gradient-to-t from-yellow-600 via-yellow-500 to-amber-300 flex items-center justify-center text-6xl font-black text-slate-950 shadow-2xl shadow-yellow-500/30 border-t-4 border-yellow-200">
                  #1
                </div>
              </div>

              {/* 3rd Place (Bronze) */}
              <div className="flex flex-col items-center">
                <div className="mb-3 text-center">
                  <span className="text-2xl">🥉</span>
                  <h4 className="text-lg font-bold text-orange-200">{podium.third?.teamName || '2nd Runner Up'}</h4>
                  <span className="text-xs text-slate-400">{podium.third?.institution}</span>
                  <span className="text-sm font-black text-yellow-400 block mt-1 font-mono">
                    {podium.third?.score?.toLocaleString()} pts
                  </span>
                </div>
                <div className="w-full h-36 rounded-t-3xl bg-gradient-to-t from-orange-800 to-orange-600 flex items-center justify-center text-3xl font-black text-slate-950 shadow-xl border-t-2 border-orange-400">
                  #3
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 7. BUZZER SPOTLIGHT OVERLAY (BZZ-04) */}
        {/* ================================================================= */}
        {buzzerWinner && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-scaleUp">
            <div className="w-32 h-32 rounded-full bg-yellow-500 flex items-center justify-center shadow-2xl shadow-yellow-500/50 mb-6 animate-pulse-fast">
              <Zap className="w-16 h-16 text-slate-950 fill-slate-950" />
            </div>

            <span className="text-sm uppercase font-extrabold tracking-widest text-yellow-400 mb-2">
              ⚡ Buzz Lockout Activated ⚡
            </span>
            <h2 className="text-5xl sm:text-6xl font-black text-white font-heading text-center mb-4">
              {buzzerWinner.winnerTeamName}
            </h2>
            <div className="px-6 py-2 rounded-full bg-slate-800 border border-slate-700 text-lg font-mono text-slate-300">
              Reaction Latency: <b className="text-yellow-400">{(buzzerWinner.reactionTimeMs / 1000).toFixed(2)}s</b>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 bg-[#131D31]/40 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>LearnUp Live Arena &bull; High-Concurrency Real-Time Synchronizer</span>
        <span>Auditorium Stage Display Mode &bull; Socket.IO Connected</span>
      </footer>
    </div>
  );
}
