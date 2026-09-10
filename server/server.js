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

const rooms = new Map();
const HOST_PASSCODES = new Set([
  (process.env.HOST_PASSCODE || '').trim(),
  'SE2026!Admin',
  'SE@Admin2025'
].filter(Boolean));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SE Quiz Backend Server</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; box-sizing: border-box; }
          .card { background: #1e293b; padding: 2.5rem 2rem; border-radius: 1.5rem; border: 1px solid #334155; text-align: center; max-width: 460px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
          .badge { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(0, 230, 118, 0.15); color: #00E676; border: 1px solid rgba(0, 230, 118, 0.4); padding: 0.4rem 1rem; border-radius: 9999px; font-weight: 700; font-size: 0.85rem; margin-bottom: 1.5rem; }
          .dot { width: 8px; height: 8px; background: #00E676; border-radius: 50%; box-shadow: 0 0 10px #00E676; display: inline-block; }
          h1 { margin: 0 0 0.75rem 0; font-size: 1.4rem; font-weight: 800; color: #ffffff; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 0 0 1.75rem 0; }
          a { display: inline-block; background: #009639; color: white; text-decoration: none; padding: 0.85rem 1.75rem; border-radius: 0.75rem; font-weight: 700; font-size: 0.95rem; transition: background 0.2s; box-shadow: 0 4px 12px rgba(0, 150, 57, 0.3); }
          a:hover { background: #00b344; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="dot"></span> Backend Active & Online</div>
          <h1>Schneider Electric MSS Quiz Server</h1>
          <p>This backend provides real-time Socket.io and WebSocket communication for the live quiz sessions.</p>
          <a href="https://se-quiz-ten.vercel.app">Go to SE Quiz Application &rarr;</a>
        </div>
      </body>
    </html>
  `);
});

// Helper: Get unique participants deduplicated by lowercase name, merging highest scores
function getUniqueParticipants(room, cleanupRoom = false) {
  if (!room || !room.participants) return [];
  const mapByName = new Map();
  const duplicatesToDelete = [];

  for (const p of room.participants.values()) {
    const key = (p.name || '').toLowerCase().trim();
    if (!key) continue;
    if (!mapByName.has(key)) {
      mapByName.set(key, p);
    } else {
      const existing = mapByName.get(key);
      // Keep whichever record has higher score, or more correct answers, or currently connected
      const isPBetter = (p.score > existing.score) ||
        (p.score === existing.score && (p.correctCount || 0) > (existing.correctCount || 0)) ||
        (p.score === existing.score && (p.correctCount || 0) === (existing.correctCount || 0) && p.connected && !existing.connected);

      if (isPBetter) {
        duplicatesToDelete.push(existing);
        mapByName.set(key, p);
      } else {
        duplicatesToDelete.push(p);
      }
    }
  }

  if (cleanupRoom && duplicatesToDelete.length > 0) {
    for (const dup of duplicatesToDelete) {
      if (dup.disconnectTimeout) clearTimeout(dup.disconnectTimeout);
      if (dup.socketId && room.socketToParticipantId && room.socketToParticipantId.get(dup.socketId) === dup.participantId) {
        room.socketToParticipantId.delete(dup.socketId);
      }
      room.participants.delete(dup.participantId);
    }
  }

  return Array.from(mapByName.values());
}

// Helper: Calculate Leaderboards and Top 3 Winners (Version 3)
function calculateLeaderboards(room) {
  const participants = getUniqueParticipants(room, true);

  // Leaderboard ranked by Score (descending), tie-broken by Speed (ascending time)
  const leaderboard = [...participants]
    .sort((a, b) => {
      // 1. Primary: Score descending
      if (b.score !== a.score) return b.score - a.score;

      // 2. Secondary: Time tie-breaker (fastest total time among players with correct answers or total answering time)
      const aTime = (a.correctCount > 0 && a.totalTimeMs > 0)
        ? a.totalTimeMs
        : ((a.allAttemptsTotalTimeMs && a.allAttemptsTotalTimeMs > 0) ? a.allAttemptsTotalTimeMs : Infinity);
      const bTime = (b.correctCount > 0 && b.totalTimeMs > 0)
        ? b.totalTimeMs
        : ((b.allAttemptsTotalTimeMs && b.allAttemptsTotalTimeMs > 0) ? b.allAttemptsTotalTimeMs : Infinity);
      if (aTime !== bTime) return aTime - bTime;

      // 3. Tertiary: Most attempted questions
      if ((b.attemptedCount || 0) !== (a.attemptedCount || 0)) {
        return (b.attemptedCount || 0) - (a.attemptedCount || 0);
      }

      // 4. Fallback: alphabetical
      return (a.name || '').localeCompare(b.name || '');
    })
    .map((p, idx, arr) => {
      const prevTied = idx > 0 && arr[idx - 1].score === p.score && p.score > 0;
      const nextTied = idx < arr.length - 1 && arr[idx + 1].score === p.score && p.score > 0;
      const hasTie = prevTied || nextTied;
      const wonTieByTime = Boolean(nextTied && arr[idx + 1].score === p.score && p.totalTimeMs < arr[idx + 1].totalTimeMs);

      return {
        rank: idx + 1,
        participantId: p.participantId || p.socketId,
        socketId: p.socketId,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount || 0,
        attemptedCount: p.attemptedCount || 0,
        connected: p.connected !== false,
        totalTimeMs: p.totalTimeMs,
        totalTimeFormatted: (p.totalTimeMs / 1000).toFixed(3) + 's',
        fastestTimeMs: p.fastestTimeMs === Infinity ? 0 : p.fastestTimeMs,
        fastestTimeFormatted: p.fastestTimeMs === Infinity ? '--' : (p.fastestTimeMs / 1000).toFixed(3) + 's',
        averageTimeMs: p.averageTimeMs || 0,
        averageTimeFormatted: p.averageTimeMs ? (p.averageTimeMs / 1000).toFixed(3) + 's' : '--',
        hasScoreTie: hasTie,
        tieBrokenByTime: wonTieByTime
      };
    });

  const grandChampion = leaderboard.length > 0 && leaderboard[0].score > 0 ? leaderboard[0] : (leaderboard[0] || null);
  const top3 = leaderboard.slice(0, 3);

  return {
    leaderboard,
    leaderboardByScore: leaderboard,
    grandChampion,
    championByScore: grandChampion,
    top3,
    tieBreakerWinner: null,
    bestLearnerWinner: null
  };
}

const updateTimers = new Map();

// Helper: compute active answer metrics for room
function getAnswerMetrics(room) {
  const uniqueParticipants = getUniqueParticipants(room, false);
  const totalCount = uniqueParticipants.length;
  let answeredCount = 0;
  if (room && room.answeredParticipantIds) {
    for (const p of uniqueParticipants) {
      if (room.answeredParticipantIds.has(p.participantId) || room.answeredParticipantIds.has(p.socketId)) {
        answeredCount++;
      }
    }
  }
  const unansweredCount = Math.max(0, totalCount - answeredCount);
  return { totalCount, answeredCount, unansweredCount };
}

// Optimized room broadcast (prevents broadcast flood)
function broadcastRoomUpdate(roomPin) {
  if (updateTimers.has(roomPin)) return;

  updateTimers.set(roomPin, setTimeout(() => {
    updateTimers.delete(roomPin);
    const room = rooms.get(roomPin);
    if (!room) return;

    const { totalCount, answeredCount, unansweredCount } = getAnswerMetrics(room);

    // Send lightweight metadata to room (participants & projector)
    io.to(roomPin).emit('room_updated', {
      roomPin: room.roomPin,
      participantCount: totalCount,
      answeredCount: answeredCount,
      unansweredCount: unansweredCount,
      gameState: room.gameState,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.configuredQuestionCount || questions.length,
      configuredQuestionCount: room.configuredQuestionCount || questions.length,
      readingEndTime: room.readingEndTime || null,
      answeringStartTime: room.answeringStartTime || null,
      answeringEndTime: room.answeringEndTime || null,
      resultsPublished: room.resultsPublished || false
    });

    // Send full participant list & live dial counters ONLY to Host socket
    if (room.hostSocketId) {
      const uniqueParticipants = getUniqueParticipants(room, true);
      const participantsList = uniqueParticipants.map(p => ({
        participantId: p.participantId || p.socketId,
        socketId: p.socketId,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount || 0,
        attemptedCount: p.attemptedCount || 0,
        connected: p.connected !== false,
        fastestTimeFormatted: p.fastestTimeMs === Infinity ? '--' : (p.fastestTimeMs / 1000).toFixed(3) + 's',
        totalTimeFormatted: (p.totalTimeMs / 1000).toFixed(3) + 's',
        hasAnsweredCurrent: room.answeredParticipantIds ? (room.answeredParticipantIds.has(p.participantId) || room.answeredParticipantIds.has(p.socketId)) : false
      }));

      io.to(room.hostSocketId).emit('host_room_updated', {
        participantCount: participantsList.length,
        answeredCount: answeredCount,
        unansweredCount: unansweredCount,
        participants: participantsList,
        gameState: room.gameState,
        currentQuestionIndex: room.currentQuestionIndex,
        totalQuestions: room.configuredQuestionCount || questions.length,
        configuredQuestionCount: room.configuredQuestionCount || questions.length,
        readingEndTime: room.readingEndTime || null,
        answeringStartTime: room.answeringStartTime || null,
        answeringEndTime: room.answeringEndTime || null
      });
    }
  }, 60));
}

// Internal: Transition from 10s reading phase to 30s answering phase
function startAnsweringPhase(roomPin) {
  const room = rooms.get(roomPin);
  if (!room || room.gameState !== 'READING') return;

  if (room.readingTimer) {
    clearTimeout(room.readingTimer);
    room.readingTimer = null;
  }

  room.gameState = 'ANSWERING';
  room.answeringEnded = false;
  room.readingEndTime = null;
  room.answeringStartTime = Date.now();
  room.answeringEndTime = Date.now() + 30000;

  const answeringPayload = {
    questionIndex: room.currentQuestionIndex,
    durationSeconds: 30,
    answeringStartTime: room.answeringStartTime,
    answeringEndTime: room.answeringEndTime
  };

  console.log(`Room ${roomPin}: Question ${room.currentQuestionIndex + 1} options unlocked. 30s answering window active.`);

  io.to(roomPin).emit('answering_started', answeringPayload);
  broadcastRoomUpdate(roomPin);

  // 30-second timer for answering window.
  // Version 3: Closes answering window when time expires; answer is NOT auto-revealed.
  // Result evaluation is kept on hold for all until the host explicitly triggers reveal_answer.
  room.answeringTimer = setTimeout(() => {
    room.answeringEnded = true;
    console.log(`Room ${roomPin}: Question ${room.currentQuestionIndex + 1} answering window closed (30s expired). Evaluation on hold waiting for host reveal.`);
    io.to(roomPin).emit('answering_closed', {
      questionIndex: room.currentQuestionIndex,
      message: "Time's up! Answering is closed. Waiting for host to reveal the answer..."
    });
    broadcastRoomUpdate(roomPin);
  }, 30000);
}

// Internal: Reveal answer, compute per-question winner (for projector only), and transition to REVEAL
function executeRevealAnswer(roomPin) {
  const room = rooms.get(roomPin);
  if (!room || room.gameState === 'REVEAL' || room.gameState === 'QUIZ_ENDED' || room.gameState === 'RESULTS_PUBLISHED') return;

  if (room.readingTimer) {
    clearTimeout(room.readingTimer);
    room.readingTimer = null;
  }
  if (room.answeringTimer) {
    clearTimeout(room.answeringTimer);
    room.answeringTimer = null;
  }

  room.gameState = 'REVEAL';
  room.answeringEnded = true;
  room.readingEndTime = null;
  room.answeringStartTime = null;
  room.answeringEndTime = null;

  const question = questions[room.currentQuestionIndex];
  if (!question) return;

  // Compute per-question winner: fastest correct respondent among all candidates who answered this question
  const correctSubmissions = [];
  if (room.currentQuestionAnswers) {
    for (const ans of room.currentQuestionAnswers.values()) {
      if (ans.isCorrect) {
        correctSubmissions.push(ans);
      }
    }
  }

  // Sort by timeMs ascending (fastest first)
  correctSubmissions.sort((a, b) => a.timeMs - b.timeMs);

  const totalCorrect = correctSubmissions.length;
  const totalAnswered = room.currentQuestionAnswers ? room.currentQuestionAnswers.size : 0;
  const totalParticipants = room.participants ? room.participants.size : 0;

  const winnerData = correctSubmissions.length > 0 ? {
    participantId: correctSubmissions[0].participantId,
    name: correctSubmissions[0].name,
    socketId: correctSubmissions[0].socketId,
    timeMs: correctSubmissions[0].timeMs,
    timeFormatted: correctSubmissions[0].timeFormatted,
    totalCorrectCount: totalCorrect
  } : null;

  // Record in room.questionWinners (for projector display only; omitted from final results)
  const existingQWinnerIdx = (room.questionWinners || []).findIndex(qw => qw.questionIndex === room.currentQuestionIndex);
  const qRecord = {
    questionIndex: room.currentQuestionIndex,
    questionText: question.question,
    category: question.category,
    winner: winnerData,
    totalCorrectCount: totalCorrect,
    totalAnsweredCount: totalAnswered,
    totalParticipantsCount: totalParticipants
  };
  if (!room.questionWinners) room.questionWinners = [];
  if (existingQWinnerIdx >= 0) {
    room.questionWinners[existingQWinnerIdx] = qRecord;
  } else {
    room.questionWinners.push(qRecord);
  }

  const { leaderboardByScore } = calculateLeaderboards(room);
  const totalQ = room.configuredQuestionCount || questions.length;

  room.currentRevealResult = {
    correctAnswerIndex: question.correctAnswer,
    correctOptionText: question.options[question.correctAnswer],
    explanation: question.explanation,
    winner: winnerData, // Fastest participant who answered correctly
    totalCorrectCount: totalCorrect, // Total count of people who answered right
    totalAnsweredCount: totalAnswered,
    totalParticipantsCount: totalParticipants,
    leaderboard: leaderboardByScore.slice(0, 10),
    questionIndex: room.currentQuestionIndex,
    isLastQuestion: room.currentQuestionIndex >= totalQ - 1
  };

  console.log(`Room ${roomPin}: Question ${room.currentQuestionIndex + 1} revealed. 1st Correct: ${winnerData?.name || 'None'} (${winnerData?.timeFormatted || 'N/A'}), Total Correct: ${totalCorrect}/${totalAnswered}`);

  io.to(roomPin).emit('answer_revealed', room.currentRevealResult);

  // Emit individual round result to each participant socket to evaluate and update their score simultaneously at reveal
  for (const [pId, p] of room.participants.entries()) {
    if (p.socketId) {
      const pAns = room.currentQuestionAnswers ? room.currentQuestionAnswers.get(pId) : null;
      io.to(p.socketId).emit('round_result', {
        hasSubmitted: Boolean(pAns),
        selectedOption: pAns ? pAns.optionIndex : null,
        isCorrect: pAns ? pAns.isCorrect : false,
        pointsDelta: pAns ? pAns.pointsDelta : 0,
        pointsDeducted: pAns ? pAns.pointsDeducted : 0,
        currentScore: p.score,
        timeFormatted: pAns ? pAns.timeFormatted : null
      });
    }
  }

  broadcastRoomUpdate(roomPin);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.isHost = false;

  socket.on('create_room', (data, callback) => {
    let cb = typeof callback === 'function' ? callback : (typeof data === 'function' ? data : null);
    let passcode = typeof data === 'object' && data !== null ? data.passcode : null;

    if (!passcode || !HOST_PASSCODES.has(passcode.trim())) {
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
        const { totalCount, answeredCount, unansweredCount } = getAnswerMetrics(existingRoom);

        const uniqueParticipants = getUniqueParticipants(existingRoom, true);
        const participantsList = uniqueParticipants.map(p => ({
          participantId: p.participantId || p.socketId,
          socketId: p.socketId,
          name: p.name,
          score: p.score,
          correctCount: p.correctCount,
          wrongCount: p.wrongCount || 0,
          attemptedCount: p.attemptedCount || 0,
          connected: p.connected !== false,
          fastestTimeFormatted: p.fastestTimeMs === Infinity ? '--' : (p.fastestTimeMs / 1000).toFixed(3) + 's',
          totalTimeFormatted: (p.totalTimeMs / 1000).toFixed(3) + 's',
          hasAnsweredCurrent: existingRoom.answeredParticipantIds ? (existingRoom.answeredParticipantIds.has(p.participantId) || existingRoom.answeredParticipantIds.has(p.socketId)) : false
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
            durationSeconds: existingRoom.gameState === 'READING' ? 10 : 30
          };
        }

        if (cb) cb({
          success: true,
          roomPin: targetPin,
          totalQuestions: totalQ,
          configuredQuestionCount: totalQ,
          participantCount: participantsList.length,
          answeredCount,
          unansweredCount,
          participants: participantsList,
          gameState: existingRoom.gameState,
          answeringEnded: Boolean(existingRoom.answeringEnded),
          currentQuestionIndex: existingRoom.currentQuestionIndex,
          readingEndTime: existingRoom.readingEndTime,
          answeringStartTime: existingRoom.answeringStartTime,
          answeringEndTime: existingRoom.answeringEndTime,
          activeQuestion,
          questionWinners: existingRoom.questionWinners || [],
          finalResults: existingRoom.finalResults || null,
          resultsPublished: existingRoom.resultsPublished || false,
          leaderboardByScore,
          grandChampion,
          top3,
          tieBreakerWinner: null,
          bestLearnerWinner: null
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
      gameState: 'LOBBY', // LOBBY | READING | ANSWERING | REVEAL | QUIZ_ENDED | RESULTS_PUBLISHED
      readingEndTime: null,
      readingTimer: null,
      answeringStartTime: null,
      answeringEndTime: null,
      answeringTimer: null,
      currentQuestionAnswers: new Map(), // participantId -> { optionIndex, isCorrect, timeMs, timeFormatted, pointsDelta }
      answeredParticipantIds: new Set(), // Set of participantIds who answered current question
      currentRevealResult: null,
      questionWinners: [], // Array of { questionIndex, questionText, category, winner }
      resultsPublished: false,
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
      answeredCount: 0,
      unansweredCount: 0,
      participants: [],
      gameState: 'LOBBY',
      currentQuestionIndex: -1,
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

    let participantId = data.participantId;
    let participant = null;

    const isParticipant = role === 'participant' || (!role && name);
    if (isParticipant) {
      // Validate participant name strictly: Only capital letters (A-Z) and spaces
      if (!name || typeof name !== 'string' || !name.trim()) {
        if (callback) callback({ success: false, message: 'Please enter your name to join the quiz.' });
        return;
      }

      const trimmedName = name.trim().replace(/\s+/g, ' ');

      // Check for numbers, special characters, symbols
      if (/[0-9]/.test(trimmedName) || /[^A-Za-z\s]/.test(trimmedName)) {
        if (callback) {
          callback({
            success: false,
            message: 'Invalid name. Only alphabetic letters (A-Z) and spaces are allowed. Numbers and special characters are not permitted.'
          });
        }
        return;
      }

      const upperName = trimmedName.toUpperCase();
      const alphabeticLettersOnly = upperName.replace(/[^A-Z]/g, '');

      if (alphabeticLettersOnly.length < 2) {
        if (callback) {
          callback({
            success: false,
            message: 'Please enter a valid name with at least 2 letters.'
          });
        }
        return;
      }

      if (upperName.length > 35) {
        if (callback) {
          callback({
            success: false,
            message: 'Name is too long. Maximum 35 characters allowed.'
          });
        }
        return;
      }

      const sanitizedName = upperName;
      const lowerName = sanitizedName.toLowerCase();

      socket.join(roomPin);

      // Find any existing participant entries matching either participantId or sanitizedName
      const matchingEntries = [];
      for (const p of room.participants.values()) {
        const pLower = (p.name || '').toLowerCase().trim();
        if ((participantId && p.participantId === participantId) || (pLower && pLower === lowerName)) {
          matchingEntries.push(p);
        }
      }

      if (matchingEntries.length > 0) {
        // Sort to pick best entry: highest score, most correct answers, most attempted
        matchingEntries.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if ((b.correctCount || 0) !== (a.correctCount || 0)) return (b.correctCount || 0) - (a.correctCount || 0);
          if ((b.attemptedCount || 0) !== (a.attemptedCount || 0)) return (b.attemptedCount || 0) - (a.attemptedCount || 0);
          if (a.connected !== b.connected) return a.connected ? -1 : 1;
          return 0;
        });

        participant = matchingEntries[0];
        participantId = participant.participantId;

        // Prune any duplicate participant records in room.participants
        for (let i = 1; i < matchingEntries.length; i++) {
          const dup = matchingEntries[i];
          if (dup.disconnectTimeout) clearTimeout(dup.disconnectTimeout);
          if (dup.socketId && room.socketToParticipantId && room.socketToParticipantId.get(dup.socketId) === dup.participantId) {
            room.socketToParticipantId.delete(dup.socketId);
          }
          room.participants.delete(dup.participantId);
        }

        // Reconnect existing participant
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

        console.log(`Player ${participant.name} (${participant.participantId}) reconnected with socket ${socket.id} to room ${roomPin} (Score: ${participant.score})`);
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
          attemptedCount: 0,
          totalTimeMs: 0,
          allAttemptsTotalTimeMs: 0,
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
    } else {
      socket.join(roomPin);
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
        durationSeconds: room.gameState === 'READING' ? 10 : 30
      };
    }

    let remainingReadingSeconds = 0;
    if (room.gameState === 'READING' && room.readingEndTime) {
      remainingReadingSeconds = Math.max(0, Math.ceil((room.readingEndTime - Date.now()) / 1000));
    }
    let remainingAnsweringSeconds = 0;
    if (room.gameState === 'ANSWERING' && room.answeringEndTime) {
      remainingAnsweringSeconds = Math.max(0, Math.ceil((room.answeringEndTime - Date.now()) / 1000));
    }

    const effectivePId = participant ? participant.participantId : (room.socketToParticipantId.get(socket.id) || socket.id);
    const myStats = participant || room.participants.get(effectivePId) || room.participants.get(socket.id) || null;

    const hasAnsweredCurrentQuestion = room.answeredParticipantIds ? (
      room.answeredParticipantIds.has(effectivePId) || room.answeredParticipantIds.has(socket.id)
    ) : false;
    const myCurrentAnswer = room.currentQuestionAnswers ? room.currentQuestionAnswers.get(effectivePId) : null;

    const { totalCount, answeredCount, unansweredCount } = getAnswerMetrics(room);

    if (callback) callback({
      success: true,
      participantId: effectivePId,
      roomPin,
      gameState: room.gameState,
      answeringEnded: Boolean(room.answeringEnded),
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: totalQ,
      configuredQuestionCount: totalQ,
      activeQuestion,
      readingEndTime: room.readingEndTime,
      remainingReadingSeconds,
      answeringStartTime: room.answeringStartTime,
      answeringEndTime: room.answeringEndTime,
      remainingAnsweringSeconds,
      hasAnsweredCurrentQuestion,
      myCurrentAnswer: myCurrentAnswer ? {
        optionIndex: myCurrentAnswer.optionIndex,
        timeFormatted: myCurrentAnswer.timeFormatted,
        ...(room.gameState === 'REVEAL' ? {
          isCorrect: myCurrentAnswer.isCorrect,
          pointsDelta: myCurrentAnswer.pointsDelta,
          pointsDeducted: myCurrentAnswer.pointsDeducted,
          optionExplanation: myCurrentAnswer.optionExplanation,
          explanation: myCurrentAnswer.explanation
        } : {})
      } : null,
      participantCount: totalCount,
      answeredCount,
      unansweredCount,
      revealResult: room.currentRevealResult || null,
      resultsPublished: room.resultsPublished || false,
      finalResults: room.finalResults || null,
      myStats: myStats ? {
        score: (room.gameState === 'ANSWERING' && myStats.previousScore !== undefined) ? myStats.previousScore : myStats.score,
        correctCount: myStats.correctCount,
        wrongCount: myStats.wrongCount || 0,
        attemptedCount: myStats.attemptedCount || 0,
        fastestTimeFormatted: myStats.fastestTimeMs === Infinity ? '--' : (myStats.fastestTimeMs / 1000).toFixed(3) + 's',
        totalTimeFormatted: (myStats.totalTimeMs / 1000).toFixed(3) + 's'
      } : null
    });
  });

  // Host: Push next question (10s reading phase)
  socket.on('push_question', (data, callback) => {
    const { roomPin } = data || {};
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    const maxQuestions = room.configuredQuestionCount || questions.length;
    const targetIndex = typeof data?.questionIndex === 'number' && !isNaN(data.questionIndex)
      ? data.questionIndex
      : (room.currentQuestionIndex !== null ? room.currentQuestionIndex + 1 : 0);

    if (targetIndex < 0 || targetIndex >= maxQuestions || !questions[targetIndex]) {
      if (callback) callback({ success: false, message: `Question index exceeds configured limit (${maxQuestions})` });
      return;
    }
    const questionIndex = targetIndex;

    // Clear any existing timers
    if (room.readingTimer) clearTimeout(room.readingTimer);
    if (room.answeringTimer) clearTimeout(room.answeringTimer);

    // Reset state for 10s reading phase
    room.currentQuestionIndex = questionIndex;
    room.gameState = 'READING';
    room.answeringEnded = false;
    room.readingEndTime = Date.now() + 10000;
    room.answeringStartTime = null;
    room.answeringEndTime = null;
    room.currentRevealResult = null;
    room.currentQuestionAnswers = new Map();
    room.answeredParticipantIds = new Set();

    // Preserve previousScore for all participants so answering phase doesn't leak score deltas
    for (const p of room.participants.values()) {
      p.previousScore = p.score;
    }

    const questionData = questions[questionIndex];
    const safeQuestion = {
      questionIndex,
      totalQuestions: maxQuestions,
      question: questionData.question,
      options: questionData.options,
      category: questionData.category,
      durationSeconds: 10,
      readingEndTime: room.readingEndTime
    };

    console.log(`Room ${roomPin}: Host pushed Question ${questionIndex + 1}/${maxQuestions}. 10s reading phase initiated.`);

    io.to(roomPin).emit('question_pushed', safeQuestion);
    broadcastRoomUpdate(roomPin);

    if (callback) callback({ success: true, questionIndex, question: safeQuestion.question, options: safeQuestion.options });

    // 10-second reading timer before unlocking options and starting 30s answering window
    room.readingTimer = setTimeout(() => {
      startAnsweringPhase(roomPin);
    }, 10000);
  });

  // Participant: Submit answer during 30s answering phase
  socket.on('submit_answer', (data, callback) => {
    const { roomPin, optionIndex } = data;
    const room = rooms.get(roomPin);

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found' });
      return;
    }

    if (room.gameState !== 'ANSWERING' || room.answeringEnded || (room.answeringEndTime && Date.now() > room.answeringEndTime)) {
      if (callback) callback({ success: false, message: 'Answering window is closed for this question' });
      return;
    }

    const participantId = room.socketToParticipantId?.get(socket.id);
    const participant = participantId ? room.participants.get(participantId) : (room.participants.get(socket.id) || null);
    const pId = participant ? (participant.participantId || socket.id) : socket.id;

    if (!participant) {
      if (callback) callback({ success: false, message: 'Participant not recognized' });
      return;
    }

    if (!room.answeredParticipantIds) room.answeredParticipantIds = new Set();
    if (!room.currentQuestionAnswers) room.currentQuestionAnswers = new Map();

    // Check if participant already answered this question
    if (room.answeredParticipantIds.has(pId) || room.answeredParticipantIds.has(socket.id)) {
      if (callback) callback({ success: false, message: 'You have already submitted your answer for this question' });
      return;
    }

    const timeMs = room.answeringStartTime ? Math.max(1, Date.now() - room.answeringStartTime) : 0;
    const timeFormatted = (timeMs / 1000).toFixed(3) + 's';

    const question = questions[room.currentQuestionIndex];
    if (!question) {
      if (callback) callback({ success: false, message: 'Active question not found' });
      return;
    }

    const isCorrect = optionIndex === question.correctAnswer;
    const optionExp = question.optionExplanations ? question.optionExplanations[optionIndex] : '';
    let pointsDelta = 0;

    if (isCorrect) {
      participant.score += 100;
      participant.correctCount += 1;
      participant.totalTimeMs += timeMs;
      if (timeMs < participant.fastestTimeMs) {
        participant.fastestTimeMs = timeMs;
      }
      participant.averageTimeMs = Math.round(participant.totalTimeMs / participant.correctCount);
      pointsDelta = 100;
    } else {
      // Negative marking: -50 (floored at 0 so score cannot be negative)
      participant.score = Math.max(0, participant.score - 50);
      participant.wrongCount = (participant.wrongCount || 0) + 1;
      pointsDelta = -50;
    }

    participant.attemptedCount = (participant.attemptedCount || 0) + 1;
    participant.allAttemptsTotalTimeMs = (participant.allAttemptsTotalTimeMs || 0) + timeMs;

    participant.answers.push({
      questionIndex: room.currentQuestionIndex,
      optionIndex,
      timeMs,
      timeFormatted,
      isCorrect,
      pointsDelta
    });

    room.answeredParticipantIds.add(pId);
    room.answeredParticipantIds.add(socket.id);

    const answerRecord = {
      participantId: pId,
      socketId: socket.id,
      name: participant.name,
      optionIndex,
      isCorrect,
      timeMs,
      timeFormatted,
      pointsDelta,
      pointsDeducted: isCorrect ? 0 : 50,
      optionExplanation: optionExp,
      explanation: question.explanation || ''
    };
    room.currentQuestionAnswers.set(pId, answerRecord);

    // Compute live progress for Admin Dial (Requirement 7)
    const { totalCount, answeredCount, unansweredCount } = getAnswerMetrics(room);

    // Immediate progress event to host for smooth real-time dial animation
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('question_progress', {
        answeredCount,
        unansweredCount,
        participantCount: totalCount,
        latestAnswerer: participant.name,
        timeFormatted
      });
    }

    broadcastRoomUpdate(roomPin);

    if (callback) callback({
      success: true,
      optionIndex,
      timeMs,
      timeFormatted,
      message: 'Answer recorded! Evaluation will be revealed to everyone together.'
    });
  });

  // Host: Reveal Answer (or triggered automatically after 30s)
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

    executeRevealAnswer(roomPin);
    if (callback) callback({ success: true });
  });

  // End Quiz: Host concludes quiz and initiates review
  socket.on('end_quiz', (data, callback) => {
    const { roomPin } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
      return;
    }

    if (room.readingTimer) clearTimeout(room.readingTimer);
    if (room.answeringTimer) clearTimeout(room.answeringTimer);

    room.gameState = 'QUIZ_ENDED';
    const { leaderboard, grandChampion, top3 } = calculateLeaderboards(room);
    const totalQ = room.configuredQuestionCount || questions.length;

    // Notice: per-question winners is removed from final results dashboard (Requirement 4)
    const reviewPayload = {
      roomPin,
      totalQuestions: totalQ,
      completedQuestions: (room.questionWinners || []).length,
      leaderboard,
      leaderboardByScore: leaderboard,
      grandChampion,
      champion: grandChampion,
      championByScore: grandChampion,
      top3,
      tieBreakerWinner: null,
      bestLearnerWinner: null,
      allRanks: leaderboard.map(p => ({
        participantId: p.participantId,
        name: p.name,
        score: p.score,
        rank: p.rank,
        totalTimeFormatted: p.totalTimeFormatted,
        correctCount: p.correctCount,
        attemptedCount: p.attemptedCount
      })),
      participantCount: getUniqueParticipants(room, true).length
    };

    room.finalResults = reviewPayload;

    console.log(`Quiz ended in room ${roomPin}. Host reviewing results...`);

    io.to(roomPin).emit('quiz_ended', {
      message: 'Quiz has ended! Host is currently reviewing and verifying the official results.',
      resultsReady: false,
      gameState: 'QUIZ_ENDED'
    });

    io.to(room.hostSocketId).emit('host_quiz_review', reviewPayload);

    broadcastRoomUpdate(roomPin);
    if (callback) callback({ success: true, results: reviewPayload, reviewPayload });
  });

  // Publish Quiz Results: Broadcast final awards & leaderboard (Requirement 6)
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

    // Published payload: Top 3, Leaderboard
    const publishedData = {
      roomPin,
      grandChampion,
      champion: grandChampion,
      top3,
      runnerUp: top3[1] || null,
      thirdPlace: top3[2] || null,
      tieBreakerWinner: null,
      bestLearnerWinner: null,
      leaderboard: leaderboard.slice(0, 20),
      leaderboardByScore: leaderboard.slice(0, 20),
      allRanks: leaderboard.map(p => ({
        participantId: p.participantId,
        name: p.name,
        score: p.score,
        rank: p.rank,
        totalTimeFormatted: p.totalTimeFormatted,
        correctCount: p.correctCount,
        attemptedCount: p.attemptedCount
      })),
      participantCount: getUniqueParticipants(room, true).length
    };

    room.finalResults = publishedData;

    console.log(`Final results published for room ${roomPin} (Champion: ${grandChampion?.name || 'None'})`);

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
