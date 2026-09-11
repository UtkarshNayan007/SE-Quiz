'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import { ShieldCheck, Users, Timer, Trophy, CheckCircle2, Zap, Hash, HelpCircle, UserCheck, Lock, Award, Sparkles, Crown, Clock, BookOpen } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { ProjectorRulesGuide } from '../../components/RulesAndGuide';
import { InteractiveQuestionVisual } from '../../components/InteractiveQuestionVisual';

interface Question {
  questionIndex: number;
  question: string;
  options: string[];
  category: string;
  durationSeconds: number;
  totalQuestions?: number;
  type?: string;
  visualData?: any;
  instruction?: string;
  revealVisual?: any;
}

interface RevealResult {
  correctAnswerIndex: number;
  correctOptionText: string;
  explanation: string;
  type?: string;
  visualData?: any;
  revealVisual?: any;
  winner?: {
    socketId: string;
    name: string;
    timeFormatted: string;
    timeMs?: number;
    totalCorrectCount?: number;
    turnNumber?: number;
  } | null;
  totalCorrectCount?: number;
  totalAnsweredCount?: number;
  totalParticipantsCount?: number;
  leaderboard: Array<{ name: string; score: number }>;
}

function ProjectorComponent() {
  const searchParams = useSearchParams();
  const roomPin = searchParams.get('pin');

  const [participantCount, setParticipantCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [gameState, setGameState] = useState<'LOBBY' | 'RULES' | 'READING' | 'ANSWERING' | 'REVEAL' | 'QUIZ_ENDED' | 'RESULTS_PUBLISHED'>('LOBBY');
  const [showRulesInLobby, setShowRulesInLobby] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [countdown, setCountdown] = useState(10);
  
  const [progressData, setProgressData] = useState<{
    answeredCount: number;
    unansweredCount: number;
    participantCount: number;
  }>({
    answeredCount: 0,
    unansweredCount: 0,
    participantCount: 0
  });

  const [revealResult, setRevealResult] = useState<RevealResult | null>(null);
  const [publishedResults, setPublishedResults] = useState<any>(null);
  const [participantUrl, setParticipantUrl] = useState('');
  const [isAnsweringClosed, setIsAnsweringClosed] = useState(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerConfettiExplosion = () => {
    const duration = 4 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 8, angle: 60, spread: 60, origin: { x: 0 }, colors: ['#00E676', '#009639', '#FFFFFF', '#FFD700'] });
      confetti({ particleCount: 8, angle: 120, spread: 60, origin: { x: 1 }, colors: ['#00E676', '#009639', '#FFFFFF', '#FFD700'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const [customHost, setCustomHost] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && roomPin) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const host = isLocal ? '172.20.1.88:3000' : window.location.host;
      const protocol = window.location.protocol;
      setCustomHost(host);
      setParticipantUrl(`${protocol}//${host}/participant?pin=${roomPin}`);
    }
  }, [roomPin]);

  const handleHostChange = (newHost: string) => {
    setCustomHost(newHost);
    if (roomPin) {
      const hasProtocol = newHost.startsWith('http://') || newHost.startsWith('https://');
      const protocol = hasProtocol ? '' : (window.location.protocol + '//');
      const hasPort = newHost.includes(':') || hasProtocol;
      const portSuffix = hasPort ? '' : ':3000';
      setParticipantUrl(`${protocol}${newHost}${portSuffix}/participant?pin=${roomPin}`);
    }
  };

  // Socket setup
  useEffect(() => {
    if (!roomPin) return;

    const socket = getSocket();

    socket.emit('join_room', { roomPin, name: 'Projector', role: 'projector' }, (res: any) => {
      if (res?.success) {
        if (res.gameState) setGameState(res.gameState);
        if (res.activeQuestion) setCurrentQuestion(res.activeQuestion);
        if (res.totalQuestions) setTotalQuestions(res.totalQuestions);
        if (res.answeringEnded) setIsAnsweringClosed(true);
        if (res.resultsPublished && res.finalResults) {
          setGameState('RESULTS_PUBLISHED');
          setPublishedResults(res.finalResults);
        }
      }
    });

    socket.on('room_updated', (data: any) => {
      setParticipantCount(data.participantCount || data.participants?.length || 0);
      if (data.gameState) setGameState(data.gameState);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      if (data.answeringEnded !== undefined) setIsAnsweringClosed(Boolean(data.answeringEnded));
    });

    socket.on('question_pushed', (data: Question) => {
      setRevealResult(null);
      setIsAnsweringClosed(false);
      setCountdown(data.durationSeconds || 10);
      setCurrentQuestion(data);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setGameState('READING');
      setProgressData({
        answeredCount: 0,
        unansweredCount: participantCount,
        participantCount
      });

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('answering_started', (data: any) => {
      setGameState('ANSWERING');
      setIsAnsweringClosed(false);
      setCountdown(data.durationSeconds || 30);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('answering_closed', () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setCountdown(0);
      setIsAnsweringClosed(true);
    });

    socket.on('question_progress', (data: any) => {
      setProgressData({
        answeredCount: data.answeredCount || 0,
        unansweredCount: data.unansweredCount || 0,
        participantCount: data.participantCount || 0
      });
      if (data.participantCount !== undefined) {
        setParticipantCount(data.participantCount);
      }
    });

    socket.on('question_limit_updated', (data: any) => {
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
    });

    socket.on('answer_revealed', (data: any) => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setIsAnsweringClosed(false);
      setGameState('REVEAL');
      setRevealResult(data);
      if (data.winner) {
        triggerConfettiExplosion();
      }
    });

    socket.on('quiz_ended', () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setGameState('QUIZ_ENDED');
    });

    socket.on('quiz_results_published', (data: any) => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setGameState('RESULTS_PUBLISHED');
      setPublishedResults(data);
      triggerConfettiExplosion();
    });

    socket.on('rules_started', () => {
      setGameState('RULES');
      setShowRulesInLobby(false);
    });

    return () => {
      socket.off('room_updated');
      socket.off('rules_started');
      socket.off('question_pushed');
      socket.off('answering_started');
      socket.off('answering_closed');
      socket.off('question_progress');
      socket.off('question_limit_updated');
      socket.off('answer_revealed');
      socket.off('quiz_ended');
      socket.off('quiz_results_published');
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [roomPin]);

  const [inputPin, setInputPin] = useState('');

  if (!roomPin) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans p-6">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl max-w-md w-full text-center shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="w-16 h-16 object-contain drop-shadow-sm"
            />
          </div>
          <h2 className="text-2xl font-black mb-1 text-slate-900">Projector Display</h2>
          <p className="text-xs font-bold text-[#009639] uppercase tracking-widest mb-4">CCSH MSS OPERATIONS</p>
          <p className="text-slate-600 text-sm mb-6">Enter the 6-digit Room PIN created on the Host Dashboard to launch the stage screen view.</p>

          <form onSubmit={(e) => {
            e.preventDefault();
            if (inputPin) window.location.href = `/projector?pin=${inputPin.trim()}`;
          }} className="space-y-4">
            <input
              type="text"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value.toUpperCase())}
              placeholder="e.g. 123456"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-[#009639] font-mono text-center text-3xl font-black tracking-widest outline-none focus:ring-2 focus:ring-[#00E676] transition"
            />
            <button
              type="submit"
              className="w-full bg-[#009639] hover:bg-[#00E676] text-white font-bold py-3.5 rounded-xl transition-colors shadow-md"
            >
              Launch Projector Screen
            </button>
          </form>
        </div>
      </div>
    );
  }

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-hidden">
      {/* SCHNEIDER ELECTRIC BRANDED HEADER */}
      <header className="flex items-center justify-between p-5 bg-white border-b-4 border-[#00E676] shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/se-logo.png"
            alt="Schneider Electric"
            className="w-12 h-12 object-contain drop-shadow-sm"
          />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Schneider <span className="text-[#009639]">Electric</span>
            </h1>
            <p className="text-xs font-bold text-[#009639] uppercase tracking-widest">
              CCSH MSS OPERATIONS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <img
            src="/cyber-shield-logo.png"
            alt="Cyber Security Shield"
            className="w-16 h-16 lg:w-20 lg:h-20 object-contain drop-shadow-md"
          />

          <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-300 py-2 px-5 rounded-full shadow-sm">
            <HelpCircle className="w-5 h-5 text-[#009639]" />
            <span className="text-xl font-bold font-mono text-slate-800">{totalQuestions}</span>
            <span className="text-slate-600 uppercase text-xs font-extrabold tracking-wider">Questions</span>
          </div>

          <div className="flex items-center gap-3 bg-[#00E676]/20 py-2 px-6 rounded-full border border-[#009639]/30">
            <Users className="w-6 h-6 text-[#009639]" />
            <span className="text-2xl font-bold font-mono text-[#009639]">{participantCount}</span>
            <span className="text-[#009639] uppercase text-xs font-extrabold tracking-wider">Players</span>
          </div>

          <div className="flex items-center gap-3 bg-slate-100 border border-slate-300 py-2 px-8 rounded-full shadow-sm">
            <Hash className="w-6 h-6 text-slate-700" />
            <span className="text-3xl font-black font-mono tracking-widest text-slate-800">{roomPin}</span>
          </div>
        </div>
      </header>

      {/* MAIN STAGE CONTENT AREA */}
      <main className="flex-grow p-8 flex flex-col relative overflow-hidden">
        {/* LOBBY STATE (QR Code & Join Info) */}
        {gameState === 'LOBBY' && !showRulesInLobby && (
          <div className="flex-grow flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-14 w-full max-w-4xl flex flex-col md:flex-row items-center gap-14 shadow-xl relative overflow-hidden">
              <div className="flex-1 text-center md:text-left z-10">
                <ShieldCheck className="w-20 h-20 text-[#009639] mb-6 mx-auto md:mx-0" />
                <h2 className="text-5xl font-black mb-6 leading-tight text-slate-900">
                  Fastest Finger First <br/>
                  <span className="text-[#009639]">MCQ Challenge</span>
                </h2>
                <p className="text-xl text-slate-600 mb-8 font-medium">Scan the QR code to join on your mobile device and prepare for the quiz round.</p>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="inline-flex items-center gap-4 bg-slate-50 border border-slate-300 py-3.5 px-7 rounded-2xl shadow-inner">
                    <span className="text-slate-600 text-sm uppercase tracking-widest font-bold">Room Join PIN</span>
                    <span className="text-3xl font-black font-mono text-[#009639]">{roomPin}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRulesInLobby(true)}
                    className="inline-flex items-center gap-2 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white text-xs font-black px-4 py-3.5 rounded-2xl shadow transition-all"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>View Rules & Interface Guide</span>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center z-10">
                <div className="bg-white p-5 rounded-3xl border-4 border-[#009639]/20 shadow-2xl mb-4">
                  {participantUrl && (
                    <QRCodeSVG
                      value={participantUrl}
                      size={260}
                      level="H"
                      includeMargin={false}
                      fgColor="#0F172A"
                    />
                  )}
                </div>

                {/* Host IP / Host config input */}
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-slate-600 font-bold">QR IP / Host:</span>
                  <input
                    type="text"
                    value={customHost}
                    onChange={(e) => handleHostChange(e.target.value)}
                    placeholder="e.g. 192.168.1.50"
                    className="bg-white border border-slate-300 text-[#009639] font-mono font-bold px-2.5 py-1 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#00E676] w-36 text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RULES / INTERFACE GUIDE STATE */}
        {(gameState === 'RULES' || (gameState === 'LOBBY' && showRulesInLobby)) && (
          <div className="flex-grow flex flex-col h-full">
            {gameState === 'LOBBY' && (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowRulesInLobby(false)}
                  className="text-xs text-slate-700 hover:text-slate-950 font-bold bg-white border border-slate-300 px-3 py-1.5 rounded-xl shadow-sm transition-all"
                >
                  ← Back to QR Lobby
                </button>
              </div>
            )}
            <ProjectorRulesGuide />
          </div>
        )}

        {/* STAGE QUIZ ENDED WAITING SCREEN */}
        {gameState === 'QUIZ_ENDED' && (
          <div className="flex-grow flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-12 w-full shadow-2xl space-y-6 relative overflow-hidden">
              <div className="w-24 h-24 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-500 mx-auto flex items-center justify-center shadow-lg animate-bounce">
                <Trophy className="w-14 h-14" />
              </div>
              <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                Quiz Completed!
              </h2>
              <p className="text-2xl text-slate-600 max-w-xl mx-auto font-medium">
                The host is currently reviewing, verifying, and approving the official podium results.
              </p>
              <div className="inline-flex items-center gap-3 bg-[#00E676]/20 border border-[#009639]/30 text-[#009639] font-black text-lg px-8 py-4 rounded-2xl shadow-inner animate-pulse">
                <Clock className="w-6 h-6" />
                <span>Final Results Coming Up Shortly...</span>
              </div>
            </div>
          </div>
        )}

        {/* STAGE RESULTS PUBLISHED GRAND PODIUM */}
        {gameState === 'RESULTS_PUBLISHED' && publishedResults && (
          <div className="flex flex-col h-full w-full max-w-7xl mx-auto space-y-6 overflow-y-auto pr-1">
            {/* Top Banner & Grand Champion Hero Card */}
            <div className="bg-gradient-to-r from-emerald-600 via-[#009639] to-teal-700 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden border-4 border-[#00E676]">
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-amber-300 shadow-xl shrink-0">
                    <Crown className="w-14 h-14" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-[#00E676] mb-2 border border-white/30">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Official Event Champion • Ranked by Score & Speed Tie-Breaker</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-md">
                      {publishedResults.grandChampion ? publishedResults.grandChampion.name : (publishedResults.champion?.name || 'Participant')}
                    </h2>
                    {(publishedResults.grandChampion?.tieBrokenByTime || publishedResults.champion?.tieBrokenByTime) && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-400 text-amber-950 px-3 py-0.5 rounded-full text-xs font-extrabold shadow">
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Won Tie-Breaker: Faster response time than tied competitor!</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/20">
                  <div className="text-center px-4">
                    <p className="text-xs uppercase font-bold text-white/75">Final Score</p>
                    <p className="text-4xl font-black font-mono text-[#00E676]">
                      {publishedResults.grandChampion ? publishedResults.grandChampion.score : (publishedResults.champion?.score || 0)} pts
                    </p>
                  </div>
                  <div className="h-12 w-px bg-white/20" />
                  <div className="text-center px-4">
                    <p className="text-xs uppercase font-bold text-white/75">Total Speed</p>
                    <p className="text-3xl font-black font-mono text-white">
                      {publishedResults.grandChampion?.totalTimeFormatted || publishedResults.champion?.totalTimeFormatted || '--'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1st Place */}
              <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-300 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                      🥇 1st Place (Champion)
                    </span>
                    <Crown className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {publishedResults.top3?.[0]?.name || publishedResults.grandChampion?.name || publishedResults.champion?.name || 'TBD'}
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-3xl font-mono font-black text-[#009639]">
                      {publishedResults.top3?.[0]?.score ?? publishedResults.champion?.score ?? 0} pts
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      ({publishedResults.top3?.[0]?.correctCount ?? publishedResults.champion?.correctCount ?? 0} Correct)
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    Speed: {publishedResults.top3?.[0]?.totalTimeFormatted || publishedResults.champion?.totalTimeFormatted || '--'}
                  </p>
                </div>
              </div>

              {/* 2nd Place */}
              <div className="bg-gradient-to-b from-slate-50 to-white border-2 border-slate-200 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                      🥈 2nd Place (Runner-Up)
                    </span>
                    <Trophy className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {publishedResults.top3?.[1]?.name || publishedResults.runnerUp?.name || 'TBD'}
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-3xl font-mono font-black text-slate-700">
                      {publishedResults.top3?.[1]?.score ?? publishedResults.runnerUp?.score ?? 0} pts
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      ({publishedResults.top3?.[1]?.correctCount ?? publishedResults.runnerUp?.correctCount ?? 0} Correct)
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    Speed: {publishedResults.top3?.[1]?.totalTimeFormatted || publishedResults.runnerUp?.totalTimeFormatted || '--'}
                  </p>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="bg-gradient-to-b from-amber-50/40 to-white border-2 border-amber-200/70 rounded-3xl p-6 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-100/70 px-3 py-1 rounded-full">
                      🥉 3rd Place
                    </span>
                    <Award className="w-6 h-6 text-amber-700" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {publishedResults.top3?.[2]?.name || publishedResults.thirdPlace?.name || 'TBD'}
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-3xl font-mono font-black text-amber-800">
                      {publishedResults.top3?.[2]?.score ?? publishedResults.thirdPlace?.score ?? 0} pts
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      ({publishedResults.top3?.[2]?.correctCount ?? publishedResults.thirdPlace?.correctCount ?? 0} Correct)
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    Speed: {publishedResults.top3?.[2]?.totalTimeFormatted || publishedResults.thirdPlace?.totalTimeFormatted || '--'}
                  </p>
                </div>
              </div>
            </div>

            {/* Official Final Leaderboard Table */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  <span>Official Final Leaderboard</span>
                </h3>
                <span className="text-xs font-extrabold uppercase bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                  Ranked by Score • Tie-breaker: Faster Response Time
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-xs text-slate-400 uppercase font-extrabold">
                      <th className="pb-3">Rank</th>
                      <th className="pb-3">Participant</th>
                      <th className="pb-3 text-center">Correct</th>
                      <th className="pb-3 text-center">Wrong (-50)</th>
                      <th className="pb-3 text-right">Total Speed</th>
                      <th className="pb-3 text-right">Final Score</th>
                      <th className="pb-3 text-right">Tie-Breaker</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-base">
                    {(publishedResults.leaderboard || publishedResults.leaderboardByScore)?.slice(0, 10).map((p: any, idx: number) => (
                      <tr key={idx} className={idx === 0 ? 'bg-amber-50/60 font-bold' : ''}>
                        <td className="py-3 font-mono text-sm font-black text-slate-500">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>
                        <td className="py-3 font-extrabold text-slate-900">{p.name}</td>
                        <td className="py-3 text-center text-xs font-bold text-emerald-600">
                          {p.correctCount || 0}
                        </td>
                        <td className="py-3 text-center text-xs font-bold text-red-500">
                          {p.wrongCount || 0}
                        </td>
                        <td className="py-3 text-right font-mono text-sm text-slate-500">{p.totalTimeFormatted || '--'}</td>
                        <td className="py-3 text-right font-mono font-black text-xl text-[#009639]">{p.score} pts</td>
                        <td className="py-3 text-right">
                          {p.tieBrokenByTime ? (
                            <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Zap className="w-3 h-3 text-blue-600" /> Faster Time
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE QUESTION VIEW */}
        {gameState !== 'LOBBY' && gameState !== 'QUIZ_ENDED' && gameState !== 'RESULTS_PUBLISHED' && currentQuestion && (
          <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
            {/* Top Bar: Category & Status Badges */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-[#009639] text-white px-5 py-2 rounded-full text-sm font-black uppercase tracking-wider shadow-sm">
                  Question {currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions || totalQuestions}
                </div>
                <div className="bg-[#00E676]/20 text-[#009639] border border-[#009639]/30 px-5 py-2 rounded-full text-sm font-extrabold uppercase tracking-wider">
                  {currentQuestion.category}
                </div>
              </div>
              
              {gameState === 'READING' && (
                <div className="flex items-center gap-4 bg-amber-50 border-2 border-amber-300 rounded-2xl px-6 py-3 shadow-md">
                  <Timer className={`w-8 h-8 ${countdown <= 3 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`} />
                  <span className={`text-3xl font-mono font-black ${countdown <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                    10s Reading ({countdown}s)
                  </span>
                </div>
              )}
              
              {gameState === 'ANSWERING' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-[#00E676]/20 border border-[#009639]/40 rounded-2xl px-5 py-3 shadow-md">
                    <Users className="w-6 h-6 text-[#009639]" />
                    <span className="text-xl font-black font-mono text-[#009639]">
                      {progressData.answeredCount} / {progressData.participantCount || participantCount} Answered
                    </span>
                  </div>
                  {countdown > 0 && !isAnsweringClosed ? (
                    <div className="flex items-center gap-3 bg-gradient-to-r from-[#00E676] to-[#009639] text-white rounded-2xl px-6 py-3 shadow-lg animate-pulse">
                      <Timer className="w-8 h-8 text-white" />
                      <span className="text-3xl font-black font-mono tracking-wider">
                        {countdown}s
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl px-5 py-3 shadow-md">
                      <Clock className="w-6 h-6 text-amber-700 animate-pulse" />
                      <span className="text-lg font-black tracking-wide uppercase">
                        Answering Closed • Waiting for Host to Reveal
                      </span>
                    </div>
                  )}
                </div>
              )}

              {gameState === 'REVEAL' && (
                <div className="flex items-center gap-3 bg-emerald-50 border-2 border-[#009639] rounded-2xl px-6 py-3">
                  <CheckCircle2 className="w-8 h-8 text-[#009639]" />
                  <span className="text-2xl font-black text-[#009639] tracking-wider uppercase">
                    Answer Revealed
                  </span>
                </div>
              )}
            </div>

            {/* Question Text Card */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 md:p-6 mb-4 shadow-md relative overflow-hidden shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#009639]" />
              <h2 className="text-2xl md:text-3xl font-black leading-snug text-slate-900">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Interactive Question Visual (Widescreen Projector View) */}
            {currentQuestion.type && currentQuestion.type !== 'theory' && (
              <div className="mb-4 shrink-0">
                <InteractiveQuestionVisual
                  type={currentQuestion.type}
                  visualData={currentQuestion.visualData}
                  revealVisual={revealResult?.revealVisual || (currentQuestion as any).revealVisual}
                  isReveal={gameState === 'REVEAL'}
                  compact={false}
                />
              </div>
            )}

            {/* MCQ Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4 flex-grow">
              {currentQuestion.options.map((option, index) => {
                let isCorrect = false;
                let isWrong = false;
                
                if (gameState === 'REVEAL' && revealResult) {
                  isCorrect = index === revealResult.correctAnswerIndex;
                  isWrong = !isCorrect;
                }

                return (
                  <div
                    key={index}
                    className={`
                      relative p-4 md:p-5 rounded-2xl border-2 flex items-center gap-4 transition-all duration-300
                      ${isCorrect ? 'bg-[#00E676]/20 border-[#009639] shadow-lg z-10 scale-[1.01] text-[#009639]' : ''}
                      ${isWrong ? 'bg-slate-50 border-slate-200 opacity-50 text-slate-400' : ''}
                      ${!isCorrect && !isWrong ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : ''}
                    `}
                  >
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-xl text-lg font-black shrink-0
                      ${isCorrect ? 'bg-[#009639] text-white' : 'bg-slate-100 text-slate-700'}
                    `}>
                      {optionLabels[index]}
                    </div>
                    <span className={`text-lg md:text-xl font-bold ${isCorrect ? 'text-[#009639]' : 'text-slate-800'}`}>
                      {option}
                    </span>
                    {isCorrect && (
                      <CheckCircle2 className="absolute right-5 w-8 h-8 text-[#009639]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* REVEAL EXPLANATION & PROMINENT PER-QUESTION WINNER (PROJECTOR SCREEN ONLY) */}
            {gameState === 'REVEAL' && revealResult && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 shrink-0 mb-2">
                {/* Official Explanation Card */}
                <div className="md:col-span-5 bg-white border-2 border-slate-200 p-6 rounded-3xl flex flex-col justify-center shadow-md">
                  <h4 className="text-xs uppercase tracking-widest text-[#009639] font-black mb-2 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> Official Explanation
                  </h4>
                  <p className="text-base text-slate-800 font-semibold leading-relaxed">
                    {revealResult.explanation}
                  </p>
                </div>

                {/* Per-Question Winner & Total Right Answers Card (Projector Screen Only) */}
                <div className="md:col-span-7 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 border-4 border-amber-300 p-6 rounded-3xl flex items-center justify-between gap-4 shadow-2xl animate-in zoom-in-95 duration-300">
                  {revealResult.winner ? (
                    <div className="flex items-center justify-between gap-4 w-full">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-16 h-16 rounded-2xl bg-white/40 flex items-center justify-center shrink-0 shadow-inner">
                          <Trophy className="w-10 h-10 text-amber-900 animate-bounce" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-black uppercase tracking-wider text-amber-900/90 bg-white/50 px-3 py-0.5 rounded-full inline-flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-amber-900" /> 1st Correct by Time
                          </span>
                          <h3 className="text-3xl font-black text-slate-950 leading-tight truncate">
                            {revealResult.winner.name}
                          </h3>
                          <p className="text-sm font-bold text-amber-950 mt-0.5 flex items-center gap-1.5 font-mono">
                            <Clock className="w-4 h-4 text-amber-900" /> Response Time: <span className="font-black text-slate-950">{revealResult.winner.timeFormatted}</span>
                          </p>
                        </div>
                      </div>

                      {/* Total Count of People Who Answered Right */}
                      <div className="bg-white/40 backdrop-blur-sm border-2 border-white/60 rounded-2xl px-5 py-3 flex flex-col items-center justify-center shrink-0 shadow-sm text-center min-w-[130px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/90 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" /> Total Right
                        </span>
                        <div className="text-3xl font-black text-slate-950 leading-none mt-1">
                          {revealResult.totalCorrectCount ?? revealResult.winner.totalCorrectCount ?? 1}
                        </div>
                        <span className="text-[10px] font-bold text-amber-950/80 mt-1">
                          {revealResult.totalAnsweredCount ? `of ${revealResult.totalAnsweredCount} answered` : 'correct answers'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 w-full">
                      <div className="py-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-900/90 bg-white/40 px-3 py-0.5 rounded-full inline-block mb-1">
                          Question Result
                        </span>
                        <h3 className="text-2xl font-black text-slate-950 leading-tight">No Correct Answers</h3>
                        <p className="text-xs text-amber-900 font-semibold mt-0.5">No participant answered correctly this round</p>
                      </div>
                      <div className="bg-white/40 backdrop-blur-sm border-2 border-white/60 rounded-2xl px-5 py-3 flex flex-col items-center justify-center shrink-0 shadow-sm text-center min-w-[130px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/90 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-900" /> Total Right
                        </span>
                        <div className="text-3xl font-black text-slate-950 leading-none mt-1">
                          0
                        </div>
                        <span className="text-[10px] font-bold text-amber-950/80 mt-1">
                          {revealResult.totalAnsweredCount ? `of ${revealResult.totalAnsweredCount} answered` : '0 answered right'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-medium">Loading Projector Display...</div>}>
      <ProjectorComponent />
    </Suspense>
  );
}
