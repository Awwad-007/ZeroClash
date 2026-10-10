import React from 'react';
import { ZoomIn, ZoomOut, Layers, Grid, Sparkles } from 'lucide-react';
import { useCampusStore } from '../store/campusStore';

export const ViewportControls: React.FC = () => {
  const zoomIn = useCampusStore((s) => s.zoomIn);
  const zoomOut = useCampusStore((s) => s.zoomOut);
  const toggleGrid = useCampusStore((s) => s.toggleGrid);
  const toggleWireframe = useCampusStore((s) => s.toggleWireframe);
  const showGrid = useCampusStore((s) => s.showGrid);
  const wireframeOnly = useCampusStore((s) => s.wireframeOnly);

  return (
    <div className="flex flex-col items-end space-y-3 pointer-events-auto select-none">
      {/* Sci-fi Sparkle Accent Star (matching IMAGE 2 bottom-right) */}
      <div className="pr-1 animate-pulse-slow text-cyan-300/80 drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]">
        <svg
          viewBox="0 0 24 24"
          className="w-8 h-8 fill-cyan-400 stroke-cyan-200"
          strokeWidth="0.5"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
        </svg>
      </div>

      {/* Control Buttons Grid */}
      <div className="flex items-center space-x-2">
        {/* Zoom In Button */}
        <button
          type="button"
          onClick={zoomIn}
          className="glass-panel p-2.5 rounded-lg text-slate-300 hover:text-cyan-400 hover:border-cyan-400/50 transition-all shadow-md active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={zoomOut}
          className="glass-panel p-2.5 rounded-lg text-slate-300 hover:text-cyan-400 hover:border-cyan-400/50 transition-all shadow-md active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {/* Wireframe / Solid Layers Toggle */}
        <button
          type="button"
          onClick={toggleWireframe}
          className={`glass-panel p-2.5 rounded-lg transition-all shadow-md active:scale-95 ${
            wireframeOnly
              ? 'text-cyan-400 border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-300 hover:text-cyan-400 hover:border-cyan-400/50'
          }`}
          title="Toggle Wireframe Layers"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Isometric Grid Toggle */}
        <button
          type="button"
          onClick={toggleGrid}
          className={`glass-panel p-2.5 rounded-lg transition-all shadow-md active:scale-95 ${
            showGrid
              ? 'text-cyan-400 border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Isometric Grid"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
