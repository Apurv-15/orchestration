'use client';

import React from 'react';

interface StarkEngineHUDProps {
  currentPhase: number;
  elapsedSeconds: number;
  documentName?: string | null;
  modelName: string;
}

const FILE_NODES = [
  { id: 'spec', name: 'spec_4.0.json', type: 'JSON', color: '#06b6d4', icon: '⚡' },
  { id: 'model', name: 'model_weights.bin', type: 'GGUF', color: '#10b981', icon: '🧠' },
  { id: 'doc', name: 'context_guidelines.pdf', type: 'PDF', color: '#8b5cf6', icon: '📄' },
  { id: 'vector', name: 'embeddings_index.bin', type: 'VEC', color: '#f59e0b', icon: '🕸️' },
];

export const StarkEngineHUD: React.FC<StarkEngineHUDProps> = ({
  currentPhase,
  elapsedSeconds,
  documentName,
  modelName,
}) => {
  return (
    <div className="relative w-full overflow-hidden select-none mb-6">
      <style jsx>{`
        @keyframes laser-flow {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.4;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.8;
          }
        }
        @keyframes scanline {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(1000%);
          }
        }
        .laser-circuit {
          stroke-dasharray: 8 6;
          animation: laser-flow 1.4s linear infinite;
        }
        .laser-fast {
          stroke-dasharray: 12 8;
          animation: laser-flow 0.8s linear infinite;
        }
      `}</style>

      {/* Futuristic Ambient Grid & Corner Reticles */}
      <div className="absolute inset-0 border border-cyan-500/20 rounded-3xl pointer-events-none bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06)_0%,transparent_70%)]">
        {/* Reticle Brackets */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
      </div>

      {/* Floating Holographic File Nodes Header */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        {FILE_NODES.map((node, i) => {
          const isActive = currentPhase >= i;
          const displayName = node.id === 'doc' && documentName ? documentName : node.id === 'model' ? `${modelName}` : node.name;

          return (
            <div
              key={node.id}
              className={`relative flex items-center gap-2.5 p-3 rounded-2xl border backdrop-blur-xl transition-all duration-500 ${
                isActive
                  ? 'bg-cyan-950/40 border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                  : 'bg-black/40 border-white/10 opacity-60'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-mono border ${
                  isActive ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {node.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-400/80">
                    {node.type} NODE
                  </span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                </div>
                <p className="font-mono text-xs font-semibold text-white/90 truncate">{displayName}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Glowing SVG Fiber Optic Laser Circuit Connecting System */}
      <div className="relative w-full h-16 pointer-events-none">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 800 64" fill="none">
          <defs>
            <linearGradient id="cyan-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="purple-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Circuit Lines connecting nodes down into synthesis core */}
          <path d="M100 0 C100 35, 380 20, 380 64" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.3" />
          <path d="M100 0 C100 35, 380 20, 380 64" stroke="url(#cyan-glow)" strokeWidth="2.5" className="laser-circuit" />

          <path d="M300 0 C300 30, 400 30, 400 64" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.3" />
          <path d="M300 0 C300 30, 400 30, 400 64" stroke="#10b981" strokeWidth="2.5" className="laser-fast" />

          <path d="M500 0 C500 30, 400 30, 400 64" stroke="#8b5cf6" strokeWidth="1.5" strokeOpacity="0.3" />
          <path d="M500 0 C500 30, 400 30, 400 64" stroke="url(#purple-glow)" strokeWidth="2.5" className="laser-circuit" />

          <path d="M700 0 C700 35, 420 20, 420 64" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" />
          <path d="M700 0 C700 35, 420 20, 420 64" stroke="#f59e0b" strokeWidth="2.5" className="laser-fast" />

          {/* Central Reactor Convergence Node */}
          <circle cx="400" cy="56" r="6" fill="#06b6d4" className="animate-pulse" />
          <circle cx="400" cy="56" r="14" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="3 3" />
        </svg>
      </div>

      {/* Telemetry Status Bar */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-cyan-500/20 bg-black/50 font-mono text-[10px] text-cyan-300/80">
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>STARK REACTOR BUS: CONNECTED</span>
        </span>
        <span className="text-white/40">CLK: 0x7E3A9F · LATENCY: {elapsedSeconds.toFixed(1)}s</span>
        <span className="text-emerald-400 font-semibold uppercase">STATUS: 10X_SYNTHESIZER_ONLINE</span>
      </div>
    </div>
  );
};
