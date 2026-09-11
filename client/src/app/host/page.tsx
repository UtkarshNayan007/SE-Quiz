'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getSocket } from '../../lib/socket';
import {
  ShieldCheck,
  Play,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trophy,
  Zap,
  Eye,
  Clock,
  Hash,
  AlertCircle,
  UserCheck,
  HelpCircle,
  Lock,
  Award,
  Flame,
  Check,
  Send,
  RotateCcw,
  PowerOff,
  Sparkles,
  Crown,
  SlidersHorizontal,
  LogOut,
  X,
  BookOpen
} from 'lucide-react';
import { InteractiveQuestionVisual } from '../../components/InteractiveQuestionVisual';

const deduplicateParticipants = (list: any[]) => {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const p of list) {
    const key = (p.name || '').toLowerCase().trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, p);
    } else {
      const existing = map.get(key);
      const isPBetter = (p.score > existing.score) ||
        (p.score === existing.score && (p.correctCount || 0) > (existing.correctCount || 0)) ||
        (p.score === existing.score && (p.correctCount || 0) === (existing.correctCount || 0) && p.connected && !existing.connected);
      if (isPBetter) {
        map.set(key, p);
      }
    }
  }
  return Array.from(map.values());
};

export default function HostDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  const [roomPin, setRoomPin] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(30);
  const [configuredQuestionCount, setConfiguredQuestionCount] = useState(30);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [currentQIndex, setCurrentQIndex] = useState(-1);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  
  // Game States: 'LOBBY', 'READING', 'ANSWERING', 'REVEAL', 'QUIZ_ENDED', 'RESULTS_PUBLISHED'
  const [gameState, setGameState] = useState('LOBBY');
  const [countdown, setCountdown] = useState(10);
  
  // Real-time Answering Gauge Data
  const [progressData, setProgressData] = useState<{
    answeredCount: number;
    unansweredCount: number;
    participantCount: number;
    latestAnswerer?: { name: string; timeFormatted: string };
  }>({
    answeredCount: 0,
    unansweredCount: 0,
    participantCount: 0
  });
  
  const [revealResult, setRevealResult] = useState<any>(null);
  const [finalResults, setFinalResults] = useState<any>(null);
  const [approvedCriteria, setApprovedCriteria] = useState<'score' | 'time'>('score');
  const [resultsPublished, setResultsPublished] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAnsweringClosed, setIsAnsweringClosed] = useState(false);
  const roomCreatedRef = useRef(false);

  const attemptCreateRoom = (inputPasscode: string, targetPin?: string) => {
    setLoading(true);
    setAuthError('');
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const urlPin = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pin') || '' : '';
    const savedPin = typeof window !== 'undefined' ? (localStorage.getItem('se_host_room_pin') || sessionStorage.getItem('se_host_room_pin') || '') : '';
    const pinToUse = targetPin !== undefined ? targetPin : (roomPin || urlPin || savedPin);

    // Timeout safety so loading never spins infinitely
    const timeout = setTimeout(() => {
      setLoading(false);
      setIsRestoring(false);
      setAuthError('Connection timed out. Please check if the server is online and try again.');
    }, 10000);

    socket.emit('create_room', { passcode: inputPasscode, roomPin: pinToUse, questionCount: 30 }, (res: any) => {
      clearTimeout(timeout);
      setLoading(false);
      setIsRestoring(false);
      if (res && res.success) {
        setIsAuthenticated(true);
        setRoomPin(res.roomPin);
        setTotalQuestions(res.totalQuestions || 30);
        setConfiguredQuestionCount(res.configuredQuestionCount || res.totalQuestions || 30);
        if (res.participants) setParticipants(deduplicateParticipants(res.participants));
        if (res.participantCount !== undefined) setParticipantCount(res.participantCount);
        if (res.gameState) setGameState(res.gameState);
        if (res.answeringEnded) setIsAnsweringClosed(true);
        if (res.currentQuestionIndex !== undefined) setCurrentQIndex(res.currentQuestionIndex);
        if (res.activeQuestion) setActiveQuestion(res.activeQuestion);
        if (res.finalResults) setFinalResults(res.finalResults);
        if (res.approvedCriteria) setApprovedCriteria(res.approvedCriteria);
        if (res.resultsPublished !== undefined) setResultsPublished(res.resultsPublished);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('se_host_passcode', inputPasscode);
          localStorage.setItem('se_host_room_pin', res.roomPin);
          sessionStorage.setItem('se_host_passcode', inputPasscode);
          sessionStorage.setItem('se_host_room_pin', res.roomPin);
          const url = new URL(window.location.href);
          url.searchParams.set('pin', res.roomPin);
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        setIsAuthenticated(false);
        setAuthError(res?.message || 'Access Denied: Invalid Admin Passcode');
        if (typeof window !== 'undefined' && res?.message?.includes('Invalid Admin Passcode')) {
          localStorage.removeItem('se_host_passcode');
          sessionStorage.removeItem('se_host_passcode');
        }
      }
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !roomCreatedRef.current) {
      const savedPasscode = localStorage.getItem('se_host_passcode') || sessionStorage.getItem('se_host_passcode') || '';
      const urlPin = new URLSearchParams(window.location.search).get('pin') || '';
      const savedPin = urlPin || localStorage.getItem('se_host_room_pin') || sessionStorage.getItem('se_host_room_pin') || '';
      if (savedPasscode) {
        roomCreatedRef.current = true;
        setIsRestoring(true);
        setPasscode(savedPasscode);
        attemptCreateRoom(savedPasscode, savedPin);
      } else {
        setIsRestoring(false);
      }
    }
  }, []);

  // Host countdown timer for 10s reading phase and 30s answering phase
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

  useEffect(() => {
    const socket = getSocket();

    const handleRoomUpdated = (data: any) => {
      if (data?.participantCount !== undefined) setParticipantCount(data.participantCount);
      if (data?.gameState) setGameState(data.gameState);
      if (data?.currentQuestionIndex !== undefined) setCurrentQIndex(data.currentQuestionIndex);
      if (data?.resultsPublished !== undefined) setResultsPublished(data.resultsPublished);
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
      if (data?.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);
    };

    const handleHostRoomUpdated = (data: any) => {
      if (data?.participantCount !== undefined) setParticipantCount(data.participantCount);
      if (data?.participants) setParticipants(deduplicateParticipants(data.participants));
      if (data?.gameState) setGameState(data.gameState);
      if (data?.currentQuestionIndex !== undefined) setCurrentQIndex(data.currentQuestionIndex);
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
      if (data?.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);
    };

    const handleAnsweringStarted = (data: any) => {
      setGameState('ANSWERING');
      setIsAnsweringClosed(false);
      setCountdown(data.durationSeconds || 30);
    };

    const handleAnsweringClosed = () => {
      setIsAnsweringClosed(true);
      setCountdown(0);
    };

    const handleQuestionProgress = (data: any) => {
      setProgressData({
        answeredCount: data.answeredCount || 0,
        unansweredCount: data.unansweredCount || 0,
        participantCount: data.participantCount || 0,
        latestAnswerer: data.latestAnswerer
      });
      if (data.participantCount !== undefined) {
        setParticipantCount(data.participantCount);
      }
    };

    const handleAnswerRevealed = (data: any) => {
      setRevealResult(data);
      setIsAnsweringClosed(false);
      setGameState('REVEAL');
    };

    const handleQuestionPushed = (data: any) => {
      setActiveQuestion(data);
      setCurrentQIndex(data.questionIndex);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setGameState('READING');
      setIsAnsweringClosed(false);
      setCountdown(data.durationSeconds || 10);
      setProgressData({
        answeredCount: 0,
        unansweredCount: participantCount,
        participantCount: participantCount
      });
      setRevealResult(null);
    };

    const handleQuestionLimitUpdated = (data: any) => {
      if (data?.configuredQuestionCount) {
        setConfiguredQuestionCount(data.configuredQuestionCount);
        setTotalQuestions(data.configuredQuestionCount);
      }
    };

    const handleHostQuizReview = (data: any) => {
      setFinalResults(data);
      setGameState('QUIZ_ENDED');
    };

    const handleQuizResultsPublished = (data: any) => {
      setFinalResults(data);
      setResultsPublished(true);
      setGameState('RESULTS_PUBLISHED');
      if (data.approvedCriteria) setApprovedCriteria(data.approvedCriteria);
    };

    const handleConnect = () => {
      if (typeof window !== 'undefined') {
        const savedPass = localStorage.getItem('se_host_passcode') || sessionStorage.getItem('se_host_passcode');
        const activePin = roomPin || (new URLSearchParams(window.location.search).get('pin') || '') || localStorage.getItem('se_host_room_pin') || sessionStorage.getItem('se_host_room_pin');
        if (savedPass) {
          socket.emit('create_room', { passcode: savedPass, roomPin: activePin || undefined, questionCount: 30 }, () => {});
        }
      }
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('host_room_updated', handleHostRoomUpdated);
    socket.on('answering_started', handleAnsweringStarted);
    socket.on('answering_closed', handleAnsweringClosed);
    socket.on('question_progress', handleQuestionProgress);
    socket.on('answer_revealed', handleAnswerRevealed);
    socket.on('question_pushed', handleQuestionPushed);
    socket.on('question_limit_updated', handleQuestionLimitUpdated);
    socket.on('host_quiz_review', handleHostQuizReview);
    socket.on('quiz_results_published', handleQuizResultsPublished);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('host_room_updated', handleHostRoomUpdated);
      socket.off('answering_started', handleAnsweringStarted);
      socket.off('answering_closed', handleAnsweringClosed);
      socket.off('question_progress', handleQuestionProgress);
      socket.off('answer_revealed', handleAnswerRevealed);
      socket.off('question_pushed', handleQuestionPushed);
      socket.off('question_limit_updated', handleQuestionLimitUpdated);
      socket.off('host_quiz_review', handleHostQuizReview);
      socket.off('quiz_results_published', handleQuizResultsPublished);
      socket.off('connect', handleConnect);
    };
  }, []);

  const handleSetQuestionLimit = (count: number) => {
    const val = Math.min(Math.max(count, 1), 30);
    setConfiguredQuestionCount(val);
    setTotalQuestions(val);
    const socket = getSocket();
    socket.emit('set_question_limit', { roomPin, questionCount: val }, (res: any) => {
      if (!res?.success) {
        setError(res?.message || 'Failed to update question limit');
      }
    });
  };

  const handleShowRules = () => {
    if (!roomPin) return;
    setLoading(true);
    const socket = getSocket();
    socket.emit('show_rules', { roomPin }, (res: any) => {
      setLoading(false);
      if (res?.success) {
        setGameState('RULES');
      } else {
        setError(res?.message || 'Failed to display rules');
      }
    });
  };

  const handleReturnToLobby = () => {
    if (!roomPin) return;
    setLoading(true);
    const socket = getSocket();
    socket.emit('return_to_lobby', { roomPin }, (res: any) => {
      setLoading(false);
      if (res?.success) {
        setGameState('LOBBY');
      } else {
        setError(res?.message || 'Failed to return to lobby');
      }
    });
  };

  const handlePushQuestion = () => {
    setLoading(true);
    const nextIndex = currentQIndex + 1;
    const socket = getSocket();
    socket.emit('push_question', { roomPin, questionIndex: nextIndex }, (res: any) => {
      setLoading(false);
      if (res.success) {
        setActiveQuestion(res.activeQuestion || res);
        setCurrentQIndex(res.questionIndex);
        setGameState('READING');
        setRevealResult(null);
        setProgressData({
          answeredCount: 0,
          unansweredCount: participantCount,
          participantCount: participantCount
        });
      } else {
        setError(res.message || 'Failed to push question');
      }
    });
  };

  const handleRevealAnswer = () => {
    setLoading(true);
    const socket = getSocket();
    socket.emit('reveal_answer', { roomPin }, (res: any) => {
      setLoading(false);
      if (!res.success) {
        setError(res.message || 'Failed to reveal answer');
      }
    });
  };

  const handleEndQuiz = () => {
    setShowEndConfirm(false);
    setLoading(true);
    const socket = getSocket();
    socket.emit('end_quiz', { roomPin }, (res: any) => {
      setLoading(false);
      if (res && res.success) {
        setGameState('QUIZ_ENDED');
        if (res.results) {
          setFinalResults(res.results);
        }
      } else {
        setError(res?.message || 'Failed to end quiz');
      }
    });
  };

  const handlePublishResults = () => {
    setPublishing(true);
    const socket = getSocket();
    socket.emit('publish_quiz_results', { roomPin, approvedCriteria }, (res: any) => {
      setPublishing(false);
      if (res && res.success) {
        setResultsPublished(true);
        setGameState('RESULTS_PUBLISHED');
        if (res.publishedData) {
          setFinalResults(res.publishedData);
        }
      } else {
        setError(res?.message || 'Failed to publish results');
      }
    });
  };

  const handleResetSession = () => {
    if (typeof window !== 'undefined') {
      if (roomPin) {
        const socket = getSocket();
        socket.emit('reset_room', { roomPin });
      }
      localStorage.removeItem('se_host_room_pin');
      sessionStorage.removeItem('se_host_room_pin');
      window.location.href = '/host';
    }
  };

  const handleRemoveParticipant = (participantId?: string, participantName?: string) => {
    if (!roomPin) return;
    const socket = getSocket();
    socket.emit('remove_participant', {
      roomPin,
      participantId,
      participantName
    }, (res: any) => {
      if (res?.success) {
        setParticipants(prev => prev.filter(p => (p.participantId || p.id) !== participantId && p.name !== participantName));
        setParticipantCount(prev => Math.max(0, prev - 1));
      }
    });
  };

  const handleHostLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('se_host_passcode');
      localStorage.removeItem('se_host_room_pin');
      sessionStorage.removeItem('se_host_passcode');
      sessionStorage.removeItem('se_host_room_pin');
      setIsAuthenticated(false);
      setRoomPin('');
      window.location.href = '/host';
    }
  };

  if (!isAuthenticated) {
    if (isRestoring) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <RefreshCw className="w-10 h-10 text-[#00E676] animate-spin" />
            <p className="text-base font-semibold text-slate-300">Restoring Host Dashboard...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/se-logo.png"
                alt="Schneider Electric"
                className="w-14 h-14 object-contain drop-shadow-sm"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Access Gate</h1>
            <p className="text-xs font-bold text-[#00E676] uppercase tracking-widest mt-1">CCSH MSS OPERATIONS</p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold p-3.5 rounded-xl text-center">
              {authError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!passcode.trim()) {
                setAuthError('Please enter Admin Passcode');
                return;
              }
              const urlPin = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pin') || '' : '';
              attemptCreateRoom(passcode.trim(), urlPin || undefined);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Host Admin Passcode
              </label>
              <input
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setAuthError(''); }}
                className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center text-lg tracking-widest focus:ring-2 focus:ring-[#00E676] focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#009639] hover:bg-[#00E676] text-white font-bold py-3.5 rounded-xl text-base flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
              Unlock Host Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 p-4 md:p-8">
      {/* End Quiz Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center shadow">
              <PowerOff className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">End Quiz Session?</h3>
            <p className="text-sm text-gray-600">
              This will conclude the active quiz, compile per-question winners and final leaderboards, and allow you to approve the final champion before publishing.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEndQuiz}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'Yes, End Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-white border-b-4 border-[#00E676] p-4 md:px-8 mb-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/se-logo.png"
            alt="Schneider Electric"
            className="w-11 h-11 object-contain drop-shadow-sm"
          />
          <div>
            <h1 className="text-xl font-black text-slate-900">
              Schneider <span className="text-[#009639]">Electric</span>
            </h1>
            <p className="text-xs font-bold text-[#009639] uppercase tracking-widest">
              CCSH MSS OPERATIONS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 mt-4 md:mt-0 flex-wrap justify-center">
          <img
            src="/cyber-shield-logo.png"
            alt="Cyber Security Shield"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-md"
          />
          <div className="flex items-center gap-2 bg-[#00E676]/20 px-4 py-2 rounded-full border border-[#009639]/30">
            <Users className="w-5 h-5 text-[#009639]" />
            <span className="font-bold text-[#009639]">{participantCount} Players</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <Hash className="w-5 h-5 text-gray-700" />
            <span className="font-bold text-gray-800 font-mono tracking-widest text-lg">
              {roomPin || '---'}
            </span>
          </div>
          <button
            onClick={handleResetSession}
            title="Start New Session (Generates fresh room code)"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-xl border border-gray-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Room</span>
          </button>
          <button
            onClick={handleHostLogout}
            title="Log out of Admin Dashboard"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-xl border border-gray-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* QUIZ ENDED / RESULTS APPROVAL VIEW */}
      {(gameState === 'QUIZ_ENDED' || gameState === 'RESULTS_PUBLISHED') && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Approval Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border-2 border-emerald-500/30">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <Trophy className="w-9 h-9 text-amber-400 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                  {resultsPublished ? 'Stage Results Live' : 'Host Final Review & Push'}
                </span>
                <h2 className="text-2xl md:text-3xl font-black mt-2 text-white">
                  {resultsPublished ? 'Official Results Published!' : 'Quiz Completed - Review & Push Results'}
                </h2>
                <p className="text-sm font-medium text-slate-300 mt-1">
                  {resultsPublished
                    ? `Results are live on the Projector and all ${participantCount} Participant screens.`
                    : 'Review the Grand Champion (ranked by score, tie-broken by speed), Winners by Question, and Final Leaderboard below before releasing to stage.'}
                </p>
              </div>
            </div>

            {!resultsPublished && (
              <button
                onClick={handlePublishResults}
                disabled={publishing}
                className="w-full md:w-auto bg-[#009639] hover:bg-[#00E676] text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:scale-105 transition-all shrink-0 active:scale-95"
              >
                {publishing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Send className="w-6 h-6" />
                )}
                <span>Push Results to All Screens</span>
              </button>
            )}
          </div>

          {/* Top 3 Podium Cards (Ranked by Score with Time Tie-breaker) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rank 1: Grand Champion */}
            <div className="bg-gradient-to-b from-amber-50 to-white rounded-3xl border-2 border-amber-300 p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-2 right-3 opacity-15">
                <Crown className="w-24 h-24 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-amber-400 text-amber-950 font-black text-sm flex items-center justify-center shadow">
                    #1
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                    🥇 Grand Champion
                  </span>
                </div>
                <h4 className="text-2xl font-black text-gray-900 mt-2">
                  {finalResults?.grandChampion ? finalResults.grandChampion.name : (finalResults?.championByScore?.name || 'No Champion')}
                </h4>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-2xl font-mono font-black text-[#009639]">
                    {finalResults?.grandChampion ? finalResults.grandChampion.score : (finalResults?.championByScore?.score || 0)} pts
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    ({finalResults?.grandChampion?.correctCount || finalResults?.championByScore?.correctCount || 0} Correct)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  Total Speed: {finalResults?.grandChampion?.totalTimeFormatted || finalResults?.championByScore?.totalTimeFormatted || '--'}
                </p>
              </div>

              {(finalResults?.grandChampion?.tieBrokenByTime || finalResults?.championByScore?.tieBrokenByTime) && (
                <div className="mt-4 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>⚡ Won tie-breaker via faster response time!</span>
                </div>
              )}
            </div>

            {/* Rank 2: Runner-up */}
            <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl border-2 border-slate-200 p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-800 font-black text-sm flex items-center justify-center shadow">
                    #2
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    🥈 1st Runner Up
                  </span>
                </div>
                <h4 className="text-2xl font-black text-gray-900 mt-2">
                  {finalResults?.top3?.[1]?.name || finalResults?.leaderboardByScore?.[1]?.name || 'TBD'}
                </h4>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-2xl font-mono font-black text-slate-700">
                    {finalResults?.top3?.[1]?.score ?? finalResults?.leaderboardByScore?.[1]?.score ?? 0} pts
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    ({finalResults?.top3?.[1]?.correctCount ?? finalResults?.leaderboardByScore?.[1]?.correctCount ?? 0} Correct)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  Total Speed: {finalResults?.top3?.[1]?.totalTimeFormatted || finalResults?.leaderboardByScore?.[1]?.totalTimeFormatted || '--'}
                </p>
              </div>

              {(finalResults?.top3?.[1]?.tieBrokenByTime || finalResults?.leaderboardByScore?.[1]?.tieBrokenByTime) && (
                <div className="mt-4 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>⚡ Score tied; ranked by speed</span>
                </div>
              )}
            </div>

            {/* Rank 3: 2nd Runner-up */}
            <div className="bg-gradient-to-b from-amber-50/40 to-white rounded-3xl border-2 border-amber-200/60 p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-amber-600 text-white font-black text-sm flex items-center justify-center shadow">
                    #3
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-100/60 px-2.5 py-0.5 rounded-full">
                    🥉 2nd Runner Up
                  </span>
                </div>
                <h4 className="text-2xl font-black text-gray-900 mt-2">
                  {finalResults?.top3?.[2]?.name || finalResults?.leaderboardByScore?.[2]?.name || 'TBD'}
                </h4>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-2xl font-mono font-black text-amber-800">
                    {finalResults?.top3?.[2]?.score ?? finalResults?.leaderboardByScore?.[2]?.score ?? 0} pts
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    ({finalResults?.top3?.[2]?.correctCount ?? finalResults?.leaderboardByScore?.[2]?.correctCount ?? 0} Correct)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  Total Speed: {finalResults?.top3?.[2]?.totalTimeFormatted || finalResults?.leaderboardByScore?.[2]?.totalTimeFormatted || '--'}
                </p>
              </div>

              {(finalResults?.top3?.[2]?.tieBrokenByTime || finalResults?.leaderboardByScore?.[2]?.tieBrokenByTime) && (
                <div className="mt-4 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>⚡ Score tied; ranked by speed</span>
                </div>
              )}
            </div>
          </div>

          {/* Official Final Leaderboard Table */}
          <div className="bg-white rounded-3xl shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" /> Official Final Leaderboard
              </h3>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Ranked by Score • Tie-breaker: Faster Response Time
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-400 uppercase">
                    <th className="pb-3">Rank</th>
                    <th className="pb-3">Participant</th>
                    <th className="pb-3 text-center">Correct</th>
                    <th className="pb-3 text-center">Wrong (-50)</th>
                    <th className="pb-3 text-right">Total Speed</th>
                    <th className="pb-3 text-right">Final Score</th>
                    <th className="pb-3 text-right">Tie-Breaker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(finalResults?.leaderboard || finalResults?.leaderboardByScore)?.map((player: any, idx: number) => (
                    <tr key={idx} className={`hover:bg-gray-50 ${idx === 0 ? 'bg-amber-50/50 font-semibold' : ''}`}>
                      <td className="py-3 font-mono text-xs font-black text-gray-500">
                        {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                      </td>
                      <td className="py-3 font-bold text-gray-900">{player.name}</td>
                      <td className="py-3 text-center text-xs font-bold text-emerald-600">
                        {player.correctCount || 0}
                      </td>
                      <td className="py-3 text-center text-xs font-bold text-red-500">
                        {player.wrongCount || 0}
                      </td>
                      <td className="py-3 text-right font-mono text-xs text-gray-500">
                        {player.totalTimeFormatted || '--'}
                      </td>
                      <td className="py-3 text-right font-mono font-black text-lg text-[#009639]">
                        {player.score} pts
                      </td>
                      <td className="py-3 text-right">
                        {player.tieBrokenByTime ? (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Zap className="w-3 h-3 text-blue-600" /> Faster Time
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
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

      {/* NORMAL IN-GAME VIEW (LOBBY, READING, BUZZER_UNLOCKED, ANSWERING, REVEAL, HOST_CONTROL) */}
      {gameState !== 'QUIZ_ENDED' && gameState !== 'RESULTS_PUBLISHED' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Quiz Configuration / Question Count Selector */}
            <div className="bg-white rounded-2xl shadow p-6 border-2 border-emerald-100 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#009639]" />
                  <h3 className="text-base font-bold text-gray-900">Quiz Questions Limit</h3>
                </div>
                <span className="text-xs font-bold text-[#009639] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {totalQuestions} of 30 Questions Configured
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Choose how many questions to play in this session. Once completed, the quiz triggers final results review.
              </p>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {[5, 10, 15, 20, 30].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={currentQIndex >= 0}
                    onClick={() => handleSetQuestionLimit(preset)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      totalQuestions === preset
                        ? 'bg-[#009639] text-white shadow-md scale-105'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    } ${currentQIndex >= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                  >
                    <span>{preset === 30 ? '30 (All Questions)' : `${preset} Questions`}</span>
                  </button>
                ))}

                {/* Custom count input when in lobby */}
                {currentQIndex === -1 && (
                  <div className="flex items-center gap-1.5 sm:ml-auto">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      placeholder="Custom"
                      value={customQuestionInput}
                      onChange={(e) => setCustomQuestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customQuestionInput) {
                          handleSetQuestionLimit(parseInt(customQuestionInput));
                          setCustomQuestionInput('');
                        }
                      }}
                      className="w-20 px-2.5 py-1.5 text-xs font-mono border rounded-xl text-center focus:outline-none focus:border-[#009639]"
                    />
                    <button
                      type="button"
                      disabled={!customQuestionInput}
                      onClick={() => {
                        if (customQuestionInput) {
                          handleSetQuestionLimit(parseInt(customQuestionInput));
                          setCustomQuestionInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition"
                    >
                      Set
                    </button>
                  </div>
                )}
              </div>

              {currentQIndex >= 0 && (
                <p className="text-[11px] text-amber-600 font-semibold mt-3 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Question count is locked during active quiz rounds.
                </p>
              )}
            </div>

            {/* Game Control Card */}
            <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#009639] flex items-center gap-2">
                  <Play className="w-6 h-6" /> Game Controls
                </h2>
                {currentQIndex >= 0 && (
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 transition"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>End Quiz</span>
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-gray-600 font-medium">
                    {currentQIndex === -1
                      ? 'Ready to start the quiz'
                      : `Question ${currentQIndex + 1} of ${totalQuestions}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Status: <span className="font-bold text-[#009639] uppercase tracking-wider">{gameState}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {gameState === 'LOBBY' && (
                    <>
                      <button
                        onClick={handleShowRules}
                        disabled={loading}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors shadow"
                      >
                        <BookOpen className="w-4 h-4 text-[#00E676]" />
                        <span>Rules & Guide</span>
                      </button>
                      <button
                        onClick={handlePushQuestion}
                        disabled={loading}
                        className="bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Quiz</span>
                      </button>
                    </>
                  )}

                  {gameState === 'RULES' && (
                    <>
                      <button
                        onClick={handleReturnToLobby}
                        disabled={loading}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm"
                      >
                        ↩ Return to Lobby
                      </button>
                      <button
                        onClick={handlePushQuestion}
                        disabled={loading}
                        className="bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition-all active:scale-95"
                      >
                        <Play className="w-4 h-4" />
                        <span>Launch Question 1</span>
                      </button>
                    </>
                  )}

                  {/* DURING READING OR ANSWERING: BRING REVEAL BUTTON RIGHT HERE AT THE TOP! */}
                  {(gameState === 'READING' || gameState === 'ANSWERING') && (
                    <div className="flex items-center gap-2.5">
                      {gameState === 'READING' && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Reading ({countdown}s)</span>
                        </span>
                      )}
                      {gameState === 'ANSWERING' && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-blue-600" />
                          <span>{progressData.answeredCount}/{participantCount} Answered ({countdown}s)</span>
                        </span>
                      )}
                      <button
                        onClick={handleRevealAnswer}
                        disabled={loading}
                        className="bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 animate-pulse"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Reveal Answer to All</span>
                      </button>
                    </div>
                  )}

                  {/* REVEAL STATE: PUSH NEXT OR END */}
                  {gameState === 'REVEAL' && (
                    currentQIndex + 1 >= totalQuestions ? (
                      <button
                        onClick={() => setShowEndConfirm(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition shadow-md animate-pulse active:scale-95"
                      >
                        <PowerOff className="w-4 h-4" />
                        <span>End Quiz & Review Results</span>
                      </button>
                    ) : (
                      <button
                        onClick={handlePushQuestion}
                        disabled={loading}
                        className="bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span>Push Next Question ({currentQIndex + 2} of {totalQuestions})</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* RULES Active Banner */}
            {gameState === 'RULES' && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-2 border-[#009639]/40 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#009639] text-white flex items-center justify-center shadow">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Rules & Interface Guide Active
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      All participant phones and the projector screen are currently displaying the tournament briefing and interactive guide.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReturnToLobby}
                    disabled={loading}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    ↩ Return to Lobby
                  </button>
                  <button
                    onClick={handlePushQuestion}
                    disabled={loading}
                    className="px-6 py-2.5 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow transition-all"
                  >
                    <Play className="w-4 h-4" />
                    <span>Launch Question 1</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active Question Display Card */}
            {activeQuestion && (
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block bg-[#00E676]/20 text-[#009639] px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Question {activeQuestion.questionIndex + 1}
                  </span>
                  {activeQuestion.type && activeQuestion.type !== 'theory' && (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                      {activeQuestion.type === 'spot_the_difference' ? '🔍 Spot the Difference' :
                       activeQuestion.type === 'picture_mcq' ? '👤 Risk Profile Analysis' :
                       activeQuestion.type === 'memory_check' ? '🧠 Memory & Vigilance Check' :
                       activeQuestion.type === 'crossword' ? '🧩 Cyber Crossword' : activeQuestion.type}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4 leading-relaxed">
                  {activeQuestion.question}
                </h3>

                {activeQuestion.type && activeQuestion.type !== 'theory' && (
                  <div className="mb-5">
                    <InteractiveQuestionVisual
                      type={activeQuestion.type}
                      visualData={activeQuestion.visualData}
                      revealVisual={revealResult?.revealVisual || activeQuestion.revealVisual}
                      isReveal={gameState === 'REVEAL'}
                      compact={true}
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeQuestion.options.map((opt: string, idx: number) => {
                    const isCorrectRevealed = revealResult && revealResult.correctAnswerIndex === idx;
                    const isWrongRevealed = revealResult && revealResult.correctAnswerIndex !== idx;
                    
                    let optionClass = 'bg-gray-50 border-gray-200 text-gray-700';
                    
                    if (gameState === 'REVEAL') {
                      if (isCorrectRevealed) {
                        optionClass = 'bg-[#00E676]/20 border-[#009639] text-[#009639] font-bold';
                      } else if (isWrongRevealed) {
                        optionClass = 'bg-gray-50 border-gray-200 text-gray-400 opacity-60';
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border-2 ${optionClass} transition-all flex items-center gap-3`}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                          isCorrectRevealed ? 'bg-[#009639] text-white' : 'bg-white text-gray-500 border border-gray-200'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="font-medium text-sm">{opt}</span>
                        {isCorrectRevealed && <CheckCircle2 className="w-5 h-5 ml-auto text-[#009639]" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Secondary Show Answer Bar (if host scrolls down) */}
            {gameState !== 'LOBBY' && gameState !== 'REVEAL' && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                <p className="text-xs text-slate-600 font-medium">
                  {gameState === 'READING' && `📖 10s Reading in progress (${countdown}s remaining)...`}
                  {gameState === 'ANSWERING' && (
                    countdown > 0 && !isAnsweringClosed
                      ? `⚡ Answering window LIVE • ${progressData.answeredCount} of ${participantCount} answered (${countdown}s remaining)`
                      : `⏳ Answering closed (${progressData.answeredCount} of ${participantCount} answered)`
                  )}
                </p>
                <button
                  onClick={handleRevealAnswer}
                  disabled={loading}
                  className="bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white px-5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow transition-all shrink-0 active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  <span>Reveal Answer to All</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Live Answering Dial & Real-Time Gauge */}
            <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#009639] flex items-center gap-2">
                  <Zap className="w-6 h-6" /> Live Answering Dial
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  gameState === 'ANSWERING' ? 'bg-green-100 text-green-800 animate-pulse' : 'bg-gray-100 text-gray-600'
                }`}>
                  {gameState === 'ANSWERING' ? 'Live Answering' : gameState}
                </span>
              </div>

              <div className="flex flex-col items-center">
                {(() => {
                  const safeTotal = Math.max(progressData.participantCount || participantCount, 1);
                  const answered = progressData.answeredCount || 0;
                  const unanswered = Math.max((progressData.participantCount || participantCount) - answered, 0);
                  const percentage = Math.min(Math.round((answered / safeTotal) * 100), 100);
                  const radius = 46;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (percentage / 100) * circumference;

                  return (
                    <div className="w-full flex flex-col items-center">
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
                          <circle
                            cx="55"
                            cy="55"
                            r={radius}
                            className="text-slate-100"
                            strokeWidth="10"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          <circle
                            cx="55"
                            cy="55"
                            r={radius}
                            className="text-[#009639] transition-all duration-500 ease-out"
                            strokeWidth="10"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                          />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-3xl font-black text-gray-900 font-mono leading-none">{answered}</span>
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">of {progressData.participantCount || participantCount}</span>
                          <span className="text-[11px] font-black text-[#009639] bg-green-50 px-2 py-0.5 rounded-full mt-1 border border-green-200">{percentage}%</span>
                        </div>
                      </div>

                      {/* Stat Counters */}
                      <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total</p>
                          <p className="text-xl font-black text-gray-800 font-mono">{progressData.participantCount || participantCount}</p>
                        </div>
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Answered</p>
                          <p className="text-xl font-black text-[#009639] font-mono">{answered}</p>
                        </div>
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Unanswered</p>
                          <p className="text-xl font-black text-amber-700 font-mono">{unanswered}</p>
                        </div>
                      </div>

                      {progressData.latestAnswerer && (
                        <div className="mt-3 w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-900">
                          <span className="font-semibold truncate">⚡ Latest: {progressData.latestAnswerer.name}</span>
                          <span className="font-mono font-bold text-[#009639] shrink-0 ml-1">{progressData.latestAnswerer.timeFormatted}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Round Results & Explanation Card */}
            {gameState === 'REVEAL' && revealResult && (
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-200 space-y-4">
                <h2 className="text-xl font-bold text-[#009639] flex items-center gap-2">
                  <Trophy className="w-6 h-6" /> Round Results
                </h2>
                
                <div className="bg-[#00E676]/10 border border-[#009639]/30 rounded-xl p-4">
                  <p className="text-xs text-[#009639] font-bold uppercase tracking-wider mb-1">Fastest Correct Answer</p>
                  <p className="text-2xl font-black text-gray-800">
                    {revealResult.winner ? revealResult.winner.name : 'No one answered correctly'}
                  </p>
                  {revealResult.winner && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Response: {revealResult.winner.timeFormatted} (Attempt #{revealResult.winner.turnNumber})
                    </p>
                  )}
                </div>

                {/* Explanation statement */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-[#009639]" /> Official Explanation
                  </p>
                  <p className="text-sm font-medium text-gray-800 leading-relaxed">
                    {revealResult.explanation}
                  </p>
                </div>

                {revealResult.leaderboard && revealResult.leaderboard.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">Top Leaderboard</h3>
                    <div className="space-y-1.5">
                      {revealResult.leaderboard.slice(0, 5).map((player: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-sm">
                          <span className="font-medium text-gray-800 flex items-center gap-2">
                            <span className="text-gray-400 font-mono text-xs">{idx + 1}.</span> {player.name}
                          </span>
                          <span className="font-bold text-[#009639]">{player.score} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Joined Players List */}
            <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-[#009639] mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" /> Players ({participants.length})
              </h2>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {participants.length === 0 ? (
                  <p className="text-gray-400 italic text-sm">Waiting for players to join...</p>
                ) : (
                  participants.map((p, idx) => (
                    <div key={idx} className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border bg-gray-100 text-gray-800 border-gray-200">
                      {p.name}
                      <span className="bg-[#009639] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {p.score || 0}
                      </span>
                      {gameState === 'LOBBY' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(p.participantId || p.id, p.name)}
                          className="ml-0.5 text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded-full hover:bg-gray-200"
                          title={`Remove ${p.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
