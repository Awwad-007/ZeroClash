import React from 'react';
import { CampusCanvas } from './scene/CampusCanvas';
import { SciFiHeader } from './components/SciFiHeader';
import { SearchBar } from './components/SearchBar';
import { EquipmentModal } from './components/EquipmentModal';
import { StatusLegend } from './components/StatusLegend';
import { ViewportControls } from './components/ViewportControls';
import { ScrollIndicator } from './components/ScrollIndicator';
import { AnalyticsSection } from './components/AnalyticsSection';
import { UserSwitcher } from './components/UserSwitcher';
import { MyBookingsDrawer } from './components/MyBookingsDrawer';
import { AuthModal } from './components/AuthModal';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-100 flex flex-col font-sans select-none">
      {/* Global Toast Alerts */}
      <ToastContainer />

      {/* Slide-out My Bookings Drawer */}
      <MyBookingsDrawer />

      {/* Real Authentication & Role Modal */}
      <AuthModal />

      {/* 100vh Hero Section */}
      <section className="relative w-full h-screen overflow-hidden">
        {/* 3D Isometric Digital Twin Canvas */}
        <div className="absolute inset-0 z-0">
          <ErrorBoundary>
            <CampusCanvas />
          </ErrorBoundary>
        </div>

        {/* Top Header UI Overlay */}
        <header className="absolute top-4 inset-x-0 z-30 pointer-events-none px-4 md:px-8">
          <div className="flex items-center justify-between mb-2">
            {/* Left brand badge */}
            <div className="pointer-events-auto flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/25 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[11px] font-mono tracking-wider text-cyan-300 font-semibold">
                ZeroClash <span className="text-slate-400 font-normal">v2.4</span>
              </span>
            </div>

            {/* Center bracket title */}
            <div className="flex-1 flex justify-center">
              <SciFiHeader />
            </div>

            {/* Right: User Switcher & My Bookings trigger */}
            <div className="pointer-events-auto flex items-center justify-end">
              <UserSwitcher />
            </div>
          </div>

          {/* Search bar below top bar */}
          <div className="pointer-events-auto w-full flex justify-center mt-1">
            <SearchBar />
          </div>
        </header>

        {/* Modal Overlay: Glassmorphic anchored inspection card with live booking flow */}
        <EquipmentModal />

        {/* Bottom Left UI Overlay: Equipment Status Legend */}
        <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
          <StatusLegend />
        </div>

        {/* Bottom Center UI Overlay: Scroll Down to Analytics Indicator */}
        <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none">
          <ScrollIndicator />
        </div>

        {/* Bottom Right UI Overlay: Zoom controls, layers toggle, sci-fi sparkle */}
        <div className="absolute bottom-6 right-6 z-20 pointer-events-none">
          <ViewportControls />
        </div>
      </section>

      {/* Below the Fold Section: Gantt, Heatmap, Waitlist, Admin Overrides */}
      <AnalyticsSection />
    </div>
  );
};

export default App;
