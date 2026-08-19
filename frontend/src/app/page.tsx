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

  // Control live step progression while thinking
  useEffect(() => {
    if (loading) {
      setCurrentStepIndex(0);
      stepIntervalRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % ORCHESTRATION_PHASES.length);
      }, 2400);
    } else {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    }

    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
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

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

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
          prompt: prompt,
          use_ollama: true,
          model_name: modelName,
          is_rag: isRag,
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
                 <span>
                   {Math.round(((currentStepIndex + 1) / ORCHESTRATION_PHASES.length) * 100)}% Complete
                 </span>
               </div>
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
            {/* Enhanced Prompt Stage */}
            {response.enhanced_prompt && (
              <div className="bg-zinc-950 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80 uppercase tracking-wider">
                    <span>✨</span> Enhanced Prompt (PromptMaster)
                  </div>
                  <button
                    onClick={() => handleCopy(response.enhanced_prompt, 'enhanced_prompt')}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition"
                  >
                    {copiedKey === 'enhanced_prompt' ? '✓ Copied' : '📋 Copy Prompt'}
                  </button>
                </div>
                <div className="text-white/90 text-sm font-mono whitespace-pre-wrap bg-black p-4 rounded-2xl max-h-64 overflow-y-auto overflow-x-hidden border border-white/10 break-words">
                  {response.enhanced_prompt}
                </div>
              </div>
            )}

            {/* Side-by-Side Output Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
              {/* Baseline / Normal Prompt Result */}
              <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between overflow-hidden min-w-0">
                <div className="overflow-hidden">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
                      <span>⚡</span> Standard Output (Raw User Prompt)
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
                  Generated directly from raw user query without PromptMaster
                </div>
              </div>

              {/* Enhanced Prompt Result */}
              <div className="bg-zinc-950 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden min-w-0">
                <div className="overflow-hidden">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white uppercase tracking-wider">
                      <span>🎯</span> Orchnex Enhanced Output
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
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center bg-zinc-900/80 backdrop-blur-3xl border border-white/20 rounded-[2rem] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] focus-within:border-white/40 transition-all duration-300">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              placeholder={loading ? 'Processing response...' : 'Ask anything...'}
              className="w-full bg-transparent px-6 py-3 text-lg text-white placeholder-white/40 focus:outline-none disabled:opacity-50 font-medium"
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
