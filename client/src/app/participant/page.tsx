'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import { ShieldCheck, Timer, Zap, CheckCircle2, XCircle, Clock, Send, Lock, Volume2, UserCheck, AlertTriangle, Trophy, Crown, Sparkles, Award, LogOut, RotateCcw, Share2, Download, BookOpen, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import WinnerTrophyModal from '../../components/WinnerTrophyModal';
import { ParticipantRulesGuide } from '../../components/RulesAndGuide';
import { InteractiveQuestionVisual } from '../../components/InteractiveQuestionVisual';
import ThemeToggle from '../../components/ThemeToggle';

const STORAGE_PIN = 'se_quiz_pin';
const STORAGE_NAME = 'se_quiz_name';
const STORAGE_PARTICIPANT_ID = 'se_quiz_participant_id';
const STORAGE_BADGE_NUMBER = 'se_quiz_badge_number';

// Hilarious, relatable Gen-Z cyber awareness quotes for participants who didn't reach the Top 3 podium
const GENZ_CYBER_ACKNOWLEDGMENTS = [
  {
    emoji: '💀',
    tag: 'HR Phishing Scam Averted',
    punchline: "GGs! You survived the tournament without leaking company credentials or falling for 'Urgent: Click here for your Diwali bonus from CEO'!",
    takeaway: "The SOC team won't have to quarantine your laptop at 3 AM — honestly, that's a massive, unhackable W! Stay safe, bestie! 💅🔒"
  },
  {
    emoji: '💅',
    tag: 'Vibes Maintained • Zero Leaks',
    punchline: "No podium trophy today, bestie, but zero company passwords were breached and 100% vibes were maintained.",
    takeaway: "The real flex is knowing never to plug in an untrusted USB found in the parking lot. Unbothered, moisturized, in your cyber defense lane! 💅🛡️"
  },
  {
    emoji: '🫡',
    tag: 'Main Character Defense',
    punchline: "Plot twist: The real championship was the phishing links, rogue Wi-Fi networks, and tailgaters we dodged along the way.",
    takeaway: "Huge thanks for playing! You now officially know more cybersecurity than the scammer sliding into your DMs asking for gift cards. ⚡"
  },
  {
    emoji: '☕',
    tag: 'Stat Defier',
    punchline: "Fun fact: 95% of cyber incidents start with human error. Thanks to your sharp eye today, that statistic took a hit!",
    takeaway: "Take a victory sip of coffee, legend. You helped make Schneider Electric's OT & enterprise defenses that much stronger! ☕😎"
  },
  {
    emoji: '🔒',
    tag: 'Unbreakable Perimeter',
    punchline: "Certified Cyber Defender: ❌ Password123 | ✅ 16-character-multi-factor-unbreakable-fortress.",
    takeaway: "Your badge isn't revoked, your firewalls are up, and zero ransomware took over. Keep critical infrastructure safe and thriving! ⚡🚀"
  },
  {
    emoji: '🕵️',
    tag: 'SOC Vigilance Award',
    punchline: "No trophy today, but you spotted the social engineering traps and SOC door tailgaters like an absolute pro.",
    takeaway: "Everyday human vigilance is our greatest defense. Thank you for protecting Schneider Electric's critical infrastructure! 🛡️✨"
  }
];

// Helper to sanitize participant names: Only capital letters (A-Z) and spaces, collapsed
const sanitizeParticipantName = (rawName: string | null | undefined): string => {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName.toUpperCase().replace(/[^A-Z\s]/g, '').trim().replace(/\s+/g, ' ');
};

// Helper to strip redundant option prefixes (e.g. "A) ", "B. ") since option badge [A] is already rendered in the box
const cleanOptionText = (text: string | null | undefined): string => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/^[A-Da-d][\)\.\:\-]\s*/, '').trim();
};

function ParticipantComponent() {
  const searchParams = useSearchParams();
  const urlPin = (searchParams?.get('pin') || '').trim().toUpperCase();
  const urlName = sanitizeParticipantName(searchParams?.get('name'));
  const [pin, setPin] = useState(urlPin);
  const [name, setName] = useState(urlName);
  const [participantId, setParticipantId] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [joined, setJoined] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
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
  const [isAnsweringClosed, setIsAnsweringClosed] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [publishedResults, setPublishedResults] = useState<any>(null);
  const [isTrophyOpen, setIsTrophyOpen] = useState(false);
  const [genzQuoteIndex, setGenzQuoteIndex] = useState(0);
  const [showRulesGuide, setShowRulesGuide] = useState(true);
  const [isGuideCompleted, setIsGuideCompleted] = useState(false);

  const initialMountDone = useRef(false);
  const isJoiningRef = useRef(false);
  const nameRef = useRef(name);
  const participantIdRef = useRef(participantId);
  const badgeNumberRef = useRef(badgeNumber);
  const myScoreRef = useRef(myScore);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    participantIdRef.current = participantId;
  }, [participantId]);

  useEffect(() => {
    badgeNumberRef.current = badgeNumber;
  }, [badgeNumber]);

  useEffect(() => {
    myScoreRef.current = myScore;
  }, [myScore]);

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
    setIsAnsweringClosed(false);
    setAnswerResult(null);
    setRevealResult(null);
    setMyScore(0);
    setPublishedResults(null);
    setIsTrophyOpen(false);
    setGenzQuoteIndex(0);
    setError('');
  };

  // Helper to determine if current participant is in Top 3 and get trophy celebration details
  const getWinnerTrophyData = (resultsData = publishedResults): { name: string; rank: 1 | 2 | 3; score: number; totalTimeFormatted?: string; correctCount?: number; badgeNumber?: string | number } | null => {
    if (!resultsData) return null;
    const currentName = (name || nameRef.current || (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_NAME) : '') || '').trim();
    const currentPid = (participantId || participantIdRef.current || (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PARTICIPANT_ID) : '') || '').trim();
    const currentBadge = (badgeNumber || badgeNumberRef.current || (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_BADGE_NUMBER) : '') || '').trim();
    const myLower = currentName.toLowerCase();
    if (!myLower && !currentPid && !currentBadge) return null;

    // Strict identity predicate: match by participantId first, then badgeNumber, fallback to name only if neither ID nor badge exists
    const isMe = (p: any): boolean => {
      if (!p) return false;
      if (currentPid && p.participantId) {
        return p.participantId === currentPid;
      }
      if (currentBadge && p.badgeNumber) {
        return String(p.badgeNumber) === String(currentBadge);
      }
      if (!currentPid && !currentBadge && myLower && p.name) {
        return (p.name || '').trim().toLowerCase() === myLower;
      }
      return false;
    };

    // 1. Check data.top3 array
    if (Array.isArray(resultsData.top3)) {
      const foundIdx = resultsData.top3.findIndex(isMe);
      if (foundIdx !== -1 && foundIdx < 3) {
        const p = resultsData.top3[foundIdx];
        return {
          name: p.name || currentName || 'Champion',
          rank: (foundIdx + 1) as 1 | 2 | 3,
          score: p.score ?? myScoreRef.current ?? myScore ?? 0,
          totalTimeFormatted: p.totalTimeFormatted,
          correctCount: p.correctCount,
          badgeNumber: p.badgeNumber || currentBadge || '---'
        };
      }
    }

    // 2. Check grandChampion, runnerUp, thirdPlace explicit fields
    if (resultsData.grandChampion && isMe(resultsData.grandChampion)) {
      return {
        name: resultsData.grandChampion.name || currentName || 'Grand Champion',
        rank: 1,
        score: resultsData.grandChampion.score ?? myScoreRef.current ?? myScore ?? 0,
        totalTimeFormatted: resultsData.grandChampion.totalTimeFormatted,
        correctCount: resultsData.grandChampion.correctCount,
        badgeNumber: resultsData.grandChampion.badgeNumber || currentBadge || '---'
      };
    }
    if (resultsData.runnerUp && isMe(resultsData.runnerUp)) {
      return {
        name: resultsData.runnerUp.name || currentName || 'Runner Up',
        rank: 2,
        score: resultsData.runnerUp.score ?? myScoreRef.current ?? myScore ?? 0,
        totalTimeFormatted: resultsData.runnerUp.totalTimeFormatted,
        correctCount: resultsData.runnerUp.correctCount,
        badgeNumber: resultsData.runnerUp.badgeNumber || currentBadge || '---'
      };
    }
    if (resultsData.thirdPlace && isMe(resultsData.thirdPlace)) {
      return {
        name: resultsData.thirdPlace.name || currentName || 'Third Place',
        rank: 3,
        score: resultsData.thirdPlace.score ?? myScoreRef.current ?? myScore ?? 0,
        totalTimeFormatted: resultsData.thirdPlace.totalTimeFormatted,
        correctCount: resultsData.thirdPlace.correctCount,
        badgeNumber: resultsData.thirdPlace.badgeNumber || currentBadge || '---'
      };
    }

    // 3. Check allRanks or leaderboard for rank <= 3
    const allList = resultsData.allRanks || resultsData.leaderboard || [];
    const foundInAll = allList.find(isMe);
    if (foundInAll && typeof foundInAll.rank === 'number' && foundInAll.rank >= 1 && foundInAll.rank <= 3) {
      return {
        name: foundInAll.name || currentName || 'Winner',
        rank: foundInAll.rank as 1 | 2 | 3,
        score: foundInAll.score ?? myScoreRef.current ?? myScore ?? 0,
        totalTimeFormatted: foundInAll.totalTimeFormatted,
        correctCount: foundInAll.correctCount,
        badgeNumber: foundInAll.badgeNumber || currentBadge || '---'
      };
    }

    return null;
  };

  // Automatically pop up animated 3D trophy for Top 3 Winners as soon as results are published
  useEffect(() => {
    if (gameState === 'RESULTS_PUBLISHED' && publishedResults) {
      const winnerData = getWinnerTrophyData(publishedResults);
      if (winnerData) {
        setIsTrophyOpen(true);
      }
    }
  }, [gameState, publishedResults, name, participantId]);

  const performJoin = (roomPinToUse: string, nameToUse: string, pIdToUse?: string) => {
    const cleanPin = (roomPinToUse || '').trim().toUpperCase();
    const cleanName = sanitizeParticipantName(nameToUse);
    if (!cleanPin || !cleanName || cleanName.replace(/\s/g, '').length < 2) {
      setIsAutoConnecting(false);
      return;
    }

    if (isJoiningRef.current) {
      console.log('[JOIN] Join request already in-flight, skipping duplicate call');
      return;
    }
    isJoiningRef.current = true;

    // Safety timeout in case socket callback drops
    const joinTimeout = setTimeout(() => {
      isJoiningRef.current = false;
    }, 6000);

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join_room', {
      roomPin: cleanPin,
      name: cleanName,
      participantId: pIdToUse || undefined,
      role: 'participant'
    }, (res: any) => {
      clearTimeout(joinTimeout);
      isJoiningRef.current = false;
      setIsAutoConnecting(false);
      if (res?.success) {
        setJoined(true);
        setPin(cleanPin);
        setName(cleanName);
        setError('');

        const effectivePid = res.participantId || pIdToUse;
        if (effectivePid) {
          setParticipantId(effectivePid);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_PARTICIPANT_ID, effectivePid);
            localStorage.setItem(STORAGE_PIN, cleanPin);
            localStorage.setItem(STORAGE_NAME, cleanName);
            const url = new URL(window.location.href);
            url.searchParams.set('pin', cleanPin);
            window.history.replaceState({}, '', url.toString());
          }
        }

        if (res.badgeNumber) {
          setBadgeNumber(String(res.badgeNumber));
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_BADGE_NUMBER, String(res.badgeNumber));
          }
        }

        if (res.gameState) setGameState(res.gameState);
        if (res.answeringEnded) setIsAnsweringClosed(true);
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
          const winnerData = getWinnerTrophyData(res.finalResults);
          if (winnerData) {
            setIsTrophyOpen(true);
          }
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_PIN);
          localStorage.removeItem(STORAGE_PARTICIPANT_ID);
          localStorage.removeItem(STORAGE_BADGE_NUMBER);
          // Preserve STORAGE_NAME so user doesn't need to retype their name
        }
        setJoined(false);
        setBadgeNumber('');
        setError(res?.message || 'Room not found or session expired');
      }
    });
  };

  // Synchronize session or switch rooms when a new QR code is scanned
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPin = (localStorage.getItem(STORAGE_PIN) || '').trim().toUpperCase();
    const savedName = sanitizeParticipantName(localStorage.getItem(STORAGE_NAME));
    const savedPid = (localStorage.getItem(STORAGE_PARTICIPANT_ID) || '').trim();
    const savedBadge = (localStorage.getItem(STORAGE_BADGE_NUMBER) || '').trim();

    const isDifferentRoom = Boolean(urlPin && savedPin && urlPin !== savedPin);
    const isDifferentName = Boolean(urlName && savedName && urlName.toLowerCase() !== savedName.toLowerCase());

    // If new room or new name is passed -> FRESH SESSION! Clear old participant ID & badge
    if (isDifferentRoom || isDifferentName) {
      console.log(`[SESSION RESET] Resetting participant session (diffRoom: ${isDifferentRoom}, diffName: ${isDifferentName})`);
      localStorage.removeItem(STORAGE_PARTICIPANT_ID);
      localStorage.removeItem(STORAGE_BADGE_NUMBER);
      if (urlPin) localStorage.setItem(STORAGE_PIN, urlPin);
      if (urlName) localStorage.setItem(STORAGE_NAME, urlName);

      const targetPin = urlPin || savedPin;
      const targetName = urlName || savedName;

      setPin(targetPin);
      setName(targetName);
      setParticipantId('');
      setBadgeNumber('');
      setJoined(false);
      resetQuizState();
      // DO NOT auto-join! Wait for user to confirm details and click Enter Lobby
      setIsAutoConnecting(false);
      return;
    }

    // Normal mount / refresh flow
    if (initialMountDone.current) return;
    initialMountDone.current = true;

    const effectivePin = urlPin || savedPin;
    const effectiveName = urlName || savedName;

    if (effectivePin) setPin(effectivePin);
    if (effectiveName) setName(effectiveName);

    // ONLY auto-reconnect if there was already an active session for THIS room
    if (savedPid && savedPin && effectivePin === savedPin && effectiveName && effectiveName.replace(/\s/g, '').length >= 2) {
      setParticipantId(savedPid);
      if (savedBadge) setBadgeNumber(savedBadge);
      setIsAutoConnecting(true);
      performJoin(effectivePin, effectiveName, savedPid);
    } else {
      setParticipantId('');
      setBadgeNumber('');
      setJoined(false);
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
      if (roomData?.answeringEnded !== undefined) {
        setIsAnsweringClosed(Boolean(roomData.answeringEnded));
      }
    };

    const handleQuestionPushed = (data: any) => {
      setShowRulesGuide(false);
      setActiveQuestion(data);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setCountdown(data.durationSeconds || 10);
      setSelectedOption(null);
      setHasSubmitted(false);
      setSubmittedTime('');
      setIsSubmitting(false);
      setIsAnsweringClosed(false);
      setAnswerResult(null);
      setRevealResult(null);
      setGameState('READING');
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

    const handleQuestionLimitUpdated = (data: any) => {
      if (data?.totalQuestions) setTotalQuestions(data.totalQuestions);
    };

    const handleAnswerRevealed = (data: any) => {
      setRevealResult(data);
      setIsAnsweringClosed(false);
      setGameState('REVEAL');
    };

    const handleQuizEnded = () => {
      setGameState('QUIZ_ENDED');
    };

    const handleQuizResultsPublished = (data: any) => {
      setGameState('RESULTS_PUBLISHED');
      setPublishedResults(data);
      triggerConfettiExplosion();

      // Check if current participant is in Top 3 -> automatically celebrate with animated 3D trophy modal!
      const winnerData = getWinnerTrophyData(data);
      if (winnerData) {
        setIsTrophyOpen(true);
      }
    };

    const handleRoomDestroyed = (data: any) => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_PIN);
        localStorage.removeItem(STORAGE_PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_BADGE_NUMBER);
      }
      setJoined(false);
      setBadgeNumber('');
      resetQuizState();
      setError(data?.message || 'Session ended by host');
    };

    // Auto re-join when socket reconnects (after network drop, phone call, background wake)
    // ONLY reconnect if this participant has an existing session ID for THIS exact room PIN
    const handleConnect = () => {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const currentUrlPin = (urlParams.get('pin') || '').trim().toUpperCase();
        const savedP = (localStorage.getItem(STORAGE_PIN) || '').trim().toUpperCase();
        const savedN = sanitizeParticipantName(localStorage.getItem(STORAGE_NAME));
        const savedId = (localStorage.getItem(STORAGE_PARTICIPANT_ID) || '').trim();
        
        const targetPin = currentUrlPin || savedP;

        if (savedId && savedP && targetPin === savedP && savedN && savedN.replace(/\s/g, '').length >= 2) {
          performJoin(targetPin, savedN, savedId);
        }
      }
    };

    const handleRoundResult = (data: any) => {
      if (data?.currentScore !== undefined) {
        setMyScore(data.currentScore);
      }
    };

    const handleRulesStarted = () => {
      setGameState('RULES');
      setShowRulesGuide(false);
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('rules_started', handleRulesStarted);
    socket.on('question_pushed', handleQuestionPushed);
    socket.on('answering_started', handleAnsweringStarted);
    socket.on('answering_closed', handleAnsweringClosed);
    socket.on('question_limit_updated', handleQuestionLimitUpdated);
    socket.on('answer_revealed', handleAnswerRevealed);
    socket.on('round_result', handleRoundResult);
    socket.on('quiz_ended', handleQuizEnded);
    socket.on('quiz_results_published', handleQuizResultsPublished);
    socket.on('room_destroyed', handleRoomDestroyed);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('rules_started', handleRulesStarted);
      socket.off('question_pushed', handleQuestionPushed);
      socket.off('answering_started', handleAnsweringStarted);
      socket.off('answering_closed', handleAnsweringClosed);
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
        const currentUrlPin = (new URLSearchParams(window.location.search).get('pin') || '').trim().toUpperCase();
        const savedP = (localStorage.getItem(STORAGE_PIN) || '').trim().toUpperCase();
        const savedN = sanitizeParticipantName(localStorage.getItem(STORAGE_NAME));
        const savedId = (localStorage.getItem(STORAGE_PARTICIPANT_ID) || '').trim();
        const targetPin = currentUrlPin || savedP;
        if (savedId && savedP && targetPin === savedP && savedN && savedN.replace(/\s/g, '').length >= 2) {
          performJoin(targetPin, savedN, savedId);
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
    if (isJoiningRef.current) return;

    const cleanPin = (pin || '').trim().toUpperCase();
    const cleanName = sanitizeParticipantName(name);

    if (!cleanPin) {
      setError('Please enter the Room PIN');
      return;
    }

    if (!cleanName) {
      setError('Please enter your Name');
      return;
    }

    if (name && (/[0-9]/.test(name) || /[^A-Za-z\s]/.test(name))) {
      setError('Name must contain only capital letters (A-Z) and spaces. Numbers and special characters are not allowed.');
      return;
    }

    if (cleanName.replace(/\s/g, '').length < 2) {
      setError('Please enter a valid name with at least 2 letters.');
      return;
    }

    if (cleanName.length > 35) {
      setError('Name is too long. Maximum 35 characters allowed.');
      return;
    }

    setError('');
    setName(cleanName);
    const existingPid = participantId || (typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_PARTICIPANT_ID) || undefined) : undefined);
    performJoin(cleanPin, cleanName, existingPid);
  };

  const handleLeaveRoom = () => {
    const socket = getSocket();
    socket.emit('leave_room', { roomPin: pin }, () => {});
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_PIN);
      localStorage.removeItem(STORAGE_PARTICIPANT_ID);
      localStorage.removeItem(STORAGE_BADGE_NUMBER);
      const url = new URL(window.location.href);
      url.searchParams.delete('pin');
      window.history.replaceState({}, '', url.toString());
    }
    setJoined(false);
    setPin('');
    setParticipantId('');
    setBadgeNumber('');
    resetQuizState();
  };

  const handleOptionClick = (index: number) => {
    if (gameState !== 'ANSWERING' || hasSubmitted || isSubmitting || countdown <= 0 || isAnsweringClosed) return;

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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-slate-800 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[#009639] border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reconnecting to Quiz...</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Restoring your session, score, and room position</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle showLabel={false} />
        </div>
        <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-slate-800">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/se-logo.png"
                alt="Schneider Electric"
                className="h-11 sm:h-13 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join Quiz Session</h1>
            <p className="text-xs font-bold text-[#009639] dark:text-[#00E676] uppercase tracking-wider mt-1">Cyber Day 2026</p>
          </div>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 p-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Room PIN</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                placeholder="e.g. 123456"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-[#009639] focus:ring-2 focus:ring-[#00E676]/30 outline-none uppercase font-mono text-center text-2xl tracking-widest font-bold"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const cleaned = e.target.value.toUpperCase().replace(/[^A-Z\s]/g, '');
                  setName(cleaned);
                  if (error) setError('');
                }}
                placeholder="ENTER YOUR FULL NAME"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:border-[#009639] focus:ring-2 focus:ring-[#00E676]/30 outline-none uppercase font-semibold tracking-wide"
                maxLength={35}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 font-medium">
                Capital letters only (A-Z). No numbers or special characters.
              </p>
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-2.5 sm:px-4 py-3 sm:py-6 pb-12 transition-all">
      <div className="w-full max-w-lg mx-auto space-y-3.5 sm:space-y-5">
        
        {/* Top Player Info Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-3 sm:p-4 flex items-center justify-between border border-gray-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <img
              src="/se-logo.png"
              alt="Schneider Electric"
              className="h-6 sm:h-7 w-auto object-contain drop-shadow-sm shrink-0"
            />
            <div className="min-w-0 border-l border-gray-200 dark:border-slate-700 pl-2">
              <p className="text-[9px] sm:text-[10px] text-[#009639] dark:text-[#00E676] font-bold uppercase tracking-wider truncate">Cyber Day 2026</p>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base leading-tight truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[180px]">{name}</p>
                {badgeNumber && (
                  <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-xs">
                    #{badgeNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img
              src="/cyber-shield-logo.png"
              alt="Cyber Security Shield"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm shrink-0"
            />
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Score</p>
              <p className="font-bold text-amber-600 dark:text-amber-400 text-base sm:text-lg leading-tight">{myScore} <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 dark:text-slate-500">pts</span></p>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="text-right">
                <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Room</p>
                <p className="font-mono font-bold text-[#009639] dark:text-[#00E676] text-sm sm:text-base leading-tight">{pin}</p>
              </div>
              <ThemeToggle showLabel={false} />
              <button
                onClick={handleLeaveRoom}
                title="Leave Room"
                className="p-1 sm:p-1.5 text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* LOBBY State (Waiting or viewing guide) */}
        {gameState === 'LOBBY' && !showRulesGuide && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-8 text-center border border-gray-100 dark:border-slate-800">
            <div className="animate-pulse flex justify-center mb-4">
              <Zap className="w-16 h-16 text-[#009639] dark:text-[#00E676]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">You are in the Lobby!</h2>
            {badgeNumber && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-mono text-xs font-bold shadow-xs">
                <span className="text-amber-700 dark:text-amber-400">Event Badge:</span>
                <span className="text-amber-950 dark:text-amber-100 font-black text-sm">#{badgeNumber}</span>
              </div>
            )}
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Waiting for the host to push the first question...</p>
            <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{totalQuestions} Questions in this round</span>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowRulesGuide(true)}
                className="w-full py-3 bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>📖 View Rules & Interface Tour</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={handleLeaveRoom}
                className="text-xs text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors inline-flex items-center gap-1 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Player / Leave Room</span>
              </button>
            </div>
          </div>
        )}

        {/* LOBBY State with Guide Open */}
        {gameState === 'LOBBY' && showRulesGuide && (
          <div className="w-full">
            <ParticipantRulesGuide onClose={() => setShowRulesGuide(false)} />
          </div>
        )}

        {/* RULES State (Active Host Briefing Phase) */}
        {gameState === 'RULES' && (
          <div className="w-full">
            {isGuideCompleted ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-800 max-w-lg mx-auto">
                <div className="w-16 h-16 mx-auto bg-emerald-50 dark:bg-emerald-950/40 text-[#009639] dark:text-[#00E676] rounded-2xl flex items-center justify-center mb-4 border border-emerald-200 dark:border-emerald-800 shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">You're All Set! 🚀</h2>
                <p className="text-gray-600 dark:text-slate-300 text-xs mb-6 leading-relaxed">
                  You have reviewed the tournament rules and mobile interface demo. Stay on this screen — Question 1 will start automatically as soon as the host launches it!
                </p>
                <button
                  type="button"
                  onClick={() => setIsGuideCompleted(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Reopen Guide</span>
                </button>
              </div>
            ) : (
              <ParticipantRulesGuide onClose={() => setIsGuideCompleted(true)} />
            )}
          </div>
        )}

        {/* QUIZ_ENDED Waiting Screen */}
        {gameState === 'QUIZ_ENDED' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-8 text-center border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="w-16 h-16 mx-auto bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center animate-bounce">
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Quiz Completed!</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
              Great effort! The host is reviewing the scores and response times. Official results will be published shortly...
            </p>
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-around">
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase font-semibold">Your Final Score</p>
                <p className="text-2xl font-black text-[#009639] dark:text-[#00E676]">{myScore} pts</p>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS_PUBLISHED State */}
        {gameState === 'RESULTS_PUBLISHED' && publishedResults && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-500">
            {/* Grand Champion Banner */}
            <div className="bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white text-center shadow-xl relative overflow-hidden">
              <div className="absolute top-2 right-3 opacity-20">
                <Crown className="w-20 h-20 sm:w-24 sm:h-24" />
              </div>
              <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2.5 sm:mb-3">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-200" />
                <span>
                  Official Champion • Ranked by Score & Speed
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-1 drop-shadow-sm break-words">
                {publishedResults.grandChampion ? publishedResults.grandChampion.name : (publishedResults.champion?.name || 'Grand Champion')}
              </h2>
              <p className="text-white/90 text-xs sm:text-sm font-semibold">
                {publishedResults.grandChampion?.score ?? publishedResults.champion?.score ?? 0} pts • {publishedResults.grandChampion?.correctCount ?? publishedResults.champion?.correctCount ?? 0} Correct • Speed: {publishedResults.grandChampion?.totalTimeFormatted || publishedResults.champion?.totalTimeFormatted || '--'}
              </p>

              {(publishedResults.grandChampion?.tieBrokenByTime || publishedResults.champion?.tieBrokenByTime) && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/25 px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white">
                  <Zap className="w-3 h-3 text-yellow-200" />
                  <span>⚡ Won tie-breaker via faster speed!</span>
                </div>
              )}

              {(publishedResults.grandChampion?.name || publishedResults.champion?.name)?.toLowerCase() === name?.toLowerCase() && (
                <div className="mt-3 sm:mt-4 inline-block bg-white text-amber-700 font-black px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm shadow-md animate-bounce">
                  🎉 YOU ARE THE CHAMPION! 🎉
                </div>
              )}
            </div>

            {/* 4 Award Categories Showcase */}
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">
                Official Quiz Awards
              </h3>

              {/* 1. Top 3 Podium */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-gray-100 dark:border-slate-800 shadow-sm space-y-2 sm:space-y-2.5">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">🏆 Top 3 Podium</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xs">
                  {/* 1st Place */}
                  <div className="p-1.5 sm:p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl min-w-0">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-400 text-amber-950 font-black rounded text-[9px] sm:text-[10px] mb-1">#1</span>
                    <p className="font-bold text-gray-900 dark:text-white text-[11px] sm:text-xs truncate">{publishedResults.top3?.[0]?.name || publishedResults.grandChampion?.name || 'TBD'}</p>
                    <p className="font-mono text-[#009639] dark:text-[#00E676] font-extrabold text-[10px] sm:text-xs">{publishedResults.top3?.[0]?.score ?? publishedResults.grandChampion?.score ?? 0} pts</p>
                  </div>
                  {/* 2nd Place */}
                  <div className="p-1.5 sm:p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl min-w-0">
                    <span className="inline-block px-1.5 py-0.5 bg-slate-300 text-slate-800 font-black rounded text-[9px] sm:text-[10px] mb-1">#2</span>
                    <p className="font-bold text-gray-900 dark:text-white text-[11px] sm:text-xs truncate">{publishedResults.top3?.[1]?.name || 'TBD'}</p>
                    <p className="font-mono text-slate-700 dark:text-slate-300 font-extrabold text-[10px] sm:text-xs">{publishedResults.top3?.[1]?.score ?? 0} pts</p>
                  </div>
                  {/* 3rd Place */}
                  <div className="p-1.5 sm:p-2.5 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl min-w-0">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-600 text-white font-black rounded text-[9px] sm:text-[10px] mb-1">#3</span>
                    <p className="font-bold text-gray-900 dark:text-white text-[11px] sm:text-xs truncate">{publishedResults.top3?.[2]?.name || 'TBD'}</p>
                    <p className="font-mono text-amber-800 dark:text-amber-300 font-extrabold text-[10px] sm:text-xs">{publishedResults.top3?.[2]?.score ?? 0} pts</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Winner Trophy Card OR Gen-Z Participant Acknowledgment Card */}
            {(() => {
              const winnerTrophy = getWinnerTrophyData();
              const isWinner = Boolean(winnerTrophy);
              const genzQuote = GENZ_CYBER_ACKNOWLEDGMENTS[genzQuoteIndex % GENZ_CYBER_ACKNOWLEDGMENTS.length];

              if (isWinner && winnerTrophy) {
                const awardTitle = winnerTrophy.rank === 1
                  ? 'Grand Champion • 1st Place'
                  : winnerTrophy.rank === 2
                  ? '1st Runner Up • 2nd Place'
                  : '2nd Runner Up • 3rd Place';

                return (
                  <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 border shadow-xl relative overflow-hidden transition-all bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 border-amber-400/60 text-white">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Trophy className="w-32 h-32 text-yellow-300" />
                    </div>

                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 animate-pulse">
                          <Trophy className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                              🏆 Cyber Day 2026 Winner
                            </span>
                            <span className="text-[10px] font-mono text-amber-200/70 truncate">
                              Rank #{winnerTrophy.rank}
                            </span>
                            {(winnerTrophy.badgeNumber || badgeNumber) && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/30 text-amber-200 border border-amber-400/50">
                                Badge #{winnerTrophy.badgeNumber || badgeNumber}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg sm:text-xl font-black mt-0.5 text-amber-300 truncate">
                            Virtual Trophy & Podium Honor!
                          </h3>
                          <p className="text-xs text-slate-300 truncate">
                            {awardTitle} • Cyber Day 2026 by Schneider Electric
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Winner Action Button */}
                    <div className="mt-3 sm:mt-4">
                      <button
                        onClick={() => setIsTrophyOpen(true)}
                        className="w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/25 transition active:scale-95 cursor-pointer"
                      >
                        <Trophy className="w-4 h-4 shrink-0 text-slate-950" />
                        <span>🏆 Open Animated 3D Trophy</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-center mt-2.5 text-amber-200/80">
                      Celebratory applause, vibration & 1-click LinkedIn/Instagram sharing available!
                    </p>
                  </div>
                );
              }

              // Rest of Participants (Rank 4+) - Gen-Z Humorous Acknowledgment & Cyber Learnings
              return (
                <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 border shadow-lg relative overflow-hidden transition-all bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/30 text-white">
                  <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl">
                        {genzQuote.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40">
                            🛡️ {genzQuote.tag}
                          </span>
                          {badgeNumber && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/50">
                              Badge #{badgeNumber}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-black mt-0.5 text-white truncate">
                          Thanks for Playing, Cyber Defender!
                        </h3>
                        <p className="text-[11px] sm:text-xs text-indigo-200/80 truncate">
                          Schneider Electric Cyber Day 2026 Awareness
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gen-Z Humorous Punchline */}
                  <div className="my-3 p-3 sm:p-3.5 bg-white/5 border border-indigo-400/20 rounded-2xl backdrop-blur-sm">
                    <p className="text-xs sm:text-sm text-indigo-100 font-semibold leading-relaxed">
                      &ldquo;{genzQuote.punchline}&rdquo;
                    </p>
                  </div>

                  {/* Cyber Awareness Learning Takeaway */}
                  <div className="p-3 sm:p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] sm:text-xs text-emerald-200/90 leading-relaxed">
                      <span className="font-bold text-emerald-300 uppercase tracking-wide block mb-0.5">
                        Key Cyber Security Takeaway:
                      </span>
                      {genzQuote.takeaway}
                    </div>
                  </div>

                  {/* Action Button: Next Laugh */}
                  <div className="mt-3.5 sm:mt-4">
                    <button
                      onClick={() => setGenzQuoteIndex((prev) => (prev + 1) % GENZ_CYBER_ACKNOWLEDGMENTS.length)}
                      className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 sm:gap-2 bg-indigo-600/60 hover:bg-indigo-600/80 border border-indigo-400/30 text-white transition active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>Next Cyber Laugh 🎲</span>
                    </button>
                  </div>
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
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-3.5 sm:p-5 border border-gray-100 dark:border-slate-800">
                  <h3 className="text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 sm:mb-3">
                    Your Performance Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3 text-center">
                    <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950/40 rounded-xl border border-green-100 dark:border-green-900/50">
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium">Final Score</p>
                      <p className="text-base sm:text-xl font-black text-[#009639] dark:text-[#00E676]">{myData?.score ?? myScore} pts</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-900/50">
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium">Final Rank</p>
                      <p className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">
                        {myRank > 0 ? `#${myRank}` : '-'}
                      </p>
                    </div>
                    <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50">
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium">Total Speed</p>
                      <p className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400 mt-1 truncate">
                        {myData?.totalTimeFormatted || '--'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Top Leaderboard */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-3.5 sm:p-5 border border-gray-100 dark:border-slate-800 space-y-2.5 sm:space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Official Leaderboard</h3>
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  Ranked by Score • Tie-breaker: Speed
                </span>
              </div>
              <div className="space-y-1.5 sm:space-y-2 max-h-64 overflow-y-auto pr-1">
                {(publishedResults.leaderboard || publishedResults.leaderboardByScore)?.slice(0, 10).map((player: any, idx: number) => {
                  const isMe = player.name?.toLowerCase() === name?.toLowerCase();
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-[11px] sm:text-xs font-semibold gap-2 ${
                        isMe 
                          ? 'bg-green-50 dark:bg-green-950/40 border-[#009639] text-[#009639] dark:text-[#00E676]' 
                          : idx === 0 
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200' 
                            : 'bg-gray-50 dark:bg-slate-800/60 border-gray-100 dark:border-slate-800 text-gray-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs shrink-0 ${
                          idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="truncate">{player.name} {isMe && '(You)'}</span>
                        {player.tieBrokenByTime && (
                          <span className="text-[8px] sm:text-[9px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-bold shrink-0 border border-blue-200 dark:border-blue-800">
                            ⚡ Fast
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span className="font-bold text-gray-900 dark:text-white">{player.score} pts</span>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500 ml-1.5">
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
          <div className="space-y-3.5 sm:space-y-5">
            
            {/* Question Info Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 sm:p-5 border border-gray-100 dark:border-slate-800 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 sm:px-3 py-1 bg-[#009639] text-white text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-sm">
                    Question {activeQuestion.questionIndex + 1} of {activeQuestion.totalQuestions || totalQuestions}
                  </span>
                  <span className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-full border ${
                    activeQuestion.type === 'riddle' ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                    activeQuestion.type === 'crossword' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' :
                    activeQuestion.type === 'fill_in_the_blank' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                    activeQuestion.type === 'image' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}>
                    {activeQuestion.category}
                  </span>
                </div>
                
                {gameState === 'READING' && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm shrink-0">
                    <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>10s Reading ({countdown}s)</span>
                  </div>
                )}
                
                {gameState === 'ANSWERING' && (
                  <div className={`flex items-center gap-1.5 font-bold px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm shrink-0 border ${
                    countdown > 0 && !isAnsweringClosed
                      ? 'text-[#009639] dark:text-[#00E676] bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 animate-pulse'
                      : 'text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                  }`}>
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>
                      {countdown > 0 && !isAnsweringClosed
                        ? `30s Answering (${countdown}s)`
                        : 'Answering Closed'}
                    </span>
                  </div>
                )}

                {gameState === 'REVEAL' && (
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300 font-bold bg-gray-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm shrink-0">
                    <span>Question Over</span>
                  </div>
                )}
              </div>
              
              {!(activeQuestion.type === 'riddle' || activeQuestion.type === 'fill_in_the_blank') && (
                <h3 className="text-sm sm:text-base md:text-lg font-black text-gray-900 dark:text-white leading-snug break-words">
                  {activeQuestion.question}
                </h3>
              )}
            </div>

            {/* Interactive Question Visual (Spot the Difference / Picture MCQ / Memory Check / Crossword / Image Scenario) */}
            {((activeQuestion.type && activeQuestion.type !== 'theory') || activeQuestion.imageUrl || activeQuestion.visualData?.imageUrl || (activeQuestion.id && [8, 9, 11, 16].includes(activeQuestion.id))) && (
              <div className="shrink-0 w-full overflow-hidden">
                <InteractiveQuestionVisual
                  type={activeQuestion.type}
                  imageUrl={activeQuestion.imageUrl || activeQuestion.visualData?.imageUrl}
                  questionId={activeQuestion.id}
                  questionText={activeQuestion.question}
                  visualData={activeQuestion.visualData}
                  revealVisual={revealResult?.revealVisual || activeQuestion.revealVisual}
                  isReveal={gameState === 'REVEAL'}
                  compact={true}
                />
              </div>
            )}

            {/* STATUS BANNER */}
            {gameState === 'READING' && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 py-2 sm:py-2.5 px-3 rounded-xl text-center flex items-center justify-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <p className="text-[11px] sm:text-xs font-bold text-amber-800 dark:text-amber-300">
                  Reading Phase ({countdown}s) • Answering will unlock automatically
                </p>
              </div>
            )}

            {gameState === 'ANSWERING' && !hasSubmitted && (
              <div className={`py-2 sm:py-2.5 px-3 rounded-xl border text-center flex items-center justify-between gap-2 ${
                countdown > 0 && !isAnsweringClosed
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
              }`}>
                <div className="flex items-center gap-1.5">
                  {countdown > 0 && !isAnsweringClosed ? (
                    <>
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 fill-blue-600 shrink-0" />
                      <span className="text-[11px] sm:text-xs font-black text-blue-900 dark:text-blue-300">Answering Live</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                      <span className="text-[11px] sm:text-xs font-black text-amber-900 dark:text-amber-300">Time's Up</span>
                    </>
                  )}
                </div>
                <span className={`text-[11px] sm:text-xs font-bold ${
                  countdown > 0 && !isAnsweringClosed ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {countdown > 0 && !isAnsweringClosed
                    ? `${countdown}s remaining`
                    : 'Awaiting host reveal...'}
                </span>
              </div>
            )}

            {gameState === 'ANSWERING' && hasSubmitted && (
              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 py-2 sm:py-2.5 px-3 rounded-xl text-center flex items-center justify-center gap-2 animate-in fade-in">
                <Lock className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
                  Answer Locked In {submittedTime ? `(${submittedTime})` : ''} • Waiting for reveal
                </span>
              </div>
            )}

            {/* MCQ OPTIONS LIST */}
            <div className="space-y-2 sm:space-y-2.5">
              {activeQuestion.options?.map((optionText: string, idx: number) => {
                const isSelected = selectedOption === idx;
                
                let cardClass = "relative w-full text-left bg-white dark:bg-slate-900 rounded-xl border-2 p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3 overflow-hidden select-none outline-none focus:outline-none transition-all min-h-[52px]";
                let letterClass = "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-xs sm:text-sm transition-colors";
                let Icon = null;

                if (gameState === 'READING') {
                  cardClass += " border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 opacity-60 cursor-not-allowed";
                  letterClass += " bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400";
                } 
                else if (gameState === 'ANSWERING') {
                  if (hasSubmitted) {
                    if (isSelected) {
                      cardClass += " border-slate-900 dark:border-[#009639] bg-slate-50 dark:bg-slate-800/90 shadow-md font-bold text-slate-900 dark:text-white cursor-default";
                      letterClass += " bg-slate-900 dark:bg-[#009639] text-white";
                      Icon = <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-[#00E676] absolute right-3 sm:right-4 shrink-0" />;
                    } else {
                      cardClass += " border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 opacity-40 cursor-not-allowed";
                      letterClass += " bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600";
                    }
                  } else if (countdown <= 0 || isAnsweringClosed) {
                    cardClass += " border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 opacity-50 cursor-not-allowed";
                    letterClass += " bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600";
                  } else {
                    cardClass += " border-gray-200 dark:border-slate-800 text-gray-800 dark:text-slate-100 cursor-pointer active:scale-[0.99] active:bg-gray-50 dark:active:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700";
                    letterClass += " bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300";
                  }
                }
                else if (gameState === 'REVEAL') {
                  const isCorrect = revealResult?.correctAnswerIndex === idx;
                  
                  if (isCorrect) {
                    cardClass += " border-[#009639] dark:border-[#00E676] bg-green-50 dark:bg-emerald-950/40 shadow-sm font-bold text-[#009639] dark:text-[#00E676]";
                    letterClass += " bg-[#009639] text-white";
                    Icon = <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#009639] dark:text-[#00E676] absolute right-3 sm:right-4 shrink-0" />;
                  } else if (isSelected && !isCorrect) {
                    cardClass += " border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold";
                    letterClass += " bg-red-500 text-white";
                    Icon = <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 absolute right-3 sm:right-4 shrink-0" />;
                  } else {
                    cardClass += " border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 opacity-40";
                    letterClass += " bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(idx)}
                    disabled={gameState !== 'ANSWERING' || hasSubmitted || isSubmitting || countdown <= 0 || isAnsweringClosed}
                    className={cardClass}
                  >
                    <div className={letterClass}>{letters[idx]}</div>
                    <span className="font-semibold text-xs sm:text-sm leading-relaxed pr-8 break-words flex-1">{cleanOptionText(optionText)}</span>
                    {Icon}
                  </button>
                );
              })}
            </div>

            {/* UNIFIED ROUND OUTCOME & EXPLANATION (Evaluated ONLY at Reveal) */}
            {gameState === 'REVEAL' && revealResult && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3 sm:space-y-4 animate-in fade-in">
                {/* 1. Clear Round Outcome Header (Single non-duplicated outcome banner) */}
                {selectedOption !== null && selectedOption === revealResult.correctAnswerIndex && (
                  <div className="p-3 sm:p-3.5 bg-green-50 dark:bg-emerald-950/40 border-2 border-green-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#009639] text-white flex items-center justify-center font-bold shrink-0">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                          Correct Answer!
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate sm:whitespace-normal">
                          Great job! +100 points added to your score
                        </p>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-[#009639] dark:text-[#00E676] bg-white dark:bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg border border-green-200 dark:border-emerald-800 shadow-sm shrink-0">
                      +100 pts
                    </span>
                  </div>
                )}

                {selectedOption !== null && selectedOption !== revealResult.correctAnswerIndex && (
                  <div className="p-3 sm:p-3.5 bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-wide">
                          Incorrect (0 Points)
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-red-700 dark:text-red-400 font-medium truncate sm:whitespace-normal">
                          No negative marking • 0 points deducted
                        </p>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-black text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 shadow-sm shrink-0">
                      0 pts
                    </span>
                  </div>
                )}

                {selectedOption === null && (
                  <div className="p-3 sm:p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">Time's Up (No Answer)</p>
                        <p className="text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate sm:whitespace-normal">0 points awarded or deducted</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60 shrink-0">
                      0 pts
                    </span>
                  </div>
                )}

                {/* 2. Round Explanation */}
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#009639] dark:text-[#00E676]" /> Round Explanation
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-200 leading-relaxed font-medium bg-green-50/50 dark:bg-green-950/20 p-3 sm:p-3.5 rounded-xl border border-green-100 dark:border-green-900/40 break-words">
                    {revealResult.explanation}
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Animated 3D Trophy Modal for Top 3 Winners */}
        {(() => {
          const winnerData = getWinnerTrophyData();
          if (!winnerData) return null;
          return (
            <WinnerTrophyModal
              isOpen={isTrophyOpen}
              onClose={() => setIsTrophyOpen(false)}
              winner={winnerData}
              roomPin={pin}
            />
          );
        })()}
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center text-gray-500 dark:text-slate-400 font-medium">Loading Participant Portal...</div>}>
      <ParticipantComponent />
    </Suspense>
  );
}
