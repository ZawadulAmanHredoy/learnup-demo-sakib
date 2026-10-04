import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Sparkles, Key, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin/quizzes');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const prefillDemo = () => {
    setEmail('admin@learnup.com');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-300 shadow-lg shadow-yellow-500/20 mb-4 border border-yellow-400/40">
            <ShieldCheck className="w-8 h-8 text-[#0A0F1D]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-heading">
            LearnUp <span className="text-yellow-400">Live Arena</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Tournament Director & Host Control Center
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl relative border border-slate-700/60">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center justify-between">
            <span>Host Authentication</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Admin Portal
            </span>
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2 uppercase tracking-wider">
                Host Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@learnup.com"
                  className="w-full pl-10 pr-4 py-3 bg-[#0A0F1D]/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-[#0A0F1D]/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-bold tracking-wide shadow-lg shadow-yellow-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              <span>{submitting ? 'Authenticating...' : 'Enter Host Cockpit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials helper */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={prefillDemo}
              className="inline-flex items-center gap-2 text-xs font-semibold text-yellow-400/90 hover:text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 px-3.5 py-2 rounded-lg transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Fill Default Credentials (admin@learnup.com / admin123)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          LearnUp Live Arena &bull; Official Platform for BUFT National Quiz 2025
        </p>
      </div>
    </div>
  );
}
