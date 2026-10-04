import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Download, Trophy, Target, Timer, Award, Loader2 } from 'lucide-react';

const PLACE_TITLES = { 1: '🥇 Champion', 2: '🥈 1st Runner-up', 3: '🥉 2nd Runner-up' };

/** Render a 1080×1350 participation card to PNG — no server round-trip needed. */
function drawSummaryCard(summary) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, '#0A0F1D');
  bg.addColorStop(1, '#1E2B45');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, 1000, 1270);

  const quadrant = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981'];
  quadrant.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(380 + i * 85, 110, 65, 14);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FACC15';
  ctx.font = '800 44px Outfit, sans-serif';
  ctx.fillText('LEARNUP LIVE ARENA', 540, 200);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 30px Inter, sans-serif';
  ctx.fillText('Certificate of Participation', 540, 255);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 76px Outfit, sans-serif';
  ctx.fillText(summary.teamName, 540, 400, 920);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 34px Inter, sans-serif';
  ctx.fillText(summary.institution || '', 540, 455, 920);

  ctx.fillStyle = '#FACC15';
  ctx.font = '900 180px Outfit, sans-serif';
  ctx.fillText(`#${summary.rank}`, 540, 680);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.fillText(`of ${summary.totalTeams} teams`, 540, 735);
  if (PLACE_TITLES[summary.rank]) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 44px Outfit, sans-serif';
    ctx.fillText(PLACE_TITLES[summary.rank], 540, 800);
  }

  const stats = [
    ['Score', summary.totalScore.toLocaleString()],
    ['Accuracy', `${summary.accuracyPct}%`],
    ['Correct', `${summary.correct}/${summary.totalQuestions}`],
    ['Avg Time', `${(summary.averageResponseTimeMs / 1000).toFixed(2)}s`],
  ];
  stats.forEach(([label, value], i) => {
    const x = 175 + i * 243;
    ctx.fillStyle = '#131D31';
    ctx.fillRect(x - 105, 880, 210, 190);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 50px Outfit, sans-serif';
    ctx.fillText(value, x, 985, 190);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 26px Inter, sans-serif';
    ctx.fillText(label, x, 1035);
  });

  ctx.fillStyle = '#64748B';
  ctx.font = '500 26px Inter, sans-serif';
  ctx.fillText(new Date().toLocaleDateString(undefined, { dateStyle: 'long' }), 540, 1200);
  ctx.fillText('BUFT National Quiz Competition', 540, 1245);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="p-3 rounded-2xl glass-panel text-left">
      <Icon className="w-4 h-4 text-arena-gold mb-1" />
      <span className="block text-xl font-black text-white font-heading tabular-nums">{value}</span>
      <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</span>
    </div>
  );
}

export default function PlayerFinalSummary({ summary }) {
  const [downloading, setDownloading] = useState(false);
  const [confettiDone, setConfettiDone] = useState(false);

  useEffect(() => {
    if (!summary || confettiDone || summary.rank > 3) return;
    setConfettiDone(true);
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
  }, [summary, confettiDone]);

  if (!summary) {
    return (
      <div className="flex flex-col items-center text-center gap-3 animate-fadeIn">
        <Trophy className="w-14 h-14 text-arena-gold" />
        <h2 className="text-2xl font-black text-white font-heading">Competition Complete</h2>
        <p className="text-sm text-slate-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Tallying your final summary…</p>
      </div>
    );
  }

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await drawSummaryCard(summary);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LearnUp_Arena_${summary.teamName.replace(/[^a-z0-9]+/gi, '_')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-5 animate-scaleUp">
      <span className="text-xs uppercase font-extrabold tracking-[0.3em] text-arena-gold">Final Summary</span>
      {PLACE_TITLES[summary.rank] && (
        <span className="text-2xl font-black text-white font-heading">{PLACE_TITLES[summary.rank]}</span>
      )}
      <div className="w-40 h-40 rounded-full border-4 border-arena-gold bg-arena-gold/10 flex flex-col items-center justify-center shadow-2xl shadow-yellow-500/20">
        <span className="text-6xl font-black text-white font-heading tabular-nums">#{summary.rank}</span>
        <span className="text-xs text-slate-400 font-semibold">of {summary.totalTeams} teams</span>
      </div>
      <div className="text-3xl font-black text-arena-gold font-heading tabular-nums">
        {summary.totalScore.toLocaleString()} <span className="text-base text-slate-400">pts</span>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <Stat icon={Target} label="Accuracy" value={`${summary.accuracyPct}%`} />
        <Stat icon={Award} label="Correct" value={`${summary.correct} / ${summary.totalQuestions}`} />
        <Stat icon={Timer} label="Avg Response" value={`${(summary.averageResponseTimeMs / 1000).toFixed(2)}s`} />
        <Stat icon={Trophy} label="Best Question" value={summary.bestQuestionScore.toLocaleString()} />
      </div>

      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-400 text-slate-950 font-black text-base shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 font-heading disabled:opacity-60"
      >
        {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        Download Participation Summary
      </button>
      <p className="text-[11px] text-slate-500">Thank you for competing in the BUFT National Quiz!</p>
    </div>
  );
}
