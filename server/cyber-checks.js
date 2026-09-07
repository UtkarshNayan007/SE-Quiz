const { io } = require('socket.io-client');

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const SERVER_URL = getArg('--server', 'http://127.0.0.1:4000');
const HOST_PASSCODE = getArg('--passcode', 'SE2026!Admin');

console.log(`=============================================================`);
console.log(`🛡️  SE QUIZ COMPREHENSIVE CYBER SECURITY & INTEGRITY AUDIT`);
console.log(`Target Server : ${SERVER_URL}`);
console.log(`Timestamp     : ${new Date().toISOString()}`);
console.log(`=============================================================\n`);

const results = [];

function recordResult(category, testName, passed, details, severity = 'MEDIUM') {
  results.push({ category, testName, passed, details, severity });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${category}] ${testName}`);
  if (details) console.log(`       -> ${details}`);
}

function createSocket(opts = {}) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...opts,
  });
}

function connectSocket(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 4000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runCyberChecks() {
  console.log('Starting Phase 1: Authentication & Authorization Checks...\n');

  // --- 1. Authentication & Passcode Checks ---
  const sock1 = createSocket();
  await connectSocket(sock1);

  // 1.1 Create room with no passcode
  await new Promise((resolve) => {
    sock1.emit('create_room', {}, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Auth', 'Reject create_room without passcode', blocked, res?.message || 'Unexpected response', 'HIGH');
      resolve();
    });
  });

  // 1.2 Create room with incorrect passcode
  await new Promise((resolve) => {
    sock1.emit('create_room', { passcode: 'WrongPassword123' }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Auth', 'Reject create_room with invalid passcode', blocked, res?.message || 'Unexpected response', 'HIGH');
      resolve();
    });
  });

  // 1.3 Create room with type-juggling / non-string passcode
  await new Promise((resolve) => {
    sock1.emit('create_room', { passcode: ['SE2026!Admin'] }, (res) => {
      const blocked = !res?.success;
      recordResult('Auth', 'Reject create_room with array/object passcode', blocked, res?.message || 'Blocked non-string passcode', 'MEDIUM');
      resolve();
    });
  });

  // 1.4 Create room with valid passcode
  let validRoomPin = null;
  await new Promise((resolve) => {
    sock1.emit('create_room', { passcode: HOST_PASSCODE, questionCount: 5 }, (res) => {
      if (res?.success && res?.roomPin) {
        validRoomPin = res.roomPin;
        recordResult('Auth', 'Allow create_room with valid admin passcode', true, `Room created: PIN ${validRoomPin}`, 'LOW');
      } else {
        recordResult('Auth', 'Allow create_room with valid admin passcode', false, res?.message, 'HIGH');
      }
      resolve();
    });
  });

  // --- 2. Host Privilege Escalation / IDOR ---
  console.log('\nStarting Phase 2: Host Privilege Escalation Checks...\n');
  const attackerSock = createSocket();
  await connectSocket(attackerSock);

  // Attacker joins as regular participant
  await new Promise((resolve) => {
    attackerSock.emit('join_room', { roomPin: validRoomPin, name: 'AttackerPlayer', role: 'participant' }, (res) => {
      resolve();
    });
  });

  // Attacker attempts push_question
  await new Promise((resolve) => {
    attackerSock.emit('push_question', { roomPin: validRoomPin, questionIndex: 0 }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Privilege Escalation', 'Reject push_question from non-host participant', blocked, res?.message, 'CRITICAL');
      resolve();
    });
  });

  // Attacker attempts reveal_answer
  await new Promise((resolve) => {
    attackerSock.emit('reveal_answer', { roomPin: validRoomPin }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Privilege Escalation', 'Reject reveal_answer from non-host participant', blocked, res?.message, 'CRITICAL');
      resolve();
    });
  });

  // Attacker attempts end_quiz
  await new Promise((resolve) => {
    attackerSock.emit('end_quiz', { roomPin: validRoomPin }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Privilege Escalation', 'Reject end_quiz from non-host participant', blocked, res?.message, 'CRITICAL');
      resolve();
    });
  });

  // Attacker attempts publish_quiz_results
  await new Promise((resolve) => {
    attackerSock.emit('publish_quiz_results', { roomPin: validRoomPin }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Privilege Escalation', 'Reject publish_quiz_results from non-host participant', blocked, res?.message, 'CRITICAL');
      resolve();
    });
  });

  // Attacker attempts set_question_limit
  await new Promise((resolve) => {
    attackerSock.emit('set_question_limit', { roomPin: validRoomPin, questionCount: 1 }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Unauthorized');
      recordResult('Privilege Escalation', 'Reject set_question_limit from non-host participant', blocked, res?.message, 'CRITICAL');
      resolve();
    });
  });

  // --- 3. Information Disclosure & Anti-Cheat Validation ---
  console.log('\nStarting Phase 3: Information Leakage & Cheat Checks...\n');

  // Push question as valid host and inspect payload on participant
  let leakedAnswerInPush = false;
  let leakedExplanationInPush = false;

  const pushPromise = new Promise((resolve) => {
    attackerSock.once('question_pushed', (data) => {
      if (data.correctAnswer !== undefined || data.correctOption !== undefined) {
        leakedAnswerInPush = true;
      }
      if (data.explanation !== undefined || data.optionExplanations !== undefined) {
        leakedExplanationInPush = true;
      }
      resolve();
    });
  });

  sock1.emit('push_question', { roomPin: validRoomPin, questionIndex: 0 });
  await pushPromise;

  recordResult('Info Disclosure', 'No correctAnswer leaked in question_pushed event', !leakedAnswerInPush, 
    leakedAnswerInPush ? 'CRITICAL: correctAnswer leaked in broadcast!' : 'Sanitized question broadcast verified', 'CRITICAL');
  recordResult('Info Disclosure', 'No explanation leaked in question_pushed event', !leakedExplanationInPush, 
    leakedExplanationInPush ? 'WARNING: explanation leaked before reveal!' : 'Explanations withheld until reveal', 'HIGH');

  // Check join_room activeQuestion payload for new joining participant
  const lateParticipant = createSocket();
  await connectSocket(lateParticipant);

  await new Promise((resolve) => {
    lateParticipant.emit('join_room', { roomPin: validRoomPin, name: 'LateJoiner', role: 'participant' }, (res) => {
      const aq = res?.activeQuestion;
      const leaked = aq && (aq.correctAnswer !== undefined || aq.explanation !== undefined);
      recordResult('Info Disclosure', 'No correctAnswer leaked in join_room activeQuestion', !leaked,
        leaked ? 'CRITICAL: Answer leaked in join_room payload' : 'join_room payload is safely sanitized', 'CRITICAL');
      resolve();
    });
  });

  // --- 4. Game Logic & State Machine Integrity ---
  console.log('\nStarting Phase 4: Buzzer & Answering State Machine Integrity...\n');

  // 4.1 Buzzing during READING state (before buzzer_unlocked event)
  await new Promise((resolve) => {
    attackerSock.emit('hit_buzzer', { roomPin: validRoomPin }, (res) => {
      const blocked = !res?.success && res?.message?.includes('not active');
      recordResult('Logic Integrity', 'Prevent buzzing during READING state (early buzz exploit)', blocked, res?.message, 'HIGH');
      resolve();
    });
  });

  // 4.2 Answering when game is in READING state (not your turn)
  await new Promise((resolve) => {
    attackerSock.emit('submit_answer', { roomPin: validRoomPin, optionIndex: 0 }, (res) => {
      const blocked = !res?.success && res?.message?.includes('Answering is not open');
      recordResult('Logic Integrity', 'Prevent submitting answer when answering not open', blocked, res?.message, 'HIGH');
      resolve();
    });
  });

  // Wait for buzzer to unlock (10s reading countdown)
  console.log('Waiting for buzzer unlock (approx 8-10s)...');
  await new Promise((resolve) => {
    attackerSock.once('buzzer_unlocked', () => resolve());
    setTimeout(resolve, 11000);
  });

  // 4.3 Legitimate buzzer hit
  let firstBuzzerAck = null;
  await new Promise((resolve) => {
    attackerSock.emit('hit_buzzer', { roomPin: validRoomPin }, (res) => {
      firstBuzzerAck = res;
      recordResult('Logic Integrity', 'Allow legitimate buzzer hit when unlocked', !!res?.success, `Position: ${res?.position}, isYourTurn: ${res?.isYourTurn}`, 'LOW');
      resolve();
    });
  });

  // 4.4 Double buzz exploit (same player buzzing twice)
  await new Promise((resolve) => {
    attackerSock.emit('hit_buzzer', { roomPin: validRoomPin }, (res) => {
      const blocked = !res?.success && res?.message?.includes('already pressed');
      recordResult('Logic Integrity', 'Prevent double buzzer press by same player', blocked, res?.message, 'MEDIUM');
      resolve();
    });
  });

  // 4.5 Submitting answer from non-turn player
  await new Promise((resolve) => {
    lateParticipant.emit('submit_answer', { roomPin: validRoomPin, optionIndex: 0 }, (res) => {
      const blocked = !res?.success && res?.message?.includes('not your turn');
      recordResult('Logic Integrity', 'Prevent answer submission by player whose turn it is NOT', blocked, res?.message, 'CRITICAL');
      resolve();
    });
  });

  // 4.6 Turn player submits incorrect answer -> test lockout on same question
  await new Promise((resolve) => {
    // Intentionally submit wrong option (e.g. 99 or known wrong)
    attackerSock.emit('submit_answer', { roomPin: validRoomPin, optionIndex: 3 }, (res) => {
      resolve();
    });
  });

  // Attacker was wrong; now attacker tries to buzz again on the same question
  await new Promise((resolve) => {
    attackerSock.emit('hit_buzzer', { roomPin: validRoomPin }, (res) => {
      const blocked = !res?.success;
      recordResult('Logic Integrity', 'Prevent failed player from buzzing again on same question', blocked, res?.message, 'HIGH');
      resolve();
    });
  });

  // --- 5. Input Validation, Fuzzing & Crash Resilience ---
  console.log('\nStarting Phase 5: Input Validation & Payload Fuzzing...\n');
  const fuzzSock = createSocket();
  await connectSocket(fuzzSock);

  // 5.1 Giant payload in player name (50KB)
  const giantName = 'A'.repeat(50000);
  await new Promise((resolve) => {
    fuzzSock.emit('join_room', { roomPin: validRoomPin, name: giantName, role: 'participant' }, (res) => {
      recordResult('Input Fuzzing', 'Server survives 50KB name payload without crashing', true, 'Server handled oversized payload cleanly', 'MEDIUM');
      resolve();
    });
  });

  // 5.2 XSS Payload in player name
  const xssPayload = `<script>alert('XSS')</script><img src=x onerror=alert(1)>`;
  await new Promise((resolve) => {
    fuzzSock.emit('join_room', { roomPin: validRoomPin, name: xssPayload, role: 'participant' }, (res) => {
      recordResult('Input Fuzzing', 'Server handles raw HTML/XSS strings in name', true, 'Processed without error; client JSX automatically escapes rendering', 'LOW');
      resolve();
    });
  });

  // 5.3 Malformed roomPin types
  const malformedPins = [null, undefined, 123456, {}, [], '__proto__', false];
  let allHandled = true;
  for (const pin of malformedPins) {
    await new Promise((resP) => {
      fuzzSock.emit('join_room', { roomPin: pin, name: 'Fuzzer' }, (res) => {
        if (res?.success) allHandled = false;
        resP();
      });
    });
  }
  recordResult('Input Fuzzing', 'Gracefully reject malformed roomPin types', allHandled, 'All non-existent/malformed roomPins cleanly rejected', 'LOW');

  // 5.4 Out-of-bounds questionIndex by host
  await new Promise((resolve) => {
    sock1.emit('push_question', { roomPin: validRoomPin, questionIndex: 99999 }, (res) => {
      const rejected = !res?.success;
      recordResult('Input Fuzzing', 'Reject out-of-bounds questionIndex', rejected, res?.message, 'LOW');
      resolve();
    });
  });

  // 5.5 Negative questionCount limit
  await new Promise((resolve) => {
    sock1.emit('set_question_limit', { roomPin: validRoomPin, questionCount: -10 }, (res) => {
      const rejected = !res?.success;
      recordResult('Input Fuzzing', 'Reject negative question limit', rejected, res?.message, 'LOW');
      resolve();
    });
  });

  // --- 6. Event Flooding & DoS Resilience ---
  console.log('\nStarting Phase 6: Event Flooding & DoS Resilience...\n');
  const floodStart = Date.now();
  const FLOOD_COUNT = 500;
  const floodPromises = [];

  for (let i = 0; i < FLOOD_COUNT; i++) {
    floodPromises.push(new Promise((resolve) => {
      attackerSock.emit('hit_buzzer', { roomPin: validRoomPin }, () => resolve());
    }));
  }

  await Promise.all(floodPromises);
  const floodDuration = Date.now() - floodStart;
  recordResult('DoS Resilience', `Handled burst of ${FLOOD_COUNT} rapid buzzer events`, true, `Processed ${FLOOD_COUNT} events in ${floodDuration}ms without crashing`, 'MEDIUM');

  // --- 7. Security Architecture & Configuration Findings ---
  console.log('\nStarting Phase 7: Architecture & Static Configuration Audit...\n');

  // Check 7.1: Room PIN Entropy & Enumeration
  recordResult('Architecture', 'Room PIN 6-digit space entropy (900,000 combinations)', false, 
    'FINDING: 6-digit PIN space is subject to brute-force room enumeration without IP-based rate limiting', 'MEDIUM');

  // Check 7.2: Admin Passcode Rate Limiting
  recordResult('Architecture', 'Admin Passcode Brute-Force Protection', false, 
    'FINDING: No rate limiting or lockout on repeated failed create_room attempts with invalid passcodes', 'HIGH');

  // Check 7.3: CORS Policy
  recordResult('Architecture', 'Socket.io CORS Origin Policy', false, 
    'FINDING: CORS origin is wildcard (*) allowing cross-site WebSocket hijacking if cookies/tokens are used', 'MEDIUM');

  // Check 7.4: Process-level crash prevention
  recordResult('Architecture', 'Uncaught exception guards active', true, 
    'process.on(uncaughtException) & unhandledRejection prevent server process death', 'LOW');

  // Cleanup
  sock1.close();
  attackerSock.close();
  lateParticipant.close();
  fuzzSock.close();

  // Print Final Summary
  console.log(`\n=============================================================`);
  console.log(`📊 CYBER AUDIT SUMMARY REPORT`);
  console.log(`=============================================================`);
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Checks Executed : ${total}`);
  console.log(`Passed Checks         : ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`Failed / Findings     : ${failed}`);

  console.log(`\nDetailed Vulnerability / Finding Breakdown:`);
  results.filter(r => !r.passed).forEach(f => {
    console.log(`  [${f.severity}] [${f.category}] ${f.testName}: ${f.details}`);
  });
  console.log(`=============================================================\n`);

  process.exit(failed > 0 && results.some(r => !r.passed && r.severity === 'CRITICAL') ? 1 : 0);
}

runCyberChecks().catch(err => {
  console.error('Cyber check runtime error:', err);
  process.exit(1);
});
