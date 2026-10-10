import React from 'react';

export const StatusLegend: React.FC = () => {
  return (
    <div className="glass-panel rounded-lg px-3.5 py-2.5 max-w-[210px] select-none pointer-events-auto border border-cyan-500/20 shadow-lg">
      <div className="text-[11px] font-mono font-medium text-slate-300 tracking-wider mb-2 flex items-center justify-between">
        <span>Equipment Status</span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span>Available</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#facc15]" />
          <span>Maintenance</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
          <span>In Use / Booked</span>
        </div>
      </div>
    </div>
  );
};
