import React from 'react';
import { Search, X } from 'lucide-react';
import { useCampusStore } from '../store/campusStore';

export const SearchBar: React.FC = () => {
  const searchQuery = useCampusStore((s) => s.searchQuery);
  const setSearchQuery = useCampusStore((s) => s.setSearchQuery);
  const matchingUnitIds = useCampusStore((s) => s.matchingUnitIds);

  return (
    <div className="w-full max-w-xl mx-auto px-4 mt-3">
      <div className="relative flex items-center group">
        {/* Glow halo */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 via-sky-500/30 to-blue-500/20 rounded-full blur-sm opacity-70 group-hover:opacity-100 transition duration-300" />
        
        {/* Search input container */}
        <div className="relative w-full flex items-center bg-[#071324]/85 backdrop-blur-md border border-cyan-500/30 rounded-full px-4 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-200 focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(0,229,255,0.25)]">
          <Search className="w-4 h-4 text-cyan-400 mr-3 shrink-0" />
          
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment (e.g. Sony Camera, Lab GPU, 3D Printer)..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400/70 focus:outline-none font-sans tracking-wide"
          />

          {searchQuery && (
            <div className="flex items-center space-x-2 shrink-0 ml-2">
              <span className="text-[11px] font-mono text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40">
                {matchingUnitIds.length} match{matchingUnitIds.length === 1 ? '' : 'es'}
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-800/60 transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
