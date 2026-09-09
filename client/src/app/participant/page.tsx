'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import { ShieldCheck, Timer, Zap, CheckCircle2, XCircle, Clock, Send, Lock, Volume2, UserCheck, AlertTriangle, Trophy, Crown, Sparkles, Award, LogOut, RotateCcw, Share2, Download, FileCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import CertificateModal from '../../components/CertificateModal';
import { CertificateData, generateVerificationId } from '../../lib/certificateGenerator';

const STORAGE_PIN = 'se_quiz_pin';
const STORAGE_NAME = 'se_quiz_name';
const STORAGE_PARTICIPANT_ID = 'se_quiz_participant_id';

function ParticipantComponent() {
  const searchParams = useSearchParams();
  const urlPin = searchParams?.get('pin') || '';
  const urlName = searchParams?.get('name') || '';
  const [pin, setPin] = useState(urlPin);
  const [name, setName] = useState(urlName);
  const [participantId, setParticipantId] = useState('');
  const [joined, setJoined] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(true);
  const [error, setError] = useState('');
  
  // Game States: 'LOBBY', 'READING', 'ANSWERING', 'REVEAL', 'QUIZ_ENDED', 'RESULTS_PUBLISHED'
  const [gameState, setGameState] = useState('LOBBY');
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [countdown, setCountdown] = useState(10);
  
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedTime, setSubmittedTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [revealResult, setRevealResult] = useState<any>(null);
  const [myScore, setMyScore] = useState(0);
  const [publishedResults, setPublishedResults] = useState<any>(null);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);

  const initialMountDone = useRef(false);

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

  const resetQuizState = () => {
    setGameState('LOBBY');
    setTotalQuestions(10);
    setActiveQuestion(null);
    setCountdown(10);
    setSelectedOption(null);
    setHasSubmitted(false);
    setSubmittedTime('');
    setIsSubmitting(false);
    setAnswerResult(null);
    setRevealResult(null);
    setMyScore(0);
    setPublishedResults(null);
    setIsCertificateOpen(false);
    setError('');
  };

  const getParticipantCertificateData = (): CertificateData => {
    const defaultData: CertificateData = {
      name: name || 'Participant',
      tier: 'participant',
      awardTitle: 'Certified Cyber Defender',
      rank: '-',
      score: myScore,
      totalQuestions,
      dateStr: '7 October 2026',
      locationStr: 'Avinya Campus, Bangalore'
    };

    if (!publishedResults) return defaultData;

    const myLower = (name || '').trim().toLowerCase();
    const allList = publishedResults.allRanks || publishedResults.leaderboard || publishedResults.leaderboardByScore || [];
    const myEntry = allList.find((p: any) => p.name?.trim().toLowerCase() === myLower);

    let myRank = myEntry?.rank;
    if (!myRank) {
      const idx = allList.findIndex((p: any) => p.name?.trim().toLowerCase() === myLower);
      if (idx !== -1) myRank = idx + 1;
      else myRank = '-';
    }

    const finalScore = myEntry?.score ?? myScore;
    const finalSpeed = myEntry?.totalTimeFormatted || '';
    const attemptedCount = myEntry?.attemptedCount || 0;

    // Check winner categories
    const isGrandChamp = (publishedResults.grandChampion?.name?.trim().toLowerCase() === myLower) ||
                         (publishedResults.champion?.name?.trim().toLowerCase() === myLower) ||
                         myRank === 1;

    const isRunnerUp = (publishedResults.top3?.[1]?.name?.trim().toLowerCase() === myLower) || myRank === 2;
    const isThirdPlace = (publishedResults.top3?.[2]?.name?.trim().toLowerCase() === myLower) || myRank === 3;
    const isBestLearner = publishedResults.bestLearnerWinner?.name?.trim().toLowerCase() === myLower;
    const isTieBreaker = publishedResults.tieBreakerWinner?.name?.trim().toLowerCase() === myLower;

    let tier: 'winner' | 'participant' = 'participant';
    let awardTitle = typeof myRank === 'number' ? `Cyber Defender • Rank #${myRank}` : 'Certified Cyber Defender';

    if (isGrandChamp) {
      tier = 'winner';
      awardTitle = 'Grand Champion • 1st Place';
    } else if (isRunnerUp) {
      tier = 'winner';
      awardTitle = '1st Runner Up • 2nd Place';
    } else if (isThirdPlace) {
      tier = 'winner';
      awardTitle = '2nd Runner Up • 3rd Place';
    } else if (isBestLearner) {
      tier = 'winner';
      awardTitle = 'Best Learner Award • Stage Qualifier';
    } else if (isTieBreaker) {
      tier = 'winner';
      awardTitle = 'Tie-Breaker Speed Champion';
    }

    return {
      name: name || 'Participant',
      tier,
      awardTitle,
      rank: myRank,
      totalParticipants: publishedResults.participantCount || allList.length,
      score: finalScore,
      speed: finalSpeed,
      attemptedCount,
      totalQuestions: publishedResults.totalQuestions || totalQuestions,
      verificationId: generateVerificationId(name || 'Participant', finalScore),
      dateStr: '7 October 2026',
      locationStr: 'Avinya Campus, Bangalore'
    };
  };

  const performJoin = (roomPinToUse: string, nameToUse: string, pIdToUse?: string) => {
    if (!roomPinToUse || !nameToUse) {
      setIsAutoConnecting(false);
      return;
    }
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join_room', {
      roomPin: roomPinToUse,
      name: nameToUse,
      participantId: pIdToUse || undefined,
      role: 'participant'
    }, (res: any) => {
      setIsAutoConnecting(false);
      if (res?.success) {
        setJoined(true);
        setPin(roomPinToUse);
        setName(nameToUse);
        setError('');

        const effectivePid = res.participantId || pIdToUse;
        if (effectivePid) {
          setParticipantId(effectivePid);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_PARTICIPANT_ID, effectivePid);
            localStorage.setItem(STORAGE_PIN, roomPinToUse);
            localStorage.setItem(STORAGE_NAME, nameToUse);
            const url = new URL(window.location.href);
            url.searchParams.set('pin', roomPinToUse);
            window.history.replaceState({}, '', url.toString());
          }
        }

        if (res.gameState) setGameState(res.gameState);
        if (res.activeQuestion) setActiveQuestion(res.activeQuestion);
        if (res.totalQuestions) setTotalQuestions(res.totalQuestions);
        if (res.remainingReadingSeconds !== undefined && res.remainingReadingSeconds > 0) {
          setCountdown(res.remainingReadingSeconds);
        } else if (res.remainingAnsweringSeconds !== undefined && res.remainingAnsweringSeconds > 0) {
          setCountdown(res.remainingAnsweringSeconds);
        }

        if (res.myStats?.score !== undefined) setMyScore(res.myStats.score);

        if (res.hasAnsweredCurrentQuestion && res.myCurrentAnswer) {
          setHasSubmitted(true);
          setSelectedOption(res.myCurrentAnswer.optionIndex);
          setSubmittedTime(res.myCurrentAnswer.timeFormatted || '');
        }

        if (res.revealResult) {
          setRevealResult(res.revealResult);
        }

        if (res.resultsPublished && res.finalResults) {
          setGameState('RESULTS_PUBLISHED');
          setPublishedResults(res.finalResults);
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_PIN);
          localStorage.removeItem(STORAGE_PARTICIPANT_ID);
          // Preserve STORAGE_NAME so user doesn't need to retype their name
        }
        setJoined(false);
        setError(res?.message || 'Room not found or session expired');
      }
    });
  };

  // Synchronize session or switch rooms when a new QR code is scanned
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPin = localStorage.getItem(STORAGE_PIN) || '';
    const savedName = localStorage.getItem(STORAGE_NAME) || '';
    const savedPid = localStorage.getItem(STORAGE_PARTICIPANT_ID) || '';

    // If urlPin is present and DIFFERENT from savedPin -> NEW ROOM from QR scan!
    if (urlPin && savedPin && urlPin !== savedPin) {
      console.log(`[QR SCAN] Switching to new room PIN ${urlPin} (clearing old room ${savedPin})`);
      localStorage.removeItem(STORAGE_PARTICIPANT_ID);
      localStorage.setItem(STORAGE_PIN, urlPin);
      if (urlName) localStorage.setItem(STORAGE_NAME, urlName);

      setPin(urlPin);
      if (urlName) setName(urlName);
      else if (savedName) setName(savedName);
      setParticipantId('');
      setJoined(false);
      resetQuizState();

      const effectiveName = urlName || savedName;
      if (effectiveName) {
        performJoin(urlPin, effectiveName, undefined);
      } else {
        setIsAutoConnecting(false);
      }
      return;
    }

    // Normal mount / refresh flow
    if (initialMountDone.current) return;
    initialMountDone.current = true;

    const effectivePin = urlPin || savedPin;
    const effectiveName = urlName || savedName;

    if (effectivePin) setPin(effectivePin);
    if (effectiveName) setName(effectiveName);
    if (savedPid) setParticipantId(savedPid);

    if (effectivePin && effectiveName) {
      performJoin(effectivePin, effectiveName, savedPid || undefined);
    } else {
      setIsAutoConnecting(false);
    }
  }, [urlPin, urlName]);

  // Socket event listeners and connection recovery
  useEffect(() => {
    const socket = getSocket();

    const handleRoomUpdated = (roomData: any) => {
      setError('');
      if (roomData?.gameState) {
        setGameState(roomData.gameState);
      }
      if (roomData?.totalQuestions) {
        setTotalQuestions(roomData.totalQuestions);
      }
    };

    const handleQuestionPushed = (data: any) => {
      setActiveQuestion(data);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setCountdown(data.durationSeconds || 10);
      setSelectedOption(null);
      setHasSubmitted(false);
      setSubmittedTime('');
      setIsSubmitting(false);
      setAnswerResult(null);
      setRevealResult(null);
      setGameState('READING');
    };

    const handleAnsweringStarted = (data: any) => {
      setGameState('ANSWERING');
      setCountdown(data.durationSeconds || 30);
    };

    const handleQuestionLimitUpdated = (data: any) => {
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
    };

    const handleAnswerRevealed = (data: any) => {
      setRevealResult(data);
      setGameState('REVEAL');
    };

    const handleQuizEnded = () => {
      setGameState('QUIZ_ENDED');
    };

    const handleQuizResultsPublished = (data: any) => {
      setGameState('RESULTS_PUBLISHED');
      setPublishedResults(data);
      triggerConfettiExplosion();
    };

    const handleRoomDestroyed = (data: any) => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_PIN);
        localStorage.removeItem(STORAGE_PARTICIPANT_ID);
      }
      setJoined(false);
      resetQuizState();
      setError(data?.message || 'Session ended by host');
    };

    // Auto re-join when socket reconnects (after network drop, phone call, background wake)
    const handleConnect = () => {
      if (typeof window !== 'undefined') {
        const currentUrlPin = new URLSearchParams(window.location.search).get('pin') || '';
        const savedP = localStorage.getItem(STORAGE_PIN);
        const savedN = localStorage.getItem(STORAGE_NAME);
        const savedId = localStorage.getItem(STORAGE_PARTICIPANT_ID);
        const targetPin = currentUrlPin || savedP;
        if (targetPin && savedN) {
          const pidToUse = (targetPin === savedP) ? (savedId || undefined) : undefined;
          performJoin(targetPin, savedN, pidToUse);
        }
      }
    };

    const handleRoundResult = (data: any) => {
      if (data?.currentScore !== undefined) {
        setMyScore(data.currentScore);
      }
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('question_pushed', handleQuestionPushed);
    socket.on('answering_started', handleAnsweringStarted);
    socket.on('question_limit_updated', handleQuestionLimitUpdated);
    socket.on('answer_revealed', handleAnswerRevealed);
    socket.on('round_result', handleRoundResult);
    socket.on('quiz_ended', handleQuizEnded);
    socket.on('quiz_results_published', handleQuizResultsPublished);
    socket.on('room_destroyed', handleRoomDestroyed);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('question_pushed', handleQuestionPushed);
      socket.off('answering_started', handleAnsweringStarted);
      socket.off('question_limit_updated', handleQuestionLimitUpdated);
      socket.off('answer_revealed', handleAnswerRevealed);
      socket.off('round_result', handleRoundResult);
      socket.off('quiz_ended', handleQuizEnded);
      socket.off('quiz_results_published', handleQuizResultsPublished);
      socket.off('room_destroyed', handleRoomDestroyed);
      socket.off('connect', handleConnect);
    };
  }, []);

  // Handle phone call return / mobile tab visibility change & online events
  useEffect(() => {
    const syncSession = () => {
      const socket = getSocket();
      if (!socket.connected) {
        socket.connect();
      }
      if (typeof window !== 'undefined') {
        const currentUrlPin = new URLSearchParams(window.location.search).get('pin') || '';
        const savedP = localStorage.getItem(STORAGE_PIN);
        const savedN = localStorage.getItem(STORAGE_NAME);
        const savedId = localStorage.getItem(STORAGE_PARTICIPANT_ID);
        const targetPin = currentUrlPin || savedP;
        if (targetPin && savedN) {
          const pidToUse = (targetPin === savedP) ? (savedId || undefined) : undefined;
          performJoin(targetPin, savedN, pidToUse);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSession();
      }
    };

    const handleOnline = () => {
      syncSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Countdown timer for 10s reading phase and 30s answering phase
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((gameState === 'READING' || gameState === 'ANSWERING') && countdown > 0) {
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
    performJoin(pin, name, participantId);
  };

  const handleLeaveRoom = () => {
    const socket = getSocket();
    socket.emit('leave_room', { roomPin: pin }, () => {});
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_PIN);
      localStorage.removeItem(STORAGE_PARTICIPANT_ID);
      const url = new URL(window.location.href);
      url.searchParams.delete('pin');
      window.history.replaceState({}, '', url.toString());
    }
    setJoined(false);
    setPin('');
    setParticipantId('');
    resetQuizState();
  };

  const handleOptionClick = (index: number) => {
    if (gameState !== 'ANSWERING' || hasSubmitted || isSubmitting) return;

    setSelectedOption(index);
    setIsSubmitting(true);
    const socket = getSocket();
    socket.emit('submit_answer', { roomPin: pin, optionIndex: index }, (res: any) => {
      setIsSubmitting(false);
      if (res?.success) {
        setHasSubmitted(true);
        setSubmittedTime(res.timeFormatted || '');
      } else {
        setError(res?.message || 'Failed to submit answer');
      }
    });
  };

  const letters = ['A', 'B', 'C', 'D'];

  if (isAutoConnecting && !joined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[#009639] border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900">Reconnecting to Quiz...</h2>
          <p className="text-xs text-gray-500 mt-1">Restoring your session, score, and room position</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="w-16 h-16 object-contain mb-4 drop-shadow-sm"
            />
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
          <div className="flex items-center gap-3">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="w-9 h-9 object-contain drop-shadow-sm"
            />
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Player</p>
              <p className="font-bold text-gray-900 text-lg leading-tight">{name}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Score</p>
            <p className="font-bold text-amber-600 text-xl">{myScore} <span className="text-xs font-medium text-gray-400">pts</span></p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Room</p>
              <p className="font-mono font-bold text-[#009639] text-xl">{pin}</p>
            </div>
            <button
              onClick={handleLeaveRoom}
              title="Leave Room"
              className="p-2 ml-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={handleLeaveRoom}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors inline-flex items-center gap-1 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Player / Leave Room</span>
              </button>
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

            {/* 4 Award Categories Showcase */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                Official Quiz Awards
              </h3>

              {/* 1. Top 3 Podium */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">🏆 Top 3 Podium</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {/* 1st Place */}
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-400 text-amber-950 font-black rounded text-[10px] mb-1">#1</span>
                    <p className="font-bold text-gray-900 truncate">{publishedResults.top3?.[0]?.name || publishedResults.grandChampion?.name || 'TBD'}</p>
                    <p className="font-mono text-[#009639] font-extrabold text-xs">{publishedResults.top3?.[0]?.score ?? publishedResults.grandChampion?.score ?? 0} pts</p>
                  </div>
                  {/* 2nd Place */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="inline-block px-1.5 py-0.5 bg-slate-300 text-slate-800 font-black rounded text-[10px] mb-1">#2</span>
                    <p className="font-bold text-gray-900 truncate">{publishedResults.top3?.[1]?.name || 'TBD'}</p>
                    <p className="font-mono text-slate-700 font-extrabold text-xs">{publishedResults.top3?.[1]?.score ?? 0} pts</p>
                  </div>
                  {/* 3rd Place */}
                  <div className="p-2.5 bg-amber-50/40 border border-amber-200/60 rounded-xl">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-600 text-white font-black rounded text-[10px] mb-1">#3</span>
                    <p className="font-bold text-gray-900 truncate">{publishedResults.top3?.[2]?.name || 'TBD'}</p>
                    <p className="font-mono text-amber-800 font-extrabold text-xs">{publishedResults.top3?.[2]?.score ?? 0} pts</p>
                  </div>
                </div>
              </div>

              {/* 2. Tie-Breaker Speed Winner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold">
                      <Zap className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">⚡ Tie-Breaker Speed Winner</p>
                      <h4 className="font-black text-gray-900 text-sm">
                        {publishedResults.tieBreakerWinner?.name || 'No Tie-Breaker Required'}
                      </h4>
                    </div>
                  </div>
                  {publishedResults.tieBreakerWinner && (
                    <div className="text-right font-mono">
                      <p className="text-xs font-bold text-blue-700">{publishedResults.tieBreakerWinner.totalTimeFormatted || '--'}</p>
                      <p className="text-[10px] text-gray-500">{publishedResults.tieBreakerWinner.score} pts</p>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-blue-600 mt-2 font-medium">
                  Fastest cumulative response time among competitors.
                </p>
              </div>

              {/* 3. Best Learner Award - Stage Qualifier */}
              <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">🌟 Best Learner Award</p>
                      <h4 className="font-black text-gray-900 text-sm">
                        {publishedResults.bestLearnerWinner?.name || 'TBD'}
                      </h4>
                    </div>
                  </div>
                  {publishedResults.bestLearnerWinner && (
                    <div className="text-right font-mono">
                      <p className="text-xs font-black text-purple-700">{publishedResults.bestLearnerWinner.score ?? 0} pts</p>
                      <p className="text-[10px] text-gray-500">Speed: {publishedResults.bestLearnerWinner.totalTimeFormatted || '--'}</p>
                      <p className="text-[9px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">✓ {publishedResults.bestLearnerWinner.attemptedCount}/{publishedResults.bestLearnerWinner.totalQuestions || totalQuestions} Questions</p>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 p-2 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-xl border border-amber-300 flex items-start gap-2 text-[11px] text-amber-950 font-semibold shadow-sm">
                  <span className="text-sm leading-none mt-0.5">🎤</span>
                  <div>
                    <span className="font-black uppercase tracking-wider text-amber-900 block text-[10px]">Stage Qualifier</span>
                    <span>Winner must come on stage and play one more game to claim the prize! (Attempted all questions + highest score after negative marking + fastest speed)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Official E-Certificate Showcase Card */}
            {(() => {
              const certData = getParticipantCertificateData();
              const isWinner = certData.tier === 'winner';

              return (
                <div className={`rounded-3xl p-5 border shadow-md relative overflow-hidden transition-all ${
                  isWinner 
                    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border-amber-400/50 text-white shadow-emerald-950/20' 
                    : 'bg-white border-emerald-200 text-gray-900 shadow-emerald-500/5'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                        isWinner ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950' : 'bg-[#009639] text-white'
                      }`}>
                        {isWinner ? <Trophy className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isWinner ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-emerald-50 text-[#009639] border border-emerald-200'
                          }`}>
                            {isWinner ? '🏆 Tier 1: Excellence Award' : '🛡️ Tier 2: Defender Award'}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {certData.verificationId}
                          </span>
                        </div>
                        <h3 className={`text-lg font-black mt-0.5 ${isWinner ? 'text-white' : 'text-gray-900'}`}>
                          Official E-Certificate Ready!
                        </h3>
                        <p className={`text-xs ${isWinner ? 'text-slate-300' : 'text-gray-500'}`}>
                          {certData.awardTitle} • Cyber Day 2026 by Schneider Electric
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 mt-4">
                    <button
                      onClick={() => setIsCertificateOpen(true)}
                      className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 ${
                        isWinner
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-amber-500/20'
                          : 'bg-[#009639] hover:bg-[#00E676] text-white shadow-emerald-500/20'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>View & Download</span>
                    </button>

                    <button
                      onClick={() => setIsCertificateOpen(true)}
                      className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition active:scale-95 ${
                        isWinner
                          ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share on Socials</span>
                    </button>
                  </div>

                  <p className={`text-[11px] text-center mt-2.5 ${isWinner ? 'text-slate-400' : 'text-gray-400'}`}>
                    Available in Landscape (16:9) & Instagram Story (9:16) with 1-click LinkedIn & Instagram tags!
                  </p>
                </div>
              );
            })()}

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

            {/* Join Another Game Option */}
            <div className="pt-2">
              <button
                onClick={handleLeaveRoom}
                className="w-full py-3.5 px-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition active:scale-95 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Join Another Game / Scan New QR</span>
              </button>
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
                
                {gameState === 'ANSWERING' && (
                  <div className="flex items-center gap-1.5 text-[#009639] font-bold bg-green-50 px-3 py-1 rounded-full text-sm animate-pulse">
                    <Zap className="w-4 h-4" />
                    <span>30s Answering ({countdown}s)</span>
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

            {/* STATUS BANNER */}
            {gameState === 'READING' && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center space-y-1">
                <p className="text-sm font-bold text-amber-800 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Question Reading Time ({countdown}s)</span>
                </p>
                <p className="text-xs text-amber-600">
                  Read the question carefully. Answering will unlock automatically!
                </p>
              </div>
            )}

            {gameState === 'ANSWERING' && !hasSubmitted && (
              <div className="bg-green-50 border border-[#009639] p-4 rounded-xl text-center space-y-1 animate-pulse">
                <p className="text-sm font-black text-[#009639] flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Answering is Live! Tap your choice below</span>
                </p>
                <p className="text-xs text-green-700">
                  Time remaining: {countdown}s • Your response time will be recorded
                </p>
              </div>
            )}

            {gameState === 'ANSWERING' && hasSubmitted && (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-center space-y-1">
                <p className="text-sm font-black text-[#009639] flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Answer Submitted in {submittedTime}!</span>
                </p>
                <p className="text-xs text-emerald-700">
                  Waiting for round timer to end and host to reveal the answer...
                </p>
              </div>
            )}

            {/* MCQ OPTIONS LIST */}
            <div className="space-y-3">
              {activeQuestion.options?.map((optionText: string, idx: number) => {
                const isSelected = selectedOption === idx;
                
                let cardClass = "relative w-full text-left bg-white rounded-xl border-2 transition-all duration-200 p-4 flex items-center gap-4 overflow-hidden";
                let letterClass = "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors";
                let Icon = null;

                if (gameState === 'READING') {
                  cardClass += " border-gray-200 opacity-60 cursor-not-allowed";
                  letterClass += " bg-gray-100 text-gray-500";
                } 
                else if (gameState === 'ANSWERING') {
                  if (hasSubmitted) {
                    if (isSelected) {
                      cardClass += " border-[#009639] bg-green-50/70 shadow-sm font-semibold";
                      letterClass += " bg-[#009639] text-white";
                      Icon = <Lock className="w-5 h-5 text-[#009639] absolute right-4" />;
                    } else {
                      cardClass += " border-gray-200 opacity-50 cursor-not-allowed";
                      letterClass += " bg-gray-100 text-gray-400";
                    }
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
                    cardClass += " border-red-500 bg-red-50 text-red-700 font-semibold";
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
                    disabled={gameState !== 'ANSWERING' || hasSubmitted || isSubmitting}
                    className={cardClass}
                  >
                    <div className={letterClass}>{letters[idx]}</div>
                    <span className="font-medium text-gray-800 pr-8">{optionText}</span>
                    {Icon}
                  </button>
                );
              })}
            </div>

            {/* ANSWER SUBMITTED STATE (During answering window, no evaluation is leaked) */}
            {gameState === 'ANSWERING' && hasSubmitted && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1 animate-in fade-in">
                <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm">
                  <Lock className="w-4 h-4 text-[#009639]" />
                  <span>Answer Locked In {submittedTime ? `(${submittedTime})` : ''}</span>
                </div>
                <p className="text-xs text-emerald-700 font-medium">
                  Waiting for round timer to end. Results will be revealed to everyone together!
                </p>
              </div>
            )}

            {/* UNIFIED ROUND OUTCOME & EXPLANATION (Evaluated ONLY at Reveal) */}
            {gameState === 'REVEAL' && revealResult && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4 animate-in fade-in">
                {/* 1. Clear Round Outcome Header (Single non-duplicated outcome banner) */}
                {selectedOption !== null && selectedOption === revealResult.correctAnswerIndex && (
                  <div className="p-3.5 bg-green-50 border-2 border-green-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#009639] text-white flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                          Correct Answer!
                        </p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          Great job! +100 points added to your score
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-black text-[#009639] bg-white px-2.5 py-1 rounded-lg border border-green-200 shadow-sm">
                      +100 pts
                    </span>
                  </div>
                )}

                {selectedOption !== null && selectedOption !== revealResult.correctAnswerIndex && (
                  <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-red-900 uppercase tracking-wide">
                          Incorrect Answer (-50 Points)
                        </p>
                        <p className="text-[11px] text-red-700 font-medium">
                          Negative marking applied: 50 points deducted from your score
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-black text-red-600 bg-white px-2.5 py-1 rounded-lg border border-red-200 shadow-sm">
                      -50 pts
                    </span>
                  </div>
                )}

                {selectedOption === null && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">Time's Up (No Answer Submitted)</p>
                        <p className="text-[11px] text-amber-700 font-medium">0 points awarded or deducted for this round</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                      0 pts
                    </span>
                  </div>
                )}

                {/* 2. Round Explanation */}
                <div>
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Zap className="w-4 h-4 text-[#009639]" /> Round Explanation
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium bg-green-50/50 p-3.5 rounded-xl border border-green-100">
                    {revealResult.explanation}
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Official E-Certificate Modal */}
        <CertificateModal
          isOpen={isCertificateOpen}
          onClose={() => setIsCertificateOpen(false)}
          data={getParticipantCertificateData()}
        />
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
