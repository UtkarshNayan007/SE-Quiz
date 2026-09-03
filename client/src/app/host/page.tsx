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
  Lock
} from 'lucide-react';

export default function HostDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  const [roomPin, setRoomPin] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [currentQIndex, setCurrentQIndex] = useState(-1);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  
  // Game States: 'LOBBY', 'READING', 'BUZZER_UNLOCKED', 'ANSWERING', 'REVEAL'
  const [gameState, setGameState] = useState('LOBBY');
  const [buzzerQueue, setBuzzerQueue] = useState<any[]>([]);
  const [currentAnswerer, setCurrentAnswerer] = useState<any>(null);
  const [turnInfo, setTurnInfo] = useState<any>(null);
  
  const [revealResult, setRevealResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const roomCreatedRef = useRef(false);

  const attemptCreateRoom = (inputPasscode: string) => {
    setLoading(true);
    setAuthError('');
    const socket = getSocket();
    socket.emit('create_room', { passcode: inputPasscode }, (res: any) => {
      setLoading(false);
      if (res && res.success) {
        setIsAuthenticated(true);
        setRoomPin(res.roomPin);
        setTotalQuestions(res.totalQuestions || 5);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('se_host_passcode', inputPasscode);
        }
      } else {
        setIsAuthenticated(false);
        setAuthError(res?.message || 'Access Denied: Invalid Admin Passcode');
      }
    });
  };

  useEffect(() => {
    const savedPasscode = typeof window !== 'undefined' ? sessionStorage.getItem('se_host_passcode') : null;
    if (savedPasscode && !roomCreatedRef.current) {
      roomCreatedRef.current = true;
      attemptCreateRoom(savedPasscode);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();

    const handleRoomUpdated = (data: any) => {
      setParticipantCount(data.participantCount || data.participants?.length || 0);
      setParticipants(data.participants || []);
      if (data.gameState) setGameState(data.gameState);
      if (data.buzzerQueue) setBuzzerQueue(data.buzzerQueue);
      if (data.currentAnswerer) setCurrentAnswerer(data.currentAnswerer);
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
      setGameState('READING');
      setBuzzerQueue([]);
      setCurrentAnswerer(null);
      setTurnInfo(null);
      setRevealResult(null);
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('buzzer_hit_recorded', handleBuzzerHitRecorded);
    socket.on('turn_passed', handleTurnPassed);
    socket.on('answer_revealed', handleAnswerRevealed);
    socket.on('buzzer_unlocked', handleBuzzerUnlocked);
    socket.on('question_pushed', handleQuestionPushed);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('buzzer_hit_recorded', handleBuzzerHitRecorded);
      socket.off('turn_passed', handleTurnPassed);
      socket.off('answer_revealed', handleAnswerRevealed);
      socket.off('buzzer_unlocked', handleBuzzerUnlocked);
      socket.off('question_pushed', handleQuestionPushed);
    };
  }, []);

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
    <div className="min-h-screen bg-white text-gray-800 p-4 md:p-8">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-gray-50 border-b-4 border-[#00E676] p-4 md:px-8 mb-6 rounded-t-xl shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-[#009639] w-8 h-8" />
          <h1 className="text-2xl font-bold text-[#009639]">SE Managed Security Services</h1>
        </div>
        <div className="flex items-center gap-6 mt-4 md:mt-0">
          <div className="flex items-center gap-2 bg-[#00E676]/20 px-4 py-2 rounded-full">
            <Users className="w-5 h-5 text-[#009639]" />
            <span className="font-bold text-[#009639]">{participantCount} Players Joined</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-200 px-4 py-2 rounded-full">
            <Hash className="w-5 h-5 text-gray-700" />
            <span className="font-bold text-gray-700 font-mono tracking-widest text-lg">
              {roomPin || '---'}
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4">
          {error}
          <button className="absolute top-0 right-0 p-3" onClick={() => setError('')}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Game Control Card */}
          <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-[#009639] mb-4 flex items-center gap-2">
              <Play className="w-6 h-6" /> Game Controls
            </h2>
            <div className="flex items-center justify-between">
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
              <button
                onClick={handlePushQuestion}
                disabled={loading || (currentQIndex + 1 >= totalQuestions && gameState === 'REVEAL')}
                className="bg-[#009639] hover:bg-[#00E676] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow"
              >
                {loading && gameState !== 'READING' ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {currentQIndex === -1 ? 'Start Quiz' : 'Push Next Question'}
              </button>
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
                <span>{turnInfo.lastAnswererWrong} answered wrong. Turn passed to 2nd person!</span>
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
                  <div key={idx} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border border-gray-200">
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
    </div>
  );
}
