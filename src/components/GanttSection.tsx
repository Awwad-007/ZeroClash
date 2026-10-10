import React, { useState, useMemo, useRef } from 'react';
import { useCampusStore } from '../store/campusStore';
import { EquipmentUnit, Booking, TimeSlot } from '../types';
import { checkAvailability } from '../engine/conflict';
import {
  Calendar,
  Clock,
  Filter,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Wrench,
  Zap,
} from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const GanttSection: React.FC = () => {
  const equipment = useCampusStore((s) => s.equipment);
  const bookings = useCampusStore((s) => s.bookings);
  const maintenance = useCampusStore((s) => s.maintenance);
  const holds = useCampusStore((s) => s.holds);
  const selectUnit = useCampusStore((s) => s.selectUnit);
  const createBooking = useCampusStore((s) => s.createBooking);

  // Filter & date states
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredBooking, setHoveredBooking] = useState<Booking | null>(null);

  // Drag / Click range selection state for direct booking
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [rangeStartHour, setRangeStartHour] = useState<number | null>(null);
  const [rangeEndHour, setRangeEndHour] = useState<number | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [bookingPurpose, setBookingPurpose] = useState('Laboratory Project Slot');

  // Compute selected date object
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayOffset]);

  // Current time position indicator (0 to 100%)
  const nowPositionPct = useMemo(() => {
    if (dayOffset !== 0) return null; // Only show now line on Today
    const now = new Date();
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    return (minutesSinceMidnight / 1440) * 100;
  }, [dayOffset]);

  // Equipment category list
  const categories = [
    { id: 'all', label: 'All Equipment' },
    { id: 'camera', label: 'DSLR Cameras' },
    { id: 'gpu', label: 'GPU Nodes' },
    { id: 'vr', label: 'VR Headsets' },
    { id: 'printer', label: '3D Printers' },
    { id: 'microscope', label: 'Microscopes' },
    { id: 'projector', label: 'Projectors' },
  ];

  // Filtered equipment list
  const filteredUnits = useMemo(() => {
    return Object.values(equipment).filter((u) => {
      if (selectedCategory === 'all') return true;
      return u.type === selectedCategory;
    });
  }, [equipment, selectedCategory]);

  // Validation for the current drag/selected range
  const rangeValidation = useMemo(() => {
    if (!activeUnitId || rangeStartHour === null || rangeEndHour === null) {
      return null;
    }

    const start = new Date(targetDate);
    start.setHours(Math.min(rangeStartHour, rangeEndHour), 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(Math.max(rangeStartHour, rangeEndHour) + 1, 0, 0, 0);

    const avail = checkAvailability(activeUnitId, start, end, bookings, maintenance);
    return {
      start,
      end,
      avail,
      clash: !avail.ok,
      reason: avail.reason,
    };
  }, [activeUnitId, rangeStartHour, rangeEndHour, targetDate, bookings, maintenance]);

  const handleCellClick = (unitId: string, hour: number) => {
    if (activeUnitId !== unitId) {
      setActiveUnitId(unitId);
      setRangeStartHour(hour);
      setRangeEndHour(hour);
      setIsConfirmOpen(true);
    } else {
      if (rangeStartHour === null) {
        setRangeStartHour(hour);
        setRangeEndHour(hour);
        setIsConfirmOpen(true);
      } else {
        setRangeEndHour(hour);
        setIsConfirmOpen(true);
      }
    }
  };

  const handleConfirmGanttBooking = async () => {
    if (!rangeValidation || rangeValidation.clash || !activeUnitId) return;
    try {
      await createBooking({
        unitId: activeUnitId,
        startTime: rangeValidation.start,
        endTime: rangeValidation.end,
        purpose: bookingPurpose,
      });
      // Clear selection
      setActiveUnitId(null);
      setRangeStartHour(null);
      setRangeEndHour(null);
      setIsConfirmOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToHeroAndFocus = (unitId: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      selectUnit(unitId);
    }, 400);
  };

  return (
    <section id="gantt-section" className="scroll-mt-20 mb-16">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-cyan-500/20 mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            <span>Interactive Schedule Engine</span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            24-Hour Gantt Timeline
          </h3>
          <p className="text-xs text-slate-400">
            Real-time interval tracking, drag-range clash detection, and instant resource allocation.
          </p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 text-xs">
            <button
              onClick={() => setDayOffset(Math.max(0, dayOffset - 1))}
              disabled={dayOffset === 0}
              className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-mono font-semibold text-white whitespace-nowrap">
              {dayOffset === 0
                ? 'Today'
                : dayOffset === 1
                ? 'Tomorrow'
                : targetDate.toLocaleDateString([], { weekday: 'short' })}{' '}
              · {targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => setDayOffset(Math.min(6, dayOffset + 1))}
              disabled={dayOffset === 6}
              className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-4 text-xs font-mono">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1 rounded-full border transition shrink-0 ${
              selectedCategory === c.id
                ? 'bg-cyan-500 text-slate-950 font-semibold border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Legend & Instructions */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mb-3 px-1 gap-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
            <span>Available</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-rose-500/80 border border-rose-400" />
            <span>Active Loan / Booked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/80 border border-amber-400" />
            <span>Waitlist Hold / Pending</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-[repeating-linear-gradient(45deg,#334155,#334155_3px,#1e293b_3px,#1e293b_6px)] border border-slate-600" />
            <span>Maintenance</span>
          </div>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono">
          💡 Click or drag hour cells to reserve · Instant overlap collision check
        </span>
      </div>

      {/* Gantt Matrix Container */}
      <div className="glass-panel rounded-xl border border-cyan-500/25 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <div className="min-w-[950px] relative">
            {/* Header: Hourly Columns */}
            <div className="flex border-b border-cyan-500/20 bg-slate-950/80 text-[10px] font-mono text-slate-400">
              <div className="w-64 p-3 font-semibold text-slate-300 border-r border-slate-800 shrink-0">
                Equipment Unit & Location
              </div>
              <div className="flex-1 grid grid-cols-24">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="p-2 text-center border-r border-slate-800/60 last:border-r-0 font-medium"
                  >
                    {h.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Vertical "NOW" Indicator Line (if today) */}
            {nowPositionPct !== null && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                style={{ left: `calc(16rem + (100% - 16rem) * ${nowPositionPct / 100})` }}
              >
                <span className="bg-rose-500 text-white text-[9px] font-mono px-1 rounded shadow-lg font-bold -mt-1">
                  NOW
                </span>
                <div className="w-[2px] flex-1 bg-gradient-to-b from-rose-500 via-rose-500/80 to-rose-400 shadow-[0_0_8px_#f43f5e]" />
              </div>
            )}

            {/* Rows */}
            <div className="divide-y divide-slate-800/50">
              {filteredUnits.map((u) => {
                // Check if this unit is in maintenance during selected day
                const dayStart = new Date(targetDate);
                const dayEnd = new Date(targetDate);
                dayEnd.setHours(23, 59, 59, 999);

                const isMaint = maintenance.some(
                  (m) =>
                    m.unitId === u.id &&
                    m.isActive &&
                    m.startedAt.getTime() < dayEnd.getTime() &&
                    m.expectedReturnTime.getTime() > dayStart.getTime()
                );

                // Bookings for this unit on this day
                const dayBookings = bookings.filter((b) => {
                  if (b.unitId !== u.id || b.status !== 'active') return false;
                  return (
                    b.startTime.getTime() < dayEnd.getTime() &&
                    b.endTime.getTime() > dayStart.getTime()
                  );
                });

                // Holds for this unit
                const dayHolds = holds.filter((h) => {
                  if (h.unitId !== u.id || h.expired || h.confirmed) return false;
                  return (
                    h.startTime.getTime() < dayEnd.getTime() &&
                    h.endTime.getTime() > dayStart.getTime()
                  );
                });

                return (
                  <div
                    key={u.id}
                    className="flex hover:bg-slate-900/30 transition group items-stretch relative"
                  >
                    {/* Unit Info Column */}
                    <div className="w-64 p-3.5 border-r border-slate-800 shrink-0 flex items-center justify-between bg-slate-950/40">
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <img
                          src={u.iconUrl}
                          alt={u.name}
                          className="w-7 h-7 object-contain rounded shrink-0 bg-slate-900 p-0.5 border border-slate-800"
                        />
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-semibold text-white truncate flex items-center space-x-1">
                            <span>{u.name}</span>
                            <span className="text-cyan-400 font-mono text-[10px]">{u.unitNumber}</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">{u.buildingName}</p>
                        </div>
                      </div>

                      {/* "View on Map" Focus Button */}
                      <button
                        onClick={() => scrollToHeroAndFocus(u.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-cyan-950/80 text-slate-400 hover:text-cyan-300 border border-transparent hover:border-cyan-500/30 transition text-[10px] font-mono flex items-center space-x-1 shrink-0 ml-1"
                        title="Focus on 3D Campus Map"
                      >
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                    </div>

                    {/* 24-Hour Grid Track */}
                    <div className="flex-1 grid grid-cols-24 relative min-h-[46px] bg-slate-950/20">
                      {/* Hour Cells (Background click targets) */}
                      {HOURS.map((h) => {
                        const isSelectedRange =
                          activeUnitId === u.id &&
                          rangeStartHour !== null &&
                          rangeEndHour !== null &&
                          h >= Math.min(rangeStartHour, rangeEndHour) &&
                          h <= Math.max(rangeStartHour, rangeEndHour);

                        return (
                          <div
                            key={h}
                            onClick={() => handleCellClick(u.id, h)}
                            className={`border-r border-slate-800/40 last:border-r-0 cursor-pointer transition ${
                              isSelectedRange
                                ? rangeValidation?.clash
                                  ? 'bg-rose-500/30 border-rose-500/50'
                                  : 'bg-cyan-500/25 border-cyan-400/50'
                                : 'hover:bg-cyan-950/20'
                            }`}
                          />
                        );
                      })}

                      {/* Maintenance Full Row Overlay if active */}
                      {isMaint && (
                        <div
                          className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-[repeating-linear-gradient(45deg,#1e293b,#1e293b_8px,#0f172a_8px,#0f172a_16px)] border-y border-amber-500/30 opacity-75"
                          title="Hardware Maintenance Lockdown"
                        >
                          <span className="text-[10px] font-mono text-amber-300 font-bold tracking-wider flex items-center space-x-1">
                            <Wrench className="w-3 h-3 text-amber-400" />
                            <span>MAINTENANCE LOCKOUT</span>
                          </span>
                        </div>
                      )}

                      {/* Render Booked Interval Bands */}
                      {dayBookings.map((bk) => {
                        // Calculate percentage start & width within 24h
                        const bStartH = bk.startTime.getHours() + bk.startTime.getMinutes() / 60;
                        const bEndH = bk.endTime.getHours() + bk.endTime.getMinutes() / 60;
                        const leftPct = (bStartH / 24) * 100;
                        const widthPct = Math.max(2, ((bEndH - bStartH) / 24) * 100);

                        return (
                          <div
                            key={bk.id}
                            onMouseEnter={() => setHoveredBooking(bk)}
                            onMouseLeave={() => setHoveredBooking(null)}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className="absolute top-1.5 bottom-1.5 z-10 rounded px-2 flex items-center bg-rose-600/80 hover:bg-rose-500 border border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)] transition cursor-pointer overflow-hidden"
                          >
                            <span className="text-[10px] font-medium text-white truncate font-sans">
                              {bk.userName} ({bk.userRole})
                            </span>
                          </div>
                        );
                      })}

                      {/* Render Waitlist Provisional Hold Bands */}
                      {dayHolds.map((hld) => {
                        const hStartH = hld.startTime.getHours() + hld.startTime.getMinutes() / 60;
                        const hEndH = hld.endTime.getHours() + hld.endTime.getMinutes() / 60;
                        const leftPct = (hStartH / 24) * 100;
                        const widthPct = Math.max(2, ((hEndH - hStartH) / 24) * 100);

                        return (
                          <div
                            key={hld.id}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className="absolute top-1.5 bottom-1.5 z-10 rounded px-2 flex items-center bg-amber-500/80 border border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse transition cursor-pointer overflow-hidden"
                          >
                            <span className="text-[10px] font-medium text-slate-950 font-bold truncate">
                              HOLD: {hld.userName} (10m)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Hover Booking Tooltip Inspector */}
      {hoveredBooking && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/90 border border-rose-500/30 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            <div>
              <span className="font-semibold text-white">
                Active Loan: {hoveredBooking.userName} ({hoveredBooking.userRole})
              </span>
              <p className="text-[11px] text-slate-400 font-mono">
                {hoveredBooking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                {hoveredBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · "
                {hoveredBooking.purpose}"
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400">ID: {hoveredBooking.id}</span>
        </div>
      )}

      {/* Selected Range Confirmation Popover */}
      {isConfirmOpen && rangeValidation && activeUnitId && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
                Selected Interval:
              </span>
              <span className="text-sm font-semibold text-white">
                {equipment[activeUnitId]?.name} ({equipment[activeUnitId]?.unitNumber})
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              {rangeValidation.start.toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
              {rangeValidation.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to{' '}
              {rangeValidation.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>

            {rangeValidation.clash ? (
              <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Conflict: {rangeValidation.reason}</span>
              </p>
            ) : (
              <p className="text-xs text-emerald-400 mt-1 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Zero conflicts detected. Ready to confirm.</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={bookingPurpose}
              onChange={(e) => setBookingPurpose(e.target.value)}
              placeholder="Purpose..."
              className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white outline-none focus:border-cyan-400 w-56"
            />
            <button
              onClick={handleConfirmGanttBooking}
              disabled={rangeValidation.clash}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                rangeValidation.clash
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer'
              }`}
            >
              Book via Engine
            </button>
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
