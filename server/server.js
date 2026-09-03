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
const HOST_PASSCODE = process.env.HOST_PASSCODE || 'SE2026!Admin';

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const updateTimers = new Map();

function broadcastRoomUpdate(roomPin) {
  if (updateTimers.has(roomPin)) return;

  updateTimers.set(roomPin, setTimeout(() => {
    updateTimers.delete(roomPin);
    const room = rooms.get(roomPin);
    if (!room) return;

    const participantsList = Array.from(room.participants.values()).map(p => ({
      ...p,
      isWinner: room.winners.has(p.socketId)
    }));
    io.to(roomPin).emit('room_updated', {
      roomPin: room.roomPin,
      participantCount: participantsList.length,
      participants: participantsList,
      gameState: room.gameState,
      currentQuestionIndex: room.currentQuestionIndex,
      buzzerQueue: room.buzzerQueue,
      currentAnswerer: room.buzzerQueue[room.currentAnswererIndex] || null
    });
  }, 50));
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
      const existingRoom = rooms.get(targetPin);
      if (existingRoom.hostDisconnectTimeout) {
        clearTimeout(existingRoom.hostDisconnectTimeout);
        existingRoom.hostDisconnectTimeout = null;
      }
      existingRoom.hostDisconnected = false;
      existingRoom.hostSocketId = socket.id;
      socket.join(targetPin);
      console.log(`Host reconnected to existing room ${targetPin} (${socket.id})`);

      const participantsList = Array.from(existingRoom.participants.values()).map(p => ({
        ...p,
        isWinner: existingRoom.winners.has(p.socketId)
      }));

      if (cb) cb({
        success: true,
        roomPin: targetPin,
        totalQuestions: questions.length,
        participantCount: participantsList.length,
        participants: participantsList,
        buzzerQueue: existingRoom.buzzerQueue,
        gameState: existingRoom.gameState,
        currentAnswerer: existingRoom.buzzerQueue[existingRoom.currentAnswererIndex] || null
      });
      broadcastRoomUpdate(targetPin);
      return;
    }

    const roomPin = Math.floor(100000 + Math.random() * 900000).toString();
    
    rooms.set(roomPin, {
      roomPin,
      hostSocketId: socket.id,
      hostDisconnected: false,
      hostDisconnectTimeout: null,
      participants: new Map(), // socketId -> { socketId, name, score }
      currentQuestionIndex: -1,
      gameState: 'LOBBY', // LOBBY | READING | BUZZER_UNLOCKED | ANSWERING | REVEAL
      unlockTime: null,
      timerTimeout: null,
      buzzerQueue: [], // Array of { socketId, name, timeMs, timeFormatted }
      currentAnswererIndex: 0,
      failedParticipants: new Set(), // Set of socketIds who answered incorrectly
      winners: new Set() // Set of socketIds who correctly answered a question
    });

    socket.join(roomPin);
    console.log(`Room created: ${roomPin} by authenticated host ${socket.id}`);
    
    if (cb) cb({
      success: true,
      roomPin,
      totalQuestions: questions.length,
      participantCount: 0,
      participants: [],
      buzzerQueue: [],
      gameState: 'LOBBY',
      currentAnswerer: null
    });
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
        score: 0,
        isWinner: room.winners.has(socket.id)
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
      hasFailed: room.failedParticipants.has(socket.id),
      hasWon: room.winners.has(socket.id)
    });
  });

  socket.on('push_question', (data, callback) => {
    const { roomPin, questionIndex } = data;
    const room = rooms.get(roomPin);

    if (!socket.isHost || !room || room.hostSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Unauthorized: Host privilege required' });
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

    if (room.winners.has(socket.id)) {
      if (callback) callback({ success: false, message: 'You have already won a question! You are in View-Only spectator mode.' });
      return;
    }

    if (room.failedParticipants.size >= 2) {
      if (callback) callback({ success: false, message: 'Both top 2 attempts have been completed! Control passed to Host.' });
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
      room.winners.add(socket.id);
      if (participant) {
        participant.score += 100;
        participant.isWinner = true;
      }
      room.gameState = 'REVEAL';

      const leaderboard = Array.from(room.participants.values())
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, score: p.score, isWinner: room.winners.has(p.socketId) }));

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
        optionExplanation: optionExp,
        hasWon: true
      });
    } else {
      // Wrong answer!
      room.failedParticipants.add(socket.id);

      let nextAnswerer = null;

      if (room.failedParticipants.size >= 2) {
        // Both top 2 participants answered wrong! End turns and transfer control to Host.
        room.gameState = 'HOST_CONTROL';
        io.to(roomPin).emit('turn_passed', {
          wrongAnswerer: currentAnswerer.name,
          wrongOptionIndex: optionIndex,
          nextAnswerer: null,
          turnNumber: room.currentAnswererIndex + 1,
          noMoreTurns: true,
          gameState: 'HOST_CONTROL',
          message: 'Both top 2 participants answered incorrectly! Control passed to host to reveal answer.'
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
          nextAnswerer: nextAnswerer ? { name: nextAnswerer.name, socketId: nextAnswerer.socketId } : null,
          turnNumber: room.currentAnswererIndex + 1,
          gameState: room.gameState
        });
      }

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
