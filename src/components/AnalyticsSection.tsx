import React, { useState, useEffect } from 'react';
import { GanttSection } from './GanttSection';
import { HeatmapForecastSection } from './HeatmapForecastSection';
import { WaitlistTableSection } from './WaitlistTableSection';
import { AdminMaintenanceSection } from './AdminMaintenanceSection';
import { Calendar, BarChart3, Users, ShieldAlert, ArrowUp, Zap, Sparkles } from 'lucide-react';

export const AnalyticsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gantt' | 'heatmap' | 'waitlist' | 'admin'>('gantt');

  const scrollToHero = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    { id: 'gantt', label: 'Gantt Timeline', href: '#gantt-section', icon: Calendar },
    { id: 'heatmap', label: 'Heatmap & Forecast', href: '#heatmap-section', icon: BarChart3 },
    { id: 'waitlist', label: 'Waitlist Matrix', href: '#waitlist-section', icon: Users },
    { id: 'admin', label: 'Admin Overrides & Concurrency', href: '#admin-section', icon: ShieldAlert },
  ];

  return (
    <section
      id="analytics"
      className="min-h-screen bg-[#030712] text-slate-100 py-10 px-4 md:px-12 border-t border-cyan-500/20 relative"
    >
      <div className="max-w-7xl mx-auto">
        {/* Sticky Mini Navigation Bar */}
        <div className="sticky top-4 z-40 mb-10 p-2 rounded-2xl bg-slate-950/90 border border-cyan-500/30 backdrop-blur-xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center space-x-1 overflow-x-auto py-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition shrink-0 ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>

          <div className="hidden md:flex items-center space-x-3 shrink-0 ml-2">
            <span className="flex items-center space-x-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE ENGINE SYNC</span>
            </span>

            <button
              onClick={scrollToHero}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 transition"
              title="Return to 3D Map"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Hero Twin</span>
            </button>
          </div>
        </div>

        {/* Section 1: Gantt Calendar */}
        <GanttSection />

        {/* Section 2: Heatmap & Forecast */}
        <HeatmapForecastSection />

        {/* Section 3: Conflict & Waitlist Priority Table */}
        <WaitlistTableSection />

        {/* Section 4: Admin Maintenance & Concurrency Lab */}
        <AdminMaintenanceSection />
      </div>
    </section>
  );
};
