import React from 'react';
import { Calendar, BarChart3, Users, Settings } from 'lucide-react';

export const AnalyticsPlaceholder: React.FC = () => {
  return (
    <section
      id="analytics"
      className="min-h-screen bg-[#030712] text-slate-100 py-16 px-6 md:px-12 border-t border-cyan-500/20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-2">
            Tier B · Below the Fold Architecture
          </span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
            Analytics & Booking Intelligence
          </h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Real-time conflict detection engine, automated waitlist promotion cascades, and demand forecasting modules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 hover:border-cyan-500/50 transition">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Gantt Calendar</h3>
            <p className="text-xs text-slate-400">
              Interactive timeline with interval overlap collision detection and drag-to-select booking.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 hover:border-cyan-500/50 transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Demand Forecasting</h3>
            <p className="text-xs text-slate-400">
              Moving-average predictive models and facility utilization heatmaps.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 hover:border-cyan-500/50 transition">
            <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Waitlist Cascade</h3>
            <p className="text-xs text-slate-400">
              Dynamic multi-factor priority scoring and automated 10-minute slot re-allocation holds.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 hover:border-cyan-500/50 transition">
            <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Admin Override</h3>
            <p className="text-xs text-slate-400">
              Maintenance mode management and concurrency row lock diagnostics.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
