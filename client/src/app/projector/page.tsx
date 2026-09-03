'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import { ShieldCheck, Users, Timer, Trophy, CheckCircle2, Zap, Hash, HelpCircle, UserCheck, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

interface Question {
  questionIndex: number;
  question: string;
  options: string[];
  category: string;
  durationSeconds: number;
}

interface RevealResult {
  correctAnswerIndex: number;
  correctOptionText: string;
  explanation: string;
  winner?: {
    socketId: string;
    name: string;
    timeFormatted: string;
    turnNumber: number;
  } | null;
  leaderboard: Array<{ name: string; score: number }>;
}

function ProjectorComponent() {
  const searchParams = useSearchParams();
  const roomPin = searchParams.get('pin');

  const [participantCount, setParticipantCount] = useState(0);
  const [gameState, setGameState] = useState<'LOBBY' | 'READING' | 'BUZZER_UNLOCKED' | 'ANSWERING' | 'REVEAL'>('LOBBY');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [countdown, setCountdown] = useState(10);
  
  const [buzzerQueue, setBuzzerQueue] = useState<any[]>([]);
  const [currentAnswerer, setCurrentAnswerer] = useState<any>(null);
  const [revealResult, setRevealResult] = useState<RevealResult | null>(null);
  const [participantUrl, setParticipantUrl] = useState('');

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerConfettiExplosion = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#00E676', '#009639', '#FFFFFF', '#FFD700'] });
      confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#00E676', '#009639', '#FFFFFF', '#FFD700'] });
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

  useEffect(() => {
    if (!roomPin) return;

    const socket = getSocket();
    socket.emit('join_room', { roomPin, name: 'Projector', role: 'projector' }, (res: any) => {
      if (res?.success) {
        if (res.gameState) setGameState(res.gameState);
        if (res.activeQuestion) setCurrentQuestion(res.activeQuestion);
        if (res.buzzerQueue) setBuzzerQueue(res.buzzerQueue);
        if (res.currentAnswerer) setCurrentAnswerer(res.currentAnswerer);
      }
    });

    socket.on('room_updated', (data: any) => {
      setParticipantCount(data.participantCount || data.participants?.length || 0);
      if (data.gameState) setGameState(data.gameState);
      if (data.buzzerQueue) setBuzzerQueue(data.buzzerQueue);
      if (data.currentAnswerer) setCurrentAnswerer(data.currentAnswerer);
    });

    socket.on('question_pushed', (data: Question) => {
      setRevealResult(null);
      setBuzzerQueue([]);
      setCurrentAnswerer(null);
      setCountdown(data.durationSeconds || 10);
      setCurrentQuestion(data);
      setGameState('READING');

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

    socket.on('buzzer_unlocked', () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setGameState('BUZZER_UNLOCKED');
      setCountdown(0);
    });

    socket.on('buzzer_hit_recorded', (data: any) => {
      setBuzzerQueue(data.buzzerQueue || []);
      setCurrentAnswerer(data.activeAnswerer || null);
      if (data.activeAnswerer) setGameState('ANSWERING');
    });

    socket.on('turn_passed', (data: any) => {
      if (data.nextAnswerer) {
        setCurrentAnswerer(data.nextAnswerer);
        setGameState('ANSWERING');
      } else {
        setCurrentAnswerer(null);
        setGameState(data.gameState || 'BUZZER_UNLOCKED');
      }
    });

    socket.on('answer_revealed', (data: RevealResult) => {
      setGameState('REVEAL');
      setRevealResult(data);
      if (data.winner) {
        triggerConfettiExplosion();
      }
    });

    return () => {
      socket.off('room_updated');
      socket.off('question_pushed');
      socket.off('buzzer_unlocked');
      socket.off('buzzer_hit_recorded');
      socket.off('turn_passed');
      socket.off('answer_revealed');
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [roomPin]);

  const [inputPin, setInputPin] = useState('');

  if (!roomPin) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans p-6">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl max-w-md w-full text-center shadow-xl">
          <div className="p-3 bg-[#00E676]/20 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Zap className="w-10 h-10 text-[#009639]" />
          </div>
          <h2 className="text-2xl font-black mb-2 text-slate-900">Projector Display</h2>
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
          <div className="w-10 h-10 rounded-xl bg-[#009639] flex items-center justify-center text-white font-black text-xl shadow-md">
            SE
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Schneider <span className="text-[#009639]">Electric</span>
            </h1>
            <p className="text-xs font-bold text-[#009639] uppercase tracking-widest">
              Managed Security Services (MSS) Quiz
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
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
        {gameState === 'LOBBY' && (
          <div className="flex-grow flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-14 w-full max-w-4xl flex flex-col md:flex-row items-center gap-14 shadow-xl relative overflow-hidden">
              <div className="flex-1 text-center md:text-left z-10">
                <ShieldCheck className="w-20 h-20 text-[#009639] mb-6 mx-auto md:mx-0" />
                <h2 className="text-5xl font-black mb-6 leading-tight text-slate-900">
                  Fastest Finger First <br/>
                  <span className="text-[#009639]">MCQ Challenge</span>
                </h2>
                <p className="text-xl text-slate-600 mb-8 font-medium">Scan the QR code to join on your mobile device and prepare for the quiz round.</p>
                
                <div className="inline-flex items-center gap-4 bg-slate-50 border border-slate-300 py-3.5 px-7 rounded-2xl shadow-inner">
                  <span className="text-slate-600 text-sm uppercase tracking-widest font-bold">Room Join PIN</span>
                  <span className="text-3xl font-black font-mono text-[#009639]">{roomPin}</span>
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

        {gameState !== 'LOBBY' && currentQuestion && (
          <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
            {/* Top Bar: Category & Status Badges */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="bg-[#00E676]/20 text-[#009639] border border-[#009639]/30 px-6 py-2 rounded-full text-sm font-extrabold uppercase tracking-wider">
                {currentQuestion.category}
              </div>
              
              {gameState === 'READING' && (
                <div className="flex items-center gap-4 bg-amber-50 border-2 border-amber-300 rounded-2xl px-6 py-3 shadow-md">
                  <Timer className={`w-8 h-8 ${countdown <= 3 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`} />
                  <span className={`text-3xl font-mono font-black ${countdown <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                    10s Reading ({countdown}s)
                  </span>
                </div>
              )}
              
              {gameState === 'BUZZER_UNLOCKED' && (
                <div className="flex items-center gap-3 bg-[#00E676]/20 border-2 border-[#009639] rounded-2xl px-6 py-3 shadow-md animate-pulse">
                  <Zap className="w-8 h-8 text-[#009639]" />
                  <span className="text-3xl font-black text-[#009639] tracking-wider">
                    BUZZER LIVE!
                  </span>
                </div>
              )}

              {gameState === 'ANSWERING' && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-[#00E676] to-[#009639] text-white rounded-2xl px-6 py-3 shadow-lg animate-pulse">
                  <UserCheck className="w-8 h-8" />
                  <span className="text-2xl font-black tracking-wider">
                    Turn #{buzzerQueue.length}: {currentAnswerer?.name} is Answering...
                  </span>
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
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 mb-6 shadow-lg relative overflow-hidden shrink-0">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#009639]" />
              <h2 className="text-3xl md:text-4xl font-black leading-relaxed text-slate-900">
                {currentQuestion.question}
              </h2>
            </div>

            {/* MCQ Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 flex-grow">
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
                      relative p-6 rounded-2xl border-2 flex items-center gap-5 transition-all duration-300
                      ${isCorrect ? 'bg-[#00E676]/20 border-[#009639] shadow-xl z-10 scale-[1.02] text-[#009639]' : ''}
                      ${isWrong ? 'bg-slate-50 border-slate-200 opacity-50 text-slate-400' : ''}
                      ${!isCorrect && !isWrong ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : ''}
                    `}
                  >
                    <div className={`
                      flex items-center justify-center w-12 h-12 rounded-xl text-xl font-black shrink-0
                      ${isCorrect ? 'bg-[#009639] text-white' : 'bg-slate-100 text-slate-700'}
                    `}>
                      {optionLabels[index]}
                    </div>
                    <span className={`text-xl md:text-2xl font-bold ${isCorrect ? 'text-[#009639]' : 'text-slate-800'}`}>
                      {option}
                    </span>
                    {isCorrect && (
                      <CheckCircle2 className="absolute right-6 w-10 h-10 text-[#009639]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* REVEAL EXPLANATION & WINNER FOOTER */}
            {gameState === 'REVEAL' && revealResult && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 shrink-0 mb-2">
                {/* Official Explanation Card */}
                <div className="md:col-span-8 bg-white border-2 border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-md">
                  <h4 className="text-xs uppercase tracking-widest text-[#009639] font-black mb-2 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> Official Explanation
                  </h4>
                  <p className="text-lg text-slate-800 font-semibold leading-relaxed">
                    {revealResult.explanation}
                  </p>
                </div>

                {/* Winner Card */}
                <div className="md:col-span-4 bg-emerald-50 border-2 border-[#009639] p-6 rounded-2xl flex flex-col justify-center shadow-md">
                  {revealResult.winner ? (
                    <div className="flex items-center gap-4">
                      <Trophy className="w-12 h-12 text-[#009639] shrink-0" />
                      <div>
                        <p className="text-xs uppercase tracking-widest text-[#009639] font-black">Fastest Correct Answer</p>
                        <h3 className="text-2xl font-black text-slate-900">{revealResult.winner.name}</h3>
                        <p className="text-xs text-slate-600 font-mono font-bold mt-0.5">{revealResult.winner.timeFormatted} (Attempt #{revealResult.winner.turnNumber})</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-600 text-base font-bold">
                      No correct answers this round
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
