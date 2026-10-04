import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Tv, Smartphone, ShieldCheck, ArrowRight, Play, 
  Sparkles, Award, Zap, Layers 
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [pinInput, setPinInput] = useState('');

  const handleJoinPlay = (e) => {
    e.preventDefault();
    if (pinInput.trim()) {
      navigate(`/play?pin=${pinInput.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-blue-600/15 via-yellow-500/10 to-transparent blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-slate-800/80 bg-[#131D31]/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center font-black text-slate-950 shadow-md">
            LA
          </div>
          <div>
            <h1 className="text-lg font-bold text-white font-heading">
              LearnUp <span className="text-yellow-400">Live Arena</span>
            </h1>
            <p className="text-xs text-slate-400">Real-Time Academic Tournament Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/login')}
            className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Host Portal</span>
          </button>
        </div>
      </header>

      {/* Main Hero */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-center text-center relative z-10">
        {/* Event Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Official Platform for BUFT National Quiz Competition 2025</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-black text-white font-heading leading-tight tracking-tight max-w-3xl mb-4 text-glow-gold">
          Auditorium-Scale Real-Time Quiz Battles
        </h2>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mb-10">
          Sub-50ms synchronized competition for 133+ collegiate teams, 4K auditorium stage broadcasts, atomic buzzers, and automated scoring.
        </p>

        {/* Quick Contestant Join Bar */}
        <form onSubmit={handleJoinPlay} className="w-full max-w-md mb-12 flex gap-2">
          <input
            type="text"
            maxLength={6}
            placeholder="Enter 6-Digit Room PIN..."
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="flex-1 px-5 py-3.5 bg-[#131D31] border border-slate-700 rounded-2xl text-yellow-400 font-mono font-bold text-center tracking-widest placeholder-slate-500 focus:outline-none focus:border-yellow-400 transition"
          />
          <button
            type="submit"
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-yellow-500/20 active:scale-95 transition cursor-pointer"
          >
            <span>Play</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 3 Synchronized Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* 1. Host Cockpit */}
          <div
            onClick={() => navigate('/admin/login')}
            className="p-6 rounded-3xl glass-panel border border-slate-700/80 hover:border-yellow-500/50 transition cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-4 group-hover:scale-110 transition">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading mb-2">
              Host Live Cockpit
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Launch live rooms, trigger questions, early lock, reveal answer charts, arbitrate buzzers, and download Excel audits.
            </p>
            <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
              <span>Open Host Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* 2. Stage Display */}
          <div
            onClick={() => navigate('/stage/705784')}
            className="p-6 rounded-3xl glass-panel border border-slate-700/80 hover:border-blue-500/50 transition cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading mb-2">
              Stage Projector (4K)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Cinema-grade display with scannable giant QR code, 48px questions, animated response distributions, and podium confetti.
            </p>
            <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
              <span>View Sample Stage (PIN: 705784)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* 3. Mobile Player */}
          <div
            onClick={() => navigate('/play?pin=705784')}
            className="p-6 rounded-3xl glass-panel border border-slate-700/80 hover:border-emerald-500/50 transition cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading mb-2">
              Mobile Player Client
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Thumb-friendly 4-color touch quadrant, haptic vibration, atomic buzzer button, and instant streak score badges.
            </p>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <span>Enter Player Mode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-slate-800/80 bg-[#131D31]/40 text-center text-xs text-slate-500">
        LearnUp Live Arena &bull; Engineered for live collegiate esports and academic quiz tournaments
      </footer>
    </div>
  );
}
