const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Process-level crash prevention guards
process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION PREVENTED:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL UNHANDLED REJECTION PREVENTED:', reason);
});

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling']
});

let questions = [];
try {
  const questionsPath = path.join(__dirname, 'questions.json');
  questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
  console.log(`Loaded ${questions.length} questions.`);
} catch (err) {
  console.error('Failed to load questions.json:', err);
}

// In-memory store for rooms
const rooms = new Map();
const HOST_PASSCODE = process.env.HOST_PASSCODE || 'SE2026!Admin';

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Helper: Calculate Leaderboards and Champions
function calculateLeaderboards(room) {
  const participants = Array.from(room.participants.values());

  // Leaderboard ranked by Score (descending), tie-broken by Speed (ascending time)
  const leaderboard = [...participants]
    .sort((a, b) => {
      // 1. Primary: Score descending
      if (b.score !== a.score) return b.score - a.score;

      // 2. Secondary: Time tie-breaker (fastest total time among players with correct answers)
      const aTime = (a.correctCount > 0 && a.totalTimeMs > 0) ? a.totalTimeMs : Infinity;
      const bTime = (b.correctCount > 0 && b.totalTimeMs > 0) ? b.totalTimeMs : Infinity;
      if (aTime !== bTime) return aTime - bTime;

      // 3. Fallback: alphabetical
      return a.name.localeCompare(b.name);
    })
    .map((p, idx, arr) => {
      const prevTied = idx > 0 && arr[idx - 1].score === p.score && p.score > 0;
      const nextTied = idx < arr.length - 1 && arr[idx + 1].score === p.score && p.score > 0;
      const hasTie = prevTied || nextTied;

      return {
        rank: idx + 1,
        participantId: p.participantId || p.socketId,
        socketId: p.socketId,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount || 0,
        connected: p.connected !== false,
        totalTimeMs: p.totalTimeMs,
        totalTimeFormatted: (p.totalTimeMs / 1000).toFixed(3) + 's',
        fastestTimeMs: p.fastestTimeMs === Infinity ? 0 : p.fastestTimeMs,
        fastestTimeFormatted: p.fastestTimeMs === Infinity ? '--' : (p.fastestTimeMs / 1000).toFixed(3) + 's',
        averageTimeMs: p.averageTimeMs || 0,
        averageTimeFormatted: p.averageTimeMs ? (p.averageTimeMs / 1000).toFixed(3) + 's' : '--',
        hasScoreTie: hasTie,
        tieBrokenByTime: hasTie && p.correctCount > 0
      };
    });

  const grandChampion = leaderboard.length > 0 && leaderboard[0].score > 0 ? leaderboard[0] : (leaderboard[0] || null);
  const top3 = leaderboard.slice(0, 3);

  return {
    leaderboard,
    leaderboardByScore: leaderboard,
    grandChampion,
    championByScore: grandChampion,
    top3
  };
}

const updateTimers = new Map();

// Optimized room broadcast (prevents N^2 broadcast storm for 500 users)
function broadcastRoomUpdate(roomPin) {
  if (updateTimers.has(roomPin)) return;

  updateTimers.set(roomPin, setTimeout(() => {
    updateTimers.delete(roomPin);
    const room = rooms.get(roomPin);
    if (!room) return;

    // Send lightweight metadata to room (participants & projector)
    io.to(roomPin).emit('room_updated', {
      roomPin: room.roomPin,
      participantCount: room.participants.size,
      gameState: room.gameState,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.configuredQuestionCount || questions.length,
      configuredQuestionCount: room.configuredQuestionCount || questions.length,
      buzzerQueueCount: room.buzzerQueue.length,
      currentAnswerer: room.buzzerQueue[room.currentAnswererIndex] || null,
      resultsPublished: room.resultsPublished || false
    });

    // Send full participant list ONLY to Host socket
    if (room.hostSocketId) {
      const participantsList = Array.from(room.participants.values()).map(p => ({
        participantId: p.participantId || p.socketId,
        socketId: p.socketId,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
        connected: p.connected !== false,
        fastestTimeFormatted: p.fastestTimeMs === Infinity ? '--' : (p.fastestTimeMs / 1000).toFixed(3) + 's',
        totalTimeFormatted: (p.totalTimeMs / 1000).toFixed(3) + 's'
      }));

      io.to(room.hostSocketId).emit('host_room_updated', {
        participantCount: participantsList.length,
        participants: participantsList,
        buzzerQueue: room.buzzerQueue,
        gameState: room.gameState,
        currentQuestionIndex: room.currentQuestionIndex,
        totalQuestions: room.configuredQuestionCount || questions.length,
        configuredQuestionCount: room.configuredQuestionCount || questions.length
      });
    }
  }, 60));
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.isHost = false;

  socket.on('create_room', (data, callback) => {
    let cb = typeof callback === 'function' ? callback : (typeof data === 'function' ? data : null);
    let passcode = typeof data === 'object' && data !== null ? data.passcode : null;

    if (!passcode || passcode !== HOST_PASSCODE) {
      console.warn(`Unauthorized create_room attempt from ${socket.id}`);
      if (cb) cb({ success: false, message: 'Unauthorized: Invalid Admin Passcode' });
      return;
    }

    socket.isHost = true;
    let targetPin = typeof data === 'object' && data !== null ? data.roomPin : null;
    
    // Check if host is reconnecting to an existing room
    if (targetPin && rooms.has(targetPin)) {
      try {
        const existingRoom = rooms.get(targetPin);
        if (existingRoom.hostDisconnectTimeout) {
          clearTimeout(existingRoom.hostDisconnectTimeout);
          existingRoom.hostDisconnectTimeout = null;
        }
        existingRoom.hostDisconnected = false;
        existingRoom.hostSocketId = socket.id;
        if (!existingRoom.socketToParticipantId) {
          existingRoom.socketToParticipantId = new Map();
        }
        socket.join(targetPin);
        console.log(`Host reconnected to existing room ${targetPin} (${socket.id})`);

        const { leaderboard, leaderboardByScore, grandChampion, top3 } = calculateLeaderboards(existingRoom);
        const leaderboardByTime = leaderboardByScore;
        const championByScore = grandChampion;
        const championByTime = grandChampion;

        const participantsList = Array.from(existingRoom.participants.values()).map(p => ({
          participantId: p.participantId || p.socketId,
          socketId: p.socketId,
          name: p.name,
          score: p.score,
          correctCount: p.correctCount,
          connected: p.connected !== false,
          fastestTimeFormatted: p.fastestTimeMs === Infinity ? '--' : (p.fastestTimeMs / 1000).toFixed(3) + 's',
          totalTimeFormatted: (p.totalTimeMs / 1000).toFixed(3) + 's'
        }));

        let activeQuestion = null;
        const totalQ = existingRoom.configuredQuestionCount || questions.length;
        if (existingRoom.currentQuestionIndex >= 0 && questions[existingRoom.currentQuestionIndex]) {
          const q = questions[existingRoom.currentQuestionIndex];
          activeQuestion = {
            questionIndex: existingRoom.currentQuestionIndex,
            totalQuestions: totalQ,
            question: q.question,
            options: q.options,
            category: q.category,
            durationSeconds: 10
          };
        }

        if (cb) cb({
          success: true,
          roomPin: targetPin,
          totalQuestions: totalQ,
          configuredQuestionCount: totalQ,
          participantCount: participantsList.length,
          participants: participantsList,
          buzzerQueue: existingRoom.buzzerQueue,
          gameState: existingRoom.gameState,
          currentQuestionIndex: existingRoom.currentQuestionIndex,
          activeQuestion,
          currentAnswerer: existingRoom.buzzerQueue[existingRoom.currentAnswererIndex] || null,
          questionWinners: existingRoom.questionWinners || [],
          finalResults: existingRoom.finalResults || null,
          approvedCriteria: existingRoom.approvedCriteria || null,
          resultsPublished: existingRoom.resultsPublished || false,
          leaderboardByScore,
          leaderboardByTime,
          championByScore,
          championByTime
        });
        broadcastRoomUpdate(targetPin);
      } catch (err) {
        console.error('Error during host reconnection to room:', err);
        if (cb) cb({ success: false, message: 'Server error during host reconnection: ' + err.message });
      }
      return;
    }

    const roomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const initialQuestionCount = (data && data.questionCount) 
      ? Math.min(Math.max(parseInt(data.questionCount) || 10, 1), questions.length)
      : 10;
    
    rooms.set(roomPin, {
      roomPin,
      hostSocketId: socket.id,
      hostDisconnected: false,
      hostDisconnectTimeout: null,
      configuredQuestionCount: initialQuestionCount,
      participants: new Map(), // participantId -> participant details
      socketToParticipantId: new Map(), // socketId -> participantId
      currentQuestionIndex: -1,
      gameState: 'LOBBY', // LOBBY | READING | BUZZER_UNLOCKED | ANSWERING | REVEAL | HOST_CONTROL | QUIZ_ENDED | RESULTS_PUBLISHED
      unlockTime: null,
      timerTimeout: null,
      readingEndTime: null,
      currentRevealResult: null,
      buzzerQueue: [], // Array of { participantId, socketId, name, timeMs, timeFormatted }
      currentAnswererIndex: 0,
      failedParticipants: new Set(), // participantIds / socketIds who answered incorrectly on CURRENT question
      questionWinners: [], // Array of { questionIndex, questionText, category, winner }
      resultsPublished: false,
      approvedCriteria: null,
      finalResults: null
    });

    socket.join(roomPin);
    console.log(`Room created: ${roomPin} by authenticated host ${socket.id} (Configured questions: ${initialQuestionCount}/${questions.length})`);
    
    if (cb) cb({
      success: true,
      roomPin,
      totalQuestions: initialQuestionCount,
      configuredQuestionCount: initialQuestionCount,
      participantCount: 0,
      participants: [],
      buzzerQueue: [],
      gameState: 'LOBBY',
      currentQuestionIndex: -1,
      currentAnswerer: null,
      questionWinners: [],
      resultsPublished: false
    });
  });

  socket.on('join_room', (data, callback) => {
    const { roomPin, name, role } = data;
    const room = rooms.get(roomPin);

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found' });
      return;
    }

    if (!room.socketToParticipantId) {
      room.socketToParticipantId = new Map();
    }

    socket.join(roomPin);

    let participantId = data.participantId;
    let participant = null;

    if (role === 'participant') {
      const sanitizedName = (name && typeof name === 'string') ? name.trim() : `Player_${socket.id.slice(0, 4)}`;

      // 1. Check if participantId exists in room
      if (participantId && room.participants.has(participantId)) {
        participant = room.participants.get(participantId);
      } 
      // 2. Fallback: match by name if participant was disconnected (e.g. storage cleared)
      else if (sanitizedName) {
        const existingByName = Array.from(room.participants.values()).find(
          p => p.name.toLowerCase() === sanitizedName.toLowerCase() && !p.connected
        );
        if (existingByName) {
          participant = existingByName;
          participantId = existingByName.participantId;
        }
      }

      if (participant) {
        // Reconnection of existing participant
        if (participant.disconnectTimeout) {
          clearTimeout(participant.disconnectTimeout);
          participant.disconnectTimeout = null;
        }
        if (participant.socketId && room.socketToParticipantId.has(participant.socketId)) {
          room.socketToParticipantId.delete(participant.socketId);
        }

        participant.socketId = socket.id;
        participant.connected = true;
        participant.disconnectedAt = null;
        if (sanitizedName) participant.name = sanitizedName;
        room.socketToParticipantId.set(socket.id, participant.participantId);

        // Update socket ID on any buzzerQueue entries
        room.buzzerQueue.forEach(b => {
          if (b.participantId === participant.participantId || b.name === participant.name) {
            b.socketId = socket.id;
          }
        });

        console.log(`Player ${participant.name} (${participant.participantId}) reconnected with socket ${socket.id} to room ${roomPin}`);
      } else {
        // New participant
        if (!participantId) {
          participantId = 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        }
        participant = {
          participantId,
          socketId: socket.id,
          name: sanitizedName,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          totalTimeMs: 0,
          fastestTimeMs: Infinity,
          averageTimeMs: 0,
          answers: [],
          connected: true,
          disconnectedAt: null,
          disconnectTimeout: null
        };
        room.participants.set(participantId, participant);
        room.socketToParticipantId.set(socket.id, participantId);
        console.log(`New player ${participant.name} (${participantId}, ${socket.id}) joined room ${roomPin}`);
      }
    }

    broadcastRoomUpdate(roomPin);

    let activeQuestion = null;
    const totalQ = room.configuredQuestionCount || questions.length;
    if (room.currentQuestionIndex >= 0 && room.currentQuestionIndex < totalQ && questions[room.currentQuestionIndex]) {
      const q = questions[room.currentQuestionIndex];
      activeQuestion = {
        questionIndex: room.currentQuestionIndex,
        totalQuestions: totalQ,
        question: q.question,
        options: q.options,
        category: q.category,
        durationSeconds: 10
      };
    }

    let remainingReadingSeconds = 0;
    if (room.gameState === 'READING' && room.readingEndTime) {
      remainingReadingSeconds = Math.max(0, Math.ceil((room.readingEndTime - Date.now()) / 1000));
    }

    const effectivePId = participant ? participant.participantId : (room.socketToParticipantId.get(socket.id) || socket.id);
    const myStats = participant || room.participants.get(effectivePId) || room.participants.get(socket.id) || null;

    const buzzerEntry = room.buzzerQueue.find(b => (b.participantId && b.participantId === effectivePId) || b.socketId === socket.id);
    const buzzedPosition = buzzerEntry ? room.buzzerQueue.indexOf(buzzerEntry) + 1 : null;
    const buzzedTime = buzzerEntry ? buzzerEntry.timeFormatted : '';
    const hasBuzzed = !!buzzerEntry;
    const hasFailed = room.failedParticipants.has(effectivePId) || room.failedParticipants.has(socket.id);

    const currentQWinner = room.questionWinners ? room.questionWinners.find(qw => qw.questionIndex === room.currentQuestionIndex) : null;
    const hasWonThisQuestion = currentQWinner && currentQWinner.winner && (
      (currentQWinner.winner.participantId && currentQWinner.winner.participantId === effectivePId) ||
      currentQWinner.winner.socketId === socket.id ||
      (myStats && currentQWinner.winner.name === myStats.name)
    );

    if (callback) callback({
      success: true,
      participantId: effectivePId,
      roomPin,
      gameState: room.gameState,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: totalQ,
      configuredQuestionCount: totalQ,
      activeQuestion,
      remainingReadingSeconds,
      buzzerQueue: room.buzzerQueue.slice(0, 10),
      currentAnswerer: room.buzzerQueue[room.currentAnswererIndex] || null,
      hasBuzzed,
      buzzedPosition,
      buzzedTime,
      hasFailed,
      hasWonThisQuestion: !!hasWonThisQuestion,
      revealResult: room.currentRevealResult || null,
      resultsPublished: room.resultsPublished || false,
      finalResults: room.finalResults || null,
      questionWinners: room.questionWinners || [],
      myStats: myStats ? {
        score: myStats.score,
        correctCount: myStats.correctCount,
        fastestTimeFormatted: myStats.fastestTimeMs === Infinity ? '--' : (myStats.fastestTimeMs / 1000).toFixed(3) + 's'
      } : null
    });
  });

  socket.on('push_question', (data, callback) => {
    const { roomPin, questionIndex } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    const maxQuestions = room.configuredQuestionCount || questions.length;
    if (questionIndex < 0 || questionIndex >= maxQuestions) {
      if (callback) callback({ success: false, message: `Question index exceeds configured limit (${maxQuestions})` });
      return;
    }

    // Reset state for reading phase
    room.currentQuestionIndex = questionIndex;
    room.gameState = 'READING';
    room.unlockTime = null;
    room.readingEndTime = Date.now() + 10000;
    room.currentRevealResult = null;
    room.buzzerQueue = [];
    room.currentAnswererIndex = 0;
    room.failedParticipants.clear();
    
    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
    }
    if (room.buzzerBroadcastTimer) {
      clearTimeout(room.buzzerBroadcastTimer);
      room.buzzerBroadcastTimer = null;
    }

    const questionData = questions[questionIndex];
    const safeQuestion = {
      questionIndex,
      totalQuestions: maxQuestions,
      question: questionData.question,
      options: questionData.options,
      category: questionData.category,
      durationSeconds: 10
    };

    io.to(roomPin).emit('question_pushed', safeQuestion);
    broadcastRoomUpdate(roomPin);

    if (callback) callback({ success: true, questionIndex, question: safeQuestion.question, options: safeQuestion.options });

    // 10s reading timer before buzzer unlocks
    room.timerTimeout = setTimeout(() => {
      room.gameState = 'BUZZER_UNLOCKED';
      room.unlockTime = Date.now();
      room.readingEndTime = null;
      
      io.to(roomPin).emit('buzzer_unlocked', {
        unlockTime: room.unlockTime
      });
      broadcastRoomUpdate(roomPin);
    }, 10000);
  });

  socket.on('hit_buzzer', (data, callback) => {
    const { roomPin } = data;
    const room = rooms.get(roomPin);

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found' });
      return;
    }

    // NOTE: Game is open to all candidates for all questions! No lockout from previous rounds.

    if (room.failedParticipants.size >= 2) {
      if (callback) callback({ success: false, message: 'Both top 2 attempts have been completed! Control passed to Host.' });
      return;
    }

    if (room.gameState !== 'BUZZER_UNLOCKED' && room.gameState !== 'ANSWERING') {
      if (callback) callback({ success: false, message: 'Buzzer is not active right now!' });
      return;
    }

    const participantId = room.socketToParticipantId?.get(socket.id);
    const participant = participantId ? room.participants.get(participantId) : (room.participants.get(socket.id) || null);

    if (!participant) {
      if (callback) callback({ success: false, message: 'Participant not found' });
      return;
    }

    const pId = participant.participantId || socket.id;

    if (room.failedParticipants.has(pId) || room.failedParticipants.has(socket.id)) {
      if (callback) callback({ success: false, message: 'You already attempted this question and answered incorrectly!' });
      return;
    }

    const alreadyInQueue = room.buzzerQueue.some(b => (b.participantId && b.participantId === pId) || b.socketId === socket.id);
    if (alreadyInQueue) {
      if (callback) callback({ success: false, message: 'You have already pressed the buzzer!' });
      return;
    }

    const timeMs = room.unlockTime ? (Date.now() - room.unlockTime) : 0;
    const timeFormatted = (timeMs / 1000).toFixed(3) + 's';

    const buzzerEntry = {
      participantId: pId,
      socketId: socket.id,
      name: participant.name,
      timeMs,
      timeFormatted
    };

    room.buzzerQueue.push(buzzerEntry);

    // If transitioning from BUZZER_UNLOCKED, find first unfailed participant
    if (room.gameState === 'BUZZER_UNLOCKED') {
      room.gameState = 'ANSWERING';
      const firstValidIdx = room.buzzerQueue.findIndex(b => {
        const idToCheck = b.participantId || b.socketId;
        return !room.failedParticipants.has(idToCheck) && !room.failedParticipants.has(b.socketId);
      });
      room.currentAnswererIndex = firstValidIdx >= 0 ? firstValidIdx : 0;
    }

    const activeAnswerer = room.buzzerQueue[room.currentAnswererIndex];

    // High performance queue broadcast: immediate for first 2 positions, throttled for subsequent hits
    const isTopContender = room.buzzerQueue.length <= 2;
    const emitBuzzerRecorded = () => {
      io.to(roomPin).emit('buzzer_hit_recorded', {
        buzzerQueue: room.buzzerQueue.slice(0, 10),
        queueLength: room.buzzerQueue.length,
        activeAnswerer: room.buzzerQueue[room.currentAnswererIndex],
        turnNumber: room.currentAnswererIndex + 1
      });
    };

    if (isTopContender) {
      emitBuzzerRecorded();
    } else if (!room.buzzerBroadcastTimer) {
      room.buzzerBroadcastTimer = setTimeout(() => {
        room.buzzerBroadcastTimer = null;
        emitBuzzerRecorded();
      }, 100);
    }

    broadcastRoomUpdate(roomPin);

    const isYourTurn = activeAnswerer && ((activeAnswerer.participantId && activeAnswerer.participantId === pId) || activeAnswerer.socketId === socket.id);

    if (callback) callback({
      success: true,
      timeMs,
      timeFormatted,
      position: room.buzzerQueue.length,
      isYourTurn: !!isYourTurn
    });
  });

  socket.on('submit_answer', (data, callback) => {
    const { roomPin, optionIndex } = data;
    const room = rooms.get(roomPin);

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found' });
      return;
    }

    if (room.gameState !== 'ANSWERING') {
      if (callback) callback({ success: false, message: 'Answering is not open' });
      return;
    }

    const currentAnswerer = room.buzzerQueue[room.currentAnswererIndex];
    const participantId = room.socketToParticipantId?.get(socket.id);
    const participant = participantId ? room.participants.get(participantId) : (room.participants.get(socket.id) || null);
    const pId = participant ? (participant.participantId || socket.id) : socket.id;

    const isMatch = currentAnswerer && (
      (currentAnswerer.participantId && currentAnswerer.participantId === pId) ||
      currentAnswerer.socketId === socket.id
    );

    if (!isMatch) {
      if (callback) callback({ success: false, message: 'It is not your turn to answer!' });
      return;
    }

    const question = questions[room.currentQuestionIndex];
    const isCorrect = optionIndex === question.correctAnswer;

    const optionExp = question.optionExplanations ? question.optionExplanations[optionIndex] : '';

    if (isCorrect) {
      // Correct answer! Update participant statistics across all questions
      if (participant) {
        participant.score += 100;
        participant.correctCount += 1;
        participant.totalTimeMs += currentAnswerer.timeMs;
        if (currentAnswerer.timeMs < participant.fastestTimeMs) {
          participant.fastestTimeMs = currentAnswerer.timeMs;
        }
        participant.averageTimeMs = Math.round(participant.totalTimeMs / participant.correctCount);
        participant.answers.push({
          questionIndex: room.currentQuestionIndex,
          timeMs: currentAnswerer.timeMs,
          timeFormatted: currentAnswerer.timeFormatted,
          isCorrect: true
        });
      }

      room.gameState = 'REVEAL';

      const winnerData = {
        participantId: pId,
        name: currentAnswerer.name,
        socketId: currentAnswerer.socketId,
        timeMs: currentAnswerer.timeMs,
        timeFormatted: currentAnswerer.timeFormatted,
        turnNumber: room.currentAnswererIndex + 1
      };

      // Record per-question winner
      const existingQWinnerIdx = room.questionWinners.findIndex(qw => qw.questionIndex === room.currentQuestionIndex);
      const qRecord = {
        questionIndex: room.currentQuestionIndex,
        questionText: question.question,
        category: question.category,
        winner: winnerData
      };
      if (existingQWinnerIdx >= 0) {
        room.questionWinners[existingQWinnerIdx] = qRecord;
      } else {
        room.questionWinners.push(qRecord);
      }

      const { leaderboardByScore, leaderboardByTime } = calculateLeaderboards(room);

      const totalQ = room.configuredQuestionCount || questions.length;
      room.currentRevealResult = {
        correctAnswerIndex: question.correctAnswer,
        correctOptionText: question.options[question.correctAnswer],
        explanation: question.explanation,
        winner: winnerData,
        leaderboard: leaderboardByScore.slice(0, 10),
        questionIndex: room.currentQuestionIndex,
        isLastQuestion: room.currentQuestionIndex >= totalQ - 1
      };

      io.to(roomPin).emit('answer_revealed', room.currentRevealResult);

      broadcastRoomUpdate(roomPin);

      if (callback) callback({
        success: true,
        isCorrect: true,
        explanation: question.explanation,
        optionExplanation: optionExp,
        hasWonThisQuestion: true,
        currentScore: participant ? participant.score : 100
      });
    } else {
      // Wrong answer! Negative marking: -50 ONLY if player has scored points (floor at 0)
      let pointsDeducted = 0;
      if (participant) {
        if (participant.score > 0) {
          pointsDeducted = participant.score >= 50 ? 50 : participant.score;
          participant.score -= pointsDeducted;
        }
        participant.wrongCount = (participant.wrongCount || 0) + 1;
        participant.answers.push({
          questionIndex: room.currentQuestionIndex,
          timeMs: currentAnswerer.timeMs,
          timeFormatted: currentAnswerer.timeFormatted,
          isCorrect: false,
          pointsDelta: -pointsDeducted
        });
        room.failedParticipants.add(pId);
      }

      room.failedParticipants.add(socket.id);

      let nextAnswerer = null;

      if (room.failedParticipants.size >= 2) {
        // Both top 2 participants answered wrong! End turns and transfer control to Host.
        room.gameState = 'HOST_CONTROL';
        io.to(roomPin).emit('turn_passed', {
          wrongAnswerer: currentAnswerer.name,
          wrongOptionIndex: optionIndex,
          pointsDeducted,
          nextAnswerer: null,
          turnNumber: room.currentAnswererIndex + 1,
          noMoreTurns: true,
          gameState: 'HOST_CONTROL',
          message: pointsDeducted > 0
            ? `${currentAnswerer.name} answered incorrectly (-50 pts). Control passed to host.`
            : `Both top 2 participants answered incorrectly! Control passed to host to reveal answer.`
        });
      } else {
        // 1st attempt failed -> check if 2nd person is in buzzer queue
        const nextIndex = room.currentAnswererIndex + 1;

        if (nextIndex < room.buzzerQueue.length && nextIndex < 2) {
          room.currentAnswererIndex = nextIndex;
          nextAnswerer = room.buzzerQueue[nextIndex];
          room.gameState = 'ANSWERING';
        } else {
          // Queue empty for 2nd turn - return to BUZZER_UNLOCKED so 2nd person can buzz
          room.gameState = 'BUZZER_UNLOCKED';
        }

        io.to(roomPin).emit('turn_passed', {
          wrongAnswerer: currentAnswerer.name,
          wrongOptionIndex: optionIndex,
          pointsDeducted,
          nextAnswerer: nextAnswerer ? { name: nextAnswerer.name, socketId: nextAnswerer.socketId } : null,
          turnNumber: room.currentAnswererIndex + 1,
          gameState: room.gameState,
          message: pointsDeducted > 0
            ? `${currentAnswerer.name} answered incorrectly (-50 pts). Next player's turn!`
            : `${currentAnswerer.name} answered incorrectly. Next player's turn!`
        });
      }

      broadcastRoomUpdate(roomPin);

      if (callback) callback({
        success: true,
        isCorrect: false,
        pointsDeducted,
        currentScore: participant ? participant.score : 0,
        explanation: question.explanation,
        optionExplanation: optionExp
      });
    }
  });

  socket.on('reveal_answer', (data, callback) => {
    const { roomPin } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    if (room.currentQuestionIndex === -1 || !questions[room.currentQuestionIndex]) {
      if (callback) callback({ success: false, message: 'No active question' });
      return;
    }

    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
    }

    room.gameState = 'REVEAL';
    const question = questions[room.currentQuestionIndex];

    // Record question in questionWinners with null winner if nobody got it right
    const existingQWinnerIdx = room.questionWinners.findIndex(qw => qw.questionIndex === room.currentQuestionIndex);
    if (existingQWinnerIdx === -1) {
      room.questionWinners.push({
        questionIndex: room.currentQuestionIndex,
        questionText: question.question,
        category: question.category,
        winner: null
      });
    }

    const { leaderboardByScore } = calculateLeaderboards(room);

    const totalQ = room.configuredQuestionCount || questions.length;
    room.currentRevealResult = {
      correctAnswerIndex: question.correctAnswer,
      correctOptionText: question.options[question.correctAnswer],
      explanation: question.explanation,
      winner: null,
      leaderboard: leaderboardByScore.slice(0, 10),
      questionIndex: room.currentQuestionIndex,
      isLastQuestion: room.currentQuestionIndex >= totalQ - 1
    };

    io.to(roomPin).emit('answer_revealed', room.currentRevealResult);

    broadcastRoomUpdate(roomPin);
    if (callback) callback({ success: true });
  });

  // End Quiz: Host clicks End Quiz button or triggers completion
  socket.on('end_quiz', (data, callback) => {
    const { roomPin } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
    }

    room.gameState = 'QUIZ_ENDED';
    const { leaderboard, grandChampion, top3 } = calculateLeaderboards(room);
    const totalQ = room.configuredQuestionCount || questions.length;

    const reviewPayload = {
      roomPin,
      totalQuestions: totalQ,
      completedQuestions: room.questionWinners.length,
      questionWinners: room.questionWinners,
      leaderboard,
      leaderboardByScore: leaderboard,
      grandChampion,
      champion: grandChampion,
      championByScore: grandChampion,
      top3,
      participantCount: room.participants.size
    };

    room.finalResults = reviewPayload;

    console.log(`Quiz ended in room ${roomPin}. Host reviewing results...`);

    // Notify all participants & projector that quiz is ended, host is reviewing
    io.to(roomPin).emit('quiz_ended', {
      message: 'Quiz has ended! Host is currently reviewing and verifying the official results.',
      resultsReady: false,
      gameState: 'QUIZ_ENDED'
    });

    // Send complete review payload specifically to Host
    io.to(room.hostSocketId).emit('host_quiz_review', reviewPayload);

    broadcastRoomUpdate(roomPin);
    if (callback) callback({ success: true, results: reviewPayload, reviewPayload });
  });

  // Publish Quiz Results: Host approves results (Overall Score with Time Tie-breaker + Winners by Question)
  socket.on('publish_quiz_results', (data, callback) => {
    const { roomPin } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    room.gameState = 'RESULTS_PUBLISHED';
    room.resultsPublished = true;

    const { leaderboard, grandChampion, top3 } = calculateLeaderboards(room);

    const publishedData = {
      roomPin,
      grandChampion,
      champion: grandChampion,
      top3,
      runnerUp: top3[1] || null,
      thirdPlace: top3[2] || null,
      questionWinners: room.questionWinners,
      leaderboard: leaderboard.slice(0, 20),
      leaderboardByScore: leaderboard.slice(0, 20),
      participantCount: room.participants.size
    };

    room.finalResults = publishedData;

    console.log(`Final results published for room ${roomPin} (Champion: ${grandChampion?.name || 'None'})`);

    // Broadcast official results to all clients (Host, Projector, Participants)
    io.to(roomPin).emit('quiz_results_published', publishedData);

    broadcastRoomUpdate(roomPin);
    if (callback) callback({ success: true, publishedData });
  });

  // Set Question Limit: Host configures how many questions to play (e.g. 5, 10, 15, 20, 30)
  socket.on('set_question_limit', (data, callback) => {
    const { roomPin, questionCount } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    const count = parseInt(questionCount);
    if (isNaN(count) || count < 1 || count > questions.length) {
      if (callback) callback({ success: false, message: `Question count must be between 1 and ${questions.length}` });
      return;
    }

    room.configuredQuestionCount = count;
    console.log(`Room ${roomPin}: Host set question limit to ${count} (of ${questions.length})`);

    io.to(roomPin).emit('question_limit_updated', {
      configuredQuestionCount: count,
      totalQuestions: count
    });

    broadcastRoomUpdate(roomPin);
    if (callback) callback({ success: true, configuredQuestionCount: count, totalQuestions: count });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    for (const [roomPin, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        console.log(`Host disconnected from room ${roomPin}. Starting 120s grace period before room cleanup...`);
        room.hostDisconnected = true;
        if (room.hostDisconnectTimeout) clearTimeout(room.hostDisconnectTimeout);
        room.hostDisconnectTimeout = setTimeout(() => {
          if (room.hostDisconnected) {
            console.log(`Host grace period expired for room ${roomPin}. Destroying room.`);
            if (room.timerTimeout) clearTimeout(room.timerTimeout);
            io.to(roomPin).emit('room_destroyed', { message: 'Host left the game' });
            rooms.delete(roomPin);
          }
        }, 120000);
      } else if (room.socketToParticipantId && room.socketToParticipantId.has(socket.id)) {
        const participantId = room.socketToParticipantId.get(socket.id);
        room.socketToParticipantId.delete(socket.id);
        const participant = room.participants.get(participantId);
        if (participant) {
          console.log(`Participant ${participant.name} (${participantId}) disconnected from room ${roomPin}. 15-minute grace period active.`);
          participant.connected = false;
          participant.disconnectedAt = Date.now();
          if (participant.disconnectTimeout) clearTimeout(participant.disconnectTimeout);
          participant.disconnectTimeout = setTimeout(() => {
            if (!participant.connected) {
              console.log(`Participant grace period expired for ${participant.name} (${participantId}) in room ${roomPin}. Removing.`);
              room.participants.delete(participantId);
              broadcastRoomUpdate(roomPin);
            }
          }, 15 * 60 * 1000);
          broadcastRoomUpdate(roomPin);
        }
      } else if (room.participants.has(socket.id)) {
        const participant = room.participants.get(socket.id);
        console.log(`Participant ${participant?.name || socket.id} disconnected from room ${roomPin}. 15-minute grace period active.`);
        participant.connected = false;
        participant.disconnectedAt = Date.now();
        if (participant.disconnectTimeout) clearTimeout(participant.disconnectTimeout);
        participant.disconnectTimeout = setTimeout(() => {
          if (!participant.connected) {
            room.participants.delete(socket.id);
            broadcastRoomUpdate(roomPin);
          }
        }, 15 * 60 * 1000);
        broadcastRoomUpdate(roomPin);
      }
    }
  });

  socket.on('leave_room', (data, callback) => {
    const { roomPin } = data || {};
    const room = roomPin ? rooms.get(roomPin) : null;
    if (room) {
      let participantId = null;
      if (room.socketToParticipantId && room.socketToParticipantId.has(socket.id)) {
        participantId = room.socketToParticipantId.get(socket.id);
        room.socketToParticipantId.delete(socket.id);
      } else if (room.participants.has(socket.id)) {
        participantId = socket.id;
      }

      if (participantId && room.participants.has(participantId)) {
        const participant = room.participants.get(participantId);
        if (participant && participant.disconnectTimeout) clearTimeout(participant.disconnectTimeout);
        room.participants.delete(participantId);
        socket.leave(roomPin);
        console.log(`Player ${participant?.name || participantId} explicitly left room ${roomPin}`);
        broadcastRoomUpdate(roomPin);
      }
    }
    if (callback) callback({ success: true });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 SE Quiz Socket.io Server running on port ${PORT}`);
  console.log(`🌐 Bound to 0.0.0.0 (Accessible locally & via Wi-Fi)`);
  console.log(`=======================================================`);
});
