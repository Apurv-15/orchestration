'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';

// Dynamically import WebGL Plasma component to ensure it renders purely client-side
const Plasma = dynamic(() => import('./components/Plasma'), { ssr: false });

const ORCHESTRATION_PHASES = [
  { title: 'Architecting specification...', sub: 'Deconstructing intent & mapping constraints' },
  { title: 'Grounding context & patterns...', sub: 'Scanning workspace & framework patterns' },
  { title: 'Cooking up optimal prompt...', sub: 'Executing PromptMaster 4.0 reasoning engine' },
  { title: 'Running dual generation...', sub: 'Synthesizing 10x-quality deliverable' },
  { title: 'Validating & verifying claims...', sub: 'Evaluating quality gates & NLI facts' }
];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [modelName, setModelName] = useState('qwen3:1.7b');
  const [isRag, setIsRag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalExecutionTime, setTotalExecutionTime] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Control live step progression & real-time execution stopwatch timer
  useEffect(() => {
    if (loading) {
      setCurrentStepIndex(0);
      setElapsedSeconds(0);
      setTotalExecutionTime(null);
      startTimeRef.current = Date.now();

      stepIntervalRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % ORCHESTRATION_PHASES.length);
      }, 2400);

      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);
    } else {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (startTimeRef.current) {
        setTotalExecutionTime((Date.now() - startTimeRef.current) / 1000);
      }
    }

    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [loading]);

  // Control video playback speed & smooth Apple-style decelerated stop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (loading) {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      video.playbackRate = 1.0;
      video.play().catch((err) => console.log('Video playback error:', err));
    } else {
      if (!video.paused) {
        let currentRate = video.playbackRate;
        fadeIntervalRef.current = setInterval(() => {
          if (currentRate > 0.35) {
            currentRate -= 0.1;
            try {
              video.playbackRate = Math.max(0.25, currentRate);
            } catch (e) {
              video.pause();
              if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            }
          } else {
            video.pause();
            try {
              video.playbackRate = 1.0;
            } catch (e) {}
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          }
        }, 60);
      }
    }

    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, [loading]);

  const [attachedDoc, setAttachedDoc] = useState<{ name: string; text: string } | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.endsWith('.pdf')) {
      setError('Please upload a valid .pdf document');
      return;
    }
    setIsUploadingDoc(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to upload PDF document');
      }

      const data = await res.json();
      setAttachedDoc({ name: data.filename, text: data.extracted_text });
    } catch (err: any) {
      setError(err.message || 'Error uploading and parsing PDF file');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const [submittedQuery, setSubmittedQuery] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = prompt.trim();
    if (!query || loading) return;

    setSubmittedQuery(query);
    setPrompt('');
    setLoading(true);
    setError(null);
    setResponse(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('http://localhost:8000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: query,
          use_ollama: true,
          model_name: modelName,
          is_rag: isRag,
          document_text: attachedDoc?.text,
          document_name: attachedDoc?.name,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate output');
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Generation stopped by user.');
      } else {
        setError(
          err.message || 'Connecting server failed. Ensure FastAPI server is running on http://localhost:8000'
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <main className="w-full min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-white/20">
      
      {/* Pure Solid Black Background */}

      {/* Top Floating Glass Nav Bar for Model Settings */}
      <header className="w-full flex items-center justify-between z-10 max-w-7xl mx-auto p-6 absolute top-0 left-0 right-0">
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-2 rounded-full shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-xs tracking-wide text-white uppercase opacity-90">Orchnex Engine</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/15 px-3.5 py-1.5 rounded-full text-xs text-white/90">
            <span>Model:</span>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="bg-transparent border-none text-xs font-mono text-white focus:outline-none w-20 text-center"
              placeholder="model"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-white/10 backdrop-blur-xl border border-white/15 px-3.5 py-1.5 rounded-full hover:bg-white/20 transition text-xs text-white font-medium">
            <input
              type="checkbox"
              checked={isRag}
              onChange={(e) => setIsRag(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-white focus:ring-0 bg-black/40 border-white/20"
            />
            <span>RAG Mode</span>
          </label>
        </div>
      </header>

      {/* Hero Body Content */}
      <div className="w-full max-w-5xl mx-auto z-10 flex flex-col items-center flex-1 justify-center py-20 pointer-events-none">
        
        {/* Glowing Orb Center Video Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-[400px] md:h-[400px] mb-8 flex items-center justify-center transition-all duration-700 pointer-events-auto">
          <video
            ref={videoRef}
            src="/Ai_home_video.mp4"
            muted
            loop
            playsInline
            className={`w-full h-full object-contain rounded-full relative z-10 transition-all duration-700 ${
              loading
                ? 'scale-110 opacity-100'
                : 'scale-100 opacity-95'
            }`}
          />
        </div>

        {/* Dynamic Title & Real-time Single Pro Progress Bar */}
        <div className="text-center space-y-4 z-10 pointer-events-auto max-w-lg mx-auto w-full px-4">
          <p className="text-white/60 text-sm font-medium uppercase tracking-widest">
            Orchnex Intelligence
          </p>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white transition-all duration-300">
            {loading ? (
              <span className="inline-block animate-pulse">
                {ORCHESTRATION_PHASES[currentStepIndex].title}
              </span>
            ) : response ? (
              'Here is what I found.'
            ) : (
              'How can I help you today?'
            )}
          </h1>

          {submittedQuery && (
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/80 max-w-md mx-auto backdrop-blur-md">
              <span className="text-emerald-400 font-semibold">Prompt:</span>
              <span className="truncate max-w-[280px]">{submittedQuery}</span>
            </div>
          )}
          
          {loading && (
             <div className="w-full space-y-3 pt-2 animate-fadeIn">
               {/* Subtitle / Cooking detail */}
               <p className="text-xs sm:text-sm text-white/70 font-normal">
                 {ORCHESTRATION_PHASES[currentStepIndex].sub}
               </p>

               {/* Single Sleek Pro Glassmorphic Progress Bar */}
               <div className="relative w-full bg-white/5 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/15 backdrop-blur-xl shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                 <div 
                   className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all duration-700 ease-out shadow-[0_0_16px_rgba(52,211,153,0.6)]"
                   style={{ width: `${((currentStepIndex + 1) / ORCHESTRATION_PHASES.length) * 100}%` }}
                 />
               </div>

               {/* Progress Status Footer */}
               <div className="flex items-center justify-between text-[11px] text-white/50 px-1 font-mono">
                 <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                   Phase {currentStepIndex + 1} of {ORCHESTRATION_PHASES.length}
                 </span>
                 <span className="flex items-center gap-2">
                   <span className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                     ⏱️ {elapsedSeconds.toFixed(1)}s
                   </span>
                   <span>
                     ({Math.round(((currentStepIndex + 1) / ORCHESTRATION_PHASES.length) * 100)}%)
                   </span>
                 </span>
               </div>
             </div>
          )}

          {totalExecutionTime !== null && !loading && response && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 backdrop-blur-md animate-fadeIn">
              <span>⚡ Pipeline Completed in <strong>{totalExecutionTime.toFixed(1)}s</strong></span>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full max-w-2xl bg-zinc-900 border border-red-500/50 rounded-2xl p-4 mt-8 text-red-200 text-sm text-center backdrop-blur-xl shadow-xl z-10 pointer-events-auto">
            ⚠️ {error}
          </div>
        )}

        {/* Output Presentation Container */}
        {response && (
          <div className="w-full max-w-7xl mt-12 space-y-6 animate-fadeIn transition-all z-10 pointer-events-auto px-4">
            {/* Side-by-Side Output Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
              {/* Baseline / Normal Prompt Result */}
              <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between overflow-hidden min-w-0">
                <div className="overflow-hidden">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
                      <span>⚡</span> Raw Output
                    </div>
                    <button
                      onClick={() => handleCopy(response.raw_result || '', 'raw_result')}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition shrink-0"
                    >
                      {copiedKey === 'raw_result' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <div className="text-white/85 text-[14px] leading-relaxed selection:bg-white/20 markdown-content overflow-x-auto max-h-[600px] overflow-y-auto pr-2 break-words">
                    <ReactMarkdown>{response.raw_result || 'Standard response unavailable'}</ReactMarkdown>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-white/40 italic">
                  Generated directly from raw user query
                </div>
              </div>

              {/* Enhanced Prompt Result */}
              <div className="bg-zinc-950 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden min-w-0">
                <div className="overflow-hidden">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white uppercase tracking-wider">
                      <span>🎯</span> Enhanced Output
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCopy(response.final_result || response.final_answer || '', 'final_result')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                      >
                        {copiedKey === 'final_result' ? '✓ Copied' : '📋 Copy'}
                      </button>
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        10x Quality
                      </span>
                    </div>
                  </div>
                  <div className="text-white/95 text-[14px] leading-relaxed selection:bg-white/30 markdown-content overflow-x-auto max-h-[600px] overflow-y-auto pr-2 break-words">
                    <ReactMarkdown>{response.final_result || response.final_answer}</ReactMarkdown>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-emerald-400/70 font-medium flex items-center gap-1">
                  <span>✨</span> Powered by PromptMaster 4.0 Spec Optimization
                </div>
              </div>
            </div>

            {/* Hallucination Detector (Per-Claim NLI) Breakdown */}
            {response.hallucination_check && (
              <div className="bg-zinc-950 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80 uppercase tracking-wider">
                    <span>🛡️</span> Hallucination Check (Per-Claim NLI)
                  </div>
                  <span
                    className={`px-3 py-0.5 text-xs font-medium rounded-full ${
                      response.hallucination_check.hallucination_detected
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {response.hallucination_check.hallucination_detected
                      ? 'Gaps / Unverified Claims Detected'
                      : 'No Hallucinations Detected'}
                  </span>
                </div>

                {/* Claims list */}
                <div className="space-y-2">
                  {response.hallucination_check.claims?.map((c: any, i: number) => (
                    <div
                      key={i}
                      className="bg-black border border-white/10 rounded-2xl p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/90">
                          {c.claim}
                        </p>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            c.verdict === 'SUPPORTED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                              : c.verdict === 'CONTRADICTED'
                              ? 'bg-red-950 text-red-400 border border-red-800/80'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/80'
                          }`}
                        >
                          {c.verdict}
                        </span>
                      </div>
                      {c.explanation && (
                        <p className="text-xs text-white/50 italic">
                          {c.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Width Desktop Bottom Floating Bar */}
      <footer className="w-full max-w-4xl mx-auto sticky bottom-8 z-20 px-4">
        {/* Hidden File Input for PDF Guidelines */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        {/* Attached Document Indicator Chip */}
        {attachedDoc && (
          <div className="mb-2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono w-fit backdrop-blur-xl animate-fadeIn">
            <span>📄 Attached Guidelines: {attachedDoc.name} ({attachedDoc.text.length} chars)</span>
            <button
              type="button"
              onClick={() => setAttachedDoc(null)}
              className="ml-2 hover:text-white font-bold text-sm"
              title="Remove document"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center bg-zinc-900/80 backdrop-blur-3xl border border-white/20 rounded-[2rem] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] focus-within:border-white/40 transition-all duration-300">
            {/* PDF Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploadingDoc}
              className={`p-3 rounded-full transition-all duration-300 flex items-center justify-center ml-1 shrink-0 ${
                attachedDoc
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Attach Company Guidelines PDF"
            >
              {isUploadingDoc ? (
                <span className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>

            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              disabled={loading}
              placeholder={loading ? 'Processing response...' : attachedDoc ? `Ask using ${attachedDoc.name}...` : 'Ask anything... (Press Enter or attach PDF)'}
              className="w-full bg-transparent px-4 py-3 text-lg text-white placeholder-white/40 focus:outline-none disabled:opacity-50 font-medium"
            />

            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-3.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all duration-300 flex items-center justify-center mr-2 group shrink-0"
                title="Stop generation"
              >
                <div className="w-4 h-4 bg-red-400 rounded-sm group-hover:scale-95 transition-transform" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim()}
                className={`p-4 rounded-full transition-all duration-300 flex items-center justify-center mr-2 ${
                  !prompt.trim()
                    ? 'text-white/30 cursor-not-allowed'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            )}
          </div>
        </form>
      </footer>
    </main>
  );
}
