/**
 * ==============================================================================
 * 🚀 SE QUIZ 1,000 CONCURRENT PARTICIPANT 30-MINUTE ENDURANCE & STAMPEDE SUITE
 * ==============================================================================
 * 
 * Simulates 1,000 real WebSocket clients connecting to the Render production
 * backend, maintaining persistent connections for 30 minutes, and triggering
 * periodic "Thundering Herd / Stampede" events every 5 minutes within a 500ms
 * window to benchmark Render's free tier CPU & event loop capacity.
 * 
 * Usage:
 *   node test-1000-endurance-suite.js [options]
 * 
 * Options:
 *   --server <url>           Target server URL (default: https://se-quiz-server.onrender.com)
 *   --users <count>          Total concurrent participants (default: 1000)
 *   --duration <seconds>     Total endurance duration in seconds (default: 1800 = 30m)
 *   --batch-size <count>     Sockets to spawn per batch (default: 50)
 *   --batch-interval <ms>    Delay between batches in ms (default: 2000)
 *   --stampede-every <sec>   Interval between stampede events (default: 300 = 5m)
 *   --jitter <ms>            Max jitter for answer submission (default: 500)
 *   --passcode <passcode>    Host passcode to create room (default: SE2026!Admin)
 *   --room <pin>             Existing Room PIN (optional, creates new room if omitted)
 * ==============================================================================
 */

const { io } = require('socket.io-client');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');

// Expand event listener limit to prevent MaxListenersExceededWarning
EventEmitter.defaultMaxListeners = 10000;

// Parse Command Line Arguments
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const SERVER_URL = getArg('--server', 'https://se-quiz-server.onrender.com');
const TOTAL_USERS = parseInt(getArg('--users', '1000'), 10);
const DURATION_SECONDS = parseInt(getArg('--duration', '1800'), 10); // 30 minutes
const BATCH_SIZE = parseInt(getArg('--batch-size', '50'), 10);
const BATCH_INTERVAL_MS = parseInt(getArg('--batch-interval', '2000'), 10); // 2s
const STAMPEDE_INTERVAL_SEC = parseInt(getArg('--stampede-every', '300'), 10); // 5 minutes
const STAMPEDE_JITTER_MS = parseInt(getArg('--jitter', '500'), 10); // 500ms thundering herd window
const HOST_PASSCODE = getArg('--passcode', 'SE2026!Admin');
const PRESET_ROOM_PIN = getArg('--room', null);

// Helper: Generate strictly alphabetical participant names (e.g. PLAYER AA, PLAYER AB)
// satisfying server regex validation: /[^A-Za-z\s]/
function generateAlphaName(index) {
  let letters = '';
  let num = index;
  do {
    letters = String.fromCharCode(65 + (num % 26)) + letters;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);
  if (letters.length < 2) letters = 'A' + letters;
  return `PLAYER ${letters}`;
}

// Helpers: Statistics
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// Global Telemetry State
const telemetry = {
  startTime: Date.now(),
  connectedSockets: 0,
  connectErrors: 0,
  disconnects: 0,
  reconnects: 0,
  roomsJoined: 0,
  totalEventsReceived: 0,
  heartbeatsSent: 0,
  heartbeatsAcked: 0,
  stampedesExecuted: 0,
  stampedeResults: [], // Array of { stampedeNumber, submissionsSent, acksReceived, errors, min, avg, p50, p95, p99, max }
  allStampedeLatencies: [],
};

// Measure Local Node.js Event Loop Lag
let localEventLoopLagMs = 0;
let lastLoopCheck = performance.now();
setInterval(() => {
  const now = performance.now();
  localEventLoopLagMs = Math.max(0, now - lastLoopCheck - 500);
  lastLoopCheck = now;
}, 500);

console.log(`==============================================================================`);
console.log(`🚀 SE QUIZ 1,000-CONCURRENT PARTICIPANT ENDURANCE & STAMPEDE SUITE`);
console.log(`==============================================================================`);
console.log(`🎯 Target Server         : ${SERVER_URL}`);
console.log(`👥 Target Participants   : ${TOTAL_USERS} WebSocket clients`);
console.log(`⏱️  Test Duration         : ${DURATION_SECONDS} seconds (${(DURATION_SECONDS / 60).toFixed(1)} minutes)`);
console.log(`⚡ Ramp-Up Strategy      : ${BATCH_SIZE} clients every ${BATCH_INTERVAL_MS}ms (${Math.ceil(TOTAL_USERS / BATCH_SIZE)} batches)`);
console.log(`💥 Thundering Herd       : Every ${STAMPEDE_INTERVAL_SEC}s (${(STAMPEDE_INTERVAL_SEC / 60).toFixed(1)}m) within ${STAMPEDE_JITTER_MS}ms window`);
console.log(`==============================================================================\n`);

async function main() {
  const testStartTime = Date.now();
  let roomPin = PRESET_ROOM_PIN;
  let hostSocket = null;

  // --------------------------------------------------------------------------
  // STEP 1: INITIALIZE HOST & ROOM
  // --------------------------------------------------------------------------
  if (!roomPin) {
    console.log(`[Host] Connecting Host controller to ${SERVER_URL}...`);
    hostSocket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      timeout: 30000,
    });

    roomPin = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Host socket connection timed out after 30s'));
      }, 30000);

      hostSocket.on('connect', () => {
        console.log(`[Host] Connected (Socket ID: ${hostSocket.id}). Creating test room with passcode...`);
        hostSocket.emit('create_room', { passcode: HOST_PASSCODE }, (res) => {
          clearTimeout(timeout);
          if (res && res.success && res.roomPin) {
            console.log(`[Host] ✅ Test room created successfully! Room PIN: [${res.roomPin}]`);
            resolve(res.roomPin);
          } else {
            reject(new Error(`Failed to create room: ${res?.message || 'Unknown server rejection'}`));
          }
        });
      });

      hostSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Host connection failed: ${err.message}`));
      });
    });
  } else {
    console.log(`[Host] Using pre-configured Room PIN: [${roomPin}]`);
  }

  // --------------------------------------------------------------------------
  // STEP 2: STAGGERED RAMP-UP (RATE LIMIT & DDOS EVASION)
  // --------------------------------------------------------------------------
  console.log(`\n[Ramp-Up] Initiating staggered ramp-up for ${TOTAL_USERS} participants in batches of ${BATCH_SIZE}...`);
  const clientSockets = [];
  const totalBatches = Math.ceil(TOTAL_USERS / BATCH_SIZE);
  const rampUpStartTime = Date.now();

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_USERS);
    const currentBatchCount = batchEnd - batchStart;

    const batchPromises = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const playerName = generateAlphaName(i);

      const socket = io(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 30000,
      });

      // Track active connections
      socket.on('connect', () => {
        telemetry.connectedSockets++;
      });

      socket.on('connect_error', () => {
        telemetry.connectErrors++;
      });

      socket.on('disconnect', () => {
        telemetry.connectedSockets = Math.max(0, telemetry.connectedSockets - 1);
        telemetry.disconnects++;
      });

      socket.on('reconnect', () => {
        telemetry.reconnects++;
        // Re-join room on reconnect
        socket.emit('join_room', { roomPin, name: playerName, role: 'participant' });
      });

      // Track server push events
      socket.on('room_updated', () => telemetry.totalEventsReceived++);
      socket.on('question_pushed', () => telemetry.totalEventsReceived++);
      socket.on('answering_started', () => telemetry.totalEventsReceived++);
      socket.on('participant_answered_count', () => telemetry.totalEventsReceived++);
      socket.on('answer_revealed', () => telemetry.totalEventsReceived++);

      clientSockets.push(socket);

      // Join room promise
      const joinPromise = new Promise((resolve) => {
        const doJoin = () => {
          socket.emit('join_room', { roomPin, name: playerName, role: 'participant' }, (res) => {
            if (res && res.success) {
              telemetry.roomsJoined++;
            }
            resolve();
          });
        };

        if (socket.connected) {
          doJoin();
        } else {
          socket.once('connect', doJoin);
        }

        // Fallback resolve if connection fails during rampup
        setTimeout(resolve, 8000);
      });

      batchPromises.push(joinPromise);
    }

    await Promise.all(batchPromises);

    const percent = ((clientSockets.length / TOTAL_USERS) * 100).toFixed(0);
    const active = clientSockets.filter(s => s.connected).length;
    console.log(`[Ramp-Up] Batch ${batchIndex + 1}/${totalBatches} deployed. Active sockets: ${active}/${clientSockets.length} (${percent}% target)`);

    if (batchIndex < totalBatches - 1 && BATCH_INTERVAL_MS > 0) {
      await new Promise(r => setTimeout(r, BATCH_INTERVAL_MS));
    }
  }

  const rampUpDurationSec = ((Date.now() - rampUpStartTime) / 1000).toFixed(1);
  const totalActiveAfterRamp = clientSockets.filter(s => s.connected).length;
  console.log(`\n✅ Ramp-up complete in ${rampUpDurationSec}s! Active sockets: ${totalActiveAfterRamp}/${TOTAL_USERS} | Joined: ${telemetry.roomsJoined}\n`);

  // --------------------------------------------------------------------------
  // STEP 3: ENDURANCE PHASE & TELEMETRY MONITORING
  // --------------------------------------------------------------------------
  console.log(`==============================================================================`);
  console.log(`🏁 30-MINUTE HIGH-AVAILABILITY ENDURANCE RUN ACTIVE`);
  console.log(`==============================================================================\n`);

  // Periodic Telemetry Logger (every 15 seconds)
  const telemetryInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - testStartTime) / 1000);
    const elapsedMin = (elapsedSec / 60).toFixed(1);
    const remainingMin = Math.max(0, (DURATION_SECONDS - elapsedSec) / 60).toFixed(1);
    const activeSockets = clientSockets.filter(s => s.connected).length;
    const dropRate = TOTAL_USERS > 0 ? (((TOTAL_USERS - activeSockets) / TOTAL_USERS) * 100).toFixed(1) : 0;
    const mem = process.memoryUsage();
    const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);

    const latestStampede = telemetry.stampedeResults[telemetry.stampedeResults.length - 1];
    const latestStats = latestStampede
      ? `Avg: ${latestStampede.avg.toFixed(0)}ms | P95: ${latestStampede.p95.toFixed(0)}ms`
      : 'Awaiting 1st Stampede';

    console.log(
      `📊 [${elapsedMin}m / ${(DURATION_SECONDS / 60).toFixed(0)}m] ` +
      `Active: ${activeSockets}/${TOTAL_USERS} (Drop: ${dropRate}%) | ` +
      `RSS: ${rssMB}MB (Heap: ${heapMB}MB) | ` +
      `Event Lag: ${localEventLoopLagMs.toFixed(0)}ms | ` +
      `Stampedes: ${telemetry.stampedesExecuted} | ` +
      `Last RTT [${latestStats}]`
    );
  }, 15000);

  // Application-Level Heartbeat / Idle Keep-Alive (every 20 seconds)
  const heartbeatInterval = setInterval(() => {
    // Send lightweight keep-alive ping on random subset to avoid idle drops
    const sampleSize = Math.min(50, clientSockets.length);
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor(Math.random() * clientSockets.length);
      const s = clientSockets[idx];
      if (s && s.connected) {
        telemetry.heartbeatsSent++;
        s.emit('ping', () => {
          telemetry.heartbeatsAcked++;
        });
      }
    }
  }, 20000);

  // --------------------------------------------------------------------------
  // STEP 4: THUNDERING HERD / STAMPEDE SIMULATION
  // --------------------------------------------------------------------------
  async function triggerStampede(stampedeIndex) {
    console.log(`\n💥💥💥 [STAMPEDE #${stampedeIndex}] TRIGGERING THUNDERING HERD EVENT! 💥💥💥`);
    console.log(`[Stampede #${stampedeIndex}] 1,000 clients submitting answers concurrently within ${STAMPEDE_JITTER_MS}ms window...`);

    // If host is connected, push a fresh question to initiate an active round
    if (hostSocket && hostSocket.connected) {
      await new Promise((resolve) => {
        hostSocket.emit('push_question', { roomPin, questionIndex: (stampedeIndex - 1) % 5 }, () => {
          resolve();
        });
      });
      // Allow short buffer for server to initialize question
      await new Promise(r => setTimeout(r, 1000));
    }

    const stampedeStartTime = Date.now();
    const latencies = [];
    let acks = 0;
    let errors = 0;

    const submissionPromises = clientSockets.map((socket, idx) => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          errors++;
          return resolve();
        }

        const jitter = Math.floor(Math.random() * STAMPEDE_JITTER_MS);

        setTimeout(() => {
          const submitTime = performance.now();
          const optionChosen = Math.floor(Math.random() * 4);

          // Submit answer to server
          socket.emit('submit_answer', { roomPin, optionIndex: optionChosen }, (res) => {
            const rtt = performance.now() - submitTime;
            latencies.push(rtt);
            telemetry.allStampedeLatencies.push(rtt);
            acks++;
            resolve();
          });

          // Guard against dropped acknowledgments
          setTimeout(() => {
            resolve();
          }, 15000);
        }, jitter);
      });
    });

    await Promise.all(submissionPromises);
    const stampedeDurationMs = Date.now() - stampedeStartTime;

    const minLat = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLat = latencies.length > 0 ? Math.max(...latencies) : 0;
    const avgLat = average(latencies);
    const p50Lat = percentile(latencies, 50);
    const p95Lat = percentile(latencies, 95);
    const p99Lat = percentile(latencies, 99);

    const result = {
      stampedeNumber: stampedeIndex,
      submissionsSent: clientSockets.length,
      acksReceived: acks,
      errors,
      min: minLat,
      avg: avgLat,
      p50: p50Lat,
      p95: p95Lat,
      p99: p99Lat,
      max: maxLat,
      durationMs: stampedeDurationMs,
    };

    telemetry.stampedesExecuted++;
    telemetry.stampedeResults.push(result);

    console.log(`\n📈 --- STAMPEDE #${stampedeIndex} PERFORMANCE RESULTS ---`);
    console.log(`Total Submissions Sent  : ${result.submissionsSent}`);
    console.log(`Server Acknowledgments  : ${result.acksReceived} (${((acks / clientSockets.length) * 100).toFixed(1)}% success)`);
    console.log(`Fastest Acknowledgment  : ${minLat.toFixed(1)} ms`);
    console.log(`Average Latency (RTT)   : ${avgLat.toFixed(1)} ms`);
    console.log(`P50 (Median) Latency    : ${p50Lat.toFixed(1)} ms`);
    console.log(`P95 Latency             : ${p95Lat.toFixed(1)} ms`);
    console.log(`P99 Latency             : ${p99Lat.toFixed(1)} ms`);
    console.log(`Peak Latency (Worst)    : ${maxLat.toFixed(1)} ms`);
    console.log(`Total Stampede Settle   : ${(stampedeDurationMs / 1000).toFixed(2)} s`);
    console.log(`---------------------------------------------------------\n`);

    // Reveal answer via host to wrap up question
    if (hostSocket && hostSocket.connected) {
      hostSocket.emit('reveal_answer', { roomPin });
    }
  }

  // Schedule Stampede Events every STAMPEDE_INTERVAL_SEC
  let stampedeCount = 0;
  const stampedeTimer = setInterval(() => {
    stampedeCount++;
    triggerStampede(stampedeCount).catch((err) => {
      console.error(`[Stampede #${stampedeCount}] Error:`, err);
    });
  }, STAMPEDE_INTERVAL_SEC * 1000);

  // Trigger initial calibration stampede 10 seconds after ramp-up
  setTimeout(() => {
    stampedeCount++;
    triggerStampede(stampedeCount).catch((err) => {
      console.error(`[Initial Calibration Stampede] Error:`, err);
    });
  }, 10000);

  // --------------------------------------------------------------------------
  // STEP 5: TEST TERMINATION & SUMMARY GENERATION
  // --------------------------------------------------------------------------
  async function cleanupAndReport(exitCode = 0) {
    clearInterval(telemetryInterval);
    clearInterval(heartbeatInterval);
    clearInterval(stampedeTimer);

    const totalSeconds = ((Date.now() - testStartTime) / 1000).toFixed(1);
    const activeAtEnd = clientSockets.filter(s => s.connected).length;
    const finalMem = process.memoryUsage();
    const finalDropRate = TOTAL_USERS > 0 ? (((TOTAL_USERS - activeAtEnd) / TOTAL_USERS) * 100).toFixed(1) : 0;

    console.log(`\n==============================================================================`);
    console.log(`📊 1,000-PARTICIPANT ENDURANCE TEST FINAL REPORT`);
    console.log(`==============================================================================`);
    console.log(`Target Server           : ${SERVER_URL}`);
    console.log(`Room PIN Tested         : ${roomPin}`);
    console.log(`Total Test Duration     : ${totalSeconds} seconds (${(totalSeconds / 60).toFixed(2)} minutes)`);
    console.log(`Target Concurrent Users : ${TOTAL_USERS}`);
    console.log(`Active Connected Sockets: ${activeAtEnd} / ${TOTAL_USERS} (${((activeAtEnd / TOTAL_USERS) * 100).toFixed(1)}%)`);
    console.log(`Total Disconnects/Drops : ${telemetry.disconnects} (${finalDropRate}% drop rate)`);
    console.log(`Reconnect Successes     : ${telemetry.reconnects}`);
    console.log(`Total Events Processed  : ${telemetry.totalEventsReceived}`);
    console.log(`Stampede Events Run     : ${telemetry.stampedesExecuted}`);

    if (telemetry.allStampedeLatencies.length > 0) {
      console.log(`\n🎯 STAMPEDE RTT LATENCY ACROSS ALL EVENTS:`);
      console.log(`  - Minimum RTT         : ${Math.min(...telemetry.allStampedeLatencies).toFixed(1)} ms`);
      console.log(`  - Average RTT         : ${average(telemetry.allStampedeLatencies).toFixed(1)} ms`);
      console.log(`  - Median (P50) RTT    : ${percentile(telemetry.allStampedeLatencies, 50).toFixed(1)} ms`);
      console.log(`  - 95th Percentile RTT : ${percentile(telemetry.allStampedeLatencies, 95).toFixed(1)} ms`);
      console.log(`  - 99th Percentile RTT : ${percentile(telemetry.allStampedeLatencies, 99).toFixed(1)} ms`);
      console.log(`  - Maximum Spike RTT   : ${Math.max(...telemetry.allStampedeLatencies).toFixed(1)} ms`);
    }

    console.log(`\n💾 LOCAL NODE.JS PROCESS RESOURCE USAGE:`);
    console.log(`  - Resident Set (RSS)  : ${(finalMem.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Heap Used           : ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Peak Event Loop Lag : ${localEventLoopLagMs.toFixed(1)} ms`);

    console.log(`\n🏁 RENDER FREE TIER SURVIVAL VERDICT:`);
    if (activeAtEnd >= TOTAL_USERS * 0.9 && telemetry.allStampedeLatencies.length > 0 && percentile(telemetry.allStampedeLatencies, 95) < 5000) {
      console.log(`  ✅ PASSED: Server maintained ${activeAtEnd}/${TOTAL_USERS} sockets with acceptable RTT!`);
    } else if (activeAtEnd >= TOTAL_USERS * 0.75) {
      console.log(`  ⚠️ DEGRADED: Server survived with ${activeAtEnd}/${TOTAL_USERS} sockets, but experienced connection drops under peak load.`);
    } else {
      console.log(`  ❌ CRITICAL: Server dropped below 75% socket capacity (${activeAtEnd}/${TOTAL_USERS}). 0.1 CPU was overwhelmed by stampedes.`);
    }
    console.log(`==============================================================================\n`);

    console.log(`[Teardown] Gracefully disconnecting all ${clientSockets.length} client sockets...`);
    clientSockets.forEach(s => {
      try { s.disconnect(); } catch (e) {}
    });
    if (hostSocket) {
      try { hostSocket.disconnect(); } catch (e) {}
    }

    console.log(`[Teardown] All sockets disconnected cleanly. Test finished.\n`);
    process.exit(exitCode);
  }

  // Handle Ctrl+C or SIGINT
  process.on('SIGINT', async () => {
    console.log(`\n[SIGINT] Interrupt received! Aborting and generating final report...`);
    await cleanupAndReport(0);
  });

  // End after DURATION_SECONDS
  setTimeout(async () => {
    console.log(`\n⏱️ Endurance duration of ${DURATION_SECONDS}s reached.`);
    await cleanupAndReport(0);
  }, DURATION_SECONDS * 1000);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
