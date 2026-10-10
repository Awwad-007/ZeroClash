import React, { useState } from 'react';
import { useCampusStore } from '../store/campusStore';
import {
  Wrench,
  ShieldAlert,
  Zap,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const AdminMaintenanceSection: React.FC = () => {
  const currentUser = useCampusStore((s) => s.currentUser);
  const allUsers = useCampusStore((s) => s.allUsers);
  const setCurrentUser = useCampusStore((s) => s.setCurrentUser);
  const equipment = useCampusStore((s) => s.equipment);
  const maintenance = useCampusStore((s) => s.maintenance);
  const auditLogs = useCampusStore((s) => s.auditLogs);
  const setMaintenance = useCampusStore((s) => s.setMaintenance);
  const createBooking = useCampusStore((s) => s.createBooking);

  // Maintenance form inputs
  const [selectedUnitId, setSelectedUnitId] = useState<string>('eq-micro-01');
  const [maintReason, setMaintReason] = useState('Optical Sensor Recalibration & Laser Cleaning');
  const [returnDays, setReturnDays] = useState(1);

  // Concurrency Race Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [raceResults, setRaceResults] = useState<{
    req1: { status: string; user: string; message: string };
    req2: { status: string; user: string; message: string };
    timeTakenMs: number;
  } | null>(null);

  const isAdmin = currentUser.role === 'Lab Admin';

  const handleToggleMaintenance = (unitId: string, currentActive: boolean) => {
    if (currentActive) {
      setMaintenance(unitId, false);
    } else {
      const returnTime = new Date();
      returnTime.setDate(returnTime.getDate() + returnDays);
      setMaintenance(unitId, true, maintReason, returnTime);
    }
  };

  // Live Simultaneous Race Condition Simulation
  const handleSimulateRaceCondition = async () => {
    setIsSimulating(true);
    setRaceResults(null);

    const testUnitId = 'eq-vr-02'; // HTC Vive Focus
    const start = new Date();
    start.setDate(start.getDate() + 2);
    start.setHours(15, 0, 0, 0); // 15:00 - 17:00

    const end = new Date(start);
    end.setHours(17, 0, 0, 0);

    const userFaculty = allUsers.find((u) => u.role === 'Faculty') || allUsers[1];
    const userStudent = allUsers.find((u) => u.role === 'Student') || allUsers[0];

    const startTimeStamp = performance.now();

    // Fire two simultaneous requests for the exact same unit and slot
    const [res1, res2] = await Promise.allSettled([
      useCampusStore.getState().engine.createBooking({
        unitId: testUnitId,
        userId: userFaculty.id,
        userName: userFaculty.name,
        userRole: userFaculty.role,
        startTime: start,
        endTime: end,
        purpose: 'Simulated Concurrent Request Alpha (Faculty)',
      }),
      useCampusStore.getState().engine.createBooking({
        unitId: testUnitId,
        userId: userStudent.id,
        userName: userStudent.name,
        userRole: userStudent.role,
        startTime: start,
        endTime: end,
        purpose: 'Simulated Concurrent Request Beta (Student)',
      }),
    ]);

    const duration = Math.round(performance.now() - startTimeStamp);

    // Refresh state so new booking shows everywhere
    useCampusStore.getState().refreshState();

    setRaceResults({
      req1: {
        status: res1.status === 'fulfilled' ? 'WINNER (200 OK)' : 'REJECTED (409 CONFLICT)',
        user: userFaculty.name,
        message:
          res1.status === 'fulfilled'
            ? 'Lock acquired. Transaction committed.'
            : (res1.reason as Error).message,
      },
      req2: {
        status: res2.status === 'fulfilled' ? 'WINNER (200 OK)' : 'REJECTED (409 CONFLICT)',
        user: userStudent.name,
        message:
          res2.status === 'fulfilled'
            ? 'Lock acquired. Transaction committed.'
            : (res2.reason as Error).message,
      },
      timeTakenMs: duration,
    });

    setIsSimulating(false);
  };

  const adminUser = allUsers.find((u) => u.role === 'Lab Admin') || allUsers[allUsers.length - 1];

  return (
    <section id="admin-section" className="scroll-mt-20 mb-20">
      {/* Header */}
      <div className="pb-4 border-b border-rose-500/20 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 font-mono text-xs uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Administrative Privileges & Concurrency Diagnostics</span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Admin Maintenance Override & Concurrency Lab
          </h3>
          <p className="text-xs text-slate-400">
            Emergency hardware lockout management, automatic booking cancellations, and live race condition testing.
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setCurrentUser(adminUser)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Switch to Lab Admin ({adminUser.name})</span>
          </button>
        )}
      </div>

      {!isAdmin ? (
        <div className="glass-panel p-8 rounded-xl border border-rose-500/30 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-3 opacity-80" />
          <h4 className="text-base font-semibold text-white mb-1">Restricted Administrative Area</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Only users with the <strong className="text-rose-300 font-mono">Lab Admin</strong> role have access
            to hardware lockout controls, telemetry overrides, and the concurrency locking simulator.
          </p>
          <button
            onClick={() => setCurrentUser(adminUser)}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-[0_0_20px_rgba(244,63,94,0.4)] cursor-pointer"
          >
            Assume Lab Admin Role Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Hardware Maintenance Override Controls (7 Cols) */}
          <div className="lg:col-span-7 glass-panel p-5 rounded-xl border border-rose-500/30">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-rose-400" />
              <span>Equipment Maintenance Lockouts</span>
            </h4>

            {/* Units Maintenance Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Unit</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Reason / Return</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {Object.values(equipment).map((u) => {
                    const isMaint = maintenance.some((m) => m.unitId === u.id && m.isActive);
                    const record = maintenance.find((m) => m.unitId === u.id && m.isActive);

                    return (
                      <tr key={u.id} className="hover:bg-slate-900/40">
                        <td className="p-2.5 font-semibold text-white">
                          <div>{u.name} {u.unitNumber}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{u.buildingName}</div>
                        </td>
                        <td className="p-2.5">
                          {isMaint ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                              MAINTENANCE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ONLINE
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-300 font-mono">
                          {isMaint ? (
                            <div>
                              <div className="truncate max-w-[180px]">{record?.reason}</div>
                              <div className="text-[10px] text-amber-400">
                                Return: {record?.expectedReturnTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">Normal Operation</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleToggleMaintenance(u.id, isMaint)}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition cursor-pointer ${
                              isMaint
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            }`}
                          >
                            {isMaint ? 'Return Online' : 'Set Lockout'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick Lockout Configuration */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
              <span className="text-[11px] font-mono text-slate-400 block mb-2">
                Lockout Parameters for New Overrides:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={maintReason}
                  onChange={(e) => setMaintReason(e.target.value)}
                  placeholder="Reason for maintenance..."
                  className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-white"
                />
                <select
                  value={returnDays}
                  onChange={(e) => setReturnDays(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-white"
                >
                  <option value={1}>Expected return: 24 Hours</option>
                  <option value={2}>Expected return: 48 Hours</option>
                  <option value={5}>Expected return: 5 Days</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500">
                Notice: Setting maintenance auto-cancels clashing future bookings and triggers audit logging.
              </p>
            </div>
          </div>

          {/* Concurrency Simulator & Audit Feed (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            {/* Concurrency Lock Simulator */}
            <div className="glass-panel p-5 rounded-xl border border-cyan-500/30 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Race Condition Simulator</span>
                </h4>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                  Transactional Locking
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Fires two concurrent asynchronous checkout requests for the exact same slot. Demonstrates mutex lock serialization.
              </p>

              <button
                onClick={handleSimulateRaceCondition}
                disabled={isSimulating}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-slate-950" />
                <span>{isSimulating ? 'Executing Concurrent Race...' : 'Simulate Simultaneous Double-Booking Race'}</span>
              </button>

              {raceResults && (
                <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs animate-in fade-in font-mono">
                  <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                    <span>EXECUTION RESULTS:</span>
                    <span className="text-cyan-400">{raceResults.timeTakenMs}ms latency</span>
                  </div>

                  {/* Request 1 */}
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 mb-2">
                    <div className="flex justify-between font-bold text-emerald-300 text-[11px]">
                      <span>REQ 1: {raceResults.req1.user}</span>
                      <span>{raceResults.req1.status}</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">{raceResults.req1.message}</div>
                  </div>

                  {/* Request 2 */}
                  <div className="p-2 rounded bg-rose-950/40 border border-rose-500/30">
                    <div className="flex justify-between font-bold text-rose-300 text-[11px]">
                      <span>REQ 2: {raceResults.req2.user}</span>
                      <span>{raceResults.req2.status}</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">{raceResults.req2.message}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Log Stream */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex-1 flex flex-col">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mb-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Engine Audit Trail ({auditLogs.length} events)</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                {auditLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-1.5 rounded bg-slate-950/60 border border-slate-900 text-slate-300">
                    <span className="text-cyan-400">[{log.action}]</span>{' '}
                    <span className="text-slate-400">{log.timestamp.toLocaleTimeString()}:</span>{' '}
                    <span>{log.details}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
