import React, { useState } from 'react';
import { CampusMap } from './features/campus-map';

export function App() {
  const [lastAction, setLastAction] = useState<string>('None');

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-100 flex flex-col">
      {/* Action Notification Banner */}
      {lastAction !== 'None' && (
        <div className="fixed top-20 left-6 z-50 bg-cyan-950/90 border border-cyan-400 px-3 py-1.5 rounded text-xs font-mono text-cyan-300 shadow-lg">
          Last callback: {lastAction}
        </div>
      )}

      {/* 3D Campus Map Hero */}
      <CampusMap
        onBookSlot={(unitId) => setLastAction(`Book Slot triggered for ${unitId}`)}
        onJoinWaitlist={(unitId) => setLastAction(`Join Waitlist triggered for ${unitId}`)}
        onSelectUnit={(unitId) => setLastAction(`Selected Unit: ${unitId}`)}
        onScrollDown={() => {
          document.getElementById('next-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Below the Fold Target Section */}
      <section id="next-section" className="min-h-[50vh] p-12 bg-slate-900 border-t border-cyan-500/20">
        <h2 className="text-xl font-bold font-mono text-cyan-400 mb-2">Host Application Next Section</h2>
        <p className="text-slate-400 text-sm">
          Successfully scrolled into host application view from the 3D Campus Map hero chevron.
        </p>
      </section>
    </div>
  );
}

export default App;
