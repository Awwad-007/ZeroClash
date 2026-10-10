import React from 'react';
import { CampusCanvas } from './scene/CampusCanvas';
import { SciFiHeader } from './components/SciFiHeader';
import { SearchBar } from './components/SearchBar';
import { EquipmentModal } from './components/EquipmentModal';
import { StatusLegend } from './components/StatusLegend';
import { ViewportControls } from './components/ViewportControls';
import { ScrollIndicator } from './components/ScrollIndicator';
import { AnalyticsPlaceholder } from './components/AnalyticsPlaceholder';

import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-100 flex flex-col font-sans select-none">
      {/* 100vh Hero Section */}
      <section className="relative w-full h-screen overflow-hidden">
        {/* 3D Isometric Digital Twin Canvas */}
        <div className="absolute inset-0 z-0">
          <ErrorBoundary>
            <CampusCanvas />
          </ErrorBoundary>
        </div>

        {/* Top Center UI Overlay: Sci-fi Bracket Frame Title + Glowing Search Bar */}
        <header className="absolute top-5 inset-x-0 z-30 flex flex-col items-center pointer-events-none px-4">
          <SciFiHeader />
          <div className="pointer-events-auto w-full flex justify-center">
            <SearchBar />
          </div>
        </header>

        {/* Modal Overlay: Glassmorphic anchored inspection card */}
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

      {/* Below the Fold Section */}
      <AnalyticsPlaceholder />
    </div>
  );
};

export default App;
