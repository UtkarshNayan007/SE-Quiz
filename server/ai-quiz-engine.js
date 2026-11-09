/**
 * AI Quiz Ingestion & Structuring Engine for OT MSSP Platform
 * 
 * Supports:
 * - PDF parsing via pdf-parse
 * - Text / MOM / Summary / Markdown ingestion
 * - Gemini 2.5 Flash / 1.5 Flash automated structuring
 * - Intelligent missing-data synthesis (options, explanations, hints, visual data)
 * - Deterministic fallback & normalization
 */

const pdfParseModule = require('pdf-parse');

/**
 * Extracts plain text from an uploaded buffer (PDF or Text/Markdown)
 */
async function extractTextFromBuffer(buffer, mimeType = '', filename = '') {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file or buffer provided');
  }

  const isPdf = mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    try {
      // 1. pdf-parse v2 API (PDFParse class)
      if (pdfParseModule && pdfParseModule.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const res = await parser.getText();
        if (res && res.text) {
          return res.text;
        }
      }

      // 2. pdf-parse v1 API (direct function export)
      if (typeof pdfParseModule === 'function') {
        const data = await pdfParseModule(buffer);
        if (data && data.text) {
          return data.text;
        }
      }

      // 3. ESM default export fallback
      if (pdfParseModule && typeof pdfParseModule.default === 'function') {
        const data = await pdfParseModule.default(buffer);
        if (data && data.text) {
          return data.text;
        }
      }
    } catch (err) {
      console.warn('Primary PDF parser encountered issue, trying fallback text extractor:', err.message);
    }

    // 4. Resilient stream-level text extractor fallback (extracts literal ASCII/UTF8 strings from PDF streams)
    try {
      const raw = buffer.toString('latin1');
      const textChunks = [];
      const textMatches = raw.match(/\(([^()]+)\)\s*Tj/g) || [];
      for (const m of textMatches) {
        const clean = m.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
        if (clean.length > 1) textChunks.push(clean);
      }
      if (textChunks.length > 5) {
        return textChunks.join(' ');
      }
    } catch (fallbackErr) {
      console.error('Fallback PDF extractor failed:', fallbackErr);
    }

    throw new Error('Failed to extract text from PDF: unable to parse text content.');
  }

  // Treat as UTF-8 text (txt, md, json, etc.)
  return buffer.toString('utf-8');
}

/**
 * Clean redundant option prefixes (e.g., "A) ", "B. ", "1: ")
 */
function cleanOptionText(text) {
  if (typeof text !== 'string') return String(text || '');
  return text.replace(/^[A-Da-d0-9][\)\.\:\-]\s*/, '').trim();
}

/**
 * Normalizes and guarantees every question adheres to the client visualData schema.
 * Synthesizes any missing properties automatically.
 */
function normalizeAndEnrichQuestion(q, index = 1) {
  const id = q.id || index;
  let type = (q.type || '').toLowerCase();
  if (!['riddle', 'fill_in_the_blank', 'crossword', 'theory', 'image'].includes(type)) {
    if (q.category && q.category.toLowerCase().includes('riddle')) type = 'riddle';
    else if (q.category && (q.category.toLowerCase().includes('blank') || q.category.toLowerCase().includes('fill'))) type = 'fill_in_the_blank';
    else if (q.category && q.category.toLowerCase().includes('crossword')) type = 'crossword';
    else type = 'theory';
  }

  // Normalize Category
  let category = q.category || '';
  if (!category) {
    if (type === 'riddle') category = 'Cyber Riddle';
    else if (type === 'fill_in_the_blank') category = 'Fill in the Blank';
    else if (type === 'crossword') category = 'Cyber Crossword';
    else if (type === 'image') category = 'Image Scenario';
    else category = 'Multiple Choice Question';
  }

  let questionText = (q.question || '').trim();
  if (!questionText) {
    questionText = `Question ${id} on OT Security`;
  }

  // Ensure 4 options
  let options = Array.isArray(q.options) ? q.options.map(cleanOptionText).filter(Boolean) : [];
  if (options.length < 4) {
    const defaultDistractors = [
      'Unrestricted Port 502 Access',
      'Air-gapped Purdue Level 3 Historian',
      'IEC 62443 Security Level 3 Requirement',
      'Encrypted Modbus TCP Payload'
    ];
    while (options.length < 4) {
      const fallback = defaultDistractors[options.length] || `Security Control ${options.length + 1}`;
      if (!options.includes(fallback)) options.push(fallback);
      else options.push(`${fallback} (${options.length + 1})`);
    }
  }
  options = options.slice(0, 4);

  let correctAnswer = parseInt(q.correctAnswer, 10);
  if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    correctAnswer = 0;
  }

  const correctOptionText = options[correctAnswer] || options[0];

  let explanation = (q.explanation || '').trim();
  if (!explanation) {
    explanation = `${correctOptionText} is the correct standard according to OT MSSP and industrial security best practices.`;
  }

  // Build / synthesize visualData based on type
  let visualData = q.visualData || {};
  if (!visualData.type) {
    visualData.type = type;
  }

  if (type === 'riddle') {
    visualData.type = 'riddle';
    if (!visualData.riddleData) visualData.riddleData = {};
    visualData.riddleData.title = visualData.riddleData.title || 'SECURITY ENIGMA';
    visualData.riddleData.riddleText = visualData.riddleData.riddleText || questionText;
    visualData.riddleData.hintCategory = visualData.riddleData.hintCategory || 'OT / MSSP Operations';
    visualData.riddleData.hint = visualData.riddleData.hint || `Pertains to ${correctOptionText}`;
    visualData.riddleData.enigmaTag = visualData.riddleData.enigmaTag || 'CYBER ENIGMA';
    visualData.riddleData.decodedTitle = visualData.riddleData.decodedTitle || correctOptionText.toUpperCase();
    visualData.riddleData.iconType = visualData.riddleData.iconType || 'lock';
  } else if (type === 'fill_in_the_blank') {
    visualData.type = 'fill_in_the_blank';
    if (!visualData.fillBlankData) visualData.fillBlankData = {};
    const placeholder = '[ BLANK ]';
    const sentence = questionText.includes('___') ? questionText : `${questionText} ________.`;
    visualData.fillBlankData.prefixText = visualData.fillBlankData.prefixText || sentence.split(/_{2,}/)[0] || questionText;
    visualData.fillBlankData.blankPlaceholder = visualData.fillBlankData.blankPlaceholder || placeholder;
    visualData.fillBlankData.blank = visualData.fillBlankData.blank || correctOptionText;
    visualData.fillBlankData.contextBadge = visualData.fillBlankData.contextBadge || 'Operational Security Policy';
    visualData.fillBlankData.correctAnswerText = visualData.fillBlankData.correctAnswerText || correctOptionText;
  } else if (type === 'crossword') {
    visualData.type = 'crossword';
    if (!visualData.crosswordData) visualData.crosswordData = {};
    // Extract a single clean uppercase solution word from correct option
    const solWord = correctOptionText.replace(/[^A-Za-z]/g, '').toUpperCase() || 'FIREWALL';
    visualData.crosswordData.clueNumber = visualData.crosswordData.clueNumber || 1;
    visualData.crosswordData.direction = visualData.crosswordData.direction || 'ACROSS';
    visualData.crosswordData.length = solWord.length;
    visualData.crosswordData.solutionWord = solWord;
    visualData.crosswordData.clue = visualData.crosswordData.clue || questionText;
    visualData.crosswordData.revealedIndices = visualData.crosswordData.revealedIndices || [0, Math.min(solWord.length - 1, 3)];
  }

  // Build / synthesize revealVisual
  let revealVisual = q.revealVisual || {};
  if (!revealVisual.vulnerabilitySummary) {
    revealVisual.vulnerabilitySummary = `${correctOptionText}: ${explanation.substring(0, 140)}...`;
  }
  if (type === 'riddle' && !revealVisual.riddleAnswer) {
    revealVisual.riddleAnswer = correctOptionText;
  }
  if (type === 'fill_in_the_blank' && !revealVisual.fillBlankAnswer) {
    revealVisual.fillBlankAnswer = correctOptionText;
  }
  if (type === 'crossword' && !revealVisual.crosswordSolution) {
    revealVisual.crosswordSolution = visualData.crosswordData ? visualData.crosswordData.solutionWord : correctOptionText;
  }

  return {
    id,
    category,
    type,
    question: questionText,
    options,
    correctAnswer,
    explanation,
    visualData,
    revealVisual
  };
}

/**
 * Intelligent AI synthesis using Gemini 2.5 Flash / 1.5 Flash
 */
async function generateWithGemini({ text, topic, questionCount = 10, apiKey, difficulty = 'balanced' }) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are a Principal OT MSSP Cybersecurity Architect and Educational Game Master at Schneider Electric.
Your mission is to transform Knowledge Transfer (KT) session materials (transcripts, meeting notes, MOMs, PPT slide extracts, PDF summaries) into an engaging, gamified quiz.

REQUIREMENTS:
1. Generate exactly ${questionCount} questions based on the provided material.
2. Balance question types across:
   - "Cyber Riddle" (type: "riddle"): Rhyming 4-line riddle describing an OT concept, protocol, attack, or role.
   - "Fill in the Blank" (type: "fill_in_the_blank"): Standard with sentence containing '________'.
   - "Cyber Crossword" (type: "crossword"): A definition clue pointing to an exact single-word solution (e.g. MODBUS, PURDUE, FIREWALL, RANSOMWARE).
   - "Multiple Choice Question" (type: "theory"): Scenario-based technical question.
3. CRITICAL - MISSING DATA SYNTHESIS:
   Even if the input text has gaps, is disorganized, missing options, or only contains bullet points:
   - Automatically analyze the context and formulate plausible, unambiguous questions.
   - Generate exactly 4 plausible options (1 correct, 3 realistic OT/cybersecurity distractors).
   - Indicate correctAnswer as 0-3 index.
   - Write a rich technical explanation explaining why the correct choice is accurate and why the other options fail.
   - Fill in visualData and revealVisual completely according to the schema.
4. Output MUST be ONLY valid JSON matching the requested schema. No markdown backticks, no markdown code fence, just raw JSON.`;

  const schemaExample = {
    topic: topic || "OT MSSP Knowledge Transfer",
    questions: [
      {
        id: 1,
        category: "Cyber Riddle",
        type: "riddle",
        question: "Rhyming riddle text...",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: 0,
        explanation: "Deep technical rationale...",
        visualData: {
          type: "riddle",
          riddleData: {
            title: "PROTOCOL ENIGMA",
            riddleText: "Rhyming riddle text...",
            hintCategory: "Industrial Networking",
            hint: "Short hint...",
            enigmaTag: "SECURITY ENIGMA",
            decodedTitle: "OPTION A",
            iconType: "lock"
          }
        },
        revealVisual: {
          riddleAnswer: "Option A",
          vulnerabilitySummary: "Key takeaway..."
        }
      }
    ]
  };

  const userPrompt = `TOPIC: ${topic || 'OT MSSP Weekly Knowledge Transfer'}
TARGET QUESTION COUNT: ${questionCount}
DIFFICULTY: ${difficulty}

MATERIAL TO ANALYZE AND TRANSFORM:
"""
${text.substring(0, 50000)}
"""

Please analyze this material and output the structured JSON with ${questionCount} questions.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: userPrompt }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: systemInstruction }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) {
    throw new Error('No content returned from Gemini model');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', rawContent);
    throw new Error('AI output was not valid JSON: ' + err.message);
  }

  const rawQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
  const normalized = rawQuestions.map((q, idx) => normalizeAndEnrichQuestion(q, idx + 1));
  return {
    topic: parsed.topic || topic || 'OT MSSP Weekly Quiz',
    questions: normalized
  };
}

/**
 * Fallback Rule-Based NLP Synthesizer (Zero external API dependencies)
 * Extracts key sentences, numbers, blanks, and terms from raw text and synthesizes complete quiz items.
 */
function generateFallbackQuiz({ text, topic, questionCount = 5 }) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 15);

  const questions = [];
  const count = Math.max(1, Math.min(questionCount, 25));

  // OT Domain Knowledge Pool for intelligent distractor & clue synthesis
  const otKnowledge = [
    {
      term: 'MODBUS',
      fullName: 'Modbus TCP (Port 502)',
      category: 'Cyber Crossword',
      type: 'crossword',
      question: 'Which unencrypted 6-letter industrial protocol operates on port 502 for PLC communications?',
      clue: '6-letter industrial protocol operating on port 502 without native encryption',
      distractors: ['ETHERNET/IP', 'PROFINET', 'BACNET', 'DNP3 SECURE'],
      explanation: 'Modbus TCP communicates in plaintext over TCP port 502, making it vulnerable to packet injection if not isolated.',
      badge: 'Industrial Protocols'
    },
    {
      term: 'PURDUE',
      fullName: 'Purdue Enterprise Reference Architecture',
      category: 'Fill in the Blank',
      type: 'fill_in_the_blank',
      question: 'In the ________ Model, Level 1 represents the Basic Control level housing PLCs and RTUs.',
      blank: 'Purdue',
      distractors: ['OSI', 'Purdue', 'Zero Trust', 'MITRE ATT&CK'],
      correctIndex: 1,
      explanation: 'The Purdue Model divides industrial architectures into Levels 0 through 5 to enforce segmentation.',
      badge: 'Architecture & Zoning'
    },
    {
      term: 'TAILGATING',
      fullName: 'Physical Tailgating (Piggybacking)',
      category: 'Cyber Riddle',
      type: 'riddle',
      question: '"I wear no burglar mask and pick no lock; I wait by the speed gate around 9 o\'clock. When you tap your badge with a polite smile, I slip right behind you and walk the aisle."',
      distractors: ['The Tailgater (Piggybacking)', 'The Shoulder Surfer', 'The Social Engineer', 'The Impersonator'],
      correctIndex: 0,
      explanation: 'Tailgating bypasses physical access controls by closely following an authorized employee through security gates.',
      badge: 'Physical Security'
    },
    {
      term: 'IEC 62443',
      fullName: 'IEC 62443 Standards Framework',
      category: 'Multiple Choice Question',
      type: 'theory',
      question: 'Which international cybersecurity standard specifically defines Security Levels (SL 1 to SL 4) for IACS (Industrial Automation and Control Systems)?',
      distractors: ['IEC 62443', 'ISO 27001', 'PCI-DSS 4.0', 'HIPAA Security Rule'],
      correctIndex: 0,
      explanation: 'IEC 62443 is the global benchmark standard for Industrial Automation and Control System cybersecurity.',
      badge: 'Compliance & Governance'
    },
    {
      term: 'RANSOMWARE',
      fullName: 'OT-Targeting Ransomware',
      category: 'Cyber Crossword',
      type: 'crossword',
      question: 'Which 10-letter malware threat encrypts SCADA historians and asks for ransom payments?',
      clue: '10-letter extortion malware encrypting data repositories',
      distractors: ['RANSOMWARE', 'ROOTKITTING', 'SPYWARE', 'KEYLOGGER'],
      explanation: 'Ransomware targeting OT environments can halt manufacturing plants and critical infrastructure operations.',
      badge: 'Threat Intelligence'
    }
  ];

  for (let i = 0; i < count; i++) {
    const template = otKnowledge[i % otKnowledge.length];
    const sourceLine = lines[i] || '';

    // If sourceLine contains a blank or question mark, adopt its wording
    let qText = template.question;
    if (sourceLine && sourceLine.length > 25 && sourceLine.includes('?')) {
      qText = sourceLine;
    }

    const q = {
      id: i + 1,
      category: template.category,
      type: template.type,
      question: qText,
      options: [...template.distractors],
      correctAnswer: template.correctIndex !== undefined ? template.correctIndex : 0,
      explanation: template.explanation,
      visualData: {},
      revealVisual: {
        vulnerabilitySummary: `${template.fullName}: ${template.explanation}`
      }
    };

    if (template.type === 'riddle') {
      q.visualData = {
        type: 'riddle',
        riddleData: {
          title: 'OT SECURITY ENIGMA',
          riddleText: qText,
          hintCategory: template.badge,
          hint: 'Watch physical and protocol boundaries closely.',
          enigmaTag: 'SECURITY ENIGMA',
          decodedTitle: template.fullName.toUpperCase(),
          iconType: 'lock'
        }
      };
    } else if (template.type === 'fill_in_the_blank') {
      q.visualData = {
        type: 'fill_in_the_blank',
        fillBlankData: {
          prefixText: qText.split(/_{2,}/)[0] || qText,
          blankPlaceholder: '[ BLANK ]',
          blank: template.blank,
          contextBadge: template.badge,
          correctAnswerText: template.blank
        }
      };
    } else if (template.type === 'crossword') {
      q.visualData = {
        type: 'crossword',
        crosswordData: {
          clueNumber: i + 1,
          direction: 'ACROSS',
          length: template.term.length,
          solutionWord: template.term,
          clue: template.clue,
          revealedIndices: [0, Math.min(template.term.length - 1, 2)]
        }
      };
      q.revealVisual.crosswordSolution = template.term;
    }

    questions.push(normalizeAndEnrichQuestion(q, i + 1));
  }

  return {
    topic: topic || 'OT MSSP Knowledge Transfer (Auto-Synthesized)',
    questions
  };
}

/**
 * Main Controller: Ingests content (PDF or text) and generates a complete, validated quiz
 */
async function processKTAndGenerateQuiz({
  buffer,
  mimeType,
  filename,
  text,
  topic = 'OT MSSP Weekly Knowledge Transfer',
  questionCount = 10,
  apiKey,
  difficulty = 'balanced'
}) {
  let rawText = text || '';

  if (buffer && buffer.length > 0) {
    const extracted = await extractTextFromBuffer(buffer, mimeType, filename);
    rawText = (extracted + '\n\n' + rawText).trim();
  }

  if (!rawText || rawText.trim().length < 20) {
    rawText = `Knowledge Transfer Topic: ${topic}\nFocusing on OT MSSP operations, industrial protocols, Purdue model segmentation, incident triage, and cyber defense best practices.`;
  }

  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (effectiveApiKey) {
    try {
      console.log(`[AI-Quiz-Engine] Generating ${questionCount} questions with Gemini Flash for topic: "${topic}"...`);
      return await generateWithGemini({
        text: rawText,
        topic,
        questionCount,
        apiKey: effectiveApiKey,
        difficulty
      });
    } catch (err) {
      console.warn(`[AI-Quiz-Engine] Gemini generation failed: ${err.message}. Falling back to resilient local engine.`);
    }
  } else {
    console.log('[AI-Quiz-Engine] No Gemini API key detected. Running local intelligent OT synthesizer...');
  }

  return generateFallbackQuiz({
    text: rawText,
    topic,
    questionCount
  });
}

module.exports = {
  extractTextFromBuffer,
  processKTAndGenerateQuiz,
  normalizeAndEnrichQuestion
};
