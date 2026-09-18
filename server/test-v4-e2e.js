const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TEST_PORT = 4056;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const HOST_PASSCODE = 'SE2026!Admin';

console.log('🚀 Starting Version 4 Comprehensive Verification Test...\n');

// 1. Static Questions Verification
const questionsPath = path.join(__dirname, 'questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

assert.strictEqual(questions.length, 20, 'questions.json must have exactly 20 questions');
console.log('✅ questions.json contains exactly 20 questions.');

const imageQuestions = [];
questions.forEach((q, idx) => {
  assert.ok(q.id > 0, `Question ${idx} must have valid id`);
  assert.ok(q.question && q.question.length > 5, `Question ${idx} must have non-empty text`);
  assert.ok(Array.isArray(q.options) && q.options.length >= 2, `Question ${idx} must have at least 2 options`);
  assert.ok(q.correctAnswer >= 0 && q.correctAnswer < q.options.length, `Question ${idx} correctAnswer is valid index`);
  assert.ok(q.explanation && q.explanation.length > 5, `Question ${idx} must have explanation`);
  
  if (q.type === 'image' || (q.visualData && q.visualData.imageUrl)) {
    imageQuestions.push(q);
    const clientImagePath = path.join(__dirname, '../client/public', q.visualData.imageUrl);
    const serverImagePath = path.join(__dirname, 'public', q.visualData.imageUrl);
    assert.ok(fs.existsSync(clientImagePath), `Client image must exist: ${clientImagePath}`);
    assert.ok(fs.existsSync(serverImagePath), `Server image must exist: ${serverImagePath}`);
  }
});

console.log(`✅ All 20 questions validated. Found ${imageQuestions.length} image scenario questions:`);
imageQuestions.forEach(iq => {
  console.log(`   - Q#${iq.id}: ${iq.visualData.imageUrl} (${iq.visualData.imageCaption})`);
});
assert.strictEqual(imageQuestions.length, 4, 'Must have exactly 4 image questions (Q8, Q9, Q11, Q16)');

// 2. Server Integration Test
function startServer() {
  return new Promise((resolve, reject) => {
    const serverProc = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: TEST_PORT.toString() },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let started = false;
    serverProc.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('running on port') && !started) {
        started = true;
        resolve(serverProc);
      }
    });

    serverProc.stderr.on('data', (d) => {
      console.error('Server err:', d.toString());
    });

    serverProc.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      if (!started) reject(new Error('Server start timed out'));
    }, 6000);
  });
}

function createClient(name) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
}

async function runLiveTest() {
  const serverProc = await startServer();
  console.log(`\n✅ Test server started on port ${TEST_PORT}`);

  try {
    const host = createClient('Host');
    const p1 = createClient('Player1');
    const p2 = createClient('Player2');

    await Promise.all([
      new Promise(r => host.on('connect', r)),
      new Promise(r => p1.on('connect', r)),
      new Promise(r => p2.on('connect', r))
    ]);
    console.log('✅ Host and 2 players connected via Socket.io');

    // Host creates room with 20 questions
    let roomPin = '';
    await new Promise((resolve, reject) => {
      host.emit('create_room', { passcode: HOST_PASSCODE, questionCount: 20 }, (res) => {
        if (!res.success) return reject(new Error(res.message));
        roomPin = res.roomPin;
        assert.strictEqual(res.totalQuestions, 20);
        assert.strictEqual(res.configuredQuestionCount, 20);
        console.log(`✅ Room ${roomPin} created with ${res.totalQuestions} randomized questions.`);
        resolve();
      });
    });

    // Players join room
    await new Promise((resolve, reject) => {
      p1.emit('join_room', { roomPin, name: 'ALICE' }, (res) => {
        if (!res.success) return reject(new Error(res.message));
        resolve();
      });
    });
    await new Promise((resolve, reject) => {
      p2.emit('join_room', { roomPin, name: 'BOB' }, (res) => {
        if (!res.success) return reject(new Error(res.message));
        resolve();
      });
    });
    console.log('✅ Players ALICE and BOB joined room successfully.');

    // Host pushes question 0
    await new Promise((resolve, reject) => {
      host.emit('push_question', { roomPin, questionIndex: 0 }, (res) => {
        if (!res.success) return reject(new Error(res.message));
        console.log(`✅ Question 1/20 pushed: "${res.question.substring(0, 50)}..." [type=${res.type}]`);
        resolve();
      });
    });

    // Verify static image serving via HTTP
    const http = require('http');
    await new Promise((resolve, reject) => {
      http.get(`${SERVER_URL}/questions/question_8_office_risks.png`, (res) => {
        assert.strictEqual(res.statusCode, 200, 'Server should serve image file with 200 OK');
        console.log(`✅ HTTP static image test passed (Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']})`);
        resolve();
      }).on('error', reject);
    });

    host.disconnect();
    p1.disconnect();
    p2.disconnect();
    serverProc.kill();
    console.log('\n🎉 ALL VERSION 4 INTEGRATION & DATA CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    serverProc.kill();
    process.exit(1);
  }
}

runLiveTest();
