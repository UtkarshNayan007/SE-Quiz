const { io } = require('socket.io-client');

// Command line argument parser
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const SERVER_URL = getArg('--server', 'http://127.0.0.1:4000');
const NUM_USERS = parseInt(getArg('--users', '500'), 10);
const RAMPUP_DELAY_MS = parseInt(getArg('--rampup', '5'), 10); // delay between spawning each socket
const MAX_JITTER_MS = parseInt(getArg('--jitter', '100'), 10); // max reaction delay before hitting buzzer
const HOST_PASSCODE = getArg('--passcode', 'SE2026!Admin');

console.log(`=============================================================`);
console.log(`🚀 SE QUIZ LOAD TESTING SUITE`);
console.log(`Target Server     : ${SERVER_URL}`);
console.log(`Concurrent Users  : ${NUM_USERS}`);
console.log(`Ramp-up Interval  : ${RAMPUP_DELAY_MS} ms/user`);
console.log(`Buzzer Max Jitter : ${MAX_JITTER_MS} ms`);
console.log(`=============================================================\n`);

// Performance Metrics Collection
const metrics = {
  connectSuccess: 0,
  connectErrors: 0,
  connectTimes: [],
  joinTimes: [],
  buzzerAckTimes: [],
  buzzerFailures: 0,
  buzzerTimeouts: 0,
  totalEventsReceived: 0,
  eventBreakdown: {},
  buzzerPositions: [],
  turnSubmitted: 0,
  correctAnswers: 0,
  startTime: Date.now(),
};

function trackEvent(eventName) {
  metrics.totalEventsReceived++;
  metrics.eventBreakdown[eventName] = (metrics.eventBreakdown[eventName] || 0) + 1;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

async function runLoadTest() {
  const initialMem = process.memoryUsage();

  // Step 1: Create Host socket & Room
  console.log(`[Host] Connecting host socket to ${SERVER_URL}...`);
  const hostSocket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  let roomPin = null;

  await new Promise((resolve, reject) => {
    hostSocket.on('connect', () => {
      console.log(`[Host] Connected (ID: ${hostSocket.id}). Authenticating host & creating room...`);
      hostSocket.emit('create_room', { passcode: HOST_PASSCODE }, (res) => {
        if (res && res.success) {
          roomPin = res.roomPin;
          console.log(`[Host] Room created successfully! Room PIN: ${roomPin}`);
          resolve();
        } else {
          reject(new Error('Failed to create room'));
        }
      });
    });
    hostSocket.on('connect_error', (err) => reject(err));
  });

  // Step 2: Spawn 500 participant clients with ramp up
  console.log(`\n[Clients] Spawning ${NUM_USERS} participant sockets...`);
  const clientSockets = [];
  const startConnectTime = Date.now();

  for (let i = 0; i < NUM_USERS; i++) {
    const connStart = Date.now();
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    socket.playerIndex = i;
    socket.playerName = `Tester_${i + 1}`;

    socket.on('connect', () => {
      metrics.connectSuccess++;
      metrics.connectTimes.push(Date.now() - connStart);
    });

    socket.on('connect_error', (err) => {
      metrics.connectErrors++;
    });

    // Track incoming broadcast events
    const eventsToTrack = ['room_updated', 'question_pushed', 'buzzer_unlocked', 'buzzer_hit_recorded', 'turn_passed', 'answer_revealed'];
    eventsToTrack.forEach(evt => {
      socket.on(evt, () => trackEvent(evt));
    });

    clientSockets.push(socket);

    if (RAMPUP_DELAY_MS > 0) {
      await new Promise(r => setTimeout(r, RAMPUP_DELAY_MS));
    }
  }

  // Wait for all sockets to finish connecting
  await new Promise(r => setTimeout(r, 2000));
  const totalRampTime = Date.now() - startConnectTime;
  console.log(`[Clients] ${metrics.connectSuccess}/${NUM_USERS} clients connected in ${(totalRampTime / 1000).toFixed(2)}s. (${metrics.connectErrors} errors)`);

  // Step 3: All clients join the room concurrently
  console.log(`\n[Clients] Joining room ${roomPin} concurrently...`);
  const joinPromises = clientSockets.map((socket) => {
    return new Promise((resolve) => {
      const joinStart = Date.now();
      socket.emit('join_room', { roomPin, name: socket.playerName, role: 'participant' }, (res) => {
        const joinDuration = Date.now() - joinStart;
        if (res && res.success) {
          metrics.joinTimes.push(joinDuration);
        }
        resolve();
      });
    });
  });

  await Promise.all(joinPromises);
  console.log(`[Clients] All ${metrics.joinTimes.length} successful room joins completed!`);
  console.log(`           Join Latency -> Avg: ${average(metrics.joinTimes).toFixed(1)}ms | P50: ${percentile(metrics.joinTimes, 50)}ms | P95: ${percentile(metrics.joinTimes, 95)}ms | P99: ${percentile(metrics.joinTimes, 99)}ms | Max: ${Math.max(...metrics.joinTimes, 0)}ms`);

  // Step 4: Host pushes question 0
  console.log(`\n[Host] Pushing Question 0 to room ${roomPin}...`);
  
  // Set up clients to listen for 'buzzer_unlocked'
  const buzzerPromises = clientSockets.map((socket) => {
    return new Promise((resolve) => {
      let done = false;
      const safeResolve = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };

      const safetyTimer = setTimeout(() => {
        metrics.buzzerTimeouts++;
        safeResolve();
      }, 18000);

      socket.once('buzzer_unlocked', () => {
        const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
        setTimeout(() => {
          const hitStart = Date.now();
          socket.emit('hit_buzzer', { roomPin }, (res) => {
            clearTimeout(safetyTimer);
            const ackDuration = Date.now() - hitStart;
            metrics.buzzerAckTimes.push(ackDuration);

            if (res && res.success) {
              metrics.buzzerPositions.push(res.position);
              if (res.isYourTurn) {
                metrics.turnSubmitted++;
                console.log(`⚡ [Client ${socket.playerName}] WINNER! First to hit buzzer! Position: ${res.position}. Submitting answer...`);
                socket.emit('submit_answer', { roomPin, optionIndex: 0 }, (ansRes) => {
                  if (ansRes && ansRes.isCorrect) {
                    metrics.correctAnswers++;
                  }
                });
              }
            } else {
              metrics.buzzerFailures++;
            }
            safeResolve();
          });
        }, jitter);
      });
    });
  });

  // Host pushes question 0
  hostSocket.emit('push_question', { roomPin, questionIndex: 0 }, (res) => {
    console.log(`[Host] Question 0 pushed! Server is in READING state (10s countdown until buzzer unlocks)...`);
  });

  console.log(`[Test] Waiting for 10s reading timer + buzzer unlocked event...`);
  await Promise.all(buzzerPromises);
  console.log(`\n[Buzzer] All ${metrics.buzzerAckTimes.length} buzzer hits processed! (${metrics.buzzerTimeouts} timeouts, ${metrics.buzzerFailures} non-first hits)`);

  // Wait 3 seconds for broadcast messages and reveal to stabilize
  await new Promise(r => setTimeout(r, 3000));

  const totalTestDuration = ((Date.now() - metrics.startTime) / 1000).toFixed(2);
  const finalMem = process.memoryUsage();

  // Step 5: Report Results
  console.log(`\n=============================================================`);
  console.log(`📊 LOAD TEST RESULTS SUMMARY (${NUM_USERS} CONCURRENT USERS)`);
  console.log(`=============================================================`);
  console.log(`Test Execution Time : ${totalTestDuration} seconds`);

  console.log(`\n1. CONNECTIONS`);
  console.log(`   - Connected Sockets : ${metrics.connectSuccess} / ${NUM_USERS} (${((metrics.connectSuccess / NUM_USERS) * 100).toFixed(1)}%)`);
  console.log(`   - Failed Sockets    : ${metrics.connectErrors}`);
  console.log(`   - Connection RTT    : Avg: ${average(metrics.connectTimes).toFixed(1)}ms | P95: ${percentile(metrics.connectTimes, 95)}ms | Max: ${Math.max(...metrics.connectTimes, 0)}ms`);

  console.log(`\n2. ROOM JOIN LATENCY`);
  console.log(`   - Total Joins       : ${metrics.joinTimes.length}`);
  console.log(`   - Average Latency   : ${average(metrics.joinTimes).toFixed(1)} ms`);
  console.log(`   - Median (P50)      : ${percentile(metrics.joinTimes, 50)} ms`);
  console.log(`   - 90th Percentile   : ${percentile(metrics.joinTimes, 90)} ms`);
  console.log(`   - 95th Percentile   : ${percentile(metrics.joinTimes, 95)} ms`);
  console.log(`   - 99th Percentile   : ${percentile(metrics.joinTimes, 99)} ms`);
  console.log(`   - Max Latency       : ${Math.max(...metrics.joinTimes, 0)} ms`);

  console.log(`\n3. SIMULTANEOUS BUZZER HIT LATENCY (ACK RTT)`);
  console.log(`   - Total Hits Acked  : ${metrics.buzzerAckTimes.length}`);
  console.log(`   - Timeouts          : ${metrics.buzzerTimeouts}`);
  console.log(`   - Average Ack RTT   : ${average(metrics.buzzerAckTimes).toFixed(1)} ms`);
  console.log(`   - Median (P50)      : ${percentile(metrics.buzzerAckTimes, 50)} ms`);
  console.log(`   - 90th Percentile   : ${percentile(metrics.buzzerAckTimes, 90)} ms`);
  console.log(`   - 95th Percentile   : ${percentile(metrics.buzzerAckTimes, 95)} ms`);
  console.log(`   - 99th Percentile   : ${percentile(metrics.buzzerAckTimes, 99)} ms`);
  console.log(`   - Max Ack RTT       : ${Math.max(...metrics.buzzerAckTimes, 0)} ms`);

  console.log(`\n4. BROADCAST & NETWORK LOAD`);
  console.log(`   - Total Event Msgs  : ${metrics.totalEventsReceived} messages received across all clients`);
  console.log(`   - Avg Msgs / Client : ${(metrics.totalEventsReceived / NUM_USERS).toFixed(1)} messages`);
  console.log(`   - Event Breakdown   :`);
  Object.entries(metrics.eventBreakdown).forEach(([evt, count]) => {
    console.log(`     * ${evt.padEnd(22)} : ${count} received`);
  });

  console.log(`\n5. CLIENT PROCESS MEMORY FOOTPRINT`);
  console.log(`   - Heap Used Initial : ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Heap Used Peak    : ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - RSS Memory Peak   : ${(finalMem.rss / 1024 / 1024).toFixed(2)} MB`);

  console.log(`=============================================================\n`);

  // Cleanup
  clientSockets.forEach(s => s.close());
  hostSocket.close();
  process.exit(0);
}

runLoadTest().catch(err => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
