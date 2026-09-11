'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  Zap,
  Lock,
  Eye,
  Trophy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Smartphone,
  BookOpen,
  Sparkles,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

export interface RuleItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  highlight: string;
}

export const QUIZ_RULES: RuleItem[] = [
  {
    id: 'phases',
    icon: Clock,
    title: 'Two-Phase Question Format',
    badge: '10s + 30s',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Each question starts with a 10-second Reading Phase where options are locked so everyone absorbs the question equally. Then, a 30-second Answering Window begins where options unlock!',
    highlight: 'Read carefully during the 10s countdown, then answer quickly in the 30s window!'
  },
  {
    id: 'scoring',
    icon: Zap,
    title: 'Speed-Weighted Scoring',
    badge: '100 Pts + Speed Bonus',
    badgeColor: 'bg-emerald-100 text-[#009639] border-emerald-300',
    description: 'Correct answers award 100 base points plus bonus points based on how quickly you submit. Incorrect answers get 0 points (no negative marking).',
    highlight: 'Faster correct answers rank higher on the leaderboard!'
  },
  {
    id: 'lockin',
    icon: Lock,
    title: 'Single Lock-In Submission',
    badge: 'No Second Guessing',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Once you tap an option, your answer is immediately locked in and transmitted to the server. You cannot change your choice for that question.',
    highlight: 'Tap with confidence — your first tap is final!'
  },
  {
    id: 'reveal',
    icon: Eye,
    title: 'Host-Controlled Answer Reveal',
    badge: 'Synchronized Reveal',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Answer evaluations are held on both participant and projector screens until the host clicks "Show Answer to All". Everyone discovers the correct answer and explanation together.',
    highlight: 'Result evaluation is kept on hold until the host triggers the reveal!'
  },
  {
    id: 'winners',
    icon: Trophy,
    title: 'Top 3 Podium Champions',
    badge: 'Podium Awards',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
    description: 'Only the Top 3 players by total score and quickest cumulative time will be celebrated as winners: 1st Place Champion, 1st Runner Up, and 2nd Runner Up.',
    highlight: 'Compete for the Top 3 podium spots and official Cyber Day 2026 awards!'
  }
];

export interface DemoStep {
  stepIndex: number;
  title: string;
  subtitle: string;
  focusArea: 'question' | 'timer' | 'options' | 'locked' | 'stats';
  description: string;
  tip: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    stepIndex: 1,
    title: 'Step 1: Question & Category Bar',
    subtitle: 'Where the challenge appears',
    focusArea: 'question',
    description: 'The question text appears prominently along with the cybersecurity topic category (e.g., Phishing Defense, Password Hygiene, Social Engineering) and your question progress.',
    tip: 'Pay attention to the category tag to orient your thinking quickly!'
  },
  {
    stepIndex: 2,
    title: 'Step 2: Dual Countdown Timers',
    subtitle: 'Pacing your response',
    focusArea: 'timer',
    description: 'First, an Amber Ring counts down 10 seconds of Reading Time. When it finishes, an Emerald/Crimson Ring counts down 30 seconds of Answering Time with an audible visual pulse.',
    tip: 'Hands ready! The moment the timer turns green, the buttons unlock.'
  },
  {
    stepIndex: 3,
    title: 'Step 3: 4 Interactive Option Buttons',
    subtitle: 'Choose your answer with a single tap',
    focusArea: 'options',
    description: 'Four color-coded cards (Blue, Orange, Green, Purple) present the choices. Tap one to lock in your answer immediately. Try tapping an option below to test it out!',
    tip: 'You can practice tapping the demo options below right now!'
  },
  {
    stepIndex: 4,
    title: 'Step 4: "Answer Locked In" Confirmation',
    subtitle: 'Peace of mind while waiting',
    focusArea: 'locked',
    description: 'As soon as you tap an answer, the screen displays a green confirmation: "Response Recorded! ⏳ Waiting for Host to Reveal". Your response time down to milliseconds is recorded.',
    tip: 'No need to tap multiple times — once confirmed, your score is secured!'
  },
  {
    stepIndex: 5,
    title: 'Step 5: Live Stats & Score Header',
    subtitle: 'Track your standings',
    focusArea: 'stats',
    description: 'At the top of your screen, your real-time score, current leaderboard rank, and fastest answer response time update with each revealed round.',
    tip: 'Watch your score climb towards the Top 3 podium after every question!'
  }
];

/**
 * PARTICIPANT RULES & INTERFACE GUIDE COMPONENT
 */
export function ParticipantRulesGuide({
  onClose,
  initialTab = 'rules'
}: {
  onClose?: () => void;
  initialTab?: 'rules' | 'demo';
}) {
  const [activeTab, setActiveTab] = useState<'rules' | 'demo'>(initialTab);
  const [currentDemoStep, setCurrentDemoStep] = useState(0);
  const [selectedDemoOption, setSelectedDemoOption] = useState<number | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [progressKey, setProgressKey] = useState(0);

  const stepData = DEMO_STEPS[currentDemoStep];

  // Automated step progression when in demo tab
  useEffect(() => {
    if (activeTab !== 'demo' || !isAutoPlaying) return;

    if (currentDemoStep === 2) {
      // Step 3 (Options): Auto simulate tap on option A after 1.5s, then advance after 4s
      const tapTimer = setTimeout(() => {
        setSelectedDemoOption(0);
      }, 1500);

      const nextTimer = setTimeout(() => {
        setCurrentDemoStep(3);
        setProgressKey(k => k + 1);
      }, 4200);

      return () => {
        clearTimeout(tapTimer);
        clearTimeout(nextTimer);
      };
    } else {
      setSelectedDemoOption(null);
      const nextTimer = setTimeout(() => {
        if (currentDemoStep < DEMO_STEPS.length - 1) {
          setCurrentDemoStep(prev => prev + 1);
        } else {
          // Loop back to step 0
          setCurrentDemoStep(0);
        }
        setProgressKey(k => k + 1);
      }, 4200);

      return () => clearTimeout(nextTimer);
    }
  }, [activeTab, currentDemoStep, isAutoPlaying]);

  const handleNextStep = () => {
    setProgressKey(k => k + 1);
    if (currentDemoStep < DEMO_STEPS.length - 1) {
      setCurrentDemoStep(prev => prev + 1);
    } else if (onClose) {
      onClose();
    }
  };

  const handlePrevStep = () => {
    setProgressKey(k => k + 1);
    if (currentDemoStep > 0) {
      setCurrentDemoStep(prev => prev - 1);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-w-lg w-full mx-auto my-4 transition-all">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-5 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center p-1.5 shadow-inner">
              <img src="/cyber-shield-logo.png" alt="Cyber Shield" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#00E676] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cyber Day 2026 Quiz</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">Player Briefing & Guide</h2>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-xs font-bold"
              title="Close Guide"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-white/10 p-1 mt-4 border border-white/15">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-[#00E676] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>1. Quiz Rules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('demo')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'demo'
                ? 'bg-[#00E676] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>2. Interface Demo</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex-grow overflow-y-auto max-h-[68vh]">
        {activeTab === 'rules' ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-center">
              <p className="text-xs font-bold text-emerald-900 leading-relaxed">
                🎯 Welcome to the official Schneider Electric Cyber Day 2026 Quiz! Please review the 5 core tournament rules below before the host starts the first question.
              </p>
            </div>

            <div className="space-y-3">
              {QUIZ_RULES.map((rule, idx) => {
                const IconComponent = rule.icon;
                return (
                  <div
                    key={rule.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#009639] shrink-0 shadow-sm mt-0.5">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-extrabold text-sm text-slate-900">
                            {idx + 1}. {rule.title}
                          </h4>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${rule.badgeColor}`}>
                            {rule.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-1.5">
                          {rule.description}
                        </p>
                        <div className="bg-white/80 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#009639] shrink-0" />
                          <span>{rule.highlight}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className="w-full py-3 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <span>Take the Interactive Interface Tour</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* INTERACTIVE DEMO SIMULATOR */
          <div className="space-y-4">
            {/* Step Indicators with Auto-Play controls */}
            <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAutoPlaying(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border transition-all ${
                    isAutoPlaying
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                  title={isAutoPlaying ? "Pause Auto-Tour" : "Resume Auto-Tour"}
                >
                  {isAutoPlaying ? (
                    <>
                      <Pause className="w-3 h-3 text-emerald-700" />
                      <span>Auto-Tour Active</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-slate-700 fill-current" />
                      <span>Paused (Resume)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {DEMO_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentDemoStep(i);
                      setProgressKey(k => k + 1);
                    }}
                    className={`h-2.5 rounded-full transition-all ${
                      i === currentDemoStep
                        ? 'w-6 bg-[#009639]'
                        : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                    }`}
                    title={`Go to step ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Auto-Play Animated Progress Bar */}
            {isAutoPlaying && (
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden -mt-2">
                <div
                  key={progressKey}
                  className="bg-gradient-to-r from-emerald-500 to-[#00E676] h-full transition-all duration-[4200ms] ease-linear w-full origin-left animate-pulse"
                />
              </div>
            )}

            {/* Step Header */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                  {stepData.subtitle}
                </span>
                <span className="text-[10px] bg-white border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Guided Tour
                </span>
              </div>
              <h3 className="font-black text-base text-slate-900 mb-1.5">
                {stepData.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                {stepData.description}
              </p>
              <div className="bg-white/80 border border-emerald-200 p-2 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>💡 {stepData.tip}</span>
              </div>
            </div>

            {/* Live Interactive Phone Simulator Canvas */}
            <div className="bg-slate-900 text-white rounded-3xl p-4 border-4 border-slate-800 shadow-2xl relative overflow-hidden">
              {/* Simulated Phone Notch / Bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-mono font-bold">CYBER DAY 2026</span>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-[#00E676] px-1.5 py-0.5 rounded font-bold">LIVE PREVIEW</span>
                </div>
              </div>

              {/* Focus Area 5: Simulated Stats Header */}
              <div className={`mt-2 p-2.5 rounded-xl border transition-all ${
                stepData.focusArea === 'stats'
                  ? 'bg-[#00E676]/20 border-[#00E676] ring-2 ring-[#00E676]/50'
                  : 'bg-slate-800/60 border-slate-700'
              }`}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Rank:</span>
                    <span className="font-black text-amber-300 font-mono">#1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Score:</span>
                    <span className="font-black text-[#00E676] font-mono">250 pts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Fastest:</span>
                    <span className="font-bold text-white font-mono text-[10px]">1.24s</span>
                  </div>
                </div>
              </div>

              {/* Focus Area 2: Simulated Timer */}
              <div className={`my-3 p-3 rounded-2xl border flex items-center justify-between transition-all ${
                stepData.focusArea === 'timer'
                  ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50'
                  : 'bg-slate-800/40 border-slate-800'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${stepData.focusArea === 'timer' ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-300">Phase Indicator</p>
                    <p className="text-xs font-bold text-[#00E676]">Answering Window Active</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-emerald-400 bg-emerald-500/20 flex items-center justify-center font-mono font-black text-emerald-300 text-sm shadow-inner">
                  24s
                </div>
              </div>

              {/* Focus Area 1: Question Card */}
              <div className={`p-3 rounded-2xl border transition-all ${
                stepData.focusArea === 'question'
                  ? 'bg-[#00E676]/20 border-[#00E676] ring-2 ring-[#00E676]/50'
                  : 'bg-slate-800 border-slate-700'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span className="text-[#00E676] uppercase">Question 1 of 10</span>
                  <span className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">Social Engineering</span>
                </div>
                <p className="text-xs font-bold text-white leading-snug">
                  What is the primary indicator of a targeted spear phishing attack?
                </p>
              </div>

              {/* Focus Area 4: Locked In Banner */}
              {selectedDemoOption !== null && (
                <div className="mt-2.5 p-2 bg-emerald-500/20 border border-emerald-400/80 rounded-xl text-center text-xs font-bold text-[#00E676] flex items-center justify-center gap-1.5 animate-pulse">
                  <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
                  <span>Answer Locked In! Waiting for Host Reveal</span>
                </div>
              )}

              {/* Focus Area 3: Option Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[
                  { label: 'A', text: 'Urgent requests from executive impersonators', color: 'border-blue-500/50 hover:border-blue-400 bg-blue-950/40 text-blue-200' },
                  { label: 'B', text: 'Spam filters blocking newsletters', color: 'border-amber-500/50 hover:border-amber-400 bg-amber-950/40 text-amber-200' },
                  { label: 'C', text: 'Generic greeting without personal details', color: 'border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/40 text-emerald-200' },
                  { label: 'D', text: 'Unsecured public Wi-Fi notifications', color: 'border-purple-500/50 hover:border-purple-400 bg-purple-950/40 text-purple-200' },
                ].map((opt, i) => {
                  const isSelected = selectedDemoOption === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDemoOption(i)}
                      className={`p-2 rounded-xl text-left border transition-all text-[11px] font-medium flex items-start gap-1.5 ${
                        isSelected
                          ? 'border-[#00E676] bg-emerald-600/40 text-white ring-2 ring-[#00E676]'
                          : opt.color
                      } ${stepData.focusArea === 'options' ? 'ring-1 ring-amber-300' : ''}`}
                    >
                      <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                        isSelected ? 'bg-[#00E676] text-slate-950' : 'bg-white/10 text-white'
                      }`}>
                        {opt.label}
                      </span>
                      <span className="line-clamp-2 leading-tight">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 text-center text-[10px] text-slate-400">
                {selectedDemoOption === null ? 'Tap any of the 4 demo options above to test the selection feeling!' : 'Great job! You tested the instant lock-in response.'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
        {activeTab === 'demo' && currentDemoStep > 0 ? (
          <button
            type="button"
            onClick={handlePrevStep}
            className="px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors"
            >
              Skip Guide
            </button>
          )}

          {activeTab === 'rules' ? (
            <button
              type="button"
              onClick={() => setActiveTab('demo')}
              className="px-5 py-2.5 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <span>Next: Interface Tour</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <span>{currentDemoStep === DEMO_STEPS.length - 1 ? "I'm Ready! 🚀" : "Next Step"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PROJECTOR RULES & INTERFACE GUIDE COMPONENT
 */
export function ProjectorRulesGuide({
  onStartQuiz
}: {
  onStartQuiz?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'rules' | 'guide'>('rules');

  return (
    <div className="flex-grow flex flex-col justify-between max-w-7xl mx-auto w-full h-full">
      {/* Presentation Subheader */}
      <div className="flex items-center justify-between mb-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <img
            src="/cyber-shield-logo.png"
            alt="Cyber Day 2026"
            className="w-12 h-12 object-contain drop-shadow-sm"
          />
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Tournament Briefing & Rules
            </h2>
            <p className="text-xs text-[#009639] font-bold uppercase tracking-wider">
              Schneider Electric • CCSH MSS OPERATIONS
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`py-2 px-5 rounded-lg text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-[#009639] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>1. Official Quiz Rules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-2 px-5 rounded-lg text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-[#009639] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>2. Mobile Interface Guide</span>
          </button>
        </div>
      </div>

      {/* Main Presentation View */}
      {activeTab === 'rules' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-grow">
          {QUIZ_RULES.map((rule, idx) => {
            const IconComp = rule.icon;
            return (
              <div
                key={rule.id}
                className={`bg-white border-2 border-slate-200 hover:border-[#009639] rounded-3xl p-6 shadow-lg flex flex-col justify-between transition-all group ${
                  idx === 0 ? 'md:col-span-2' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#009639] group-hover:scale-110 transition-transform shadow-inner">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${rule.badgeColor}`}>
                      {rule.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    {idx + 1}. {rule.title}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {rule.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-[#009639]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{rule.highlight}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MOBILE INTERFACE GUIDE ON STAGE */
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center gap-8 flex-grow">
          {/* Visual Phone Breakdown */}
          <div className="w-full md:w-5/12 bg-slate-950 text-white rounded-3xl p-5 border-4 border-slate-800 shadow-2xl relative">
            <div className="text-center pb-3 border-b border-slate-800 text-xs font-black tracking-widest text-[#00E676]">
              PARTICIPANT MOBILE SCREEN
            </div>

            {/* Simulated Live View */}
            <div className="space-y-3 mt-3">
              <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">Live Standings:</span>
                <span className="text-amber-300 font-black font-mono">Rank #1 • 250 pts</span>
              </div>

              <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="text-[#00E676] font-bold uppercase">Question 1 of 10</span>
                  <span className="text-amber-400 font-mono font-bold">28s remaining</span>
                </div>
                <p className="text-xs font-bold text-white leading-snug">
                  What is the primary indicator of a spear phishing email?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border-2 border-[#00E676] bg-emerald-600/30 text-white font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#00E676] text-slate-950 flex items-center justify-center text-xs font-black">A</span>
                  <span className="truncate">Urgent executive request</span>
                </div>
                <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-white/10 text-white flex items-center justify-center text-xs font-black">B</span>
                  <span className="truncate">Spam filter alert</span>
                </div>
                <div className="p-2.5 rounded-xl border border-blue-500/40 bg-blue-950/30 text-blue-200 font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-white/10 text-white flex items-center justify-center text-xs font-black">C</span>
                  <span className="truncate">Generic greeting</span>
                </div>
                <div className="p-2.5 rounded-xl border border-purple-500/40 bg-purple-950/30 text-purple-200 font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-white/10 text-white flex items-center justify-center text-xs font-black">D</span>
                  <span className="truncate">Public Wi-Fi notice</span>
                </div>
              </div>

              <div className="bg-[#00E676]/20 border border-[#009639] p-2 rounded-xl text-center text-xs font-bold text-[#00E676] flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Response Recorded • Awaiting Host Reveal</span>
              </div>
            </div>
          </div>

          {/* Explanatory Callout List */}
          <div className="flex-1 space-y-3.5">
            <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>How Participants Play on Mobile</span>
            </h4>

            {[
              { num: '1', title: '10s Reading Phase (Study Question)', text: 'Options are disabled during the first 10 seconds so participants focus on reading the question attentively on their phones.' },
              { num: '2', title: '30s Answering Window (One-Tap Lock-In)', text: 'The four color-coded buttons unlock immediately. Tap one choice — it locks in instantly and cannot be changed.' },
              { num: '3', title: 'Speed Tracking Down to Milliseconds', text: 'The server measures exact reaction time from the second answering opens to determine leaderboard tie-breakers.' },
              { num: '4', title: 'Hold & Host Reveal', text: 'Participants see a green confirmation. Nobody sees the right answer until the host reveals it to the whole auditorium!' },
              { num: '5', title: 'Top 3 Podium Celebration', text: 'Top 3 participants with the highest score and quickest speed are crowned official event winners!' },
            ].map(callout => (
              <div key={callout.num} className="flex items-start gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <span className="w-7 h-7 rounded-xl bg-[#009639] text-white flex items-center justify-center font-black text-sm shrink-0 shadow">
                  {callout.num}
                </span>
                <div>
                  <h5 className="font-extrabold text-sm text-slate-900">{callout.title}</h5>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{callout.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage Footer Status */}
      <div className="mt-4 bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <ShieldCheck className="w-4 h-4 text-[#009639]" />
          <span>All players currently reviewing rules & interface guide on mobile devices.</span>
        </div>

        {onStartQuiz && (
          <button
            type="button"
            onClick={onStartQuiz}
            className="px-6 py-2.5 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition-all"
          >
            <Play className="w-4 h-4" />
            <span>Launch Question 1</span>
          </button>
        )}
      </div>
    </div>
  );
}
