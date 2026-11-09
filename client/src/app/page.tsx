'use client';

import React, { useState } from 'react';
import { ShieldCheck, Monitor, UserCheck, Play, ArrowRight, Lock, Moon, Zap, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function LandingPage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [joinMode, setJoinMode] = useState<'live' | 'shift'>('live');

  const handleJoinParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();
    const cleanName = name.toUpperCase().replace(/[^A-Z\s]/g, '').trim().replace(/\s+/g, ' ');

    if (!cleanPin || cleanPin.length < 6) {
      setError('Please enter a valid 6-digit Room PIN');
      return;
    }
    if (!cleanName) {
      setError('Please enter your Name');
      return;
    }
    if (name && (/[0-9]/.test(name) || /[^A-Za-z\s]/.test(name))) {
      setError('Name must contain only capital letters (A-Z) and spaces. Numbers and special characters are not allowed.');
      return;
    }
    if (cleanName.replace(/\s/g, '').length < 2) {
      setError('Please enter a valid name with at least 2 letters.');
      return;
    }
    if (cleanName.length > 35) {
      setError('Name is too long. Maximum 35 characters allowed.');
      return;
    }
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('se_quiz_name');
      const savedPin = localStorage.getItem('se_quiz_pin');
      if (savedName !== cleanName || savedPin !== cleanPin) {
        localStorage.removeItem('se_quiz_participant_id');
      }
      localStorage.setItem('se_quiz_pin', cleanPin);
      localStorage.setItem('se_quiz_name', cleanName);
    }

    if (joinMode === 'shift') {
      const url = `/shift?pin=${cleanPin}&name=${encodeURIComponent(cleanName)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const url = `/participant?pin=${cleanPin}&name=${encodeURIComponent(cleanName)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLaunchProjector = () => {
    const url = pin.trim() && pin.length >= 6 ? `/projector?pin=${pin.trim()}` : '/projector';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Navbar Header */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6 shadow-sm transition-colors duration-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="h-9 sm:h-10 w-auto object-contain drop-shadow-sm brightness-100 dark:brightness-110"
            />
            <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-3">
              <h1 className="text-xs sm:text-sm font-black tracking-wider text-schneider-brand dark:text-schneider-green uppercase">
                OT MSS Weekly KT Quiz
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle showLabel={false} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center my-6">
        <div className="text-center mb-8">
          <span className="inline-block bg-schneider-lightgreen dark:bg-emerald-950/70 text-schneider-darkgreen dark:text-emerald-400 border border-transparent dark:border-emerald-800/60 font-bold text-xs px-3.5 py-1 rounded-full uppercase tracking-wider mb-3">
            OT MSSP Operational Readiness Arena
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            OT MSS Weekly KT & <span className="text-schneider-green">Readiness Arena</span>
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Industrial Cybersecurity Knowledge Testing & Incident Response Simulation — Measuring, validating, and reinforcing weekly technical engineering gains.
          </p>
        </div>

        {/* 4 Tactical Training Modes Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-left">
            <div className="flex items-center gap-2 text-schneider-brand dark:text-schneider-green mb-1.5">
              <Zap className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Mode 1 • Live</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Fastest Finger First</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              Synchronous speed-weighted scoring, live dial, podium & confetti.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-left">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Mode 2 • Battle</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">OT Incident Triage</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              3-step scenario: Detection, Purdue containment & DCS restoration.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-left">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1.5">
              <FileText className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Mode 3 • Vocab</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Acronym Decoder</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              IEC 62443, NIST SP 800-82, OPC UA, CIP, HMI, RTU, Historian clues.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-sm text-left bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1.5">
              <Moon className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Mode 4 • 24/7</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Shift-Worker Arena</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              48h self-paced link with anti-cheat timer for night-shift analysts.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-sm font-semibold text-center animate-shake-red">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Participant Card */}
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between border border-slate-200 dark:border-slate-800 hover:border-schneider-green dark:hover:border-schneider-green transition-all shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-schneider-brand dark:text-schneider-green">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Participant Join</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Play live or enter self-paced shift arena</p>
                  </div>
                </div>

                {/* Live vs Shift Switcher */}
                <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setJoinMode('live')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      joinMode === 'live'
                        ? 'bg-white dark:bg-slate-700 text-schneider-brand dark:text-schneider-green shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Live
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinMode('shift')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                      joinMode === 'shift'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Moon className="w-3 h-3" /> Shift
                  </button>
                </div>
              </div>

              {joinMode === 'shift' && (
                <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-800 dark:text-indigo-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    Shift-Worker Mode Active (24/7 Self-Paced)
                  </span>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                    Take the quiz on your own shift. Your final score integrates into the room leaderboard.
                  </p>
                </div>
              )}

              <form onSubmit={handleJoinParticipant} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Room PIN
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 482195"
                      value={pin}
                      onChange={(e) => { setPin(e.target.value); setError(''); }}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-center text-xl tracking-widest font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-schneider-green focus:bg-white dark:focus:bg-slate-800 transition"
                    />
                    <Lock className="w-4 h-4 absolute right-3 top-3.5 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="ENTER YOUR FULL NAME"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value.toUpperCase().replace(/[^A-Z\s]/g, ''));
                      setError('');
                    }}
                    maxLength={35}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck="false"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-semibold uppercase tracking-wide text-slate-900 dark:text-white focus:ring-2 focus:ring-schneider-green focus:bg-white dark:focus:bg-slate-800 transition"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                    Capital letters only (A-Z). No numbers or special characters.
                  </p>
                </div>

                <button
                  type="submit"
                  className={`w-full py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center space-x-2 group mt-2 cursor-pointer transition-all shadow-md active:scale-98 text-white ${
                    joinMode === 'shift'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'btn-schneider'
                  }`}
                >
                  <span>{joinMode === 'shift' ? 'Enter Shift Arena' : 'Join Live Game'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>

          {/* Admin & Stage Control Card */}
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between border border-slate-200 dark:border-slate-800 shadow-lg">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-slate-200">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Host & Stage Display</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Launch Host Control or Main Stage Projector</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                    <Play className="w-4 h-4 text-schneider-brand dark:text-schneider-green" />
                    <span>Host Control Dashboard</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-3">
                    Configures training modes, ingests KT docs with AI, pushes questions, and validates answers.
                  </p>
                  <a
                    href="/host"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-2.5 rounded-lg text-sm transition text-center block cursor-pointer"
                  >
                    Open Host Dashboard
                  </a>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                    <Monitor className="w-4 h-4 text-schneider-green" />
                    <span>Projector Screen View</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-3">
                    Main big-screen display with live QR code, 30s timer, Top-5 queue & podium.
                  </p>
                  <button
                    type="button"
                    onClick={handleLaunchProjector}
                    className="w-full bg-schneider-brand hover:bg-schneider-darkgreen text-white font-bold py-2.5 rounded-lg text-sm transition cursor-pointer"
                  >
                    Launch Projector Display
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        Schneider Electric • OT MSSP Knowledge Transfer & Operational Readiness Arena
      </footer>
    </div>
  );
}
