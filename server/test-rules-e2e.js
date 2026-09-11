const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const assert = require('assert');

const TEST_PORT = 4058;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const HOST_PASSCODE = 'SE2026!Admin';

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
    }, 5000);
  });
}

function createClient(name) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
}

async function runTests() {
  console.log('🚀 Starting Rules & Interface Guide E2E Flow Test...');
  const serverProc = await startServer();

  try {
    const host = createClient('Host');
    const projector = createClient('Projector');
    const participant = createClient('Participant');

    await Promise.all([
      new Promise(r => host.on('connect', r)),
      new Promise(r => projector.on('connect', r)),
      new Promise(r => participant.on('connect', r))
    ]);
    console.log('✅ All 3 sockets connected (Host, Projector, Participant).');

    // 1. Host creates room
    let roomPin;
    await new Promise((resolve) => {
      host.emit('create_room', { passcode: HOST_PASSCODE, questionCount: 5 }, (res) => {
        assert(res.success, 'Host room creation must succeed');
        assert.strictEqual(res.gameState, 'LOBBY');
        roomPin = res.roomPin;
        console.log(`✅ Room created with PIN: ${roomPin} (State: LOBBY)`);
        resolve();
      });
    });

    // 2. Projector joins
    await new Promise((resolve) => {
      projector.emit('join_room', { roomPin, name: 'Projector', role: 'projector' }, (res) => {
        assert(res.success, 'Projector join must succeed');
        assert.strictEqual(res.gameState, 'LOBBY');
        console.log('✅ Projector joined room.');
        resolve();
      });
    });

    // 3. Participant joins
    await new Promise((resolve) => {
      participant.emit('join_room', { roomPin, name: 'ALICE', role: 'participant' }, (res) => {
        assert(res.success, 'Participant join must succeed');
        assert.strictEqual(res.gameState, 'LOBBY');
        console.log('✅ Participant ALICE joined room.');
        resolve();
      });
    });

    // 4. Host activates Rules & Guide
    let projectorSawRules = false;
    let participantSawRules = false;
    projector.on('rules_started', (data) => {
      projectorSawRules = true;
      assert.strictEqual(data.gameState, 'RULES');
    });
    participant.on('rules_started', (data) => {
      participantSawRules = true;
      assert.strictEqual(data.gameState, 'RULES');
    });

    await new Promise((resolve) => {
      host.emit('show_rules', { roomPin }, (res) => {
        assert(res.success, 'show_rules must succeed');
        assert.strictEqual(res.gameState, 'RULES');
        console.log('✅ Host activated show_rules.');
        resolve();
      });
    });

    await new Promise(r => setTimeout(r, 200));
    assert(projectorSawRules, 'Projector must receive rules_started');
    assert(participantSawRules, 'Participant must receive rules_started');
    console.log('✅ Both Projector and Participant successfully entered RULES phase.');

    // 5. Host returns to Lobby
    let participantSawLobby = false;
    participant.on('room_updated', (data) => {
      if (data.gameState === 'LOBBY') participantSawLobby = true;
    });

    await new Promise((resolve) => {
      host.emit('return_to_lobby', { roomPin }, (res) => {
        assert(res.success, 'return_to_lobby must succeed');
        assert.strictEqual(res.gameState, 'LOBBY');
        console.log('✅ Host returned room to LOBBY.');
        resolve();
      });
    });

    await new Promise(r => setTimeout(r, 200));
    assert(participantSawLobby, 'Participant must observe room return to LOBBY');
    console.log('✅ Room successfully transitioned back to LOBBY.');

    // 6. Host re-activates Rules & Guide
    await new Promise((resolve) => {
      host.emit('show_rules', { roomPin }, (res) => {
        assert(res.success);
        resolve();
      });
    });
    console.log('✅ Re-entered RULES phase.');

    // 7. Host starts Question 1 directly from RULES
    let questionPushedReceived = false;
    participant.on('question_pushed', (data) => {
      questionPushedReceived = true;
      assert.strictEqual(data.questionIndex, 0);
      console.log(`✅ Question 1 received on participant: "${data.question.substring(0, 30)}..."`);
    });

    await new Promise((resolve) => {
      host.emit('push_question', { roomPin, questionIndex: 0 }, (res) => {
        assert(res.success, 'push_question must succeed from RULES');
        assert.strictEqual(res.questionIndex, 0);
        console.log('✅ Host pushed Question 1 successfully from RULES state.');
        resolve();
      });
    });

    await new Promise(r => setTimeout(r, 200));
    assert(questionPushedReceived, 'Participant must receive question_pushed event');
    console.log('✅ Successfully transitioned from RULES to READING Question 1!');

    // Cleanup
    projector.disconnect();
    participant.disconnect();
    host.disconnect();

    console.log('\n🎉 ALL RULES & INTERFACE GUIDE E2E TESTS PASSED PERFECTLY!\n');
  } finally {
    serverProc.kill();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
