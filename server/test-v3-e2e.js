const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const assert = require('assert');

const TEST_PORT = 4055;
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
  console.log('🚀 Starting Version 3 E2E Integration Test...');
  const serverProc = await startServer();

  try {
    const host = createClient('Host');
    const p1 = createClient('Participant 1');
    const p2 = createClient('Participant 2');
    const p3 = createClient('Participant 3');
    const p4 = createClient('Participant 4');

    await Promise.all([
      new Promise(r => host.on('connect', r)),
      new Promise(r => p1.on('connect', r)),
      new Promise(r => p2.on('connect', r)),
      new Promise(r => p3.on('connect', r)),
      new Promise(r => p4.on('connect', r)),
    ]);
    console.log('✅ All 5 sockets connected.');

    // 1. Host creates room
    let roomPin;
    await new Promise((resolve, reject) => {
      host.emit('create_room', { passcode: HOST_PASSCODE, questionCount: 2 }, (res) => {
        if (res.success) {
          roomPin = res.roomPin;
          resolve();
        } else {
          reject(new Error(res.message));
        }
      });
    });
    console.log(`✅ Room created with PIN: ${roomPin}`);

    // 2. Participants join
    const joinPromises = [
      { client: p1, name: 'Alice', empId: 'SE001' },
      { client: p2, name: 'Bob', empId: 'SE002' },
      { client: p3, name: 'Charlie', empId: 'SE003' },
      { client: p4, name: 'Diana', empId: 'SE004' },
    ].map(({ client, name, empId }) => new Promise((resolve, reject) => {
      client.emit('join_room', { roomPin, name, empId }, (res) => {
        if (res.success) resolve(res);
        else reject(new Error(res.message));
      });
    }));

    await Promise.all(joinPromises);
    console.log('✅ All 4 participants joined room successfully.');

    // 3. Host pushes question 1
    const p1QuestionPromise = new Promise(r => p1.once('question_pushed', r));
    await new Promise((resolve) => {
      host.emit('push_question', { roomPin, questionIndex: 0 }, (res) => {
        assert(res.success, 'Push question must succeed');
        resolve();
      });
    });
    const questionData = await p1QuestionPromise;
    console.log(`✅ Question 1 pushed: "${questionData.question.substring(0, 40)}..."`);
    assert.strictEqual(questionData.questionIndex, 0, 'Question index is 0');

    // 4. Wait for 10s reading phase to complete and answering window to open
    console.log('⏳ Waiting for answering window to open (10s reading phase)...');
    const answeringPhasePromise = new Promise(r => p1.once('answering_started', r));
    const answeringData = await answeringPhasePromise;
    console.log('✅ Answering window opened (30s answering countdown active).');

    // 5. Participants submit answers
    // Question 1 correct answer is index 2
    const correctIdx = 2;
    const wrongIdx = 0;

    await new Promise(r => p1.emit('submit_answer', { roomPin, optionIndex: correctIdx }, r));
    console.log('✅ Alice answered correctly (option 2)');

    await new Promise(r => setTimeout(r, 100)); // slight gap
    await new Promise(r => p2.emit('submit_answer', { roomPin, optionIndex: correctIdx }, r));
    console.log('✅ Bob answered correctly (option 2)');

    await new Promise(r => setTimeout(r, 100));
    await new Promise(r => p3.emit('submit_answer', { roomPin, optionIndex: correctIdx }, r));
    console.log('✅ Charlie answered correctly (option 2)');

    await new Promise(r => setTimeout(r, 100));
    await new Promise(r => p4.emit('submit_answer', { roomPin, optionIndex: wrongIdx }, r));
    console.log('✅ Diana answered incorrectly (option 0)');

    // 6. Test HOLD state: Answer must NOT be revealed yet!
    let revealedEarly = false;
    const revealListener = () => { revealedEarly = true; };
    p1.on('answer_revealed', revealListener);

    // Short wait to ensure no early reveal
    await new Promise(r => setTimeout(r, 1200));
    assert.strictEqual(revealedEarly, false, 'Answer must NOT be revealed immediately after submissions!');
    console.log('✅ Evaluation HOLD verified: answer has NOT been revealed.');

    // 7. Host triggers reveal_answer
    console.log('📢 Host clicks "Show Answer to All"...');
    const p1RevealPromise = new Promise(r => p1.once('answer_revealed', r));
    const p1ResultPromise = new Promise(r => p1.once('round_result', r));

    await new Promise((resolve) => {
      host.emit('reveal_answer', { roomPin }, (res) => {
        assert(res.success, 'Host reveal_answer must succeed');
        resolve();
      });
    });

    const revealData = await p1RevealPromise;
    const resultData = await p1ResultPromise;
    assert.strictEqual(revealData.correctAnswerIndex, correctIdx, 'Revealed correct index matches');
    assert.strictEqual(resultData.isCorrect, true, 'Alice got correct result');
    assert.strictEqual(resultData.pointsDelta, 100, 'Alice got +100 points delta');
    console.log('✅ Host reveal successful: answer and round_results broadcasted to all.');

    p1.off('answer_revealed', revealListener);

    // 8. End Quiz and Publish Results
    await new Promise((resolve) => {
      host.emit('end_quiz', { roomPin }, (res) => {
        assert(res.success, 'End quiz must succeed');
        resolve();
      });
    });

    const p1FinalPromise = new Promise(r => p1.once('quiz_results_published', r));
    await new Promise((resolve) => {
      host.emit('publish_quiz_results', { roomPin }, (res) => {
        assert(res.success, 'Publish quiz results must succeed');
        resolve();
      });
    });

    const finalResults = await p1FinalPromise;
    console.log('✅ Final results received on participant side.');

    // Verify Requirement 1: Only Top 3 winners, NO Tie-Breaker or Best Learner spotlight awards!
    assert.strictEqual(finalResults.tieBreakerWinner, null, 'tieBreakerWinner must be null');
    assert.strictEqual(finalResults.bestLearnerWinner, null, 'bestLearnerWinner must be null');
    assert(Array.isArray(finalResults.top3), 'top3 must be an array');
    assert.strictEqual(finalResults.top3.length, 3, 'top3 must contain exactly 3 winners');

    // Rank 1: Alice (100 pts)
    // Rank 2: Bob (100 pts)
    // Rank 3: Charlie (100 pts)
    // Rank 4: Diana (-50 pts)
    assert.strictEqual(finalResults.top3[0].name, 'ALICE', 'Rank 1 is Alice');
    assert.strictEqual(finalResults.top3[1].name, 'BOB', 'Rank 2 is Bob');
    assert.strictEqual(finalResults.top3[2].name, 'CHARLIE', 'Rank 3 is Charlie');
    assert.strictEqual(finalResults.grandChampion.name, 'ALICE', 'Grand Champion is Alice');

    console.log('🏆 Verified Winners:');
    console.log(`   1st Place: ${finalResults.top3[0].name} (Score: ${finalResults.top3[0].score}, Time: ${finalResults.top3[0].totalTimeMs}ms)`);
    console.log(`   2nd Place: ${finalResults.top3[1].name} (Score: ${finalResults.top3[1].score}, Time: ${finalResults.top3[1].totalTimeMs}ms)`);
    console.log(`   3rd Place: ${finalResults.top3[2].name} (Score: ${finalResults.top3[2].score}, Time: ${finalResults.top3[2].totalTimeMs}ms)`);
    console.log(`   Leaderboard 4th (non-winner): ${finalResults.leaderboard[3].name} (Score: ${finalResults.leaderboard[3].score})`);
    console.log('✅ Spotlights check: tieBreakerWinner=null, bestLearnerWinner=null verified!');

    host.disconnect();
    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
    p4.disconnect();

    console.log('\n🎉 ALL VERSION 3 E2E TESTS PASSED SUCCESSFULLY!');
  } finally {
    serverProc.kill();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
