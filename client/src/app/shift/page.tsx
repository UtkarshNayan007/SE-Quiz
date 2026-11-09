'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Moon,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Copy,
  Check,
  Sparkles,
  Zap,
  HelpCircle,
  FileText,
  AlertTriangle,
  Play
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { getServerUrl } from '@/lib/socket';
import { InteractiveQuestionVisual } from '@/components/InteractiveQuestionVisual';
import CertificateModal from '@/components/CertificateModal';
import { CertificateData } from '@/lib/certificateGenerator';

interface ShiftQuestion {
  id?: number | string;
  questionIndex: number;
  question: string;
  options: string[];
  category?: string;
  type?: string;
  difficulty?: string;
  scenario?: string | null;
  step?: string | null;
  visualData?: any;
  instruction?: string | null;
}

interface EvaluatedAnswer {
  questionIndex: number;
  selectedOption: number;
  correctOptionIndex: number;
  isCorrect: boolean;
  points: number;
  timeMs: number;
  timeFormatted: string;
  explanation: string;
}

export default function ShiftWorkerPage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Flow states: 'LOBBY', 'BRIEFING', 'QUESTION', 'FEEDBACK', 'RESULTS'
  const [stage, setStage] = useState<'LOBBY' | 'BRIEFING' | 'QUESTION' | 'FEEDBACK' | 'RESULTS'>('LOBBY');

  const [roomTopic, setRoomTopic] = useState('OT MSS Weekly Knowledge Transfer');
  const [questions, setQuestions] = useState<ShiftQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Anti-cheat timer per question (30 seconds)
  const [timeLeft, setTimeLeft] = useState(30);
  const questionStartTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Participant choices
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ questionIndex: number; selectedOption: number; timeMs: number }[]>([]);

  // Feedback state for current question
  const [currentEval, setCurrentEval] = useState<{
    isCorrect: boolean;
    correctOptionIndex: number;
    points: number;
    timeMs: number;
    explanation: string;
  } | null>(null);

  // Final Results
  const [finalScorecard, setFinalScorecard] = useState<{
    participantId: string;
    badgeNumber: string;
    name: string;
    score: number;
    correctCount: number;
    wrongCount: number;
    totalQuestions: number;
    rank: number;
    totalParticipants: number;
    evaluatedAnswers: EvaluatedAnswer[];
  } | null>(null);

  // Certificate Modal
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [copiedHandover, setCopiedHandover] = useState(false);

  // Pre-fill from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin');
      const urlName = urlParams.get('name');
      if (urlPin) setPin(urlPin.toUpperCase());
      if (urlName) setName(urlName.toUpperCase());
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (stage === 'QUESTION') {
      questionStartTimeRef.current = Date.now();
      setTimeLeft(30);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage, currentIdx]);

  const handleFetchRoomQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();
    const cleanName = name.toUpperCase().replace(/[^A-Z\s]/g, '').trim().replace(/\s+/g, ' ');

    if (!cleanPin || cleanPin.length < 6) {
      setError('Please enter a valid 6-digit Room PIN.');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full name (at least 2 letters, A-Z only).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const serverUrl = getServerUrl();
      const res = await fetch(`${serverUrl}/api/rooms/${cleanPin}/questions`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Room not found. Please verify the PIN.');
      }

      setRoomTopic(data.topic || 'OT MSS Weekly Knowledge Transfer');
      setQuestions(data.questions || []);
      setStage('BRIEFING');
    } catch (err: any) {
      setError(err.message || 'Could not connect to room. Please check the PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = () => {
    setCurrentIdx(0);
    setUserAnswers([]);
    setSelectedOption(null);
    setCurrentEval(null);
    setStage('QUESTION');
  };

  const handleTimeExpired = () => {
    // Participant ran out of 30 seconds
    if (selectedOption === null) {
      submitAnswerChoice(-1, 30000);
    }
  };

  const handleSelectOption = (optIdx: number) => {
    if (stage !== 'QUESTION' || selectedOption !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const elapsedMs = Math.min(Math.max(Date.now() - questionStartTimeRef.current, 500), 30000);
    setSelectedOption(optIdx);
    submitAnswerChoice(optIdx, elapsedMs);
  };

  const submitAnswerChoice = (optIdx: number, elapsedMs: number) => {
    const updatedAnswers = [
      ...userAnswers,
      {
        questionIndex: currentIdx,
        selectedOption: optIdx,
        timeMs: elapsedMs
      }
    ];
    setUserAnswers(updatedAnswers);

    // Provide immediate question feedback if available
    setStage('FEEDBACK');
  };

  const handleProceedToNext = async () => {
    setSelectedOption(null);
    setCurrentEval(null);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setStage('QUESTION');
    } else {
      // Finished all questions! Submit to backend
      await submitAllAnswers();
    }
  };

  const submitAllAnswers = async () => {
    setLoading(true);
    setError('');

    try {
      const serverUrl = getServerUrl();
      const cleanPin = pin.trim().toUpperCase();
      const cleanName = name.toUpperCase().replace(/[^A-Z\s]/g, '').trim().replace(/\s+/g, ' ');

      const res = await fetch(`${serverUrl}/api/rooms/${cleanPin}/async-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          badgeNumber: badgeNumber.trim(),
          answers: userAnswers
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit shift evaluation.');
      }

      setFinalScorecard(data);

      // Prepare certificate
      const isWinner = (data.rank || 99) <= 3;
      const cert: CertificateData = {
        name: cleanName,
        tier: isWinner ? 'winner' : 'participant',
        awardTitle: data.rank === 1 ? 'Grand Champion (Shift SOC)' : (data.rank <= 3 ? `Top ${data.rank} Shift Defender` : 'OT MSS Certified Practitioner'),
        rank: data.rank || 1,
        totalParticipants: data.totalParticipants || 1,
        score: data.score || 0,
        attemptedCount: data.totalQuestions,
        totalQuestions: data.totalQuestions,
        verificationId: `MSS-SHIFT-${cleanPin}-${data.badgeNumber}`,
        dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        locationStr: 'CCSH OT SOC Global Hub'
      };
      setCertData(cert);

      setStage('RESULTS');
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please try again.');
      setStage('FEEDBACK');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyHandover = () => {
    if (!finalScorecard) return;
    const summary = `🛡️ [OT MSS Weekly KT Shift Assessment]\n` +
      `Analyst: ${finalScorecard.name} (#${finalScorecard.badgeNumber})\n` +
      `Room PIN: ${pin}\n` +
      `Final Score: ${finalScorecard.score} pts (Rank #${finalScorecard.rank} of ${finalScorecard.totalParticipants})\n` +
      `Accuracy: ${finalScorecard.correctCount}/${finalScorecard.totalQuestions} (${Math.round((finalScorecard.correctCount / finalScorecard.totalQuestions) * 100)}%)\n` +
      `Status: Shift KT Completed & Verified.`;

    navigator.clipboard.writeText(summary).then(() => {
      setCopiedHandover(true);
      setTimeout(() => setCopiedHandover(false), 2500);
    });
  };

  const currentQ = questions[currentIdx];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Header */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3.5 px-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="h-8 sm:h-9 w-auto object-contain brightness-100 dark:brightness-110"
            />
            <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-3">
              <h1 className="text-xs sm:text-sm font-black tracking-wider text-[#009639] dark:text-[#00E676] uppercase flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-indigo-500 inline" />
                OT MSS Shift-Worker Arena
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              24/7 Self-Paced Mode
            </span>
            <ThemeToggle showLabel={false} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-sm font-semibold text-center flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {/* STAGE 1: LOBBY JOIN */}
        {stage === 'LOBBY' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl max-w-md mx-auto w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
                <Moon className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-black tracking-wider uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                Mode 4 • Asynchronous Shift Access
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Shift-Worker KT Arena
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Take the weekly OT MSS technical assessment at your own pace during live monitoring or night shifts. Your score blends directly into the unified team leaderboard.
              </p>
            </div>

            <form onSubmit={handleFetchRoomQuestions} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Room PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 482195"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.toUpperCase()); setError(''); }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-center text-xl tracking-widest font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#00E676] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-semibold uppercase tracking-wide text-slate-900 dark:text-white focus:ring-2 focus:ring-[#00E676] transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Capital letters only (A-Z).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Badge / Employee ID <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SE-8491"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  maxLength={15}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#00E676] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Loading Assessment...</span>
                ) : (
                  <>
                    <span>Load Shift Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STAGE 2: BRIEFING & RULES */}
        {stage === 'BRIEFING' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl mx-auto w-full space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                Session Verified
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
                {roomTopic}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Room #{pin} • {questions.length} Questions Configured
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#009639]" /> Shift Assessment Protocols:
              </h3>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 pl-1">
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>30 Seconds Anti-Cheat Timer:</strong> Each question must be answered within 30 seconds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Speed-Weighted Scoring:</strong> Faster correct answers yield up to 1,000 points (500 base + 500 speed bonus).</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span><strong>Unified MSSP Leaderboard:</strong> Your final score merges directly with the live session participants and generates your official certificate.</span>
                </li>
              </ul>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setStage('LOBBY')}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleStartQuiz}
                className="flex-2 py-3 px-6 rounded-xl bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Begin Assessment</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3 & 4: QUESTION & FEEDBACK */}
        {(stage === 'QUESTION' || stage === 'FEEDBACK') && currentQ && (
          <div className="space-y-4 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
            {/* Top Status & Timer Bar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                {currentQ.category && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    {currentQ.category}
                  </span>
                )}
              </div>

              {/* 30s Countdown Dial */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono transition-colors ${
                timeLeft <= 5
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 animate-pulse'
                  : timeLeft <= 10
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLeft}s</span>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                {currentQ.question}
              </h3>

              {currentQ.instruction && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Instruction: {currentQ.instruction}
                </p>
              )}

              {/* Interactive Visual if provided */}
              {currentQ.visualData && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <InteractiveQuestionVisual
                    type={currentQ.type}
                    questionText={currentQ.question}
                    visualData={currentQ.visualData}
                    compact={true}
                    isReveal={stage === 'FEEDBACK'}
                  />
                </div>
              )}

              {/* Options Grid */}
              <div className="space-y-2.5 pt-2">
                {currentQ.options.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isSelected = selectedOption === optIdx;

                  let cardStyle = "bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200";

                  if (stage === 'FEEDBACK' && isSelected) {
                    cardStyle = "bg-emerald-50 dark:bg-emerald-950/60 border-[#009639] text-[#009639] dark:text-[#00E676] ring-2 ring-[#009639]";
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={stage === 'FEEDBACK'}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-sm font-semibold cursor-pointer disabled:cursor-default ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                          {letter}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-[#009639] dark:text-[#00E676] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Footer & Next Action */}
              {stage === 'FEEDBACK' && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Answer Recorded! Response time evaluated.
                    </span>
                  </div>

                  <button
                    onClick={handleProceedToNext}
                    className="w-full bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
                  >
                    <span>{currentIdx + 1 >= questions.length ? 'Complete Assessment' : 'Next Question'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAGE 5: FINAL SCORECARD & CERTIFICATE */}
        {stage === 'RESULTS' && finalScorecard && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl mx-auto w-full space-y-6 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                <Award className="w-9 h-9" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                Shift Assessment Completed
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {finalScorecard.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Badge #{finalScorecard.badgeNumber} • Room {pin}
              </p>
            </div>

            {/* Scorecard Metrics */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rank</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  #{finalScorecard.rank}
                </span>
                <span className="text-[10px] text-slate-400 block">of {finalScorecard.totalParticipants}</span>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Score</span>
                <span className="text-2xl font-black text-[#009639] dark:text-[#00E676] font-mono">
                  {finalScorecard.score}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">pts</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correct</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {finalScorecard.correctCount}/{finalScorecard.totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {Math.round((finalScorecard.correctCount / finalScorecard.totalQuestions) * 100)}%
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setIsCertOpen(true)}
                className="w-full bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>View & Download Official Certificate</span>
              </button>

              <button
                onClick={handleCopyHandover}
                className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {copiedHandover ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedHandover ? 'Copied to Clipboard!' : 'Copy Summary for Shift Handover Log'}</span>
              </button>
            </div>

            {/* Answer Breakdown Accordion */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Question Performance Review
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {finalScorecard.evaluatedAnswers.map((ea, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs border flex items-start justify-between gap-2 ${
                      ea.isCorrect
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800/40'
                    }`}
                  >
                    <div>
                      <span className="font-bold">Q{idx + 1}: </span>
                      <span className={ea.isCorrect ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-red-700 dark:text-red-400 font-semibold'}>
                        {ea.isCorrect ? 'Correct (+ ' + ea.points + ' pts)' : 'Incorrect (0 pts)'}
                      </span>
                      {ea.explanation && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {ea.explanation}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">{ea.timeFormatted}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 text-center text-xs text-slate-400">
        Schneider Electric • OT MSSP Knowledge Transfer & Operational Readiness Arena
      </footer>

      {/* Certificate Modal */}
      {isCertOpen && certData && (
        <CertificateModal
          isOpen={isCertOpen}
          onClose={() => setIsCertOpen(false)}
          data={certData}
        />
      )}
    </div>
  );
}
