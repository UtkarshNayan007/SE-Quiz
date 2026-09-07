const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const path = require('path');

const TEST_PORT = 4005;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const HOST_PASSCODE = 'SE2026!Admin';

let serverProc = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createSocket() {
  return io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
}

function connectSocket(sock) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 4000);
    sock.on('connect', () => {
      clearTimeout(timer);
      resolve(sock);
    });
    sock.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('------------------------------------------------------------');
  console.log('🧪 Starting Participant Reconnection & Session Suite');
  console.log('------------------------------------------------------------\n');

  // Start server on TEST_PORT
  const serverJsPath = path.join(__dirname, 'server.js');
  serverProc = spawn(process.execPath, [serverJsPath], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: 'pipe'
  });

  serverProc.stdout.on('data', d => {
    // console.log(`[SERVER] ${d.toString().trim()}`);
  });
  serverProc.stderr.on('data', d => {
    console.error(`[SERVER ERR] ${d.toString().trim()}`);
  });

  // Wait for server to start
  await sleep(1500);

  const hostSock = createSocket();
  await connectSocket(hostSock);

  // 1. Create room
  let roomPin = null;
  await new Promise(resolve => {
    hostSock.emit('create_room', { passcode: HOST_PASSCODE, questionCount: 5 }, res => {
      assert(res.success && res.roomPin, `Room created: ${res.roomPin}`);
      roomPin = res.roomPin;
      resolve();
    });
  });

  // 2. Participant 1 (Alice) joins
  let aliceSock1 = createSocket();
  await connectSocket(aliceSock1);
  let alicePId = null;

  await new Promise(resolve => {
    aliceSock1.emit('join_room', { roomPin, name: 'Alice', role: 'participant' }, res => {
      assert(res.success === true, 'Alice joined room successfully');
      assert(!!res.participantId, `Alice received participantId: ${res.participantId}`);
      assert(res.gameState === 'LOBBY', 'Alice initially in LOBBY');
      alicePId = res.participantId;
      resolve();
    });
  });

  // 3. Host pushes question 0
  await new Promise(resolve => {
    hostSock.emit('push_question', { roomPin, questionIndex: 0 }, res => {
      assert(res.success === true, 'Question 0 pushed by host');
      resolve();
    });
  });

  // Wait 10.2s for buzzer to unlock
  console.log('  ⏳ Waiting for buzzer countdown (10s)...');
  await sleep(10500);

  // 4. Alice hits buzzer
  let aliceBuzzedTime = null;
  await new Promise(resolve => {
    aliceSock1.emit('hit_buzzer', { roomPin }, res => {
      assert(res.success === true, 'Alice buzzed successfully');
      assert(res.position === 1, 'Alice is position #1 in buzzer queue');
      assert(res.isYourTurn === true, 'Alice is active answerer');
      aliceBuzzedTime = res.timeFormatted;
      resolve();
    });
  });

  // 5. TEST REFRESH DURING ANSWERING
  console.log('\n  🔄 Test Scenario: Alice refreshes page while it is her turn to answer');
  aliceSock1.disconnect();
  await sleep(300);

  const aliceSock2 = createSocket();
  await connectSocket(aliceSock2);

  await new Promise(resolve => {
    aliceSock2.emit('join_room', { roomPin, name: 'Alice', participantId: alicePId, role: 'participant' }, res => {
      assert(res.success === true, 'Alice reconnected on new socket');
      assert(res.participantId === alicePId, 'Alice retained same participantId');
      assert(res.gameState === 'ANSWERING', 'Game state is still ANSWERING');
      assert(res.hasBuzzed === true, 'Alice hasBuzzed is preserved as true');
      assert(res.buzzedPosition === 1, 'Alice position #1 is preserved');
      assert(res.buzzerQueue.length > 0, 'Buzzer queue is preserved');
      assert(res.currentAnswerer && res.currentAnswerer.name === 'Alice', 'Alice is still current answerer');
      resolve();
    });
  });

  // 6. Alice submits answer on her NEW socket (simulating answering after refresh)
  await new Promise(resolve => {
    // Correct answer for question 0 is option index 2 ('C')
    aliceSock2.emit('submit_answer', { roomPin, optionIndex: 2 }, res => {
      assert(res.success === true, 'Alice answered via reconnected socket');
      assert(res.isCorrect === true, 'Alice answer is correct (+100 pts)');
      assert(res.currentScore === 100, 'Alice currentScore updated to 100');
      resolve();
    });
  });

  // 7. TEST REFRESH DURING REVEAL
  console.log('\n  🔄 Test Scenario: Alice refreshes page during REVEAL phase');
  aliceSock2.disconnect();
  await sleep(300);

  const aliceSock3 = createSocket();
  await connectSocket(aliceSock3);

  await new Promise(resolve => {
    aliceSock3.emit('join_room', { roomPin, name: 'Alice', participantId: alicePId, role: 'participant' }, res => {
      assert(res.success === true, 'Alice reconnected in REVEAL phase');
      assert(res.gameState === 'REVEAL', 'State is REVEAL');
      assert(res.myStats && res.myStats.score === 100, 'Alice score 100 retained across refresh');
      assert(res.hasWonThisQuestion === true, 'Alice hasWonThisQuestion is true');
      assert(res.revealResult && res.revealResult.winner && res.revealResult.winner.name === 'Alice', 'revealResult winner is Alice');
      resolve();
    });
  });

  // 8. TEST PARTICIPANT 2 (Bob) WRONG ANSWER ANTI-CHEAT ON REFRESH
  console.log('\n  🔄 Test Scenario: Bob attempts wrong answer and tries to refresh to bypass lockout');
  const bobSock1 = createSocket();
  await connectSocket(bobSock1);
  let bobPId = null;

  await new Promise(resolve => {
    bobSock1.emit('join_room', { roomPin, name: 'Bob', role: 'participant' }, res => {
      bobPId = res.participantId;
      assert(res.success === true, `Bob joined with participantId: ${bobPId}`);
      resolve();
    });
  });

  // Push question 1
  await new Promise(resolve => {
    hostSock.emit('push_question', { roomPin, questionIndex: 1 }, res => {
      assert(res.success === true, 'Question 1 pushed');
      resolve();
    });
  });

  console.log('  ⏳ Waiting for reading phase timer (10s)...');
  await sleep(10500);

  // Bob buzzes
  await new Promise(resolve => {
    bobSock1.emit('hit_buzzer', { roomPin }, res => {
      assert(res.success === true, 'Bob buzzed on question 1');
      resolve();
    });
  });

  // Bob answers wrong (option 0)
  await new Promise(resolve => {
    bobSock1.emit('submit_answer', { roomPin, optionIndex: 0 }, res => {
      assert(res.success === true && res.isCorrect === false, 'Bob answered incorrectly');
      resolve();
    });
  });

  // Bob refreshes tab
  bobSock1.disconnect();
  await sleep(300);

  const bobSock2 = createSocket();
  await connectSocket(bobSock2);

  await new Promise(resolve => {
    bobSock2.emit('join_room', { roomPin, name: 'Bob', participantId: bobPId, role: 'participant' }, res => {
      assert(res.success === true, 'Bob reconnected');
      assert(res.hasFailed === true, 'Bob hasFailed is still true after refresh');
      resolve();
    });
  });

  // Bob tries to buzz again on question 1 -> must be rejected
  await new Promise(resolve => {
    bobSock2.emit('hit_buzzer', { roomPin }, res => {
      assert(res.success === false, 'Bob cannot buzz again after refresh on same question');
      resolve();
    });
  });

  // 9. TEST LEAVE ROOM
  console.log('\n  🚪 Test Scenario: Bob explicitly leaves room');
  await new Promise(resolve => {
    bobSock2.emit('leave_room', { roomPin }, res => {
      assert(res.success === true, 'leave_room acknowledged');
      resolve();
    });
  });

  // Check host room update to verify Alice is still in room
  await new Promise(resolve => {
    hostSock.emit('reveal_answer', { roomPin }, res => {
      assert(res.success === true, 'Host revealed answer');
      resolve();
    });
  });

  await sleep(200);

  console.log('\n------------------------------------------------------------');
  console.log(`Results: ${passedTests} / ${totalTests} assertions passed`);
  console.log('------------------------------------------------------------\n');

  aliceSock3.disconnect();
  bobSock2.disconnect();
  hostSock.disconnect();
  serverProc.kill('SIGTERM');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  if (serverProc) serverProc.kill('SIGTERM');
  process.exit(1);
});
