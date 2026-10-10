import React, { useState, useMemo } from 'react';
import { useCampusStore } from '../store/campusStore';
import { Booking } from '../types';
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
  Wrench,
  Sparkles,
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
  const [bookingPurpose, setBookingPurpose] = useState('Laboratory Research Session');

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

  // Equipment category list (Apple Maps style segmented filter)
  const categories = [
    { id: 'all', label: 'All Units' },
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
      {/* Apple Style Clean Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-4 mb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Schedule Engine</span>
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight flex items-center space-x-2">
            <span>24-Hour Equipment Timeline</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time interval occupancy, collision checking, and drag-to-reserve slots.
          </p>
        </div>

        {/* Date Navigator - Apple Minimal Capsule */}
        <div className="flex items-center space-x-3 self-start md:self-auto">
          <div className="inline-flex items-center bg-slate-900/90 border border-slate-700/60 rounded-full px-2 py-1 shadow-sm backdrop-blur-md">
            <button
              onClick={() => setDayOffset(Math.max(0, dayOffset - 1))}
              disabled={dayOffset === 0}
              className="p-1 rounded-full hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 flex items-center space-x-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium text-white">
                {dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : targetDate.toLocaleDateString([], { weekday: 'short' })}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                · {targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <button
              onClick={() => setDayOffset(Math.min(6, dayOffset + 1))}
              disabled={dayOffset === 6}
              className="p-1 rounded-full hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Segmented Control Categories Bar (Apple iOS / macOS style) */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="inline-flex p-1 bg-slate-900/90 border border-slate-800/80 rounded-xl overflow-x-auto max-w-full backdrop-blur-md">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Minimal Legend Indicators */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Available</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Booked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Waitlist Hold</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span>Maintenance</span>
          </div>
        </div>
      </div>

      {/* Minimal Clean Timeline Card */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <div className="min-w-[980px] relative">
            {/* Horizontal Timeline Header */}
            <div className="flex border-b border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 select-none">
              {/* Unit Info Header Column */}
              <div className="w-64 p-3 font-medium text-slate-300 border-r border-slate-800/80 shrink-0">
                Equipment Unit & Location
              </div>

              {/* 24 Hours Horizontal Row (Strict CSS Grid) */}
              <div
                className="flex-1"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="py-2.5 text-center border-r border-slate-800/40 last:border-r-0 font-mono text-[10px]"
                  >
                    {/* Show clean labels on even hours */}
                    {h % 2 === 0 ? (
                      <span className="font-semibold text-slate-300">
                        {h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
                      </span>
                    ) : (
                      <span className="opacity-30">·</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Red "NOW" Line Indicator (Only visible if viewing Today) */}
            {nowPositionPct !== null && (
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
                style={{ left: `calc(16rem + (100% - 16rem) * ${nowPositionPct / 100})` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -mt-1 shadow-[0_0_8px_#f43f5e]" />
                <div className="w-[1.5px] flex-1 bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
              </div>
            )}

            {/* Equipment Rows */}
            <div className="divide-y divide-slate-800/40">
              {filteredUnits.map((u) => {
                const dayStart = new Date(targetDate);
                const dayEnd = new Date(targetDate);
                dayEnd.setHours(23, 59, 59, 999);

                // Maintenance check
                const isMaint = maintenance.some(
                  (m) =>
                    m.unitId === u.id &&
                    m.isActive &&
                    m.startedAt.getTime() < dayEnd.getTime() &&
                    m.expectedReturnTime.getTime() > dayStart.getTime()
                );

                // Bookings for unit on target day
                const dayBookings = bookings.filter((b) => {
                  if (b.unitId !== u.id || b.status !== 'active') return false;
                  return (
                    b.startTime.getTime() < dayEnd.getTime() &&
                    b.endTime.getTime() > dayStart.getTime()
                  );
                });

                // Holds for unit on target day
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
                    className="flex hover:bg-slate-800/20 transition group items-stretch relative min-h-[52px]"
                  >
                    {/* Unit Info Left Card */}
                    <div className="w-64 p-3 border-r border-slate-800/80 shrink-0 flex items-center justify-between bg-slate-950/30">
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center p-1 shrink-0">
                          <img src={u.iconUrl} alt={u.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-semibold text-white truncate flex items-center space-x-1.5">
                            <span>{u.name}</span>
                            <span className="text-cyan-400 font-mono text-[10px]">{u.unitNumber}</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">{u.buildingName}</p>
                        </div>
                      </div>

                      {/* Map Focus Shortcut */}
                      <button
                        onClick={() => scrollToHeroAndFocus(u.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition text-[10px] shrink-0 ml-1"
                        title="Focus on 3D Map"
                      >
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                    </div>

                    {/* 24-Hour Interactive Grid Row (Strict CSS Grid) */}
                    <div
                      className="flex-1 relative bg-slate-950/10"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                      }}
                    >
                      {/* Hour Cells (Interactive click/drag targets) */}
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
                            className={`border-r border-slate-800/30 last:border-r-0 cursor-pointer transition ${
                              isSelectedRange
                                ? rangeValidation?.clash
                                  ? 'bg-rose-500/25 border-rose-500/40'
                                  : 'bg-cyan-500/20 border-cyan-400/40'
                                : 'hover:bg-slate-800/20'
                            }`}
                          />
                        );
                      })}

                      {/* Maintenance Banner Overlay */}
                      {isMaint && (
                        <div
                          className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-slate-900/80 border-y border-amber-500/30"
                          title="Hardware Maintenance Lockdown"
                        >
                          <span className="text-[11px] font-medium text-amber-300 flex items-center space-x-1.5">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            <span>Hardware Maintenance Lockout</span>
                          </span>
                        </div>
                      )}

                      {/* Booked Interval Capsule Bars (Apple Calendar Style) */}
                      {dayBookings.map((bk) => {
                        const bStartH = bk.startTime.getHours() + bk.startTime.getMinutes() / 60;
                        const bEndH = bk.endTime.getHours() + bk.endTime.getMinutes() / 60;
                        const leftPct = (bStartH / 24) * 100;
                        const widthPct = Math.max(3, ((bEndH - bStartH) / 24) * 100);

                        return (
                          <div
                            key={bk.id}
                            onMouseEnter={() => setHoveredBooking(bk)}
                            onMouseLeave={() => setHoveredBooking(null)}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className="absolute top-2 bottom-2 z-10 rounded-lg px-2 flex items-center bg-rose-600/85 hover:bg-rose-500 border border-rose-400/30 shadow-sm transition cursor-pointer overflow-hidden backdrop-blur-md"
                          >
                            <span className="text-[11px] font-medium text-white truncate">
                              {bk.userName} ({bk.userRole})
                            </span>
                          </div>
                        );
                      })}

                      {/* Waitlist Provisional Hold Capsule Bars */}
                      {dayHolds.map((hld) => {
                        const hStartH = hld.startTime.getHours() + hld.startTime.getMinutes() / 60;
                        const hEndH = hld.endTime.getHours() + hld.endTime.getMinutes() / 60;
                        const leftPct = (hStartH / 24) * 100;
                        const widthPct = Math.max(3, ((hEndH - hStartH) / 24) * 100);

                        return (
                          <div
                            key={hld.id}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className="absolute top-2 bottom-2 z-10 rounded-lg px-2 flex items-center bg-amber-500/90 border border-amber-300/50 shadow-sm animate-pulse transition cursor-pointer overflow-hidden backdrop-blur-md"
                          >
                            <span className="text-[11px] font-semibold text-slate-950 truncate">
                              Hold: {hld.userName} (10m)
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

      {/* Hover Tooltip Card */}
      {hoveredBooking && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-900/95 border border-slate-700/60 shadow-xl text-xs flex items-center justify-between animate-in fade-in backdrop-blur-xl">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div>
              <span className="font-semibold text-white">
                {hoveredBooking.userName} ({hoveredBooking.userRole})
              </span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {hoveredBooking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                {hoveredBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · "
                {hoveredBooking.purpose}"
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Booking #{hoveredBooking.id}</span>
        </div>
      )}

      {/* Floating Apple-Style Booking Bar When Cell Clicked */}
      {isConfirmOpen && rangeValidation && activeUnitId && (
        <div className="mt-4 p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in backdrop-blur-xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                Selected Interval:
              </span>
              <span className="text-sm font-semibold text-white">
                {equipment[activeUnitId]?.name} ({equipment[activeUnitId]?.unitNumber})
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              {rangeValidation.start.toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
              {rangeValidation.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
              {rangeValidation.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>

            {rangeValidation.clash ? (
              <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Slot unavailable: {rangeValidation.reason}</span>
              </p>
            ) : (
              <p className="text-xs text-emerald-400 mt-1 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Zero conflicts. Slot is open for booking.</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={bookingPurpose}
              onChange={(e) => setBookingPurpose(e.target.value)}
              placeholder="Session Purpose..."
              className="bg-slate-950 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs text-white outline-none focus:border-cyan-400 w-56"
            />
            <button
              onClick={handleConfirmGanttBooking}
              disabled={rangeValidation.clash}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                rangeValidation.clash
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md cursor-pointer'
              }`}
            >
              Confirm Booking
            </button>
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="px-3.5 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
