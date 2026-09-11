'use client';

import React, { useState } from 'react';
import { ShieldCheck, Monitor, UserCheck, Play, ArrowRight, Lock } from 'lucide-react';

export default function LandingPage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

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
    const url = `/participant?pin=${cleanPin}&name=${encodeURIComponent(cleanName)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleLaunchProjector = () => {
    const url = pin.trim() && pin.length >= 6 ? `/projector?pin=${pin.trim()}` : '/projector';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      {/* Navbar Header */}
      <header className="w-full bg-white border-b border-slate-200 py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="w-10 h-10 object-contain drop-shadow-sm"
            />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                Schneider <span className="text-schneider-brand">Electric</span>
              </h1>
              <p className="text-xs font-bold text-schneider-brand uppercase tracking-widest">
                CCSH MSS OPERATIONS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img
              src="/cyber-shield-logo.png"
              alt="Cyber Security Shield"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-md transition-transform hover:scale-105"
            />
            <div className="hidden sm:flex items-center space-x-2 bg-emerald-50 text-schneider-darkgreen px-3.5 py-2 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-schneider-green" />
              <span>Fastest Finger First • Live Local Network</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center my-8">
        <div className="text-center mb-10">
          <span className="inline-block bg-schneider-lightgreen text-schneider-darkgreen font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider mb-3">
            Cyber Security Team Challenge
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Fastest Finger First <span className="text-schneider-green">MCQ Quiz</span>
          </h2>
          <p className="mt-3 text-slate-600 text-base max-w-lg mx-auto">
            Zero-latency local multiplayer buzz-in system designed for high-stakes speed and precision.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold text-center animate-shake-red">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Participant Card */}
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between border border-slate-200 hover:border-schneider-green transition-all shadow-lg">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-emerald-100 rounded-xl text-schneider-brand">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Participant Join</h3>
                  <p className="text-xs text-slate-500">Play from your mobile phone or desktop</p>
                </div>
              </div>

              <form onSubmit={handleJoinParticipant} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Room PIN
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 482195"
                      value={pin}
                      onChange={(e) => { setPin(e.target.value); setError(''); }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center text-xl tracking-widest font-bold focus:ring-2 focus:ring-schneider-green focus:bg-white transition"
                    />
                    <Lock className="w-4 h-4 absolute right-3 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
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
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold uppercase tracking-wide focus:ring-2 focus:ring-schneider-green focus:bg-white transition"
                  />
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Capital letters only (A-Z). No numbers or special characters.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full btn-schneider py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center space-x-2 group mt-2"
                >
                  <span>Join Game</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>

          {/* Admin & Stage Control Card */}
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between border border-slate-200 shadow-lg">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-800">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Host & Stage Display</h3>
                  <p className="text-xs text-slate-500">Launch Host Control or Main Stage Projector</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <Play className="w-4 h-4 text-schneider-brand" />
                    <span>Host Control Dashboard</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 mb-3">
                    Generates Room PIN, pushes questions, and validates participant answers.
                  </p>
                  <a
                    href="/host"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm transition text-center block cursor-pointer"
                  >
                    Open Host Dashboard
                  </a>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <Monitor className="w-4 h-4 text-schneider-green" />
                    <span>Projector Screen View</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 mb-3">
                    Main big-screen display with live QR code, 30s timer, Top-5 queue & confetti.
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
      <footer className="w-full bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        Schneider Electric MSS Cyber Security Event • M2 Mac Local WebSocket Environment
      </footer>
    </div>
  );
}
