'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Monitor, UserCheck, Play, ArrowRight, Lock } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');

  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleJoinParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.length < 6) {
      setError('Please enter a valid 6-digit Room PIN');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your Name');
      return;
    }
    router.push(`/participant?pin=${pin.trim()}&name=${encodeURIComponent(name.trim())}`);
  };

  const handleLaunchProjector = () => {
    if (!pin.trim() || pin.length < 6) {
      setError('Enter Room PIN to launch Projector view');
      return;
    }
    router.push(`/projector?pin=${pin.trim()}`);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      {/* Navbar Header */}
      <header className="w-full bg-white border-b border-slate-200 py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-schneider-brand flex items-center justify-center text-white font-black text-xl shadow-md">
              SE
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                Schneider <span className="text-schneider-brand">Electric</span>
              </h1>
              <p className="text-xs font-semibold text-schneider-brand uppercase tracking-widest">
                Managed Security Services (MSS)
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-2 bg-emerald-50 text-schneider-darkgreen px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-schneider-green" />
            <span>Fastest Finger First • Live Local Network</span>
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
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold focus:ring-2 focus:ring-schneider-green focus:bg-white transition"
                  />
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
                  <button
                    onClick={() => router.push('/host')}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm transition"
                  >
                    Open Host Dashboard
                  </button>
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
                    onClick={handleLaunchProjector}
                    className="w-full bg-schneider-brand hover:bg-schneider-darkgreen text-white font-bold py-2.5 rounded-lg text-sm transition"
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
