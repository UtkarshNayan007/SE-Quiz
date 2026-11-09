'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  FileText,
  Key,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  Save,
  Download,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FolderOpen,
  Cpu,
  Layers,
  HelpCircle,
  Hash,
  Eye,
  EyeOff
} from 'lucide-react';

interface Question {
  id: number;
  category: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  visualData?: any;
  revealVisual?: any;
}

interface AIQuizStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomPin: string;
  socket: any;
  onQuestionsApplied?: (count: number) => void;
}

export default function AIQuizStudioModal({
  isOpen,
  onClose,
  roomPin,
  socket,
  onQuestionsApplied
}: AIQuizStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'review' | 'sessions'>('upload');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'beginner' | 'balanced' | 'advanced'>('balanced');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // File & text state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Generated questions
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Saved sessions list
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

  useEffect(() => {
    const savedKey = localStorage.getItem('ot_quiz_gemini_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('ot_quiz_gemini_key', val.trim());
  };

  const loadSavedSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch(`${socketUrl}/api/sessions/list`);
      if (res.ok) {
        const data = await res.json();
        setSavedSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile && !pastedText.trim()) {
      setErrorMessage('Please either select a document (PDF / Text) or paste your KT summary/notes.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);
    setStatusMessage('Analyzing KT content and synthesizing questions...');

    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        if (apiKey.trim()) formData.append('apiKey', apiKey.trim());
        formData.append('topic', topic.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''));
        formData.append('questionCount', String(questionCount));
        formData.append('difficulty', difficulty);
        if (pastedText.trim()) formData.append('text', pastedText);
        formData.append('file', selectedFile);

        const customHeaders: Record<string, string> = {};
        if (apiKey.trim()) {
          customHeaders['x-gemini-key'] = apiKey.trim();
        }

        res = await fetch(`${socketUrl}/api/ai/generate-quiz`, {
          method: 'POST',
          headers: Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
          body: formData
        });
      } else {
        const customHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.trim()) {
          customHeaders['x-gemini-key'] = apiKey.trim();
        }

        res = await fetch(`${socketUrl}/api/ai/generate-quiz`, {
          method: 'POST',
          headers: customHeaders,
          body: JSON.stringify({
            text: pastedText,
            topic: topic.trim() || 'OT MSSP Weekly Knowledge Transfer',
            questionCount,
            difficulty,
            apiKey: apiKey.trim()
          })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Quiz generation failed');
      }

      setGeneratedQuestions(data.questions || []);
      if (data.topic && !topic) setTopic(data.topic);
      setActiveTab('review');
      setStatusMessage(`Successfully generated ${data.questions.length} questions! Review and edit below.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with AI quiz engine');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyToLiveRoom = async () => {
    if (!roomPin) {
      setErrorMessage('No active game room found. Please create or start a room first.');
      return;
    }
    if (generatedQuestions.length === 0) {
      setErrorMessage('No questions to apply.');
      return;
    }

    setStatusMessage('Applying questions to live game room...');

    // Emit via Socket if connected
    if (socket && socket.connected) {
      socket.emit(
        'apply_custom_questions',
        {
          roomPin,
          questions: generatedQuestions,
          topic: topic || 'OT MSSP Weekly Quiz'
        },
        (resp: any) => {
          if (resp && resp.success) {
            setStatusMessage(`Applied ${resp.configuredQuestionCount} questions to room ${roomPin}!`);
            if (onQuestionsApplied) onQuestionsApplied(resp.configuredQuestionCount);
            setTimeout(() => onClose(), 1200);
          } else {
            setErrorMessage(resp?.message || 'Failed to update live room');
          }
        }
      );
    } else {
      // Fallback to REST
      try {
        const res = await fetch(`${socketUrl}/api/rooms/${roomPin}/apply-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: generatedQuestions,
            topic: topic || 'OT MSSP Weekly Quiz'
          })
        });
        const data = await res.json();
        if (data.success) {
          setStatusMessage(`Applied ${data.count} questions to room ${roomPin}!`);
          if (onQuestionsApplied) onQuestionsApplied(data.count);
          setTimeout(() => onClose(), 1200);
        } else {
          setErrorMessage(data.message || 'Failed to update room');
        }
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleSaveSession = async (isDefault = false) => {
    if (generatedQuestions.length === 0) return;
    try {
      const res = await fetch(`${socketUrl}/api/sessions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'Weekly OT MSSP KT',
          questions: generatedQuestions,
          isDefault
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(isDefault ? 'Saved as permanent default quiz bank!' : 'Weekly session saved successfully!');
      } else {
        setErrorMessage(data.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(generatedQuestions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(topic || 'ot-mssp-quiz').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateQuestionField = (idx: number, field: keyof Question, value: any) => {
    const updated = [...generatedQuestions];
    updated[idx] = { ...updated[idx], [field]: value };
    setGeneratedQuestions(updated);
  };

  const updateOptionText = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...generatedQuestions];
    const newOptions = [...updated[qIdx].options];
    newOptions[optIdx] = text;
    updated[qIdx] = { ...updated[qIdx], options: newOptions };
    setGeneratedQuestions(updated);
  };

  const deleteQuestion = (idx: number) => {
    const filtered = generatedQuestions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, id: i + 1 }));
    setGeneratedQuestions(filtered);
  };

  const addNewQuestion = () => {
    const newQ: Question = {
      id: generatedQuestions.length + 1,
      category: 'Multiple Choice Question',
      type: 'theory',
      question: 'New question on OT security protocol or architecture...',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correctAnswer: 0,
      explanation: 'Detailed technical explanation of the correct answer...',
      visualData: {},
      revealVisual: { vulnerabilitySummary: 'Key security takeaway...' }
    };
    setGeneratedQuestions([...generatedQuestions, newQ]);
    setExpandedIndex(generatedQuestions.length);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[92vh] bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/40">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                OT MSSP AI Quiz Studio & Ingestion Engine
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Gemini Flash & Heuristic
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Transform KT slides (PDF), transcripts, MOMs, or notes into gamified quizzes with automatic gap-filling.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                activeTab === 'upload'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload PDF / Document
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                activeTab === 'paste'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              Paste KT Notes / MOM / Transcript
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                activeTab === 'review'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Layers className="w-4 h-4" />
              Review & Edit Questions ({generatedQuestions.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('sessions');
                loadSavedSessions();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                activeTab === 'sessions'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Saved Weekly Sessions
            </button>
          </div>

          {/* Quick API Key Pill */}
          <div className="flex items-center gap-2 pb-2">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="Optional Gemini API Key"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-36 text-slate-200 placeholder-slate-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-slate-500 hover:text-slate-300"
              >
                {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Messages */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}
          {statusMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* TAB 1: UPLOAD FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              {/* Engine Status & API Key Banner */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">AI Engine Configuration</span>
                  </div>
                  {apiKey.trim() ? (
                    <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1.5 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Gemini 2.5 Flash Active (Full AI Reasoning)
                    </span>
                  ) : (
                    <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700 font-medium">
                      ⚡ Smart Local Extractor (No API Key Required)
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Gemini API Key (Optional):</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs w-full sm:w-64">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Paste AI Studio Key for deep reasoning..."
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-slate-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-slate-500 hover:text-slate-300 ml-1"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-400 hover:underline shrink-0"
                    >
                      Get Free Key &rarr;
                    </a>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 rounded-2xl p-8 text-center transition cursor-pointer relative group">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      if (!topic) {
                        setTopic(e.target.files[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
                      }
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full group-hover:scale-110 transition">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {selectedFile ? selectedFile.name : 'Upload KT Presentation PDF or Document'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports PDF, TXT, Markdown, or MOM files up to 50MB
                    </p>
                  </div>
                  {selectedFile && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for analysis
                    </span>
                  )}
                </div>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">KT Topic Title</label>
                  <input
                    type="text"
                    placeholder="e.g., Modbus TCP & IEC 62443 Security"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Question Count: <span className="text-emerald-400 font-bold">{questionCount}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 mt-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Depth / Target Role</label>
                  <select
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="beginner">Foundational (Concepts & Protocols)</option>
                    <option value="balanced">Balanced (Standard Weekly KT)</option>
                    <option value="advanced">Advanced (Deep Packet / Incident Triage)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !selectedFile}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? 'AI Analyzing & Structuring...' : 'Analyze PDF & Generate Quiz'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PASTE TEXT */}
          {activeTab === 'paste' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Paste KT Summary, MOM, or Raw Transcripts:
                </label>
                <textarea
                  rows={10}
                  placeholder="Paste your meeting notes, speaker talking points, slide texts, or raw Q&A here... Our AI will identify core concepts, generate riddles, crossword clues, fill-in-the-blanks, and complete all missing explanations and options."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 outline-none font-mono"
                />
                <div className="text-right text-[11px] text-slate-500 mt-1">
                  {pastedText.length} characters • {pastedText.split(/\s+/).filter(Boolean).length} words
                </div>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">KT Topic Title</label>
                  <input
                    type="text"
                    placeholder="e.g. SCADA Ransomware Playbook"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Question Count: <span className="text-emerald-400 font-bold">{questionCount}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 mt-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Target Depth</label>
                  <select
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="beginner">Foundational</option>
                    <option value="balanced">Balanced</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !pastedText.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? 'Synthesizing...' : 'Generate Quiz From Text'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: REVIEW & EDIT QUESTIONS */}
          {activeTab === 'review' && (
            <div className="space-y-4">
              {generatedQuestions.length === 0 ? (
                <div className="text-center py-16 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">No questions generated yet</p>
                  <p className="text-xs text-slate-500 mt-1">Upload a PDF or paste KT notes in the tabs above to begin.</p>
                </div>
              ) : (
                <>
                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Topic:</span>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="bg-slate-900 border border-slate-700 px-3 py-1 rounded text-xs text-emerald-400 font-bold focus:border-emerald-500 outline-none"
                      />
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {generatedQuestions.length} Questions
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={addNewQuestion}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Question
                      </button>
                      <button
                        onClick={() => handleSaveSession(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Session
                      </button>
                      <button
                        onClick={handleExportJSON}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export JSON
                      </button>
                      <button
                        onClick={handleApplyToLiveRoom}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold rounded-lg shadow-md transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Apply to Live Room ({roomPin || 'No Room'})
                      </button>
                    </div>
                  </div>

                  {/* Question Cards List */}
                  <div className="space-y-3">
                    {generatedQuestions.map((q, idx) => {
                      const isExpanded = expandedIndex === idx;
                      return (
                        <div
                          key={q.id || idx}
                          className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition"
                        >
                          {/* Card Header */}
                          <div
                            onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                            className="flex items-center justify-between p-3.5 cursor-pointer select-none bg-slate-900/60"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {q.category || q.type}
                              </span>
                              <p className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-xl">
                                {q.question}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteQuestion(idx);
                                }}
                                className="p-1 hover:text-red-400 text-slate-500 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </div>

                          {/* Card Details (Expanded) */}
                          {isExpanded && (
                            <div className="p-4 space-y-4 border-t border-slate-800/80 bg-slate-950/30">
                              {/* Question Text */}
                              <div>
                                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                                  Question / Riddle / Blank Prompt:
                                </label>
                                <textarea
                                  rows={2}
                                  value={q.question}
                                  onChange={(e) => updateQuestionField(idx, 'question', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                                />
                              </div>

                              {/* Options */}
                              <div>
                                <label className="text-[11px] font-bold text-slate-400 block mb-2">
                                  Answer Options (Select Radio for Correct Choice):
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {q.options.map((opt, optIdx) => (
                                    <div
                                      key={optIdx}
                                      className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                                        q.correctAnswer === optIdx
                                          ? 'border-emerald-500 bg-emerald-950/30'
                                          : 'border-slate-800 bg-slate-900/50'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`correct_${idx}`}
                                        checked={q.correctAnswer === optIdx}
                                        onChange={() => updateQuestionField(idx, 'correctAnswer', optIdx)}
                                        className="accent-emerald-500 cursor-pointer"
                                      />
                                      <span className="text-[11px] font-bold text-slate-400 w-4">
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => updateOptionText(idx, optIdx, e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs text-slate-200 w-full"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Explanation */}
                              <div>
                                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                                  Technical Explanation & Vulnerability Impact:
                                </label>
                                <textarea
                                  rows={2}
                                  value={q.explanation}
                                  onChange={(e) => updateQuestionField(idx, 'explanation', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 focus:border-emerald-500 outline-none"
                                />
                              </div>

                              {/* Visual Data Details Preview */}
                              {q.visualData && (
                                <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg text-xs space-y-1">
                                  <div className="flex items-center gap-2 font-bold text-slate-400">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Interactive Visual Schema:</span>
                                    <span className="text-emerald-400 font-mono">[{q.visualData.type || q.type}]</span>
                                  </div>
                                  {q.visualData.crosswordData && (
                                    <p className="text-slate-400">
                                      Crossword Word: <strong className="text-white">{q.visualData.crosswordData.solutionWord}</strong> ({q.visualData.crosswordData.length} letters)
                                    </p>
                                  )}
                                  {q.visualData.fillBlankData && (
                                    <p className="text-slate-400">
                                      Blank Answer: <strong className="text-white">{q.visualData.fillBlankData.blank}</strong>
                                    </p>
                                  )}
                                  {q.visualData.riddleData && (
                                    <p className="text-slate-400">
                                      Riddle Answer: <strong className="text-white">{q.visualData.riddleData.decodedTitle}</strong> • Hint: {q.visualData.riddleData.hint}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: SAVED SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Archived Weekly KT Sessions
                </h3>
                <button
                  onClick={loadSavedSessions}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {savedSessions.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500">
                  No saved sessions found. Once you generate and save weekly sessions, they will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {savedSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-slate-700 transition"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{s.topic}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {s.count} Questions • {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Archived'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`${socketUrl}/api/sessions/list`);
                              // Load session from server
                              setStatusMessage(`Session "${s.topic}" selected.`);
                            } catch (err: any) {
                              setErrorMessage(err.message);
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>OT MSSP Engine Ready (Sub-second real-time sync)</span>
          </div>
          <div>
            <span>Active Room: </span>
            <strong className="text-slate-200">{roomPin || 'None (Create room first)'}</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
