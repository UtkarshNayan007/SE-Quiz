/**
 * End-to-End Test for OT MSSP AI Quiz Generation & KT Ingestion Engine
 */

const http = require('http');

const PORT = 4001;
process.env.PORT = String(PORT);

// Start server
const app = require('./server'); // If server exports app or runs
// Since server.js might start listening automatically, let's test running server.js in background or via child process
console.log('Testing AI Quiz Engine with various imperfect KT inputs...');

const { processKTAndGenerateQuiz, normalizeAndEnrichQuestion } = require('./ai-quiz-engine');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  console.log('\n--- Test 1: Ingestion of Imperfect/Incomplete KT Material ---');
  const imperfectInput = `
  KT Session: Week 44 - OT Incident Response & SCADA Perimeter Security
  Speaker: Utkarsh
  
  Notes:
  - We discussed Purdue Level 1 vs Level 3 isolation.
  - Modbus port is 502, it has no native encryption so attackers can inject fake coils.
  - Remember Windows + L screen lock rule for clean desk policy.
  - Ransomware encrypted the plant historian last month because someone plugged in a rogue USB drive.
  `;

  const result = await processKTAndGenerateQuiz({
    text: imperfectInput,
    topic: 'OT Incident Response & SCADA Perimeter',
    questionCount: 4
  });

  assert(result && Array.isArray(result.questions), 'Result returns questions array');
  assert(result.questions.length === 4, `Generated exactly 4 questions (got ${result.questions.length})`);

  result.questions.forEach((q, i) => {
    assert(q.options && q.options.length === 4, `Question ${i + 1} has exactly 4 options`);
    assert(q.correctAnswer >= 0 && q.correctAnswer <= 3, `Question ${i + 1} has valid correctAnswer index (0-3)`);
    assert(q.explanation && q.explanation.length > 10, `Question ${i + 1} has complete explanation`);
    assert(q.visualData && typeof q.visualData === 'object', `Question ${i + 1} has visualData`);
    assert(q.revealVisual && q.revealVisual.vulnerabilitySummary, `Question ${i + 1} has revealVisual summary`);
  });

  console.log('\n--- Test 2: Incomplete Raw Question Auto-Completion ---');
  // Raw question with missing options, missing explanation, missing category
  const rawBrokenQuestion = {
    question: "What protocol does SCADA use on port 502?",
    options: ["Modbus TCP"] // Only 1 option provided!
  };

  const enriched = normalizeAndEnrichQuestion(rawBrokenQuestion, 1);
  assert(enriched.options.length === 4, 'Auto-synthesized missing distractors to make 4 options');
  assert(enriched.options.includes('Modbus TCP'), 'Retained original correct answer');
  assert(enriched.correctAnswer === 0, 'Correct answer index is valid');
  assert(enriched.explanation.length > 15, 'Auto-synthesized comprehensive explanation');
  assert(enriched.category.length > 0, 'Auto-assigned valid category');
  assert(enriched.visualData.type, 'Auto-created visualData structure');

  console.log(`\nAll tests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
