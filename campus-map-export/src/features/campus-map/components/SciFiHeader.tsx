import React from 'react';
import { useCampusStore } from '../store/campusStore';
import { ConnectionStatus } from '../types';

interface SciFiHeaderProps {
  title?: string;
  connectionStatus?: ConnectionStatus;
}

export const SciFiHeader: React.FC<SciFiHeaderProps> = ({
  title = 'Smart Campus Hub',
  connectionStatus: propConnectionStatus,
}) => {
  const storeConnectionStatus = useCampusStore((s) => s.connectionStatus);
  const connectionStatus = propConnectionStatus || storeConnectionStatus;

  const getPill = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          label: 'LIVE',
          sub: 'Sync Active',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
          dotClass: 'bg-emerald-400 animate-pulse',
        };
      case 'reconnecting':
        return {
          label: 'RECONNECTING',
          sub: 'Retrying',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
          dotClass: 'bg-amber-400 animate-ping',
        };
      case 'disconnected':
        return {
          label: 'OFFLINE',
          sub: 'Disconnected',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dotClass: 'bg-rose-400',
        };
      case 'local':
      default:
        return {
          label: 'OFFLINE',
          sub: 'Standalone',
          badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700/60 shadow-[0_0_8px_rgba(148,163,184,0.15)]',
          dotClass: 'bg-slate-400',
        };
    }
  };

  const pill = getPill();

  return (
    <div className="flex flex-col items-center pointer-events-none">
      <div className="relative flex items-center justify-center">
        {/* Decorative sci-fi horizontal guide lines */}
        <div className="hidden sm:block w-10 md:w-16 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-500/80 mr-3" />

        {/* Sci-fi bracket frame */}
        <div className="scifi-bracket-frame shadow-[0_0_20px_rgba(0,229,255,0.2)]">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-400/70 font-mono text-xs tracking-tighter">[</span>
            <h1 className="text-sm md:text-base font-semibold tracking-wider uppercase text-slate-100 font-sans drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
              {title}
            </h1>
            <span className="text-cyan-400/70 font-mono text-xs tracking-tighter">]</span>
          </div>
        </div>

        {/* Connection Health Pill */}
        <div
          title={`Connection status: ${pill.label} (${pill.sub})`}
          className={`pointer-events-auto ml-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono tracking-wider backdrop-blur-md transition-all ${pill.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${pill.dotClass}`} />
          <span className="font-semibold">{pill.label}</span>
          <span className="text-[9px] opacity-75 hidden md:inline">({pill.sub})</span>
        </div>

        <div className="hidden sm:block w-10 md:w-16 h-[1px] bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-500/80 ml-3" />
      </div>
    </div>
  );
};
