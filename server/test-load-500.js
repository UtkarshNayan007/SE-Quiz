/**
 * SE QUIZ PLATFORM - 500 CONCURRENT USERS COMPREHENSIVE TEST SUITE
 * Tests: Load, Endurance, Real-time Dial Synchronization, Security & Resilience
 */

const { io } = require('../client/node_modules/socket.io-client');
const http = require('http');

const TARGET_URL = process.env.TEST_TARGET_URL || 'http://localhost:4000';
const NUM_PARTICIPANTS = parseInt(process.env.NUM_PARTICIPANTS || '500', 10);
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 60;
const IS_REMOTE = !TARGET_URL.includes('localhost') && !TARGET_URL.includes('127.0.0.1');

// Adaptive thresholds: remote deployments have higher network latency
const THRESHOLDS = {
  wsHandshakeP95:   IS_REMOTE ? 3000 : 1500,
  roomJoinP95:      IS_REMOTE ? 2000 : 1000,
  answerSubmitP95:  IS_REMOTE ? 1500 : 600,
  revealWaitMs:     IS_REMOTE ? 3000 : 600,
  reconnectWaitMs:  IS_REMOTE ? 2000 : 500,
  postReconnectStabilizeMs: IS_REMOTE ? 2000 : 200,
};

console.log('================================================================');
console.log('   CYBER DAY 2026 - ENTERPRISE LOAD & RELIABILITY TEST SUITE    ');
console.log('================================================================');
console.log(`Target URL:         ${TARGET_URL}`);
console.log(`Concurrent Users:   ${NUM_PARTICIPANTS}`);
console.log(`Timestamp:          ${new Date().toISOString()}`);
console.log('----------------------------------------------------------------\n');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(avg * 10) / 10,
    p50,
    p95,
    p99
  };
}

async function runTestSuite() {
  const startTime = Date.now();
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      testsFailed++;
    }
  }

  // =================================================================
  // PHASE 1: HOST & PROJECTOR INITIALIZATION
  // =================================================================
  console.log('PHASE 1: Host & Projector Interface Initialization...');
  const hostSocket = io(TARGET_URL, { transports: ['websocket'], reconnection: false });
  const projectorSocket = io(TARGET_URL, { transports: ['websocket'], reconnection: false });

  await new Promise((resolve, reject) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    hostSocket.on('connect', check);
    projectorSocket.on('connect', check);
    setTimeout(() => reject(new Error('Host/Projector connection timeout')), 10000);
  });

  assert(hostSocket.connected, 'Host socket connected successfully');
  assert(projectorSocket.connected, 'Projector socket connected successfully');

  // Create room with host
  let roomPin = null;
  await new Promise((resolve, reject) => {
    hostSocket.emit('create_room', { questionCount: 5, passcode: 'SE2026!Admin' }, (res) => {
      if (res && res.success) {
        roomPin = res.roomPin;
        resolve();
      } else {
        reject(new Error('Failed to create room: ' + JSON.stringify(res)));
      }
    });
  });

  assert(Boolean(roomPin), `Host created Room PIN: ${roomPin}`);

  // Projector joins room
  let projectorJoined = false;
  let projectorDialAnswered = 0;
  let projectorDialTotal = 0;

  projectorSocket.on('question_progress', (data) => {
    projectorDialAnswered = data.answeredCount;
    projectorDialTotal = data.participantCount;
  });

  await new Promise((resolve, reject) => {
    projectorSocket.emit('join_room', { roomPin, name: 'Projector Screen', role: 'projector' }, (res) => {
      if (res && res.success) {
        projectorJoined = true;
        resolve();
      } else {
        reject(new Error('Projector failed to join room: ' + JSON.stringify(res)));
      }
    });
  });

  assert(projectorJoined, 'Projector joined stage room view');

  // Host dial tracker
  let hostDialAnswered = 0;
  let hostDialTotal = 0;
  hostSocket.on('question_progress', (data) => {
    hostDialAnswered = data.answeredCount;
    hostDialTotal = data.participantCount;
  });

  // =================================================================
  // PHASE 2: CONCURRENT 500 PARTICIPANTS LOAD TEST
  // =================================================================
  console.log(`\nPHASE 2: Connecting & Joining ${NUM_PARTICIPANTS} Parallel Participants in Batches...`);
  const participants = [];
  const connectionLatencies = [];
  const joinLatencies = [];
  const assignedBadges = new Set();

  const connectStart = Date.now();

function indexToAlphaName(idx) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let str = '';
  let n = idx;
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = letters[rem] + str;
    n = Math.floor((n - 1) / 26);
  }
  return `PLAYER ${str}`;
}

  for (let batch = 0; batch < NUM_PARTICIPANTS; batch += BATCH_SIZE) {
    const batchPromises = [];
    const currentBatchSize = Math.min(BATCH_SIZE, NUM_PARTICIPANTS - batch);

    for (let i = 0; i < currentBatchSize; i++) {
      const userIndex = batch + i + 1;
      const name = indexToAlphaName(userIndex);

      batchPromises.push(new Promise((resolve) => {
        const t0 = Date.now();
        const pSocket = io(TARGET_URL, {
          transports: ['websocket'],
          reconnection: IS_REMOTE,
          reconnectionAttempts: IS_REMOTE ? 3 : 0,
          reconnectionDelay: 1000,
          timeout: IS_REMOTE ? 30000 : 15000
        });

        pSocket.on('connect', () => {
          const connectLatency = Date.now() - t0;
          connectionLatencies.push(connectLatency);

          const joinT0 = Date.now();
          pSocket.emit('join_room', { roomPin, name, role: 'participant' }, (res) => {
            const joinLatency = Date.now() - joinT0;
            joinLatencies.push(joinLatency);

            if (res && res.success) {
              assignedBadges.add(res.badgeNumber);
              participants.push({
                index: userIndex,
                name,
                socket: pSocket,
                participantId: res.participantId,
                badgeNumber: res.badgeNumber
              });
            }
            resolve();
          });
        });

        pSocket.on('connect_error', () => {
          resolve(); // Still resolve to keep batch moving
        });
      }));
    }

    await Promise.all(batchPromises);
    process.stdout.write(`\r  Joined: ${participants.length}/${NUM_PARTICIPANTS} players...`);
    await sleep(BATCH_DELAY_MS);
  }

  const connectTotalDuration = ((Date.now() - connectStart) / 1000).toFixed(2);
  console.log(`\n  All connections established in ${connectTotalDuration}s.`);

  assert(participants.length === NUM_PARTICIPANTS, `Successfully connected all ${participants.length}/${NUM_PARTICIPANTS} participants`);
  assert(assignedBadges.size === NUM_PARTICIPANTS, `All 500 participants assigned unique badge numbers (${assignedBadges.size} unique badges)`);

  const connStats = calculatePercentiles(connectionLatencies);
  console.log(`  WebSocket Handshake Latencies (ms): min=${connStats.min}, p50=${connStats.p50}, p95=${connStats.p95}, p99=${connStats.p99}, max=${connStats.max}`);
  const joinStats = calculatePercentiles(joinLatencies);
  console.log(`  Room Join Ack Latencies (ms):       min=${joinStats.min}, p50=${joinStats.p50}, p95=${joinStats.p95}, p99=${joinStats.p99}, max=${joinStats.max}`);

  assert(connStats.p95 < THRESHOLDS.wsHandshakeP95, `P95 WebSocket Handshake Latency is healthy (< ${THRESHOLDS.wsHandshakeP95}ms): ${connStats.p95}ms`);
  assert(joinStats.p95 < THRESHOLDS.roomJoinP95, `P95 Room Join Latency is healthy (< ${THRESHOLDS.roomJoinP95}ms): ${joinStats.p95}ms`);

  // =================================================================
  // PHASE 3: STRESS & CONCURRENT ANSWER SURGE ("FASTEST FINGER FIRST")
  // =================================================================
  console.log('\nPHASE 3: High-Concurrency Answering Surge (500 simultaneous submissions)...');

  // Push question from host
  await new Promise((resolve) => {
    hostSocket.emit('push_question', { roomPin, questionIndex: 0 }, (res) => {
      resolve(res);
    });
  });

  // Wait for the 10-second reading phase to transition to answering window
  console.log('  Waiting 10s reading countdown to transition to active answering phase...');
  await new Promise((resolve) => {
    projectorSocket.once('answering_started', resolve);
  });

  await sleep(100);

  // All 500 participants submit answers concurrently
  console.log('  Firing 500 concurrent answer submissions...');
  const answerLatencies = [];
  const answerResults = [];
  const surgeT0 = Date.now();

  const answerPromises = participants.map((p, idx) => {
    return new Promise((resolve) => {
      // Simulate random realistic human delay between 50ms and 800ms
      const delay = Math.floor(Math.random() * 750);
      setTimeout(() => {
        const t0 = Date.now();
        // Give 70% of players the correct option (option 0 or 1), 30% other
        const optionIndex = (idx % 3 === 0) ? 1 : 0;

        p.socket.emit('submit_answer', { roomPin, optionIndex }, (res) => {
          const latency = Date.now() - t0;
          answerLatencies.push(latency);
          answerResults.push(res);
          resolve();
        });
      }, delay);
    });
  });

  await Promise.all(answerPromises);
  const surgeDuration = Date.now() - surgeT0;
  console.log(`  Completed 500 answer submissions in ${surgeDuration}ms.`);

  const successfulAnswers = answerResults.filter(r => r && r.success).length;
  assert(successfulAnswers === NUM_PARTICIPANTS, `100% of concurrent answer submissions succeeded (${successfulAnswers}/${NUM_PARTICIPANTS})`);

  const answerStats = calculatePercentiles(answerLatencies);
  console.log(`  Answer Submission Latencies (ms): min=${answerStats.min}, p50=${answerStats.p50}, p95=${answerStats.p95}, p99=${answerStats.p99}, max=${answerStats.max}`);
  assert(answerStats.p95 < THRESHOLDS.answerSubmitP95, `P95 Answer Submission Ack is healthy (< ${THRESHOLDS.answerSubmitP95}ms): ${answerStats.p95}ms`);

  // Wait for throttled dials to catch up
  await sleep(600);
  assert(projectorDialAnswered === NUM_PARTICIPANTS, `Projector stage dial accurately received 500 answers: ${projectorDialAnswered}/${projectorDialTotal}`);
  assert(hostDialAnswered === NUM_PARTICIPANTS, `Host admin dial accurately received 500 answers: ${hostDialAnswered}/${hostDialTotal}`);

  // =================================================================
  // PHASE 4: SECURITY & INPUT VALIDATION ASSURANCE
  // =================================================================
  console.log('\nPHASE 4: Security & Edge Case Vulnerability Checks...');

  // Test 4.1: Unauthorized participant attempts to push question
  const attackerSocket = participants[0].socket;
  let unauthorizedPushBlocked = false;
  await new Promise((resolve) => {
    attackerSocket.emit('push_question', { roomPin, questionIndex: 1 }, (res) => {
      if (!res.success && res.message.includes('Unauthorized')) {
        unauthorizedPushBlocked = true;
      }
      resolve();
    });
  });
  assert(unauthorizedPushBlocked, 'Security: Participant blocked from unauthorized push_question');

  // Test 4.2: Unauthorized participant attempts to reset room
  let unauthorizedResetBlocked = false;
  await new Promise((resolve) => {
    attackerSocket.emit('reset_room', { roomPin }, (res) => {
      if (!res.success && res.message.includes('Unauthorized')) {
        unauthorizedResetBlocked = true;
      }
      resolve();
    });
  });
  assert(unauthorizedResetBlocked, 'Security: Participant blocked from unauthorized reset_room');

  // Test 4.3: Duplicate answer submission (double-click attack)
  let duplicateAnswerBlocked = false;
  await new Promise((resolve) => {
    attackerSocket.emit('submit_answer', { roomPin, optionIndex: 0 }, (res) => {
      if (!res.success && res.message.includes('already submitted')) {
        duplicateAnswerBlocked = true;
      }
      resolve();
    });
  });
  assert(duplicateAnswerBlocked, 'Reliability: Participant blocked from duplicate answer submission');

  // Test 4.4: XSS / Malicious script name sanitization
  const testSocket = io(TARGET_URL, { transports: ['websocket'], reconnection: false });
  await new Promise((res) => testSocket.on('connect', res));
  let xssBlocked = false;
  await new Promise((resolve) => {
    testSocket.emit('join_room', { roomPin, name: '<script>alert("XSS")</script>', role: 'participant' }, (res) => {
      if (!res.success && res.message.includes('Invalid name')) {
        xssBlocked = true;
      }
      resolve();
    });
  });
  assert(xssBlocked, 'Security: XSS and special characters strictly rejected on participant join');
  testSocket.disconnect();

  // =================================================================
  // PHASE 5: NETWORK RESILIENCE & RECONNECTION STABILITY
  // =================================================================
  console.log('\nPHASE 5: Network Disconnect & Grace Period Reconnection...');
  const DISCONNECT_COUNT = 50;
  const disconnectedSubset = participants.slice(0, DISCONNECT_COUNT);

  // Abruptly disconnect 50 participants
  disconnectedSubset.forEach(p => p.socket.disconnect());
  await sleep(THRESHOLDS.reconnectWaitMs);

  // Reconnect all 50 participants using their participantId
  let reconnectedCount = 0;
  const reconPromises = disconnectedSubset.map(p => {
    return new Promise((resolve) => {
      const newSocket = io(TARGET_URL, { transports: ['websocket'], reconnection: false });
      newSocket.on('connect', () => {
        newSocket.emit('join_room', {
          roomPin,
          name: p.name,
          participantId: p.participantId,
          role: 'participant'
        }, (res) => {
          if (res && res.success && res.badgeNumber === p.badgeNumber) {
            reconnectedCount++;
            p.socket = newSocket; // Update socket reference
          }
          resolve();
        });
      });
      // Handle connection failure
      newSocket.on('connect_error', () => resolve());
      setTimeout(() => resolve(), 10000); // Safety timeout
    });
  });

  await Promise.all(reconPromises);
  assert(reconnectedCount === DISCONNECT_COUNT, `Resilience: All ${reconnectedCount}/${DISCONNECT_COUNT} disconnected users restored session and badge numbers`);

  // Allow reconnected sockets to fully stabilize in Socket.io rooms
  await sleep(THRESHOLDS.postReconnectStabilizeMs);

  // =================================================================
  // PHASE 6: ANSWER REVEAL & PODIUM TOURNAMENT ACCURACY
  // =================================================================
  console.log('\nPHASE 6: Answer Reveal & Official Podium Tournament Calculation...');

  // Pre-reveal connection health check
  const connectedBeforeReveal = participants.filter(p => p.socket.connected).length;
  const droppedBeforeReveal = NUM_PARTICIPANTS - connectedBeforeReveal;
  console.log(`  Pre-reveal connection health: ${connectedBeforeReveal}/${NUM_PARTICIPANTS} sockets alive${droppedBeforeReveal > 0 ? ` (${droppedBeforeReveal} silently dropped)` : ''}`);

  let revealReceivedCount = 0;

  // Only register reveal listeners on actually connected sockets
  participants.forEach(p => {
    if (p.socket.connected) {
      p.socket.on('answer_revealed', () => {
        revealReceivedCount++;
      });
    }
  });

  let revealData = null;
  projectorSocket.once('answer_revealed', (data) => {
    revealData = data;
  });

  await new Promise((resolve) => {
    hostSocket.emit('reveal_answer', { roomPin }, resolve);
  });

  await sleep(THRESHOLDS.revealWaitMs);
  const revealTolerance = IS_REMOTE ? Math.max(Math.floor(connectedBeforeReveal * 0.02), 5) : 5;
  assert(revealReceivedCount >= connectedBeforeReveal - revealTolerance, `Answer reveal broadcast reached active participants (${revealReceivedCount}/${connectedBeforeReveal} connected)`);
  assert(Boolean(revealData && revealData.winner), `Fastest correct responder identified: ${revealData?.winner?.name} (${revealData?.winner?.timeFormatted})`);

  // End quiz & publish results
  let finalResults = null;
  await new Promise((resolve) => {
    hostSocket.emit('end_quiz', { roomPin }, (res) => {
      resolve(res);
    });
  });
  await new Promise((resolve) => {
    hostSocket.emit('publish_quiz_results', { roomPin }, (res) => {
      finalResults = res?.publishedData;
      resolve(res);
    });
  });

  assert(Boolean(finalResults?.grandChampion), `Grand Champion crowned: ${finalResults?.grandChampion?.name} with ${finalResults?.grandChampion?.score} pts`);
  assert(finalResults?.allRanks?.length === NUM_PARTICIPANTS, `Full tournament leaderboard calculated for all ${NUM_PARTICIPANTS} participants`);

  // Cleanup sockets
  console.log('\nCleaning up sockets...');
  participants.forEach(p => p.socket.disconnect());
  projectorSocket.disconnect();
  hostSocket.disconnect();

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`   TEST EXECUTION COMPLETE (${totalDuration}s)                    `);
  console.log(`   Passed: ${testsPassed} | Failed: ${testsFailed}              `);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
