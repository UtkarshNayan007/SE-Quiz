const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
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

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

function broadcastRoomUpdate(roomPin) {
  const room = rooms.get(roomPin);
  if (!room) return;

  const participantsList = Array.from(room.participants.values());
  io.to(roomPin).emit('room_updated', {
    roomPin: room.roomPin,
    participantCount: participantsList.length,
    participants: participantsList,
    gameState: room.gameState,
    currentQuestionIndex: room.currentQuestionIndex,
    buzzerQueue: room.buzzerQueue,
    currentAnswerer: room.buzzerQueue[room.currentAnswererIndex] || null
  });
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create_room', (callback) => {
    const roomPin = Math.floor(100000 + Math.random() * 900000).toString();
    
    rooms.set(roomPin, {
      roomPin,
      hostSocketId: socket.id,
      participants: new Map(), // socketId -> { socketId, name, score }
      currentQuestionIndex: -1,
      gameState: 'LOBBY', // LOBBY | READING | BUZZER_UNLOCKED | ANSWERING | REVEAL
      unlockTime: null,
      timerTimeout: null,
      buzzerQueue: [], // Array of { socketId, name, timeMs, timeFormatted }
      currentAnswererIndex: 0,
      failedParticipants: new Set() // Set of socketIds who answered incorrectly
    });

    socket.join(roomPin);
    console.log(`Room created: ${roomPin} by host ${socket.id}`);
    
    if (callback) callback({ success: true, roomPin, totalQuestions: questions.length });
  });

  socket.on('join_room', (data, callback) => {
    const { roomPin, name, role } = data;
    const room = rooms.get(roomPin);

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found' });
      return;
    }

    socket.join(roomPin);

    if (role === 'participant') {
      room.participants.set(socket.id, {
        socketId: socket.id,
        name: name || `Player_${socket.id.slice(0, 4)}`,
        score: 0
      });
      console.log(`Player ${name} (${socket.id}) joined room ${roomPin}`);
    }

    broadcastRoomUpdate(roomPin);

    let activeQuestion = null;
    if (room.currentQuestionIndex >= 0 && room.currentQuestionIndex < questions.length) {
      const q = questions[room.currentQuestionIndex];
      activeQuestion = {
        questionIndex: room.currentQuestionIndex,
        totalQuestions: questions.length,
        question: q.question,
        options: q.options,
        category: q.category,
        durationSeconds: 10
      };
    }

    if (callback) callback({
      success: true,
      roomPin,
      gameState: room.gameState,
      activeQuestion,
      buzzerQueue: room.buzzerQueue,
      currentAnswerer: room.buzzerQueue[room.currentAnswererIndex] || null,
      hasBuzzed: room.buzzerQueue.some(b => b.socketId === socket.id),
      hasFailed: room.failedParticipants.has(socket.id)
    });
  });

  socket.on('push_question', (data, callback) => {
    const { roomPin, questionIndex } = data;
    const room = rooms.get(roomPin);

    if (!room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized or room not found' });
      return;
    }

    if (questionIndex < 0 || questionIndex >= questions.length) {
      if (callback) callback({ success: false, message: 'Invalid question index' });
      return;
    }

    // Reset state for reading phase
    room.currentQuestionIndex = questionIndex;
    room.gameState = 'READING';
    room.unlockTime = null;
    room.buzzerQueue = [];
    room.currentAnswererIndex = 0;
    room.failedParticipants.clear();
    
    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
    }

    const questionData = questions[questionIndex];
    const safeQuestion = {
      questionIndex,
      totalQuestions: questions.length,
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

    if (room.gameState !== 'BUZZER_UNLOCKED' && room.gameState !== 'ANSWERING') {
      if (callback) callback({ success: false, message: 'Buzzer is not active right now!' });
      return;
    }

    if (room.failedParticipants.has(socket.id)) {
      if (callback) callback({ success: false, message: 'You already attempted this question and answered incorrectly!' });
      return;
    }

    const alreadyInQueue = room.buzzerQueue.some(b => b.socketId === socket.id);
    if (alreadyInQueue) {
      if (callback) callback({ success: false, message: 'You have already pressed the buzzer!' });
      return;
    }

    const participant = room.participants.get(socket.id);
    if (!participant) {
      if (callback) callback({ success: false, message: 'Participant not found' });
      return;
    }

    const timeMs = room.unlockTime ? (Date.now() - room.unlockTime) : 0;
    const timeFormatted = (timeMs / 1000).toFixed(3) + 's';

    const buzzerEntry = {
      socketId: socket.id,
      name: participant.name,
      timeMs,
      timeFormatted
    };

    room.buzzerQueue.push(buzzerEntry);

    // If first hit, transition to ANSWERING turn for 1st person
    if (room.gameState === 'BUZZER_UNLOCKED') {
      room.gameState = 'ANSWERING';
      room.currentAnswererIndex = 0;
    }

    const activeAnswerer = room.buzzerQueue[room.currentAnswererIndex];

    io.to(roomPin).emit('buzzer_hit_recorded', {
      buzzerQueue: room.buzzerQueue,
      activeAnswerer,
      turnNumber: room.currentAnswererIndex + 1
    });

    broadcastRoomUpdate(roomPin);

    if (callback) callback({
      success: true,
      timeMs,
      timeFormatted,
      position: room.buzzerQueue.length,
      isYourTurn: activeAnswerer?.socketId === socket.id
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
    if (!currentAnswerer || currentAnswerer.socketId !== socket.id) {
      if (callback) callback({ success: false, message: 'It is not your turn to answer!' });
      return;
    }

    const question = questions[room.currentQuestionIndex];
    const isCorrect = optionIndex === question.correctAnswer;
    const participant = room.participants.get(socket.id);

    const optionExp = question.optionExplanations ? question.optionExplanations[optionIndex] : '';

    if (isCorrect) {
      if (participant) participant.score += 100;
      room.gameState = 'REVEAL';

      const leaderboard = Array.from(room.participants.values())
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, score: p.score }));

      io.to(roomPin).emit('answer_revealed', {
        correctAnswerIndex: question.correctAnswer,
        correctOptionText: question.options[question.correctAnswer],
        explanation: question.explanation,
        winner: {
          name: currentAnswerer.name,
          socketId: currentAnswerer.socketId,
          timeFormatted: currentAnswerer.timeFormatted,
          turnNumber: room.currentAnswererIndex + 1
        },
        leaderboard
      });

      broadcastRoomUpdate(roomPin);

      if (callback) callback({
        success: true,
        isCorrect: true,
        explanation: question.explanation,
        optionExplanation: optionExp
      });
    } else {
      // Wrong answer!
      room.failedParticipants.add(socket.id);

      // Check if 2nd person (or next) is in buzzer queue
      const nextIndex = room.currentAnswererIndex + 1;
      let nextAnswerer = null;

      if (nextIndex < room.buzzerQueue.length) {
        room.currentAnswererIndex = nextIndex;
        nextAnswerer = room.buzzerQueue[nextIndex];
      } else {
        // Queue empty for next turn - return to BUZZER_UNLOCKED so others can buzz
        room.gameState = 'BUZZER_UNLOCKED';
      }

      io.to(roomPin).emit('turn_passed', {
        wrongAnswerer: currentAnswerer.name,
        wrongOptionIndex: optionIndex,
        nextAnswerer: nextAnswerer ? { name: nextAnswerer.name, socketId: nextAnswerer.socketId } : null,
        turnNumber: room.currentAnswererIndex + 1,
        gameState: room.gameState
      });

      broadcastRoomUpdate(roomPin);

      if (callback) callback({
        success: true,
        isCorrect: false,
        explanation: question.explanation,
        optionExplanation: optionExp
      });
    }
  });

  socket.on('reveal_answer', (data, callback) => {
    const { roomPin } = data;
    const room = rooms.get(roomPin);

    if (!room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized or room not found' });
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

    const leaderboard = Array.from(room.participants.values())
      .sort((a, b) => b.score - a.score)
      .map(p => ({ name: p.name, score: p.score }));

    io.to(roomPin).emit('answer_revealed', {
      correctAnswerIndex: question.correctAnswer,
      correctOptionText: question.options[question.correctAnswer],
      explanation: question.explanation,
      winner: null,
      leaderboard
    });

    broadcastRoomUpdate(roomPin);
    if (callback) callback({ success: true });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    for (const [roomPin, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        console.log(`Host disconnected, destroying room ${roomPin}`);
        if (room.timerTimeout) clearTimeout(room.timerTimeout);
        io.to(roomPin).emit('room_destroyed', { message: 'Host left the game' });
        rooms.delete(roomPin);
      } else if (room.participants.has(socket.id)) {
        console.log(`Participant ${socket.id} disconnected from room ${roomPin}`);
        room.participants.delete(socket.id);
        broadcastRoomUpdate(roomPin);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 SE Quiz Socket.io Server running on port ${PORT}`);
  console.log(`🌐 Bound to 0.0.0.0 (Accessible locally & via Wi-Fi)`);
  console.log(`=======================================================`);
});
