'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import { ShieldCheck, Timer, Zap, CheckCircle2, XCircle, Clock, Send, Lock, Volume2, UserCheck, AlertTriangle, Trophy, Crown, Sparkles, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

function ParticipantComponent() {
  const searchParams = useSearchParams();
  const [pin, setPin] = useState(searchParams?.get('pin') || '');
  const [name, setName] = useState(searchParams?.get('name') || '');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  
  // Game States: 'LOBBY', 'READING', 'BUZZER_UNLOCKED', 'ANSWERING', 'REVEAL', 'HOST_CONTROL', 'QUIZ_ENDED', 'RESULTS_PUBLISHED'
  const [gameState, setGameState] = useState('LOBBY');
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [countdown, setCountdown] = useState(10);
  
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [buzzedPosition, setBuzzedPosition] = useState<number | null>(null);
  const [buzzedTime, setBuzzedTime] = useState('');
  
  const [buzzerQueue, setBuzzerQueue] = useState<any[]>([]);
  const [currentAnswerer, setCurrentAnswerer] = useState<any>(null);
  
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [revealResult, setRevealResult] = useState<any>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [hasWonThisQuestion, setHasWonThisQuestion] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [publishedResults, setPublishedResults] = useState<any>(null);

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

  useEffect(() => {
    const socket = getSocket();

    socket.on('room_updated', (roomData) => {
      setJoined(true);
      setError('');
      if (roomData?.gameState) {
        setGameState(roomData.gameState);
      }
      if (roomData?.currentAnswerer) {
        setCurrentAnswerer(roomData.currentAnswerer);
      }
      if (roomData?.totalQuestions) {
        setTotalQuestions(roomData.totalQuestions);
      }
    });

    socket.on('question_pushed', (data) => {
      setActiveQuestion(data);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setCountdown(data.durationSeconds || 10);
      setHasBuzzed(false);
      setBuzzedPosition(null);
      setBuzzedTime('');
      setBuzzerQueue([]);
      setCurrentAnswerer(null);
      setSelectedOption(null);
      setAnswerResult(null);
      setRevealResult(null);
      setHasFailed(false);
      setHasWonThisQuestion(false);
      setGameState('READING');
    });

    socket.on('question_limit_updated', (data: any) => {
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
    });

    socket.on('buzzer_unlocked', () => {
      setGameState('BUZZER_UNLOCKED');
      setCountdown(0);
    });

    socket.on('buzzer_hit_recorded', (data) => {
      setBuzzerQueue(data.buzzerQueue || []);
      setCurrentAnswerer(data.activeAnswerer || null);
      if (data.activeAnswerer) {
        setGameState('ANSWERING');
      }
    });

    socket.on('turn_passed', (data) => {
      if (data.nextAnswerer) {
        setCurrentAnswerer(data.nextAnswerer);
        setGameState('ANSWERING');
      } else {
        setCurrentAnswerer(null);
        setGameState(data.gameState || 'BUZZER_UNLOCKED');
      }
    });

    socket.on('answer_revealed', (data) => {
      setRevealResult(data);
      setGameState('REVEAL');
    });

    socket.on('quiz_ended', () => {
      setGameState('QUIZ_ENDED');
    });

    socket.on('quiz_results_published', (data) => {
      setGameState('RESULTS_PUBLISHED');
      setPublishedResults(data);
      triggerConfettiExplosion();
    });

    return () => {
      socket.off('room_updated');
      socket.off('question_pushed');
      socket.off('question_limit_updated');
      socket.off('buzzer_unlocked');
      socket.off('buzzer_hit_recorded');
      socket.off('turn_passed');
      socket.off('answer_revealed');
      socket.off('quiz_ended');
      socket.off('quiz_results_published');
    };
  }, []);

  // Countdown timer for 10s reading phase
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'READING' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState, countdown]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !name) {
      setError('Please enter both PIN and Name');
      return;
    }
    const socket = getSocket();
    socket.emit('join_room', { roomPin: pin, name, role: 'participant' }, (res: any) => {
      if (res?.success) {
        setJoined(true);
        if (res.gameState) setGameState(res.gameState);
        if (res.activeQuestion) setActiveQuestion(res.activeQuestion);
        if (res.totalQuestions) setTotalQuestions(res.totalQuestions);
        if (res.buzzerQueue) setBuzzerQueue(res.buzzerQueue);
        if (res.currentAnswerer) setCurrentAnswerer(res.currentAnswerer);
        if (res.hasBuzzed) setHasBuzzed(true);
        if (res.hasFailed) setHasFailed(true);
        if (res.myStats?.score !== undefined) setMyScore(res.myStats.score);
        if (res.resultsPublished && res.finalResults) {
          setGameState('RESULTS_PUBLISHED');
          setPublishedResults(res.finalResults);
        }
      } else {
        setError(res?.message || 'Failed to join room');
      }
    });
  };

  const handleBuzzerPress = () => {
    if (gameState !== 'BUZZER_UNLOCKED' && gameState !== 'ANSWERING') return;
    if (hasBuzzed || hasFailed) return;

    const socket = getSocket();
    socket.emit('hit_buzzer', { roomPin: pin }, (res: any) => {
      if (res?.success) {
        setHasBuzzed(true);
        setBuzzedPosition(res.position);
        setBuzzedTime(res.timeFormatted);
      } else {
        setError(res?.message || 'Failed to hit buzzer');
      }
    });
  };

  const handleOptionClick = (index: number) => {
    const socket = getSocket();
    const isMyTurn = currentAnswerer?.socketId === socket.id;
    if (gameState !== 'ANSWERING' || !isMyTurn || selectedOption !== null) return;

    setSelectedOption(index);
    socket.emit('submit_answer', { roomPin: pin, optionIndex: index }, (res: any) => {
      if (res?.success) {
        setAnswerResult(res);
        if (res.currentScore !== undefined) setMyScore(res.currentScore);
        if (res.isCorrect || res.hasWonThisQuestion) {
          setHasWonThisQuestion(true);
        } else {
          setHasFailed(true);
        }
      } else {
        setError(res?.message || 'Failed to submit answer');
      }
    });
  };

  const letters = ['A', 'B', 'C', 'D'];
  const socket = getSocket();
  const isMyTurn = currentAnswerer?.socketId === socket.id;

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col items-center mb-8">
            <ShieldCheck className="w-16 h-16 text-[#009639] mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Join Quiz Session</h1>
            <p className="text-sm text-gray-500 mt-1">Schneider Electric MSS Quiz</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room PIN</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                placeholder="e.g. 123456"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#009639] focus:ring-2 focus:ring-[#00E676]/30 outline-none uppercase font-mono text-center text-2xl tracking-widest font-bold"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#009639] focus:ring-2 focus:ring-[#00E676]/30 outline-none font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#009639] hover:bg-[#00E676] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-md transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
              Enter Lobby
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md mx-auto space-y-5">
        
        {/* Top Player Info Header */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between border border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Player</p>
            <p className="font-bold text-gray-900 text-lg">{name}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Score</p>
            <p className="font-bold text-amber-600 text-xl">{myScore} <span className="text-xs font-medium text-gray-400">pts</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Room</p>
            <p className="font-mono font-bold text-[#009639] text-xl">{pin}</p>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* LOBBY State */}
        {gameState === 'LOBBY' && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
            <div className="animate-pulse flex justify-center mb-4">
              <Zap className="w-16 h-16 text-[#009639]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You are in the Lobby!</h2>
            <p className="text-gray-500 text-sm mb-4">Waiting for the host to push the first question...</p>
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{totalQuestions} Questions in this round</span>
            </div>
          </div>
        )}

        {/* QUIZ_ENDED Waiting Screen */}
        {gameState === 'QUIZ_ENDED' && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100 space-y-4">
            <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center animate-bounce">
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Quiz Completed!</h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Great effort! The host is reviewing the scores and response times. Official results will be published shortly...
            </p>
            <div className="pt-4 border-t border-gray-100 flex justify-around">
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold">Your Final Score</p>
                <p className="text-2xl font-black text-[#009639]">{myScore} pts</p>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS_PUBLISHED State */}
        {gameState === 'RESULTS_PUBLISHED' && publishedResults && (
          <div className="space-y-5 animate-in fade-in duration-500">
            {/* Grand Champion Banner */}
            <div className="bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 rounded-3xl p-6 text-white text-center shadow-xl relative overflow-hidden">
              <div className="absolute top-2 right-3 opacity-20">
                <Crown className="w-24 h-24" />
              </div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3">
                <Sparkles className="w-4 h-4 text-yellow-200" />
                <span>
                  Official Champion • Ranked by Score & Speed Tie-Breaker
                </span>
              </div>
              <h2 className="text-3xl font-black mb-1 drop-shadow-sm">
                {publishedResults.grandChampion ? publishedResults.grandChampion.name : (publishedResults.champion?.name || 'Grand Champion')}
              </h2>
              <p className="text-white/90 text-sm font-semibold">
                {publishedResults.grandChampion?.score ?? publishedResults.champion?.score ?? 0} pts • {publishedResults.grandChampion?.correctCount ?? publishedResults.champion?.correctCount ?? 0} Correct • Total Speed {publishedResults.grandChampion?.totalTimeFormatted || publishedResults.champion?.totalTimeFormatted || '--'}
              </p>

              {(publishedResults.grandChampion?.tieBrokenByTime || publishedResults.champion?.tieBrokenByTime) && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/25 px-3 py-0.5 rounded-full text-xs font-bold text-white">
                  <Zap className="w-3.5 h-3.5 text-yellow-200" />
                  <span>⚡ Won tie-breaker via faster response time!</span>
                </div>
              )}

              {(publishedResults.grandChampion?.name || publishedResults.champion?.name)?.toLowerCase() === name?.toLowerCase() && (
                <div className="mt-4 inline-block bg-white text-amber-700 font-black px-4 py-2 rounded-xl text-sm shadow-md animate-bounce">
                  🎉 YOU ARE THE CHAMPION! 🎉
                </div>
              )}
            </div>

            {/* My Performance Card */}
            {(() => {
              const activeList = publishedResults.leaderboard || publishedResults.leaderboardByScore || [];
              const myRank = activeList.findIndex(
                (p: any) => p.name?.toLowerCase() === name?.toLowerCase()
              ) + 1;
              const myData = activeList.find(
                (p: any) => p.name?.toLowerCase() === name?.toLowerCase()
              );

              return (
                <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Your Performance Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <p className="text-xs text-gray-500 font-medium">Final Score</p>
                      <p className="text-xl font-black text-[#009639]">{myData?.score ?? myScore} pts</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs text-gray-500 font-medium">Final Rank</p>
                      <p className="text-xl font-black text-amber-600">
                        {myRank > 0 ? `#${myRank}` : '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs text-gray-500 font-medium">Total Speed</p>
                      <p className="text-sm font-black text-blue-600 mt-1">
                        {myData?.totalTimeFormatted || '--'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Winners by Question Breakdown */}
            {publishedResults.questionWinners && publishedResults.questionWinners.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 space-y-3">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Award className="w-5 h-5 text-[#009639]" />
                  <h3 className="font-bold text-gray-900 text-sm">Winners by Question</h3>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {publishedResults.questionWinners.map((w: any, idx: number) => {
                    const winnerName = w.winner?.name || w.winnerName;
                    const timeFormatted = w.winner?.timeFormatted || w.timeFormatted;
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                            Q{w.questionIndex + 1}
                          </span>
                          <span className="font-bold text-gray-800">{winnerName || 'Unclaimed'}</span>
                        </div>
                        {timeFormatted && (
                          <span className="font-mono text-emerald-600 font-semibold">{timeFormatted}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Leaderboard */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-gray-900 text-sm">Official Leaderboard</h3>
                </div>
                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  Ranked by Score • Tie-breaker: Faster Time
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(publishedResults.leaderboard || publishedResults.leaderboardByScore)?.slice(0, 10).map((player: any, idx: number) => {
                  const isMe = player.name?.toLowerCase() === name?.toLowerCase();
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold ${
                        isMe 
                          ? 'bg-green-50 border-[#009639] text-[#009639]' 
                          : idx === 0 
                            ? 'bg-amber-50 border-amber-200 text-amber-900' 
                            : 'bg-gray-50 border-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <span>{player.name} {isMe && '(You)'}</span>
                        {player.tieBrokenByTime && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                            ⚡ Faster Time
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-gray-900">{player.score} pts</span>
                        <span className="text-[10px] text-gray-400 ml-2">
                          {player.totalTimeFormatted || ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active Question Flow */}
        {gameState !== 'LOBBY' && gameState !== 'QUIZ_ENDED' && gameState !== 'RESULTS_PUBLISHED' && activeQuestion && (
          <div className="space-y-5">
            
            {/* Question Info Card */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 relative overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#009639] text-white text-xs font-black uppercase tracking-wider rounded-full shadow-sm">
                    Question {activeQuestion.questionIndex + 1} of {activeQuestion.totalQuestions || totalQuestions}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-full">
                    {activeQuestion.category}
                  </span>
                </div>
                
                {gameState === 'READING' && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-full text-sm">
                    <Timer className="w-4 h-4" />
                    <span>10s Reading ({countdown}s)</span>
                  </div>
                )}
                
                {(gameState === 'BUZZER_UNLOCKED' || gameState === 'ANSWERING') && (
                  <div className="flex items-center gap-1.5 text-[#009639] font-bold bg-green-50 px-3 py-1 rounded-full text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Buzzer Live!</span>
                  </div>
                )}

                {gameState === 'REVEAL' && (
                  <div className="flex items-center gap-1.5 text-gray-600 font-bold bg-gray-100 px-3 py-1 rounded-full text-sm">
                    <span>Question Over</span>
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 leading-snug">
                {activeQuestion.question}
              </h3>
            </div>

            {/* BUZZER BUTTON SECTION */}
            {gameState !== 'REVEAL' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                {gameState === 'READING' && (
                  <div className="flex flex-col items-center">
                    <button
                      disabled
                      className="w-36 h-36 rounded-full bg-gray-200 border-4 border-gray-300 text-gray-400 font-black text-lg flex flex-col items-center justify-center cursor-not-allowed shadow-inner"
                    >
                      <Lock className="w-8 h-8 mb-1" />
                      <span>LOCKED</span>
                    </button>
                    <p className="text-xs text-gray-400 mt-3 font-semibold">
                      Reading Time ({countdown}s) - Buzzer unlocks after timer
                    </p>
                  </div>
                )}

                {(gameState === 'BUZZER_UNLOCKED' || gameState === 'ANSWERING') && (
                  <div className="flex flex-col items-center">
                    {hasWonThisQuestion ? (
                      <div className="bg-green-50 border-2 border-[#009639] p-5 rounded-2xl text-green-900 w-full text-center shadow-md">
                        <div className="flex items-center justify-center gap-2 font-black text-lg text-[#009639] mb-1">
                          <Trophy className="w-7 h-7 text-amber-500" />
                          <span>Question Winner!</span>
                        </div>
                        <p className="text-xs font-semibold text-green-800">
                          You answered correctly first! +100 Points added to your total score. Get ready for the next question!
                        </p>
                      </div>
                    ) : !hasBuzzed && !hasFailed ? (
                      <button
                        onClick={handleBuzzerPress}
                        className="w-40 h-40 rounded-full bg-gradient-to-b from-[#00E676] to-[#009639] text-white font-black text-2xl flex flex-col items-center justify-center shadow-xl shadow-green-200 transform active:scale-90 transition-all hover:brightness-110 animate-pulse"
                      >
                        <Zap className="w-10 h-10 mb-1" />
                        <span>BUZZ!</span>
                      </button>
                    ) : null}

                    {hasBuzzed && !hasWonThisQuestion && (
                      <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-green-800 w-full">
                        <div className="flex items-center justify-center gap-2 font-bold text-lg">
                          <CheckCircle2 className="w-6 h-6 text-[#009639]" />
                          <span>Buzzer Pressed!</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Response Time: <span className="font-bold text-[#009639]">{buzzedTime}</span> (Position #{buzzedPosition})
                        </p>
                      </div>
                    )}

                    {hasFailed && !hasWonThisQuestion && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 w-full">
                        <div className="flex items-center justify-center gap-2 font-bold">
                          <XCircle className="w-5 h-5" />
                          <span>Attempt Failed</span>
                        </div>
                        <p className="text-xs text-red-600 mt-1">You answered incorrectly for this question.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* HOST CONTROL BANNER FOR DOUBLE WRONG ATTEMPTS */}
            {gameState === 'HOST_CONTROL' && (
              <div className="p-4 rounded-xl text-center shadow-sm font-bold bg-amber-50 border border-amber-300 text-amber-800 text-sm">
                Both top 2 attempts failed! Control passed to Host to reveal the answer.
              </div>
            )}

            {/* TURN STATUS BANNER */}
            {gameState === 'ANSWERING' && (
              <div className={`p-4 rounded-xl text-center shadow-sm font-bold ${
                isMyTurn 
                  ? 'bg-gradient-to-r from-[#00E676] to-[#009639] text-white text-lg animate-pulse' 
                  : 'bg-blue-50 text-blue-800 border border-blue-200 text-sm'
              }`}>
                {isMyTurn ? (
                  <div className="flex items-center justify-center gap-2">
                    <UserCheck className="w-6 h-6" />
                    <span>YOUR TURN! Select your answer below!</span>
                  </div>
                ) : (
                  <p>
                    Turn: <span className="underline">{currentAnswerer?.name}</span> is selecting an answer...
                  </p>
                )}
              </div>
            )}

            {/* MCQ OPTIONS LIST */}
            <div className="space-y-3">
              {activeQuestion.options?.map((optionText: string, idx: number) => {
                const isSelected = selectedOption === idx;
                
                let cardClass = "relative w-full text-left bg-white rounded-xl border-2 transition-all duration-200 p-4 flex items-center gap-4 overflow-hidden";
                let letterClass = "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors";
                
                let Icon = null;

                if (gameState === 'READING' || gameState === 'BUZZER_UNLOCKED' || (gameState === 'ANSWERING' && !isMyTurn)) {
                  // Disabled options for participants who aren't currently active answerer
                  cardClass += " border-gray-200 opacity-60 cursor-not-allowed";
                  letterClass += " bg-gray-100 text-gray-500";
                } 
                else if (gameState === 'ANSWERING' && isMyTurn) {
                  // Active for current answerer
                  if (isSelected) {
                    cardClass += " border-[#009639] bg-green-50";
                    letterClass += " bg-[#009639] text-white";
                    Icon = <CheckCircle2 className="w-5 h-5 text-[#009639] absolute right-4" />;
                  } else {
                    cardClass += " border-gray-200 hover:border-[#009639] hover:shadow-md cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0";
                    letterClass += " bg-gray-100 text-gray-700";
                  }
                }
                else if (gameState === 'REVEAL') {
                  const isCorrect = revealResult?.correctAnswerIndex === idx;
                  
                  if (isCorrect) {
                    cardClass += " border-[#009639] bg-green-50 shadow-sm font-bold text-[#009639]";
                    letterClass += " bg-[#009639] text-white";
                    Icon = <CheckCircle2 className="w-6 h-6 text-[#009639] absolute right-4" />;
                  } else if (isSelected && !isCorrect) {
                    cardClass += " border-red-500 bg-red-50 text-red-700";
                    letterClass += " bg-red-500 text-white";
                    Icon = <XCircle className="w-6 h-6 text-red-500 absolute right-4" />;
                  } else {
                    cardClass += " border-gray-200 opacity-50";
                    letterClass += " bg-gray-100 text-gray-400";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(idx)}
                    disabled={gameState !== 'ANSWERING' || !isMyTurn || selectedOption !== null}
                    className={cardClass}
                  >
                    <div className={letterClass}>{letters[idx]}</div>
                    <span className="font-medium text-gray-800 pr-8">{optionText}</span>
                    {Icon}
                  </button>
                );
              })}
            </div>

            {/* INDIVIDUAL ANSWER RESULT / REASONING FEEDBACK */}
            {answerResult && (
              <div className={`p-4 rounded-xl shadow-sm border ${
                answerResult.isCorrect 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-1 text-base">
                  {answerResult.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-[#009639]" />
                      <span>CORRECT! +100 Points 🎉</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span>
                        INCORRECT ANSWER {answerResult.pointsDeducted > 0 ? `(-${answerResult.pointsDeducted} Points)` : '(0 pts deducted - score cannot be negative)'}
                      </span>
                    </>
                  )}
                </div>
                
                {answerResult.optionExplanation && (
                  <p className="text-xs mt-2 p-2 bg-white/80 rounded-lg border border-current/10">
                    <span className="font-semibold">Reason:</span> {answerResult.optionExplanation}
                  </p>
                )}
                
                {answerResult.explanation && (
                  <p className="text-xs mt-1 italic text-gray-600">
                    "{answerResult.explanation}"
                  </p>
                )}
              </div>
            )}

            {/* FINAL REVEAL SUMMARY & EXPLANATION */}
            {gameState === 'REVEAL' && revealResult && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
                <h4 className="font-bold text-gray-900 border-b pb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#009639]" /> Round Explanation
                </h4>

                <p className="text-sm text-gray-700 leading-relaxed font-medium bg-green-50/50 p-3 rounded-xl border border-green-100">
                  {revealResult.explanation}
                </p>

                {revealResult.winner ? (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-xl text-center font-bold text-sm">
                    🏆 Winner: {revealResult.winner.name} ({revealResult.winner.timeFormatted})
                  </div>
                ) : (
                  <div className="bg-gray-100 text-gray-600 p-3 rounded-xl text-center text-xs font-semibold">
                    No correct answers this round.
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">Loading Participant Portal...</div>}>
      <ParticipantComponent />
    </Suspense>
  );
}
