import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { apiRequest } from '../../utils/api';
import { sound } from '../../utils/audio';
import { 
  Play, Lock, Eye, BarChart3, ChevronRight, Users, Tv, 
  Download, AlertTriangle, CheckCircle, Clock, Zap, Volume2, VolumeX, Copy, Check
} from 'lucide-react';

export default function HostCockpit() {
  const { pin } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const [room, setRoom] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('LOBBY');
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Live Telemetry
  const [answeredCount, setAnsweredCount] = useState(0);
  const [distribution, setDistribution] = useState({});
  const [buzzerWinner, setBuzzerWinner] = useState(null);
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  // Emergency Modal
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [selectedTeamToKick, setSelectedTeamToKick] = useState('');
  const [selectedTeamToAdjust, setSelectedTeamToAdjust] = useState('');
  const [deltaPoints, setDeltaPoints] = useState(50);

  // Load initial room state from backend
  const loadRoomState = async () => {
    try {
      const res = await apiRequest(`/rooms/${pin}/state`);
      if (res.success) {
        setRoom(res.data.room);
        setQuiz(res.data.quiz);
        setParticipants(res.data.participants || []);
        setStatus(res.data.room.status || 'LOBBY');
        setCurrentQIndex(res.data.room.currentQuestionIndex || 0);
      }
    } catch (err) {
      console.error('Error fetching room state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomState();
  }, [pin]);

  // Connect socket and listen for live events
  useEffect(() => {
    if (!socket) return;

    socket.emit('room:join_host', { pin });

    socket.on('room:player_list', ({ totalCount, participants }) => {
      setParticipants(participants || []);
    });

    socket.on('sync:countdown', ({ questionIndex }) => {
      setStatus('COUNTDOWN');
      setCurrentQIndex(questionIndex);
      setAnsweredCount(0);
      setDistribution({});
      setBuzzerWinner(null);
      sound.playTick();
    });

    socket.on('sync:question_active', () => {
      setStatus('QUESTION_ACTIVE');
    });

    socket.on('host:live_telemetry', ({ answeredCount, distribution }) => {
      setAnsweredCount(answeredCount);
      setDistribution(distribution || {});
    });

    socket.on('sync:question_locked', ({ totalAnswersReceived }) => {
      setStatus('QUESTION_LOCKED');
      setAnsweredCount(totalAnswersReceived);
      sound.playTimeUp();
    });

    socket.on('sync:answer_reveal', ({ distribution }) => {
      setStatus('ANSWER_REVEAL');
      setDistribution(distribution || {});
      sound.playCorrect();
    });

    socket.on('sync:leaderboard', ({ isLastQuestion }) => {
      setStatus(isLastQuestion ? 'FINISHED' : 'LEADERBOARD');
    });

    socket.on('sync:buzzer_ready', () => {
      setBuzzerActive(true);
      setBuzzerWinner(null);
    });

    socket.on('sync:buzzer_locked', (winner) => {
      setBuzzerWinner(winner);
      setBuzzerActive(false);
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
      socket.off('sync:buzzer_ready');
      socket.off('sync:buzzer_locked');
    };
  }, [socket, pin]);

  const currentQuestion = quiz?.questions?.[currentQIndex] || null;
  const totalQuestions = quiz?.questions?.length || 0;
  const isBuzzerQuestion = currentQuestion?.type === 'BUZZER';

  // Control Actions
  const handleStartQuestion = () => {
    if (!socket) return;
    socket.emit('host:start_question', { pin, questionIndex: currentQIndex });
  };

  const handleLockQuestion = () => {
    if (!socket) return;
    socket.emit('host:lock_question', { pin });
  };

  const handleRevealAnswer = () => {
    if (!socket) return;
    socket.emit('host:reveal_answer', { pin });
  };

  const handleShowLeaderboard = () => {
    if (!socket) return;
    socket.emit('host:show_leaderboard', { pin });
  };

  const handleNextQuestion = () => {
    if (currentQIndex + 1 < totalQuestions) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      setStatus('LOBBY');
      setAnsweredCount(0);
      setDistribution({});
      setBuzzerWinner(null);
    }
  };

  // Buzzer Actions
  const handleActivateBuzzer = () => {
    if (!socket) return;
    socket.emit('host:activate_buzzer', { pin, questionId: currentQuestion?._id });
  };

  const handleJudgeBuzzer = (verdict) => {
    if (!socket || !buzzerWinner) return;
    socket.emit('host:judge_buzzer', {
      pin,
      winnerTeamId: buzzerWinner.winnerTeamId,
      verdict,
    });
    if (verdict === 'CORRECT') {
      sound.playCorrect();
    } else if (verdict === 'WRONG') {
      sound.playWrong();
    }
  };

  // Emergency Actions
  const handleKickTeam = () => {
    if (!socket || !selectedTeamToKick) return;
    socket.emit('host:emergency_action', {
      pin,
      action: 'KICK_TEAM',
      targetParticipantId: selectedTeamToKick,
    });
    setSelectedTeamToKick('');
    setShowEmergencyModal(false);
  };

  const handleAdjustScore = () => {
    if (!socket || !selectedTeamToAdjust) return;
    socket.emit('host:emergency_action', {
      pin,
      action: 'ADJUST_SCORE',
      targetParticipantId: selectedTeamToAdjust,
      deltaPoints: Number(deltaPoints),
    });
    setSelectedTeamToAdjust('');
    setShowEmergencyModal(false);
  };

  // Simulate 5 test teams for quick developer testing
  const handleSimulateTeams = () => {
    if (!socket) return;
    const testTeams = [
      { name: 'Team Falcon', college: 'BUFT CSE' },
      { name: 'Cyber Knights', college: 'BUFT Textile' },
      { name: 'Neural Ninjas', college: 'BUFT Fashion' },
      { name: 'Syntax Squad', college: 'DU Tech' },
      { name: 'Quantum Leapers', college: 'IUT CSE' },
    ];

    testTeams.forEach((t, i) => {
      setTimeout(() => {
        socket.emit('room:join', {
          pin,
          teamName: t.name,
          institution: t.college,
          captainName: `${t.name} Captain`,
          sessionToken: `sim_token_${i}_${Date.now()}`,
        });
      }, i * 300);
    });
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAudio = () => {
    const nextState = !audioMuted;
    setAudioMuted(nextState);
    sound.setMuted(nextState);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center text-white">
        Loading Host Cockpit...
      </div>
    );
  }

  const responsePercentage = participants.length > 0
    ? Math.round((answeredCount / participants.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col select-none">
      {/* 1. Header Telemetry Bar */}
      <header className="bg-[#131D31] border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-base font-extrabold text-white font-heading tracking-wide uppercase">
              Host Cockpit
            </h1>
          </div>

          {/* PIN Badge */}
          <div className="flex items-center gap-2 bg-[#0A0F1D] border border-slate-700 px-3.5 py-1.5 rounded-xl">
            <span className="text-xs text-slate-400 font-semibold uppercase">PIN:</span>
            <span className="text-lg font-black tracking-widest text-yellow-400 font-mono">
              {pin}
            </span>
            <button
              onClick={copyPin}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Copy PIN"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Status Badge */}
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${
            status === 'QUESTION_ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' :
            status === 'COUNTDOWN' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
            status === 'QUESTION_LOCKED' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
            status === 'ANSWER_REVEAL' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
            status === 'LEADERBOARD' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
            'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            {status}
          </span>
        </div>

        {/* Telemetry counters & Quick Links */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0A0F1D] border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <Users className="w-4 h-4 text-yellow-400" />
            <span className="text-slate-400">Teams:</span>
            <span className="font-bold text-white text-sm">{participants.length}</span>
          </div>

          {/* Direct link to Stage Screen */}
          <button
            onClick={() => window.open(`/stage/${pin}`, '_blank')}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition"
            title="Open Auditorium 4K Projector Screen in new window"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Open Stage (4K)</span>
          </button>

          {/* Excel Export */}
          <a
            href={`http://localhost:5000/api/rooms/${pin}/export`}
            download
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Download Excel Report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export (.xlsx)</span>
          </a>

          {/* Mute Audio */}
          <button
            onClick={toggleAudio}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
            title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Emergency Dialog */}
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition"
            title="Emergency Overrides"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Cockpit Body: 2 Columns */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Question Inspector (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 font-extrabold text-xs">
                    Q {currentQIndex + 1} of {totalQuestions}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {currentQuestion?.segment || 'GENERAL'}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {currentQuestion?.type || 'MCQ'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>{currentQuestion?.timeLimitSec || 20}s</span>
                  </span>
                  <span className="font-bold text-yellow-400">
                    {currentQuestion?.points || 1000} pts
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <h2 className="text-xl font-bold text-white leading-relaxed mb-6 font-heading">
                {currentQuestion?.questionText || 'No question active'}
              </h2>

              {/* Options Breakdown with Verified Correct Marked */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {currentQuestion?.options?.map((opt, i) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const isCorrect = opt.isCorrect;
                  const count = distribution[opt.id] || 0;

                  return (
                    <div
                      key={opt.id || i}
                      className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                        isCorrect
                          ? 'bg-emerald-950/30 border-emerald-500/70 shadow-lg shadow-emerald-500/10'
                          : 'bg-[#0A0F1D]/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400">
                          Option {letters[i]}
                        </span>
                        {isCorrect && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" />
                            <span>CORRECT</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white mb-2">
                        {opt.text}
                      </p>
                      <div className="text-xs text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span>Submitted:</span>
                        <span className="font-mono font-bold text-white">{count} teams</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulated Teams Tool (For instant testing without 5 phones) */}
            {participants.length === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-center justify-between">
                <span>Want to test the tournament flow right now?</span>
                <button
                  onClick={handleSimulateTeams}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition shadow"
                >
                  Simulate 5 Teams in Lobby
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Telemetry & Control Panel (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Telemetry Gauge Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 shadow-lg flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Live Response Telemetry</span>
              <span className="font-mono text-yellow-400 font-bold">{responsePercentage}%</span>
            </h3>

            {/* Progress Bar */}
            <div className="w-full bg-[#0A0F1D] h-4 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="bg-gradient-to-r from-yellow-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, responsePercentage)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Answered: <b className="text-white">{answeredCount}</b></span>
              <span>Total Teams: <b className="text-white">{participants.length}</b></span>
              <span>Waiting: <b className="text-amber-400">{Math.max(0, participants.length - answeredCount)}</b></span>
            </div>

            {/* Real-time Option Distribution Pill Grid */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              {['opt_a', 'opt_b', 'opt_c', 'opt_d'].map((optId, idx) => {
                const label = ['A', 'B', 'C', 'D'][idx];
                const count = distribution[optId] || 0;
                return (
                  <div key={optId} className="bg-[#0A0F1D] p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="block text-[10px] text-slate-400 font-bold">OPT {label}</span>
                    <span className="text-base font-black text-white font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buzzer Control Mode (If question is BUZZER or host activates) */}
          {isBuzzerQuestion && (
            <div className="glass-panel-elevated rounded-2xl p-6 border border-yellow-500/40 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Buzzer Round Arbitration</span>
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  buzzerActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {buzzerActive ? 'BUZZER UNLOCKED' : 'LOCKED'}
                </span>
              </div>

              {!buzzerWinner ? (
                <button
                  onClick={handleActivateBuzzer}
                  disabled={buzzerActive}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg active:scale-98 transition disabled:opacity-50"
                >
                  {buzzerActive ? 'Buzzer Active on Mobile Screens...' : 'Unlock Buzzer for Contestants'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
                    <span className="text-xs uppercase text-slate-400 block mb-1">Floor Given To:</span>
                    <h4 className="text-lg font-black text-yellow-400 font-heading">
                      {buzzerWinner.winnerTeamName}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      Reaction Time: {(buzzerWinner.reactionTimeMs / 1000).toFixed(2)}s
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleJudgeBuzzer('CORRECT')}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                    >
                      Correct (+100)
                    </button>
                    <button
                      onClick={() => handleJudgeBuzzer('WRONG')}
                      className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition"
                    >
                      Wrong (-50)
                    </button>
                    <button
                      onClick={() => handleJudgeBuzzer('PASS')}
                      className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs shadow-md transition"
                    >
                      Pass / Re-open
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Master Control Action Bar */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 shadow-lg flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Master Stage Orchestration
            </h3>

            {/* 1. Start Countdown */}
            <button
              onClick={handleStartQuestion}
              disabled={status === 'COUNTDOWN' || status === 'QUESTION_ACTIVE'}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Start 3s Countdown & Question</span>
            </button>

            {/* 2. Lock Submissions */}
            <button
              onClick={handleLockQuestion}
              disabled={status !== 'QUESTION_ACTIVE'}
              className="w-full py-3 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Lock Submissions Early</span>
            </button>

            {/* 3. Reveal Answer & Stats */}
            <button
              onClick={handleRevealAnswer}
              disabled={status !== 'QUESTION_LOCKED'}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Reveal Correct Answer & Charts</span>
            </button>

            {/* 4. Show Standings */}
            <button
              onClick={handleShowLeaderboard}
              disabled={status !== 'ANSWER_REVEAL'}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Show Leaderboard Standings</span>
            </button>

            {/* 5. Next Question */}
            <button
              onClick={handleNextQuestion}
              disabled={currentQIndex + 1 >= totalQuestions}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Emergency Overrides */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated max-w-md w-full rounded-2xl p-6 border border-red-500/40 shadow-2xl">
            <h3 className="text-base font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Emergency Tournament Actions</span>
            </h3>

            {/* Disqualify Team */}
            <div className="mb-5 pb-5 border-b border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Disqualify & Zero Score for Team
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTeamToKick}
                  onChange={(e) => setSelectedTeamToKick(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="">Select team to disqualify...</option>
                  {participants.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.teamName} ({p.institution})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleKickTeam}
                  disabled={!selectedTeamToKick}
                  className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs disabled:opacity-40"
                >
                  Disqualify
                </button>
              </div>
            </div>

            {/* Adjust Points Dispute */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Manual Score Dispute Adjustment
              </label>
              <div className="flex gap-2 mb-2">
                <select
                  value={selectedTeamToAdjust}
                  onChange={(e) => setSelectedTeamToAdjust(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="">Select team for adjustment...</option>
                  {participants.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.teamName} (Score: {p.score || 0})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="+/- Pts"
                  value={deltaPoints}
                  onChange={(e) => setDeltaPoints(e.target.value)}
                  className="w-20 px-2 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
              <button
                onClick={handleAdjustScore}
                disabled={!selectedTeamToAdjust}
                className="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs disabled:opacity-40"
              >
                Apply Point Adjustment
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
