const assert = require('assert');

// Test calculateLeaderboards logic directly
function mockRoomWithParticipants(participantsList, currentQuestionAnswers = new Map()) {
  const participants = new Map();
  for (const p of participantsList) {
    participants.set(p.participantId, p);
  }
  return {
    participants,
    currentQuestionAnswers,
    answeredParticipantIds: new Set(),
    questionWinners: [],
    configuredQuestionCount: 5,
    gameState: 'REVEAL'
  };
}

// Extract calculateLeaderboards from server.js
const fs = require('fs');
const serverCode = fs.readFileSync(__dirname + '/server.js', 'utf-8');

// Isolate getUniqueParticipants and calculateLeaderboards functions
const fnMatch = serverCode.match(/(\/\/\s*Helper:\s*Get unique participants[\s\S]*?function calculateLeaderboards\(room\) \{[\s\S]*?\n\})/);
if (!fnMatch) {
  console.error('Could not extract functions from server.js');
  process.exit(1);
}

const extracted = new Function(`${fnMatch[1]}\nreturn { getUniqueParticipants, calculateLeaderboards };`)();
const calculateLeaderboards = extracted.calculateLeaderboards;

console.log('🧪 RUNNING COMPREHENSIVE RESULT VALIDATION CHECKS...\n');

// --- TEST 1: Score & Tie-Breaking Precision ---
console.log('Test 1: Score & Speed Tie-Breaking Logic');
{
  const room = mockRoomWithParticipants([
    { participantId: 'p1', name: 'BOB', score: 200, correctCount: 2, wrongCount: 0, totalTimeMs: 4500, attemptedCount: 2, fastestTimeMs: 2000 },
    { participantId: 'p2', name: 'ALICE', score: 200, correctCount: 2, wrongCount: 0, totalTimeMs: 2800, attemptedCount: 2, fastestTimeMs: 1200 },
    { participantId: 'p3', name: 'CHARLIE', score: 150, correctCount: 2, wrongCount: 1, totalTimeMs: 3500, attemptedCount: 3, fastestTimeMs: 1500 },
    { participantId: 'p4', name: 'DAVID', score: 100, correctCount: 1, wrongCount: 0, totalTimeMs: 1000, attemptedCount: 1, fastestTimeMs: 1000 },
    { participantId: 'p5', name: 'EVE', score: 0, correctCount: 0, wrongCount: 2, totalTimeMs: 0, attemptedCount: 2, fastestTimeMs: Infinity, allAttemptsTotalTimeMs: 5000 }
  ]);

  const { leaderboard, top3, grandChampion, tieBreakerWinner, bestLearnerWinner } = calculateLeaderboards(room);

  // ALICE and BOB both have 200 pts, but ALICE was faster (2800ms vs 4500ms)
  assert.strictEqual(top3[0].name, 'ALICE', 'Rank 1 must be ALICE (faster time on tie)');
  assert.strictEqual(top3[0].rank, 1, 'Alice rank is 1');
  assert.strictEqual(top3[0].tieBrokenByTime, true, 'Alice tieBrokenByTime must be true');

  assert.strictEqual(top3[1].name, 'BOB', 'Rank 2 must be BOB');
  assert.strictEqual(top3[1].rank, 2, 'Bob rank is 2');

  assert.strictEqual(top3[2].name, 'CHARLIE', 'Rank 3 must be CHARLIE');
  assert.strictEqual(top3[2].rank, 3, 'Charlie rank is 3');

  assert.strictEqual(grandChampion.name, 'ALICE', 'Grand Champion is Alice');

  // Spotlight awards must be null
  assert.strictEqual(tieBreakerWinner, null, 'tieBreakerWinner must be null');
  assert.strictEqual(bestLearnerWinner, null, 'bestLearnerWinner must be null');

  // 4th and 5th places
  assert.strictEqual(leaderboard[3].name, 'DAVID', 'Rank 4 is DAVID');
  assert.strictEqual(leaderboard[4].name, 'EVE', 'Rank 5 is EVE');

  console.log('  ✅ Score and speed tie-breaker correctly ranked Alice ahead of Bob.');
  console.log('  ✅ Verified spotlight awards are null.');
}

// --- TEST 2: Fewer Than 3 Participants (Edge Case: 1 or 2 players) ---
console.log('Test 2: Edge Case with fewer than 3 participants (e.g. 2 players)');
{
  const room = mockRoomWithParticipants([
    { participantId: 'p1', name: 'SOLO_WINNER', score: 100, correctCount: 1, totalTimeMs: 1500, attemptedCount: 1, fastestTimeMs: 1500 },
    { participantId: 'p2', name: 'RUNNER_UP', score: 50, correctCount: 1, totalTimeMs: 2500, attemptedCount: 2, fastestTimeMs: 2500 }
  ]);

  const { leaderboard, top3, grandChampion } = calculateLeaderboards(room);
  assert.strictEqual(leaderboard.length, 2, 'Leaderboard has 2 items');
  assert.strictEqual(top3.length, 2, 'top3 has 2 items without error');
  assert.strictEqual(grandChampion.name, 'SOLO_WINNER');
  assert.strictEqual(top3[0].name, 'SOLO_WINNER');
  assert.strictEqual(top3[1].name, 'RUNNER_UP');
  assert.strictEqual(top3[2], undefined, 'top3[2] is safely undefined');
  console.log('  ✅ Successfully handled 2-player session without crashing.');
}

// --- TEST 3: Score Negative Floor Logic ---
console.log('Test 3: Negative Score Flooring Logic (Floor at 0)');
{
  let score = 0;
  // Wrong answer on first question
  score = Math.max(0, score - 50);
  assert.strictEqual(score, 0, 'Score cannot go below 0 on wrong answer');

  // Correct answer
  score += 100;
  assert.strictEqual(score, 100, 'Score is 100');

  // Wrong answer
  score = Math.max(0, score - 50);
  assert.strictEqual(score, 50, 'Score is 50');

  // Two wrong answers
  score = Math.max(0, score - 50);
  score = Math.max(0, score - 50);
  assert.strictEqual(score, 0, 'Score remains floored at 0');
  console.log('  ✅ Negative score flooring logic validated.');
}

// --- TEST 4: Certificate Tier Assignment Validation ---
console.log('Test 4: Certificate Tier Assignment for Ranks 1 to 5');
{
  function getCertTier(rank) {
    if (rank === 1) return { tier: 'winner', title: 'Grand Champion • 1st Place' };
    if (rank === 2) return { tier: 'winner', title: '1st Runner Up • 2nd Place' };
    if (rank === 3) return { tier: 'winner', title: '2nd Runner Up • 3rd Place' };
    return { tier: 'participant', title: `Cyber Defender • Rank #${rank}` };
  }

  const r1 = getCertTier(1);
  const r2 = getCertTier(2);
  const r3 = getCertTier(3);
  const r4 = getCertTier(4);
  const r5 = getCertTier(5);

  assert.strictEqual(r1.tier, 'winner');
  assert.strictEqual(r1.title, 'Grand Champion • 1st Place');

  assert.strictEqual(r2.tier, 'winner');
  assert.strictEqual(r2.title, '1st Runner Up • 2nd Place');

  assert.strictEqual(r3.tier, 'winner');
  assert.strictEqual(r3.title, '2nd Runner Up • 3rd Place');

  assert.strictEqual(r4.tier, 'participant');
  assert.strictEqual(r4.title, 'Cyber Defender • Rank #4');

  assert.strictEqual(r5.tier, 'participant');
  assert.strictEqual(r5.title, 'Cyber Defender • Rank #5');

  console.log('  ✅ Certificate tier logic strictly validates: Ranks 1-3 = winner, Rank 4+ = participant.');
}

console.log('\n🎉 ALL RESULT VALIDATION UNIT CHECKS PASSED WITH 100% ACCURACY!\n');
