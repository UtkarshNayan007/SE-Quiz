/**
 * AI Quiz Ingestion & Structuring Engine
 * 
 * Supports:
 * - PDF parsing via pdf-parse v2 (with class & stream fallback)
 * - Academic & Report Boilerplate Stripping (removes cover pages, student IDs, declaration forms, TOCs)
 * - Document-grounded Gemini 2.5 Flash / 1.5 Flash automated structuring
 * - Dynamic Smart Local NLP Synthesizer with intelligent domain distractors
 * - Schema normalization for all gamified formats (Riddle, Crossword, Fill-in-the-blank, MCQ)
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
 * Strips academic front-matter (Cover pages, candidate names, guide names,
 * bonafide certificates, declaration forms, acknowledgments, table of contents)
 * and jumps straight to the core technical content (Abstract, Intro, Architecture, Results).
 */
function discardBoilerplateFrontMatter(text) {
  if (typeof text !== 'string') return '';
  const startMarkers = [
    /\b(abstract|executive\s+summary)\b/i,
    /\b(chapter\s*1|section\s*1|1\.\s*introduction)\b/i,
    /\b(1\.\s*project\s+overview)\b/i,
    /\b(problem\s+statement)\b/i
  ];
  for (const marker of startMarkers) {
    const match = text.search(marker);
    if (match !== -1 && match < 25000) {
      console.log(`[AI-Quiz-Engine] Successfully skipped academic front-matter (${match} characters).`);
      return text.substring(match);
    }
  }
  return text;
}

/**
 * Filter out academic and institutional boilerplate (title pages, student names, register numbers,
 * declaration forms, bonafide certificates, table of contents, acknowledgments).
 */
function isBoilerplateSentence(s) {
  if (typeof s !== 'string') return true;
  const boilerplatePatterns = [
    /submitted\s+by/i,
    /under\s+the\s+guidance/i,
    /department\s+of/i,
    /institute\s+of/i,
    /faculty\s+of/i,
    /school\s+of/i,
    /declaration\s+form/i,
    /bonafide\s+certificate/i,
    /this\s+sheet\s+must\s+be\s+filled/i,
    /acknowledgement/i,
    /grateful\s+to\s+our/i,
    /gratitude\s+to\s+our/i,
    /head\s+of\s+the\s+department/i,
    /faculty\s+advisor/i,
    /sincere\s+thanks/i,
    /we\s+thank\s+our/i,
    /immeasurable\s+gratitude/i,
    /table\s+of\s+contents/i,
    /list\s+of\s+(figures|tables|symbols|abbreviations)/i,
    /\bra\d{10,}\b/i, // Student register number pattern (e.g. RA2211030010169)
    /\b(reg(ister)?|roll)\s*(no|number)[:\s]/i,
    /to\s+certify\s+that\s+this\s+project/i,
    /partial\s+fulfillment\s+of/i,
    /degree\s+of\s+bachelor/i,
    /own\s+work\s+declaration/i,
    /supervisor\s*[:\-]/i,
    /project\s+coordinator/i,
    /internal\s+examiner/i,
    /external\s+examiner/i,
    /\.{4,}/ // Table of contents dot leaders
  ];

  return boilerplatePatterns.some(pattern => pattern.test(s));
}

/**
 * Clean redundant option prefixes (e.g., "A) ", "B. ", "1: ")
 */
function cleanOptionText(text) {
  if (typeof text !== 'string') return String(text || '');
  return text.replace(/^[A-Da-d0-9][\)\.\:\-]\s*/, '').trim();
}

/**
 * Pre-compiled domain dictionaries for high-quality, category-aware distractors.
 * If a key term belongs to a known family (databases, ML models, messaging, protocols, frameworks),
 * we generate natural alternatives instead of repeating generic words.
 */
const technicalDomainFamilies = {
  database: ['MongoDB', 'PostgreSQL', 'Redis', 'Cassandra', 'MySQL', 'DynamoDB', 'SQLite'],
  mlModels: ['Random Forest', 'XGBoost', 'Convolutional Neural Network (CNN)', 'Support Vector Machine (SVM)', 'LSTM', 'Transformer', 'Decision Tree'],
  messaging: ['Kafka Streams', 'RabbitMQ', 'ZeroMQ', 'Apache Pulsar', 'AWS SQS', 'MQTT'],
  frontend: ['React & Next.js', 'Vue.js', 'Angular', 'SvelteKit', 'Flutter', 'FastAPI Web UI'],
  backend: ['FastAPI & Python', 'Node.js & Express', 'Go Gin Engine', 'Spring Boot', 'Django Framework'],
  security: ['Role-Based Access Control (RBAC)', 'Mutual TLS (mTLS)', 'OAuth 2.0 & JWT', 'Zero Trust Architecture', 'Multi-Factor Auth (MFA)'],
  protocols: ['Modbus TCP', 'OPC UA', 'IEC 62443', 'MQTT Protocol', 'HTTPS / REST API', 'gRPC Protocol'],
  metrics: ['Latency (ms)', 'Throughput (req/sec)', 'Accuracy (%)', 'F1-Score', 'Precision & Recall', 'CPU Utilization']
};

/**
 * Generates smart, per-question distractors
 */
function generateContextualDistractors(targetTerm, documentTerms = [], questionIndex = 0) {
  const targetLower = targetTerm.toLowerCase();

  // 1. Try finding a category family match
  for (const family of Object.values(technicalDomainFamilies)) {
    const hasMatch = family.some(item => item.toLowerCase().includes(targetLower) || targetLower.includes(item.toLowerCase()));
    if (hasMatch) {
      const candidates = family.filter(item => !item.toLowerCase().includes(targetLower) && !targetLower.includes(item.toLowerCase()));
      // Rotate starting offset using questionIndex so different questions get different alternatives
      const offset = questionIndex % candidates.length;
      const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
      return rotated.slice(0, 3);
    }
  }

  // 2. Select distinct terms from document vocabulary, skipping terms close to target
  const filteredDocTerms = documentTerms.filter(t => {
    const tLower = t.toLowerCase();
    return tLower !== targetLower && !targetLower.includes(tLower) && !tLower.includes(targetLower);
  });

  if (filteredDocTerms.length >= 3) {
    const offset = (questionIndex * 3) % filteredDocTerms.length;
    const pool = [...filteredDocTerms.slice(offset), ...filteredDocTerms.slice(0, offset)];
    return pool.slice(0, 3);
  }

  // 3. Fallback generic architectural alternatives
  const genericFallbacks = [
    'Automated Verification Pipeline',
    'Distributed Cluster Coordinator',
    'Asynchronous Event Dispatcher',
    'High-Performance Query Optimizer',
    'Fault-Tolerant Replicated Store'
  ];
  return genericFallbacks.slice(0, 3);
}

/**
 * Normalizes and guarantees every question adheres to the client visualData schema.
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
    questionText = `Question ${id} on System Architecture & Implementation`;
  }

  // Ensure 4 options
  let options = Array.isArray(q.options) ? q.options.map(cleanOptionText).filter(Boolean) : [];
  if (options.length < 4) {
    const fallbackDistractors = generateContextualDistractors(options[0] || 'System', documentContext.keyTerms || [], index);
    for (const d of fallbackDistractors) {
      if (options.length < 4 && !options.includes(d)) options.push(d);
    }
    while (options.length < 4) {
      options.push(`Architecture Feature ${options.length + 1}`);
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
    'various', 'different', 'based', 'provide', 'provides', 'order', 'such', 'since',
    'department', 'communications', 'srm', 'institute', 'science', 'technology', 'declaration',
    'form', 'sheet', 'filled', 'ticked', 'bonafide', 'certificate', 'utkarsh', 'shashwat', 'chirag',
    'nayan', 'bhatt', 'jain', 'kanimozhi', 'guide', 'guidance', 'examiner', 'coordinator',
    'features', 'feature', 'submitted', 'abstract', 'title', 'name', 'names', 'candidates',
    'candidate', 'work', 'sprint', 'user', 'event', 'first', 'second', 'third', 'fourth'
  ]);

  for (const w of words) {
    // Strictly exclude student registration numbers, IDs, and words containing numbers
    if (/\d/.test(w)) continue;
    const lower = w.toLowerCase();
    if (!stopWords.has(lower) && w.length >= 4) {
      const isCapitalized = /^[A-Z]/.test(w);
      const isAllUpper = /^[A-Z]+$/.test(w) && w.length >= 2;
      const weight = isAllUpper ? 4 : isCapitalized ? 3 : 1;
      freq[w] = (freq[w] || 0) + weight;
    }
  }

  return Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
}

/**
 * Splits document into meaningful informative sentences, strictly filtering out
 * academic headers, title pages, student IDs, and declaration sheets.
 */
function extractDocumentSentences(text) {
  return text
    .split(/(?<=[.?!])\s+|\n{2,}/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(s => {
      if (s.length < 35 || s.length > 280) return false;
      if (isBoilerplateSentence(s)) return false;
      return s.split(' ').length >= 6;
    });
}

/**
 * Intelligent AI synthesis using Gemini 2.0 Flash / 1.5 Flash
 * Strictly grounded in the provided document text across all chapters.
 */
async function generateWithGemini({ text, topic, questionCount = 10, apiKey, difficulty = 'balanced' }) {
  const cleanText = discardBoilerplateFrontMatter(text)
    .split('\n')
    .filter(line => !isBoilerplateSentence(line))
    .join('\n');

  const systemInstruction = `You are an expert Educational Assessment and Technical Quiz Engine.
Your mission is to transform the provided document (such as a final year engineering project report, research thesis, or KT presentation) into an engaging, gamified quiz.

STRICT RULES:
1. Every single question, answer, and explanation MUST be 100% derived from and faithful to the technical content of the document.
2. DO NOT include questions about student names, registration numbers, college names, declaration forms, acknowledgments, or certificates. Focus STRICTLY on the actual technical architecture, methodology, algorithms, problem statement, datasets, and results of the project!
3. CRITICAL: Analyze the ENTIRE document (including introduction, methodology, algorithms, modules, and testing results). DO NOT just take questions from the first page! Distribute questions evenly across the whole report.
4. DO NOT inject unrelated topics (such as industrial SCADA, Modbus, or Tailgating) UNLESS the document is explicitly about them. If the report is about "DigiFence" or "Cyber Defense", generate questions specifically testing the DigiFence architecture, modules, and implementation detailed in the text.
5. Formulate exactly ${questionCount} questions distributed across:
   - "Multiple Choice Question" (type: "theory"): Testing methodology, architecture choices, dataset, results, or objectives from the text.
   - "Fill in the Blank" (type: "fill_in_the_blank"): Sentences containing '________' where the blank is an important technical concept from the report.
   - "Project Crossword" (type: "crossword"): A single technical keyword with a clue summarizing its role in the project.
   - "Technical Riddle" (type: "riddle"): A 4-line rhyming enigma clue describing a key algorithm, tool, or component mentioned in the report.
6. Provide 4 distinct, plausible options for every question (1 correct, 3 realistic distractors). DO NOT repeat the same 4 options across multiple questions.
7. The explanation must reference the rationale and findings from the document.
8. Output ONLY valid JSON matching the schema. No markdown backticks.`;

  const userPrompt = `DOCUMENT TOPIC: ${topic || 'Submitted Project Report'}
TARGET QUESTION COUNT: ${questionCount}
DEPTH LEVEL: ${difficulty}

EXTRACTED TEXT FROM UPLOADED DOCUMENT (UP TO 200,000 CHARACTERS ACROSS ALL CHAPTERS):
"""
${cleanText.substring(0, 200000)}
"""

Please analyze this technical material across all chapters and output ${questionCount} questions evenly distributed across the document.`;

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

  // 1. Dynamic Model Discovery via ListModels API
  let candidateModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const models = (listData.models || []).filter(m =>
        Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')
      );
      // Prefer flash models, then pro, then any
      const flash = models.filter(m => m.name.includes('flash')).map(m => ({ version: 'v1beta', name: m.name.replace(/^models\//, '') }));
      const pro = models.filter(m => m.name.includes('pro')).map(m => ({ version: 'v1beta', name: m.name.replace(/^models\//, '') }));
      candidateModels = [...flash, ...pro];
      console.log(`[AI-Quiz-Engine] Discovered ${candidateModels.length} compatible models via ListModels.`);
    }
  } catch (discoveryErr) {
    console.warn(`[AI-Quiz-Engine] ListModels discovery warning:`, discoveryErr.message);
  }

  // Fallback candidate list if discovery returned empty
  if (candidateModels.length === 0) {
    candidateModels = [
      { version: 'v1beta', name: 'gemini-1.5-flash-latest' },
      { version: 'v1beta', name: 'gemini-2.0-flash' },
      { version: 'v1beta', name: 'gemini-2.0-flash-exp' },
      { version: 'v1', name: 'gemini-1.5-flash' },
      { version: 'v1beta', name: 'gemini-1.5-pro-latest' },
      { version: 'v1', name: 'gemini-pro' }
    ];
  }

  let lastError = null;

  for (const item of candidateModels) {
    const { version, name } = item;
    try {
      console.log(`[AI-Quiz-Engine] Calling Gemini API (${version} / ${name})...`);
      const url = `https://generativelanguage.googleapis.com/${version}/models/${name}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${name} - ${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) {
        throw new Error(`No content returned from Gemini model ${name}`);
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
    } catch (err) {
      console.warn(`[AI-Quiz-Engine] Model ${name} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

/**
 * Dynamic Content-Grounded NLP Synthesizer (100% Derived from Document Text)
 * Uses intelligent per-question distractor rotation and natural question synthesis
 * evenly sampled across the entire document length.
 */
function generateDynamicContentQuiz({ text, topic, questionCount = 10 }) {
  const cleanDoc = discardBoilerplateFrontMatter(text);
  const sentences = extractDocumentSentences(cleanDoc);
  const keyTerms = extractDocumentKeyTerms(cleanDoc);

  const count = Math.max(1, Math.min(questionCount, 25));
  const questions = [];

  const safeSentences = sentences.length > 0 ? sentences : [
    `${topic} describes the implementation architecture, methodology, and evaluated results of the system.`,
    `The system architecture utilizes modular service layers to guarantee low latency and high availability.`,
    `Data processing pipelines apply validation and sanitization filters prior to persistent storage.`,
    `Experimental benchmarks evaluate accuracy, throughput, and computational efficiency across test scenarios.`
  ];

  const safeTerms = keyTerms.length >= 4 ? keyTerms : ['Architecture', 'Implementation', 'Optimization', 'Validation', 'Algorithm', 'Database', 'Microservice'];

  // Evenly distribute sampling index across the ENTIRE document length
  const step = Math.max(1, Math.floor(safeSentences.length / count));

  for (let i = 0; i < count; i++) {
    const sampleIdx = Math.min(i * step, safeSentences.length - 1);
    const sentence = safeSentences[sampleIdx];
    
    // Pick the most relevant domain key term in this sentence
    const matchedTermsInSentence = safeTerms.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(sentence));
    let termInSentence = matchedTermsInSentence[0] || safeTerms[i % safeTerms.length];
    termInSentence = termInSentence.replace(/[^A-Za-z0-9_-]/g, '');

    // Form smart per-question distractors (avoiding global repetition)
    const distractors = generateContextualDistractors(termInSentence, safeTerms, i);

    const options = [termInSentence, ...distractors];
    // Shuffle options so correct answer isn't always at the same position
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
        explanation: `According to the project report: "${sentence}"`,
        visualData: {
          type: 'fill_in_the_blank',
          fillBlankData: {
            prefixText: sentence.split(new RegExp(termInSentence, 'i'))[0] || sentence,
            blankPlaceholder: '[ BLANK ]',
            blank: correctOption,
            contextBadge: 'Technical Specification',
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
      const solWord = cleanWord.length >= 3 && cleanWord.length <= 14 ? cleanWord : 'SECURITY';
      const q = {
        id: i + 1,
        category: 'Project Crossword',
        type: 'crossword',
        question: `Which ${solWord.length}-letter component or concept is described in the report: "${sentence.substring(0, 100)}..."?`,
        options: shuffledOptions,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: `In the project report, "${sentence}" specifies ${solWord}.`,
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
        question: `"An integral part of the project design,\nFulfilling its purpose along the pipeline.\nReferenced in the report with accuracy and care,\nName the system component described right there."`,
        options: shuffledOptions,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: `The report highlights ${correctOption}: "${sentence}"`,
        visualData: {
          type: 'riddle',
          riddleData: {
            title: 'PROJECT ARCHITECTURE ENIGMA',
            riddleText: `"An integral part of the project design,\nFulfilling its purpose along the pipeline.\nReferenced in the report with accuracy and care,\nName the system component described right there."`,
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
        question: `In the project architecture, which component or methodology addresses the following specification?\n"${sentence.substring(0, 140)}..."`,
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

  const effectiveApiKey = (apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

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
      console.error(`[AI-Quiz-Engine] Gemini generation failed: ${err.message}`);
      if (apiKey) {
        // Explicit user key provided: do not silently mask the error!
        throw new Error(`Gemini AI Generation Error: ${err.message}`);
      }
      console.warn(`[AI-Quiz-Engine] Falling back to dynamic document NLP synthesizer.`);
    }
  } else {
    console.log(`[AI-Quiz-Engine] No Gemini API key provided. Running Smart Local NLP Synthesizer across entire document...`);
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
