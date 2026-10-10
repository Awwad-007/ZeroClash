import React, { useEffect } from 'react';
import { CampusCanvas } from './scene/CampusCanvas';
import { SciFiHeader } from './components/SciFiHeader';
import { SearchBar } from './components/SearchBar';
import { EquipmentModal } from './components/EquipmentModal';
import { StatusLegend } from './components/StatusLegend';
import { ViewportControls } from './components/ViewportControls';
import { ScrollIndicator } from './components/ScrollIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCampusStore } from './store/campusStore';
import { CampusMapProps } from './types';
import { MOCK_BUILDINGS, MOCK_EQUIPMENT } from './mockData';

export const CampusMap: React.FC<CampusMapProps> = ({
  buildings,
  equipment,
  onBookSlot,
  onJoinWaitlist,
  onSelectUnit,
  onScrollDown,
  className = '',
  title = 'Smart Campus Hub',
  badgeText = 'ZeroClash v2.4',
  connectionStatus,
  showHeader = true,
  showLegend = true,
  showControls = true,
  showScrollIndicator = true,
}) => {
  const setBuildings = useCampusStore((s) => s.setBuildings);
  const setEquipment = useCampusStore((s) => s.setEquipment);
  const setConnectionStatus = useCampusStore((s) => s.setConnectionStatus);

  // Sync external buildings prop into store (fallback to mockData if undefined)
  useEffect(() => {
    if (buildings && buildings.length > 0) {
      setBuildings(buildings);
    } else {
      setBuildings(MOCK_BUILDINGS);
    }
  }, [buildings, setBuildings]);

  // Sync external equipment prop into store (fallback to mockData if undefined)
  useEffect(() => {
    if (equipment) {
      setEquipment(equipment);
    } else {
      setEquipment(MOCK_EQUIPMENT);
    }
  }, [equipment, setEquipment]);

  // Sync external connectionStatus prop into store if provided
  useEffect(() => {
    if (connectionStatus) {
      setConnectionStatus(connectionStatus);
    }
  }, [connectionStatus, setConnectionStatus]);

  return (
    <section
      className={`relative w-full h-screen overflow-hidden bg-[#050B14] text-slate-100 select-none ${className}`}
    >
      {/* 3D Isometric Digital Twin Canvas */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary>
          <CampusCanvas onSelectUnit={onSelectUnit} />
        </ErrorBoundary>
      </div>

      {/* Top Header UI Overlay */}
      {showHeader && (
        <header className="absolute top-4 inset-x-0 z-30 pointer-events-none px-4 md:px-8">
          <div className="flex items-center justify-between mb-2">
            {/* Left brand badge */}
            <div className="pointer-events-auto flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/25 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[11px] font-mono tracking-wider text-cyan-300 font-semibold">
                {badgeText}
              </span>
            </div>

            {/* Center bracket title */}
            <div className="flex-1 flex justify-center">
              <SciFiHeader title={title} connectionStatus={connectionStatus} />
            </div>

            {/* Right placeholder to balance flex row */}
            <div className="w-[120px] hidden md:block" />
          </div>

          {/* Search bar below top bar */}
          <div className="pointer-events-auto w-full flex justify-center mt-1">
            <SearchBar />
          </div>
        </header>
      )}

      {/* Modal Overlay: Glassmorphic inspection card */}
      <EquipmentModal
        onBookSlot={onBookSlot}
        onJoinWaitlist={onJoinWaitlist}
      />

      {/* Bottom Left UI Overlay: Status Legend */}
      {showLegend && (
        <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
          <StatusLegend />
        </div>
      )}

      {/* Bottom Center UI Overlay: Scroll Down Indicator */}
      {showScrollIndicator && (
        <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none">
          <ScrollIndicator onScrollDown={onScrollDown} />
        </div>
      )}

      {/* Bottom Right UI Overlay: Viewport Controls */}
      {showControls && (
        <div className="absolute bottom-6 right-6 z-20 pointer-events-none">
          <ViewportControls />
        </div>
      )}
    </section>
  );
};

export default CampusMap;
