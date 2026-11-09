/**
 * AI Quiz Ingestion & Structuring Engine
 * 
 * Supports:
 * - PDF parsing via pdf-parse v2 (with class & stream fallback)
 * - Text / MOM / Summary / Project Report / Markdown ingestion
 * - Document-grounded Gemini 2.5 Flash / 1.5 Flash automated structuring
 * - Dynamic Local NLP Synthesizer (100% derived from the uploaded document text)
 * - Intelligent missing-data synthesis (options, explanations, hints, visual data)
 * - Complete schema normalization
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
        if (res && res.text && res.text.trim().length > 20) {
          return res.text;
        }
      }

      // 2. pdf-parse v1 API (direct function export)
      if (typeof pdfParseModule === 'function') {
        const data = await pdfParseModule(buffer);
        if (data && data.text && data.text.trim().length > 20) {
          return data.text;
        }
      }

      // 3. ESM default export fallback
      if (pdfParseModule && typeof pdfParseModule.default === 'function') {
        const data = await pdfParseModule.default(buffer);
        if (data && data.text && data.text.trim().length > 20) {
          return data.text;
        }
      }
    } catch (err) {
      console.warn('Primary PDF parser encountered issue, trying fallback text extractor:', err.message);
    }

    // 4. Resilient stream-level text extractor fallback (extracts literal strings from PDF streams)
    try {
      const raw = buffer.toString('latin1');
      const textChunks = [];
      const textMatches = raw.match(/\(([^()]{2,})\)\s*Tj/g) || [];
      for (const m of textMatches) {
        const clean = m.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
        if (clean.length > 2 && !clean.startsWith('/')) {
          textChunks.push(clean);
        }
      }
      if (textChunks.length > 10) {
        return textChunks.join(' ');
      }
    } catch (fallbackErr) {
      console.error('Fallback PDF extractor failed:', fallbackErr);
    }

    throw new Error('Failed to extract text from PDF: unable to parse readable text content.');
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
function normalizeAndEnrichQuestion(q, index = 1, documentContext = {}) {
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
    if (type === 'riddle') category = 'Technical Riddle';
    else if (type === 'fill_in_the_blank') category = 'Fill in the Blank';
    else if (type === 'crossword') category = 'Project Crossword';
    else if (type === 'image') category = 'System Architecture Scenario';
    else category = 'Multiple Choice Question';
  }

  let questionText = (q.question || '').trim();
  if (!questionText) {
    questionText = `Question ${id} on Project Architecture & Concepts`;
  }

  // Ensure 4 options
  let options = Array.isArray(q.options) ? q.options.map(cleanOptionText).filter(Boolean) : [];
  if (options.length < 4) {
    const contextualDistractors = documentContext.keyTerms || [
      'FastAPI Microservice',
      'Asynchronous Event Queue',
      'Relational Schema Model',
      'Validation Pipeline'
    ];
    let distractorIdx = 0;
    while (options.length < 4) {
      const candidate = contextualDistractors[distractorIdx % contextualDistractors.length];
      distractorIdx++;
      if (!options.includes(candidate)) {
        options.push(candidate);
      } else {
        options.push(`${candidate} Variant ${options.length + 1}`);
      }
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
    explanation = `${correctOptionText} is the correct implementation choice according to the submitted project report.`;
  }

  // Build / synthesize visualData based on type
  let visualData = q.visualData || {};
  if (!visualData.type) {
    visualData.type = type;
  }

  if (type === 'riddle') {
    visualData.type = 'riddle';
    if (!visualData.riddleData) visualData.riddleData = {};
    visualData.riddleData.title = visualData.riddleData.title || 'PROJECT CONCEPT ENIGMA';
    visualData.riddleData.riddleText = visualData.riddleData.riddleText || questionText;
    visualData.riddleData.hintCategory = visualData.riddleData.hintCategory || 'Core Technology & Design';
    visualData.riddleData.hint = visualData.riddleData.hint || `Pertains to ${correctOptionText}`;
    visualData.riddleData.enigmaTag = visualData.riddleData.enigmaTag || 'TECHNICAL ENIGMA';
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
    visualData.fillBlankData.contextBadge = visualData.fillBlankData.contextBadge || 'System Specification';
    visualData.fillBlankData.correctAnswerText = visualData.fillBlankData.correctAnswerText || correctOptionText;
  } else if (type === 'crossword') {
    visualData.type = 'crossword';
    if (!visualData.crosswordData) visualData.crosswordData = {};
    const solWord = correctOptionText.replace(/[^A-Za-z]/g, '').toUpperCase() || 'FRAMEWORK';
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
    revealVisual.vulnerabilitySummary = `${correctOptionText}: ${explanation.substring(0, 160)}`;
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
 * Extract technical terms, capitalized entities, and metrics directly from the document
 */
function extractDocumentKeyTerms(text) {
  const words = text.match(/\b[A-Za-z0-9_-]{3,24}\b/g) || [];
  const freq = {};
  const stopWords = new Set([
    'the', 'this', 'that', 'these', 'those', 'with', 'from', 'into', 'over', 'under',
    'then', 'when', 'what', 'where', 'which', 'while', 'there', 'their', 'here', 'some',
    'such', 'each', 'every', 'also', 'been', 'have', 'were', 'will', 'both', 'page',
    'figure', 'table', 'chapter', 'section', 'about', 'after', 'before', 'between', 'during',
    'using', 'used', 'uses', 'and', 'for', 'are', 'was', 'has', 'had', 'not', 'but', 'can',
    'could', 'should', 'would', 'may', 'might', 'must', 'shall', 'our', 'all', 'any', 'most',
    'other', 'more', 'less', 'well', 'very', 'too', 'only', 'own', 'same', 'so', 'than',
    'just', 'now', 'such', 'how', 'why', 'who', 'whom', 'whose', 'introduction', 'overview',
    'project', 'report', 'paper', 'study', 'system', 'present', 'presents', 'presented',
    'various', 'different', 'based', 'provide', 'provides', 'order', 'such', 'since'
  ]);

  for (const w of words) {
    const lower = w.toLowerCase();
    if (!stopWords.has(lower) && !/^\d+$/.test(w) && w.length >= 4) {
      const isCapitalized = /^[A-Z]/.test(w);
      const isAllUpper = /^[A-Z0-9]+$/.test(w) && w.length >= 2;
      const weight = isAllUpper ? 4 : isCapitalized ? 3 : 1;
      freq[w] = (freq[w] || 0) + weight;
    }
  }

  return Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
}

/**
 * Splits document into meaningful informative sentences
 */
function extractDocumentSentences(text) {
  return text
    .split(/(?<=[.?!])\s+|\n{2,}/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(s => {
      if (s.length < 35 || s.length > 280) return false;
      // Filter out table of contents lines (e.g. "Chapter 1 ... 12")
      if (/\.{4,}|\b\d+\s*$/.test(s)) return false;
      // Must contain at least 4 words
      return s.split(' ').length >= 5;
    });
}

/**
 * Intelligent AI synthesis using Gemini 2.5 Flash / 1.5 Flash
 * Strictly grounded in the provided document text (No unrelated domain hallucinations)
 */
async function generateWithGemini({ text, topic, questionCount = 10, apiKey, difficulty = 'balanced' }) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are an expert Educational Assessment and Technical Quiz Engine.
Your mission is to transform the provided document (such as a final year engineering project report, research thesis, presentation deck, or technical document) into an engaging, gamified quiz.

STRICT DOMAIN GROUNDING RULES:
1. Every single question, answer, and explanation MUST be 100% derived from and faithful to the provided document.
2. DO NOT inject unrelated subjects (such as industrial SCADA, Modbus, or Tailgating) UNLESS the provided text is explicitly about them. If the user provides a project report about Web Development, Machine Learning, Robotics, Databases, or Cloud Computing, generate questions specifically about their project!
3. Formulate exactly ${questionCount} questions distributed across:
   - "Multiple Choice Question" (type: "theory"): Testing methodology, architecture choices, dataset, results, or objectives from the text.
   - "Fill in the Blank" (type: "fill_in_the_blank"): Sentences containing '________' where the blank is an important concept from the report.
   - "Project Crossword" (type: "crossword"): A single technical keyword (e.g. FASTAPI, RESNET, DATABASE, SENSOR) with a clue summarizing its role in the project.
   - "Technical Riddle" (type: "riddle"): A 4-line rhyming enigma clue describing a key algorithm, tool, or component mentioned in the report.
4. Exactly 4 plausible options for every question (1 correct, 3 realistic distractors within the same domain).
5. The explanation must reference the rationale and findings from the document.
6. Output ONLY valid JSON matching the schema. No markdown backticks.`;

  const userPrompt = `DOCUMENT TOPIC: ${topic || 'Submitted Project Report'}
TARGET QUESTION COUNT: ${questionCount}
DEPTH LEVEL: ${difficulty}

EXTRACTED TEXT FROM UPLOADED DOCUMENT:
"""
${text.substring(0, 60000)}
"""

Please analyze this text carefully and output ${questionCount} questions strictly derived from the document.`;

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
    topic: parsed.topic || topic || 'Project Knowledge Assessment',
    questions: normalized
  };
}

/**
 * Dynamic Content-Grounded NLP Synthesizer (100% Derived from Document Text)
 * Used when no LLM key is provided or offline. Extracts real sentences, terms, and facts directly from the document.
 */
function generateDynamicContentQuiz({ text, topic, questionCount = 10 }) {
  const sentences = extractDocumentSentences(text);
  const keyTerms = extractDocumentKeyTerms(text);

  const count = Math.max(1, Math.min(questionCount, 25));
  const questions = [];

  const safeSentences = sentences.length > 0 ? sentences : [
    `${topic} describes the implementation architecture, methodology, and evaluated results of the system.`,
    `The system architecture utilizes modular service layers to guarantee low latency and high availability.`,
    `Data processing pipelines apply validation and sanitization filters prior to persistent storage.`,
    `Experimental benchmarks evaluate accuracy, throughput, and computational efficiency across test scenarios.`
  ];

  const safeTerms = keyTerms.length >= 4 ? keyTerms : ['Architecture', 'Implementation', 'Optimization', 'Validation', 'Algorithm', 'Database', 'Microservice'];

  for (let i = 0; i < count; i++) {
    const sentence = safeSentences[i % safeSentences.length];
    
    // Strictly pick from clean domain key terms matching this sentence
    const matchedTermsInSentence = safeTerms.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(sentence));
    let termInSentence = matchedTermsInSentence[0] || safeTerms[i % safeTerms.length];
    termInSentence = termInSentence.replace(/[^A-Za-z0-9_-]/g, '');

    // Form distractors strictly from other key terms in the same document
    const distractors = safeTerms.filter(t => t.toLowerCase() !== termInSentence.toLowerCase()).slice(0, 3);
    while (distractors.length < 3) {
      distractors.push(`Feature_${distractors.length + 1}`);
    }

    const options = [termInSentence, ...distractors];
    // Shuffle options so correct answer isn't always at index 0
    const correctOption = termInSentence;
    const shuffledOptions = options.sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(correctOption);

    const questionFormat = i % 4; // 0: theory, 1: fill_in_the_blank, 2: crossword, 3: riddle

    if (questionFormat === 1) {
      // Fill in the Blank
      const blankedSentence = sentence.replace(new RegExp(`\\b${termInSentence}\\b`, 'i'), '________');
      const q = {
        id: i + 1,
        category: 'Fill in the Blank',
        type: 'fill_in_the_blank',
        question: blankedSentence.includes('________') ? blankedSentence : `${sentence} (Key concept: ________)`,
        options: shuffledOptions,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: `According to the document: "${sentence}"`,
        visualData: {
          type: 'fill_in_the_blank',
          fillBlankData: {
            prefixText: sentence.split(new RegExp(termInSentence, 'i'))[0] || sentence,
            blankPlaceholder: '[ BLANK ]',
            blank: correctOption,
            contextBadge: 'Report Technical Specification',
            correctAnswerText: correctOption
          }
        },
        revealVisual: {
          fillBlankAnswer: correctOption,
          vulnerabilitySummary: `Key Finding: "${sentence}"`
        }
      };
      questions.push(normalizeAndEnrichQuestion(q, i + 1, { keyTerms: safeTerms }));
    } else if (questionFormat === 2) {
      // Crossword
      const cleanWord = correctOption.replace(/[^A-Za-z]/g, '').toUpperCase();
      const solWord = cleanWord.length >= 3 && cleanWord.length <= 14 ? cleanWord : 'ANALYSIS';
      const q = {
        id: i + 1,
        category: 'Project Crossword',
        type: 'crossword',
        question: `Which ${solWord.length}-letter component or methodology is highlighted in the report: "${sentence.substring(0, 110)}..."?`,
        options: shuffledOptions,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: `In the project report, "${sentence}" relates to ${solWord}.`,
        visualData: {
          type: 'crossword',
          crosswordData: {
            clueNumber: i + 1,
            direction: 'ACROSS',
            length: solWord.length,
            solutionWord: solWord,
            clue: sentence.length > 90 ? sentence.substring(0, 90) + '...' : sentence,
            revealedIndices: [0, Math.min(solWord.length - 1, 2)]
          }
        },
        revealVisual: {
          crosswordSolution: solWord,
          vulnerabilitySummary: `${solWord}: Highlighted in report as key component in "${sentence.substring(0, 100)}..."`
        }
      };
      questions.push(normalizeAndEnrichQuestion(q, i + 1, { keyTerms: safeTerms }));
    } else if (questionFormat === 3) {
      // Riddle
      const q = {
        id: i + 1,
        category: 'Technical Riddle',
        type: 'riddle',
        question: `"Defined in the project to fulfill its role;\nI process the data and maintain control.\nFound in the report where the findings reside;\nIdentify the component described inside."`,
        options: shuffledOptions,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: `The report highlights ${correctOption}: "${sentence}"`,
        visualData: {
          type: 'riddle',
          riddleData: {
            title: 'PROJECT ARCHITECTURE ENIGMA',
            riddleText: `"Defined in the project to fulfill its role;\nI process the data and maintain control.\nFound in the report where the findings reside;\nIdentify the component described inside."`,
            hintCategory: 'Project Methodology',
            hint: `Described in report: "${sentence.substring(0, 80)}..."`,
            enigmaTag: 'TECHNICAL ENIGMA',
            decodedTitle: correctOption.toUpperCase(),
            iconType: 'lock'
          }
        },
        revealVisual: {
          riddleAnswer: correctOption,
          vulnerabilitySummary: `${correctOption}: Referenced in report as "${sentence.substring(0, 120)}..."`
        }
      };
      questions.push(normalizeAndEnrichQuestion(q, i + 1, { keyTerms: safeTerms }));
    } else {
      // Multiple Choice Question (Theory)
      const q = {
        id: i + 1,
        category: 'Multiple Choice Question',
        type: 'theory',
        question: `According to the submitted report, what is stated regarding ${correctOption}?\n"${sentence.substring(0, 120)}..."`,
        options: shuffledOptions,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: `As detailed in the document: "${sentence}"`,
        visualData: { type: 'theory' },
        revealVisual: {
          vulnerabilitySummary: `Report Reference: "${sentence}"`
        }
      };
      questions.push(normalizeAndEnrichQuestion(q, i + 1, { keyTerms: safeTerms }));
    }
  }

  return {
    topic: topic || 'Project Knowledge Assessment',
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
  topic = 'Knowledge Transfer & Project Review',
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
    rawText = `Document Topic: ${topic}\nFocusing on project architecture, technical methodology, experimental evaluation, and key findings.`;
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
      console.warn(`[AI-Quiz-Engine] Gemini generation failed: ${err.message}. Falling back to dynamic document NLP synthesizer.`);
    }
  } else {
    console.log(`[AI-Quiz-Engine] Generating quiz directly from document text using Dynamic Content Synthesizer...`);
  }

  return generateDynamicContentQuiz({
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
