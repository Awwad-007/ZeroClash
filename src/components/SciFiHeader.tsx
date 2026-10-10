import React from 'react';

export const SciFiHeader: React.FC = () => {
  return (
    <div className="flex flex-col items-center pointer-events-none">
      <div className="relative flex items-center justify-center">
        {/* Decorative sci-fi horizontal guide lines */}
        <div className="hidden sm:block w-16 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-500/80 mr-3" />
        
        {/* Sci-fi bracket frame */}
        <div className="scifi-bracket-frame shadow-[0_0_20px_rgba(0,229,255,0.2)]">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-400/70 font-mono text-xs tracking-tighter">[</span>
            <h1 className="text-sm md:text-base font-semibold tracking-wider uppercase text-slate-100 font-sans drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
              Smart Campus Hub
            </h1>
            <span className="text-cyan-400/70 font-mono text-xs tracking-tighter">]</span>
          </div>
        </div>

        <div className="hidden sm:block w-16 h-[1px] bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-500/80 ml-3" />
      </div>
    </div>
  );
};
