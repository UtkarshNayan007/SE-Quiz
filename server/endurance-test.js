const { io } = require('socket.io-client');

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const SERVER_URL = getArg('--server', 'https://se-quiz-server.onrender.com');
const NUM_USERS = parseInt(getArg('--users', '500'), 10);
const DURATION_SECONDS = parseInt(getArg('--duration', '600'), 10); // Default 10 mins = 600s
const RAMPUP_DELAY_MS = parseInt(getArg('--rampup', '10'), 10);
const MAX_JITTER_MS = parseInt(getArg('--jitter', '100'), 10);
const HOST_PASSCODE = getArg('--passcode', 'SE2026!Admin');

console.log(`=============================================================`);
console.log(`⚡ 10-MINUTE SE QUIZ ENDURANCE LOAD TESTING SUITE`);
console.log(`Target Server     : ${SERVER_URL}`);
console.log(`Concurrent Users  : ${NUM_USERS}`);
console.log(`Test Duration     : ${DURATION_SECONDS} seconds (${(DURATION_SECONDS / 60).toFixed(1)} mins)`);
console.log(`Ramp-up Interval  : ${RAMPUP_DELAY_MS} ms/user`);
console.log(`=============================================================\n`);

const metrics = {
  connectSuccess: 0,
  connectErrors: 0,
  disconnects: 0,
  joinSuccess: 0,
  buzzerHitsSent: 0,
  buzzerAcks: 0,
  buzzerFailures: 0,
  buzzerLatencyMs: [],
  answersSubmitted: 0,
  totalEventsReceived: 0,
  eventBreakdown: {},
  roundsCompleted: 0,
  startTime: Date.now(),
};

function trackEvent(eventName) {
  metrics.totalEventsReceived++;
  metrics.eventBreakdown[eventName] = (metrics.eventBreakdown[eventName] || 0) + 1;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runEnduranceTest() {
  const testStartTime = Date.now();
  const endTime = testStartTime + DURATION_SECONDS * 1000;

  // Step 1: Host connects & creates room
  console.log(`[Host] Connecting host socket to ${SERVER_URL}...`);
  const hostSocket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: true,
  });

  let roomPin = null;

  await new Promise((resolve, reject) => {
    hostSocket.on('connect', () => {
      console.log(`[Host] Connected. Authenticating host & creating room...`);
      hostSocket.emit('create_room', { passcode: HOST_PASSCODE }, (res) => {
        if (res && res.success) {
          roomPin = res.roomPin;
          console.log(`[Host] Room created successfully! Room PIN: ${roomPin}`);
          resolve();
        } else {
          reject(new Error('Host creation failed: ' + (res?.message || 'Unknown error')));
        }
      });
    });
    hostSocket.on('connect_error', (err) => reject(err));
  });

  // Step 2: Spawn 500 participant clients
  console.log(`[Clients] Spawning ${NUM_USERS} participant sockets...`);
  const clientSockets = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
    });

    const participantName = `Player_${i + 1}`;
    let isWinner = false;

    socket.on('connect', () => {
      metrics.connectSuccess++;
    });

    socket.on('connect_error', () => {
      metrics.connectErrors++;
    });

    socket.on('disconnect', () => {
      metrics.disconnects++;
    });

    socket.on('room_updated', () => {
      trackEvent('room_updated');
    });

    socket.on('question_pushed', () => {
      trackEvent('question_pushed');
    });

    socket.on('buzzer_unlocked', () => {
      trackEvent('buzzer_unlocked');
      if (isWinner) return;

      const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
      setTimeout(() => {
        const hitStart = Date.now();
        metrics.buzzerHitsSent++;
        socket.emit('hit_buzzer', { roomPin }, (res) => {
          if (res && res.success) {
            metrics.buzzerAcks++;
            metrics.buzzerLatencyMs.push(Date.now() - hitStart);

            if (res.isYourTurn) {
              // Submit answer for 1st turn
              setTimeout(() => {
                metrics.answersSubmitted++;
                const isCorrectAttempt = Math.random() > 0.4;
                socket.emit('submit_answer', { roomPin, optionIndex: isCorrectAttempt ? 1 : 0 }, (ansRes) => {
                  if (ansRes && ansRes.hasWon) {
                    isWinner = true;
                  }
                });
              }, 300);
            }
          } else {
            metrics.buzzerFailures++;
          }
        });
      }, jitter);
    });

    socket.on('turn_passed', (data) => {
      trackEvent('turn_passed');
      if (data.nextAnswerer && data.nextAnswerer.socketId === socket.id && !isWinner) {
        setTimeout(() => {
          metrics.answersSubmitted++;
          const isCorrectAttempt = Math.random() > 0.3;
          socket.emit('submit_answer', { roomPin, optionIndex: isCorrectAttempt ? 1 : 0 }, (ansRes) => {
            if (ansRes && ansRes.hasWon) {
              isWinner = true;
            }
          });
        }, 300);
      }
    });

    socket.on('answer_revealed', () => {
      trackEvent('answer_revealed');
    });

    clientSockets.push(socket);
    if (RAMPUP_DELAY_MS > 0) {
      await new Promise(r => setTimeout(r, RAMPUP_DELAY_MS));
    }
  }

  console.log(`[Clients] All ${NUM_USERS} sockets spawned. Joining room ${roomPin}...`);

  // Concurrently join room
  await Promise.all(clientSockets.map((socket, idx) => {
    return new Promise(resolve => {
      socket.emit('join_room', { roomPin, name: `Player_${idx + 1}`, role: 'participant' }, (res) => {
        if (res && res.success) metrics.joinSuccess++;
        resolve();
      });
    });
  }));

  console.log(`[Clients] ${metrics.joinSuccess}/${NUM_USERS} users joined room ${roomPin} successfully!\n`);
  console.log(`=============================================================`);
  console.log(`🏁 10-MINUTE LIVE UNINTERRUPTED SHOW TEST STARTED`);
  console.log(`=============================================================\n`);

  // Periodic status logger every 60 seconds
  const statusInterval = setInterval(() => {
    const elapsedMs = Date.now() - testStartTime;
    const elapsedMin = (elapsedMs / 60000).toFixed(1);
    const activeClients = clientSockets.filter(s => s.connected).length;
    const mem = process.memoryUsage();

    console.log(`⏱️  [${elapsedMin}m / ${(DURATION_SECONDS/60).toFixed(0)}m] ` +
      `Active Sockets: ${activeClients}/${NUM_USERS} | ` +
      `Disconnects: ${metrics.disconnects} | ` +
      `Rounds: ${metrics.roundsCompleted} | ` +
      `Buzzer Acks: ${metrics.buzzerAcks} | ` +
      `Avg Latency: ${average(metrics.buzzerLatencyMs).toFixed(1)}ms | ` +
      `Heap: ${(mem.heapUsed/1024/1024).toFixed(1)}MB`
    );
  }, 60000);

  // Host loop running questions continuously
  let currentQ = 0;

  while (Date.now() < endTime) {
    await new Promise(r => setTimeout(r, 1000));
    if (Date.now() >= endTime) break;

    // Push question
    await new Promise(resolve => {
      hostSocket.emit('push_question', { roomPin, questionIndex: currentQ % 5 }, () => {
        resolve();
      });
    });

    // Wait for reading phase + buzzer turns (approx 16s per question)
    await new Promise(r => setTimeout(r, 16000));

    // Reveal answer if needed
    await new Promise(resolve => {
      hostSocket.emit('reveal_answer', { roomPin }, () => {
        resolve();
      });
    });

    metrics.roundsCompleted++;
    currentQ++;

    await new Promise(r => setTimeout(r, 3000)); // Pause between rounds
  }

  clearInterval(statusInterval);

  // Final Summary Report
  const totalDurationSec = ((Date.now() - testStartTime) / 1000).toFixed(1);
  const finalMem = process.memoryUsage();
  const activeEndSockets = clientSockets.filter(s => s.connected).length;

  console.log(`\n=============================================================`);
  console.log(`📊 10-MINUTE ENDURANCE TEST SUMMARY REPORT`);
  console.log(`=============================================================`);
  console.log(`Total Duration          : ${totalDurationSec} seconds (${(totalDurationSec/60).toFixed(2)} mins)`);
  console.log(`Target Server           : ${SERVER_URL}`);
  console.log(`Concurrent Users Target : ${NUM_USERS}`);
  console.log(`Active Connected Sockets: ${activeEndSockets} / ${NUM_USERS} (${((activeEndSockets/NUM_USERS)*100).toFixed(1)}%)`);
  console.log(`Connection Drops/Errors : ${metrics.disconnects}`);
  console.log(`Quiz Rounds Completed   : ${metrics.roundsCompleted}`);
  console.log(`Total Socket Messages   : ${metrics.totalEventsReceived}`);
  console.log(`Buzzer Hits Processed   : ${metrics.buzzerAcks} (Failures: ${metrics.buzzerFailures})`);
  console.log(`Avg Buzzer Latency      : ${average(metrics.buzzerLatencyMs).toFixed(1)} ms`);
  console.log(`P95 Buzzer Latency      : ${percentile(metrics.buzzerLatencyMs, 95).toFixed(1)} ms`);
  console.log(`P99 Buzzer Latency      : ${percentile(metrics.buzzerLatencyMs, 99).toFixed(1)} ms`);
  console.log(`Answers Submitted       : ${metrics.answersSubmitted}`);
  console.log(`Memory Footprint        : Heap ${(finalMem.heapUsed/1024/1024).toFixed(2)} MB | RSS ${(finalMem.rss/1024/1024).toFixed(2)} MB`);
  console.log(`=============================================================\n`);

  // Disconnect all sockets
  clientSockets.forEach(s => s.disconnect());
  hostSocket.disconnect();
  process.exit(0);
}

runEnduranceTest().catch(err => {
  console.error('Endurance test error:', err);
  process.exit(1);
});
