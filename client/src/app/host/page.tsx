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
  SlidersHorizontal
} from 'lucide-react';

export default function HostDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  const [roomPin, setRoomPin] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [configuredQuestionCount, setConfiguredQuestionCount] = useState(10);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [currentQIndex, setCurrentQIndex] = useState(-1);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  
  // Game States: 'LOBBY', 'READING', 'BUZZER_UNLOCKED', 'ANSWERING', 'REVEAL', 'HOST_CONTROL', 'QUIZ_ENDED', 'RESULTS_PUBLISHED'
  const [gameState, setGameState] = useState('LOBBY');
  const [buzzerQueue, setBuzzerQueue] = useState<any[]>([]);
  const [currentAnswerer, setCurrentAnswerer] = useState<any>(null);
  const [turnInfo, setTurnInfo] = useState<any>(null);
  
  const [revealResult, setRevealResult] = useState<any>(null);
  const [questionWinners, setQuestionWinners] = useState<any[]>([]);
  const [finalResults, setFinalResults] = useState<any>(null);
  const [approvedCriteria, setApprovedCriteria] = useState<'score' | 'time'>('score');
  const [resultsPublished, setResultsPublished] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const roomCreatedRef = useRef(false);

  const attemptCreateRoom = (inputPasscode: string, targetPin?: string) => {
    setLoading(true);
    setAuthError('');
    const socket = getSocket();
    const pinToUse = targetPin !== undefined ? targetPin : (roomPin || (typeof window !== 'undefined' ? sessionStorage.getItem('se_host_room_pin') || '' : ''));
    
    socket.emit('create_room', { passcode: inputPasscode, roomPin: pinToUse }, (res: any) => {
      setLoading(false);
      if (res && res.success) {
        setIsAuthenticated(true);
        setRoomPin(res.roomPin);
        setTotalQuestions(res.totalQuestions || 10);
        setConfiguredQuestionCount(res.configuredQuestionCount || res.totalQuestions || 10);
        if (res.participants) setParticipants(res.participants);
        if (res.participantCount !== undefined) setParticipantCount(res.participantCount);
        if (res.buzzerQueue) setBuzzerQueue(res.buzzerQueue);
        if (res.gameState) setGameState(res.gameState);
        if (res.currentQuestionIndex !== undefined) setCurrentQIndex(res.currentQuestionIndex);
        if (res.activeQuestion) setActiveQuestion(res.activeQuestion);
        if (res.currentAnswerer) setCurrentAnswerer(res.currentAnswerer);
        if (res.questionWinners) setQuestionWinners(res.questionWinners);
        if (res.finalResults) setFinalResults(res.finalResults);
        if (res.approvedCriteria) setApprovedCriteria(res.approvedCriteria);
        if (res.resultsPublished !== undefined) setResultsPublished(res.resultsPublished);
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('se_host_passcode', inputPasscode);
          sessionStorage.setItem('se_host_room_pin', res.roomPin);
          const url = new URL(window.location.href);
          url.searchParams.set('pin', res.roomPin);
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        setIsAuthenticated(false);
        setAuthError(res?.message || 'Access Denied: Invalid Admin Passcode');
      }
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !roomCreatedRef.current) {
      const savedPasscode = sessionStorage.getItem('se_host_passcode');
      const urlPin = new URLSearchParams(window.location.search).get('pin');
      const savedPin = urlPin || sessionStorage.getItem('se_host_room_pin') || '';
      if (savedPasscode) {
        roomCreatedRef.current = true;
        attemptCreateRoom(savedPasscode, savedPin);
      }
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleRoomUpdated = (data: any) => {
      if (data?.participantCount !== undefined) setParticipantCount(data.participantCount);
      if (data?.gameState) setGameState(data.gameState);
      if (data?.currentQuestionIndex !== undefined) setCurrentQIndex(data.currentQuestionIndex);
      if (data?.currentAnswerer !== undefined) setCurrentAnswerer(data.currentAnswerer);
      if (data?.resultsPublished !== undefined) setResultsPublished(data.resultsPublished);
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
      if (data?.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);
    };

    const handleHostRoomUpdated = (data: any) => {
      if (data?.participantCount !== undefined) setParticipantCount(data.participantCount);
      if (data?.participants) setParticipants(data.participants);
      if (data?.buzzerQueue) setBuzzerQueue(data.buzzerQueue);
      if (data?.gameState) setGameState(data.gameState);
      if (data?.currentQuestionIndex !== undefined) setCurrentQIndex(data.currentQuestionIndex);
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
      if (data?.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);
    };

    const handleBuzzerHitRecorded = (data: any) => {
      setBuzzerQueue(data.buzzerQueue || []);
      setCurrentAnswerer(data.activeAnswerer || null);
      if (data.activeAnswerer) setGameState('ANSWERING');
    };

    const handleTurnPassed = (data: any) => {
      setTurnInfo(data);
      if (data.nextAnswerer) {
        setCurrentAnswerer(data.nextAnswerer);
        setGameState('ANSWERING');
      } else {
        setCurrentAnswerer(null);
        setGameState(data.gameState || 'BUZZER_UNLOCKED');
      }
    };

    const handleAnswerRevealed = (data: any) => {
      setRevealResult(data);
      setGameState('REVEAL');
      if (data.winner) {
        setQuestionWinners(prev => {
          const filtered = prev.filter(qw => qw.questionIndex !== data.questionIndex);
          return [...filtered, {
            questionIndex: data.questionIndex,
            winner: data.winner
          }];
        });
      }
    };

    const handleBuzzerUnlocked = () => {
      setGameState('BUZZER_UNLOCKED');
    };

    const handleQuestionPushed = (data: any) => {
      setActiveQuestion({
        questionIndex: data.questionIndex,
        question: data.question,
        options: data.options,
      });
      setCurrentQIndex(data.questionIndex);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setGameState('READING');
      setBuzzerQueue([]);
      setCurrentAnswerer(null);
      setTurnInfo(null);
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
      if (data.questionWinners) setQuestionWinners(data.questionWinners);
      setGameState('QUIZ_ENDED');
    };

    const handleQuizResultsPublished = (data: any) => {
      setFinalResults(data);
      setResultsPublished(true);
      setGameState('RESULTS_PUBLISHED');
      if (data.approvedCriteria) setApprovedCriteria(data.approvedCriteria);
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('host_room_updated', handleHostRoomUpdated);
    socket.on('buzzer_hit_recorded', handleBuzzerHitRecorded);
    socket.on('turn_passed', handleTurnPassed);
    socket.on('answer_revealed', handleAnswerRevealed);
    socket.on('buzzer_unlocked', handleBuzzerUnlocked);
    socket.on('question_pushed', handleQuestionPushed);
    socket.on('question_limit_updated', handleQuestionLimitUpdated);
    socket.on('host_quiz_review', handleHostQuizReview);
    socket.on('quiz_results_published', handleQuizResultsPublished);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('host_room_updated', handleHostRoomUpdated);
      socket.off('buzzer_hit_recorded', handleBuzzerHitRecorded);
      socket.off('turn_passed', handleTurnPassed);
      socket.off('answer_revealed', handleAnswerRevealed);
      socket.off('buzzer_unlocked', handleBuzzerUnlocked);
      socket.off('question_pushed', handleQuestionPushed);
      socket.off('question_limit_updated', handleQuestionLimitUpdated);
      socket.off('host_quiz_review', handleHostQuizReview);
      socket.off('quiz_results_published', handleQuizResultsPublished);
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

  const handlePushQuestion = () => {
    setLoading(true);
    const nextIndex = currentQIndex + 1;
    const socket = getSocket();
    socket.emit('push_question', { roomPin, questionIndex: nextIndex }, (res: any) => {
      setLoading(false);
      if (res.success) {
        setActiveQuestion({
          questionIndex: res.questionIndex,
          question: res.question,
          options: res.options,
        });
        setCurrentQIndex(res.questionIndex);
        setGameState('READING');
        setBuzzerQueue([]);
        setCurrentAnswerer(null);
        setTurnInfo(null);
        setRevealResult(null);
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
          if (res.results.questionWinners) setQuestionWinners(res.results.questionWinners);
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
      sessionStorage.removeItem('se_host_room_pin');
      window.location.href = '/host';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#009639]/20 border border-[#00E676] rounded-2xl flex items-center justify-center text-[#00E676] mb-4 shadow-lg">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Access Gate</h1>
            <p className="text-sm text-slate-400 mt-1">SE Quiz Host Dashboard Protection</p>
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
              attemptCreateRoom(passcode.trim());
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
          <div className="w-10 h-10 rounded-xl bg-[#009639] flex items-center justify-center text-white font-black text-xl shadow-md">
            SE
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#009639]">Schneider Electric MSS</h1>
            <p className="text-xs text-gray-500 font-semibold">Fastest Finger First • Host Control Center</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 mt-4 md:mt-0 flex-wrap justify-center">
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
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-xl border border-gray-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Room</span>
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

          {/* Winner by Question Showcase */}
          <div className="bg-white rounded-3xl shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-6 h-6 text-[#009639]" /> Winners by Question ({questionWinners.length})
              </h3>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                +100 pts per round win • Negative marking -50 pts on wrong attempts
              </span>
            </div>

            {questionWinners.length === 0 ? (
              <p className="text-gray-400 italic text-sm">No questions were completed before quiz end.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {questionWinners.map((qw: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl border-2 border-gray-100 bg-slate-50 hover:border-[#009639]/30 transition-all space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold uppercase">
                      <span className="bg-[#009639] text-white px-2.5 py-0.5 rounded-full">
                        Question #{qw.questionIndex + 1}
                      </span>
                      <span className="text-gray-500">{qw.category || 'Technology'}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-700 line-clamp-2">
                      {qw.questionText}
                    </p>
                    <div className="pt-2 border-t border-gray-200">
                      {qw.winner ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="font-bold text-sm text-gray-900">{qw.winner.name}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#009639]">
                            {qw.winner.timeFormatted} (Turn #{qw.winner.turnNumber})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No correct answer recorded</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

                <div className="flex items-center gap-3">
                  {currentQIndex + 1 >= totalQuestions && gameState === 'REVEAL' ? (
                    <button
                      onClick={() => setShowEndConfirm(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow animate-pulse"
                    >
                      <PowerOff className="w-5 h-5" />
                      <span>End Quiz & Review Results</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePushQuestion}
                      disabled={loading || gameState === 'READING'}
                      className="bg-[#009639] hover:bg-[#00E676] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow"
                    >
                      {loading && gameState !== 'READING' ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                      {currentQIndex === -1 ? 'Start Quiz' : 'Push Next Question'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Question Display Card */}
            {activeQuestion && (
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
                <div className="inline-block bg-[#00E676]/20 text-[#009639] px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase">
                  Question {activeQuestion.questionIndex + 1}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-6 leading-relaxed">
                  {activeQuestion.question}
                </h3>
                
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

            {/* Show Answer Action Box */}
            {gameState !== 'LOBBY' && gameState !== 'REVEAL' && (
              <div className="bg-gray-50 rounded-2xl shadow p-6 border border-gray-200 text-center space-y-4">
                <p className="text-gray-600 font-medium">
                  {gameState === 'READING' && '📖 10s Reading Time in progress...'}
                  {gameState === 'BUZZER_UNLOCKED' && '⚡ Buzzer is live! Waiting for participants to buzz in...'}
                  {gameState === 'ANSWERING' && `🎯 Turn: ${currentAnswerer?.name} is selecting an option on screen...`}
                  {gameState === 'HOST_CONTROL' && '⚠️ Both top 2 participants answered incorrectly! Control passed to host.'}
                </p>

                <button
                  onClick={handleRevealAnswer}
                  disabled={loading}
                  className="bg-[#009639] hover:bg-[#00E676] text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 w-full mx-auto max-w-md shadow-md transition-transform hover:scale-105"
                >
                  <Eye className="w-6 h-6" />
                  Show Answer to All
                </button>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Buzzer Queue & Live Turn Card */}
            <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-[#009639] mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6" /> Live Buzzer Queue ({buzzerQueue.length})
              </h2>

              {buzzerQueue.length === 0 ? (
                <p className="text-gray-400 italic text-sm text-center py-4">No buzzer hits yet...</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {buzzerQueue.map((entry, idx) => {
                    const isActive = currentAnswerer?.socketId === entry.socketId;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isActive
                            ? 'bg-[#00E676]/20 border-[#009639] font-bold text-[#009639] shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                            isActive ? 'bg-[#009639] text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-semibold">{entry.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500">{entry.timeFormatted}</span>
                          {isActive && <UserCheck className="w-4 h-4 text-[#009639]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {turnInfo?.lastAnswererWrong && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{turnInfo.lastAnswererWrong} answered wrong. {turnInfo.noMoreTurns ? 'Both top 2 attempts failed! Control passed to host.' : 'Turn passed to 2nd person!'}</span>
                </div>
              )}
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
