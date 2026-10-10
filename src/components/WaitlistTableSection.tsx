import React, { useState, useMemo } from 'react';
import { useCampusStore } from '../store/campusStore';
import { WaitlistEntry, UserRole } from '../types';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';

export const WaitlistTableSection: React.FC = () => {
  const waitlist = useCampusStore((s) => s.waitlist);
  const bookings = useCampusStore((s) => s.bookings);
  const holds = useCampusStore((s) => s.holds);
  const equipment = useCampusStore((s) => s.equipment);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'priority' | 'time' | 'name'>('priority');
  const [sortAsc, setSortAsc] = useState(false);

  // Selected unit for Queue Cascade visual
  const [cascadeUnitId, setCascadeUnitId] = useState<string>('eq-gpu-01');

  // Combined requests list (Waitlist entries + active Bookings to show all demand requests)
  interface RequestRow {
    id: string;
    userName: string;
    userRole: UserRole;
    unitId: string;
    startTime: Date;
    endTime: Date;
    priorityScore: number;
    scoreBreakdown?: {
      roleScore: number;
      urgencyScore: number;
      reliabilityScore: number;
    };
    status: 'Confirmed' | 'Waitlisted' | 'On Hold' | 'Expired' | 'Cancelled';
    purpose: string;
    holdExpiresAt?: Date;
  }

  const allRequests: RequestRow[] = useMemo(() => {
    const list: RequestRow[] = [];

    // From waitlist
    for (const w of waitlist) {
      let st: RequestRow['status'] = 'Waitlisted';
      if (w.status === 'on_hold') st = 'On Hold';
      else if (w.status === 'promoted') st = 'Confirmed';
      else if (w.status === 'expired') st = 'Expired';
      else if (w.status === 'cancelled') st = 'Cancelled';

      list.push({
        id: w.id,
        userName: w.userName,
        userRole: w.userRole,
        unitId: w.unitId,
        startTime: w.startTime,
        endTime: w.endTime,
        priorityScore: w.priorityScore,
        scoreBreakdown: w.scoreBreakdown,
        status: st,
        purpose: w.purpose,
        holdExpiresAt: w.holdExpiresAt,
      });
    }

    // From bookings (Confirmed)
    for (const b of bookings) {
      // Avoid duplication if already in list from waitlist promotion
      if (!list.some((r) => r.id === b.id)) {
        list.push({
          id: b.id,
          userName: b.userName,
          userRole: b.userRole,
          unitId: b.unitId,
          startTime: b.startTime,
          endTime: b.endTime,
          priorityScore: b.userRole === 'Faculty' ? 95 : b.userRole === 'Researcher' ? 88 : 72,
          status: b.status === 'active' ? 'Confirmed' : 'Cancelled',
          purpose: b.purpose,
        });
      }
    }

    return list;
  }, [waitlist, bookings]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    return allRequests
      .filter((row) => {
        const q = searchQuery.toLowerCase().trim();
        const matchQ =
          !q ||
          row.userName.toLowerCase().includes(q) ||
          row.purpose.toLowerCase().includes(q) ||
          row.id.toLowerCase().includes(q) ||
          (equipment[row.unitId]?.name || '').toLowerCase().includes(q);

        const matchRole = roleFilter === 'all' || row.userRole === roleFilter;
        const matchStatus = statusFilter === 'all' || row.status === statusFilter;

        return matchQ && matchRole && matchStatus;
      })
      .sort((a, b) => {
        if (sortField === 'priority') {
          return sortAsc ? a.priorityScore - b.priorityScore : b.priorityScore - a.priorityScore;
        } else if (sortField === 'time') {
          return sortAsc
            ? a.startTime.getTime() - b.startTime.getTime()
            : b.startTime.getTime() - a.startTime.getTime();
        } else {
          return sortAsc
            ? a.userName.localeCompare(b.userName)
            : b.userName.localeCompare(a.userName);
        }
      });
  }, [allRequests, searchQuery, roleFilter, statusFilter, sortField, sortAsc, equipment]);

  // Unit Queue Cascade calculations
  const unitCascadeCandidates = useMemo(() => {
    return waitlist
      .filter((w) => w.unitId === cascadeUnitId && (w.status === 'waiting' || w.status === 'on_hold'))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [waitlist, cascadeUnitId]);

  return (
    <section id="waitlist-section" className="scroll-mt-20 mb-16">
      {/* Header */}
      <div className="pb-4 border-b border-cyan-500/20 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Priority Queue & Cascade Dynamics</span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Conflict & Waitlist Matrix
          </h3>
          <p className="text-xs text-slate-400">
            Multi-factor priority ranking, automated 10-minute hold countdowns, and real-time reassignment cascades.
          </p>
        </div>

        {/* Cascade Visual Unit Selector */}
        <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Inspect Cascade:</span>
          <select
            value={cascadeUnitId}
            onChange={(e) => setCascadeUnitId(e.target.value)}
            className="bg-transparent text-cyan-300 font-mono font-semibold outline-none cursor-pointer"
          >
            {Object.values(equipment).map((u) => (
              <option key={u.id} value={u.id} className="bg-slate-950 text-white">
                {u.name} {u.unitNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- VISUAL QUEUE CASCADE COMPONENT --- */}
      <div className="mb-8 p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">
              Live Queue Cascade for {equipment[cascadeUnitId]?.name} {equipment[cascadeUnitId]?.unitNumber}
            </h4>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            Automated Reallocation Active
          </span>
        </div>

        {unitCascadeCandidates.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-400 text-center font-mono">
            No candidates currently queued for this equipment unit. Next cancellation opens directly to campus!
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {unitCascadeCandidates.map((cand, idx) => {
              const isHold = cand.status === 'on_hold';

              return (
                <div
                  key={cand.id}
                  className={`flex-1 p-3 rounded-lg border transition-all duration-300 relative ${
                    isHold
                      ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                      : idx === 0
                      ? 'bg-cyan-950/40 border-cyan-500/50'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      RANK #{idx + 1}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                        isHold
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-cyan-300'
                      }`}
                    >
                      {isHold ? 'HOLD (10:00)' : 'NEXT IN LINE'}
                    </span>
                  </div>

                  <h5 className="text-xs font-semibold text-white truncate">{cand.userName}</h5>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {cand.userRole} · Score: <strong className="text-cyan-400">{cand.priorityScore}</strong>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-1">"{cand.purpose}"</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, purpose, or unit..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
          >
            <option value="all">All Roles</option>
            <option value="Faculty">Faculty</option>
            <option value="Researcher">Researcher</option>
            <option value="Student">Student</option>
            <option value="Lab Admin">Lab Admin</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Waitlisted">Waitlisted</option>
            <option value="On Hold">On Hold</option>
            <option value="Expired">Expired</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Sort Buttons */}
        <div className="flex items-center space-x-1 font-mono text-[11px] text-slate-400">
          <span>Sort by:</span>
          <button
            onClick={() => {
              if (sortField === 'priority') setSortAsc(!sortAsc);
              else {
                setSortField('priority');
                setSortAsc(false);
              }
            }}
            className={`px-2 py-1 rounded border transition ${
              sortField === 'priority'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            Priority Score {sortField === 'priority' ? (sortAsc ? '↑' : '↓') : ''}
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel rounded-xl border border-cyan-500/25 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-cyan-500/20 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="p-3">Request ID</th>
                <th className="p-3">User & Persona</th>
                <th className="p-3">Equipment</th>
                <th className="p-3">Window</th>
                <th className="p-3 text-center">Priority Score</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredRows.map((row) => {
                const unit = equipment[row.unitId];

                let statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Confirmed
                  </span>
                );

                if (row.status === 'Waitlisted') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Waitlisted
                    </span>
                  );
                } else if (row.status === 'On Hold') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      On Hold (10m)
                    </span>
                  );
                } else if (row.status === 'Cancelled') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Cancelled
                    </span>
                  );
                } else if (row.status === 'Expired') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      Expired
                    </span>
                  );
                }

                return (
                  <tr key={row.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3 font-mono text-slate-400 text-[11px]">{row.id}</td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{row.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.userRole}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-200 font-medium">
                        {unit?.name || 'Equipment'} {unit?.unitNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {unit?.buildingName}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-300">
                      <div>{row.startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                      <div className="text-slate-400 text-[10px]">
                        {row.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {row.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center space-x-1 group relative">
                        <span className="font-mono font-bold text-cyan-300 text-sm">
                          {row.priorityScore}
                        </span>
                        <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                        {row.scoreBreakdown && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 p-2 rounded bg-slate-950 border border-cyan-500/40 text-[10px] text-slate-300 z-30 shadow-xl pointer-events-none font-mono">
                            <div>Role Weight: {row.scoreBreakdown.roleScore} (40%)</div>
                            <div>Urgency: {row.scoreBreakdown.urgencyScore} (40%)</div>
                            <div>Reliability: {row.scoreBreakdown.reliabilityScore} (20%)</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">{statusBadge}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
