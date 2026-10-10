import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Info,
  Bot,
  Loader2,
  Wand2,
} from 'lucide-react';
import { useCampusStore } from '../store/campusStore';
import { checkAvailability, TimeSlot } from '../engine/conflict';
import { calculatePriorityScore } from '../engine/waitlist';
import { dataSource } from '../api';
import { ScheduleSuggestion } from '../types';

export const EquipmentModal: React.FC = () => {
  const isModalOpen = useCampusStore((s) => s.isModalOpen);
  const selectedUnitId = useCampusStore((s) => s.selectedUnitId);
  const equipment = useCampusStore((s) => s.equipment);
  const closeModal = useCampusStore((s) => s.closeModal);
  const bookings = useCampusStore((s) => s.bookings);
  const maintenance = useCampusStore((s) => s.maintenance);
  const currentUser = useCampusStore((s) => s.currentUser);
  const createBooking = useCampusStore((s) => s.createBooking);
  const joinWaitlist = useCampusStore((s) => s.joinWaitlist);
  const selectUnit = useCampusStore((s) => s.selectUnit);
  const addToast = useCampusStore((s) => s.addToast);

  // Booking slide-in panel state
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [startHourStr, setStartHourStr] = useState<string>('12:00');
  const [endHourStr, setEndHourStr] = useState<string>('14:00');
  const [purpose, setPurpose] = useState<string>('Senior Capstone Project Evaluation');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Waitlist urgency modal state
  const [isWaitlistPromptOpen, setIsWaitlistPromptOpen] = useState(false);
  const [waitlistUrgency, setWaitlistUrgency] = useState<'low' | 'medium' | 'high'>('high');

  // AI Smart Scheduling state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);

  // Reset booking panel when selected unit changes
  useEffect(() => {
    setIsBookingOpen(false);
    setIsWaitlistPromptOpen(false);
    setAiSuggestions([]);
    setAiError(null);
    setIsAiOpen(false);
  }, [selectedUnitId]);

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isBookingOpen) {
          setIsBookingOpen(false);
        } else {
          closeModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBookingOpen, closeModal]);

  const unit = selectedUnitId ? equipment[selectedUnitId] : null;

  // Generate 15-minute time options from 08:00 to 22:00
  const timeOptions = useMemo(() => {
    const opts: string[] = [];
    for (let h = 8; h <= 21; h++) {
      for (const m of [0, 15, 30, 45]) {
        opts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    opts.push('22:00');
    return opts;
  }, []);

  // Compute selected Start and End Date objects
  const { reqStart, reqEnd } = useMemo(() => {
    const s = new Date();
    s.setDate(s.getDate() + selectedDayOffset);
    const [sh, sm] = startHourStr.split(':').map(Number);
    s.setHours(sh, sm, 0, 0);

    const e = new Date();
    e.setDate(e.getDate() + selectedDayOffset);
    const [eh, em] = endHourStr.split(':').map(Number);
    e.setHours(eh, em, 0, 0);

    return { reqStart: s, reqEnd: e };
  }, [selectedDayOffset, startHourStr, endHourStr]);

  // Run live clash validation
  const availability = useMemo(() => {
    if (!unit) return { ok: true, conflictingBookings: [], suggestedAlternativeSlots: [] };
    return checkAvailability(unit.id, reqStart, reqEnd, bookings, maintenance);
  }, [unit, reqStart, reqEnd, bookings, maintenance]);

  if (!isModalOpen || !unit) return null;

  const handleConfirmBooking = async () => {
    if (!availability.ok) return;
    try {
      setIsSubmitting(true);
      await createBooking({
        unitId: unit.id,
        startTime: reqStart,
        endTime: reqEnd,
        purpose: purpose || 'Academic Research',
      });
      setIsBookingOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmWaitlist = () => {
    joinWaitlist({
      unitId: unit.id,
      startTime: reqStart,
      endTime: reqEnd,
      urgency: waitlistUrgency,
      purpose: purpose || 'Academic Research',
    });
    setIsBookingOpen(false);
    setIsWaitlistPromptOpen(false);
  };

  const handleSelectAlternativeSlot = (slot: TimeSlot) => {
    // Determine day offset
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDay = new Date(slot.start);
    targetDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    setSelectedDayOffset(Math.max(0, diffDays));
    const sH = slot.start.getHours().toString().padStart(2, '0');
    const sM = slot.start.getMinutes().toString().padStart(2, '0');
    const eH = slot.end.getHours().toString().padStart(2, '0');
    const eM = slot.end.getMinutes().toString().padStart(2, '0');
    setStartHourStr(`${sH}:${sM}`);
    setEndHourStr(`${eH}:${eM}`);
  };

  const handleAiSchedule = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiSuggestions([]);
    try {
      // 1. NLP Parse query (Claude API / strict schema + fallback)
      const parsed = await dataSource.parseNaturalLanguageSchedule(aiPrompt.trim());

      // Strict validation of parsed output
      if (!parsed.equipmentType || !parsed.durationMinutes || !parsed.earliest || !parsed.latest) {
        throw new Error('AI could not parse valid scheduling boundaries. Try clarifying your request.');
      }

      // 2. Optimization query using OR-Tools CP-SAT batch scheduler
      const suggestions = await dataSource.suggestSchedule({
        equipmentType: parsed.equipmentType || unit.type,
        durationMinutes: parsed.durationMinutes,
        startWindow: parsed.earliest,
        endWindow: parsed.latest,
        userRole: currentUser.role,
        urgency: 'high',
        userId: currentUser.id,
      });

      if (!suggestions || suggestions.length === 0) {
        setAiError('Zero clash-free slots found in that window. Try expanding your search timeframe.');
      } else {
        setAiSuggestions(suggestions);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err?.message || 'Failed to generate AI schedule recommendations.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplyAiSuggestion = (suggestion: ScheduleSuggestion) => {
    if (suggestion.unitId !== unit.id) {
      selectUnit(suggestion.unitId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDay = new Date(suggestion.startTime);
    targetDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    setSelectedDayOffset(Math.max(0, diffDays));

    const sH = suggestion.startTime.getHours().toString().padStart(2, '0');
    const sM = suggestion.startTime.getMinutes().toString().padStart(2, '0');
    const eH = suggestion.endTime.getHours().toString().padStart(2, '0');
    const eM = suggestion.endTime.getMinutes().toString().padStart(2, '0');
    setStartHourStr(`${sH}:${sM}`);
    setEndHourStr(`${eH}:${eM}`);

    addToast({
      type: 'success',
      title: 'AI Slot Loaded',
      message: `Populated ${sH}:${sM} - ${eH}:${eM} (${suggestion.unitNumber}). Review details and click Confirm Reservation.`,
      duration: 4000,
    });
  };

  const priorityPreview = calculatePriorityScore(
    currentUser.role,
    waitlistUrgency,
    currentUser.noShowCount
  );

  return (
    <div
      className="absolute top-24 right-6 md:right-16 z-50 w-84 md:w-[410px] select-none pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glass-panel-highlight rounded-xl p-5 border border-cyan-500/40 shadow-[0_16px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl max-h-[85vh] overflow-y-auto">
        {/* Top Header Row */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-cyan-500/15">
          <span className="text-xs font-mono text-slate-400 tracking-wider">
            {unit.buildingName}
          </span>
          <button
            type="button"
            onClick={closeModal}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800/60 transition"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Equipment Title & Unit ID */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0">
            <img src={unit.iconUrl} alt={unit.name} className="w-8 h-8 object-contain" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white tracking-wide flex items-center space-x-1.5">
              <span>{unit.name}</span>
              <span className="text-cyan-400 font-mono text-sm">{unit.unitNumber}</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono line-clamp-1">{unit.specs.model}</p>
          </div>
        </div>

        {/* Live Dynamic Status Line */}
        <div className="flex items-center space-x-2 mb-2 text-xs font-medium">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              unit.status === 'available'
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                : unit.status === 'booked'
                ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                : 'bg-amber-400 shadow-[0_0_8px_#facc15]'
            }`}
          />
          <span
            className={`${
              unit.status === 'available'
                ? 'text-emerald-400'
                : unit.status === 'booked'
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}
          >
            {unit.statusText}
          </span>
        </div>

        {/* Next Booking Info */}
        {unit.nextBooking && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-300/90 mb-3 font-sans bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-700/30">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Next booking: <strong className="text-slate-100 font-medium">{unit.nextBooking.startTime} - {unit.nextBooking.endTime}</strong> ({unit.nextBooking.userName})
            </span>
          </div>
        )}

        {/* Current Active Booking Details if Booked */}
        {unit.currentBooking && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-300/90 mb-3 font-sans bg-rose-950/20 px-2.5 py-1.5 rounded border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>
              In use by <strong className="text-rose-200">{unit.currentBooking.userName}</strong> ({unit.currentBooking.userRole})
            </span>
          </div>
        )}

        {/* Main Action Buttons (when booking panel is closed) */}
        {!isBookingOpen && !isWaitlistPromptOpen && (
          <div className="flex items-center space-x-2 pt-1">
            {/* Book Slot Button */}
            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              disabled={unit.status === 'maintenance'}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                unit.status === 'maintenance'
                  ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-700/30'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-98 cursor-pointer'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Slot</span>
            </button>

            {/* Join Waitlist Button */}
            <button
              type="button"
              onClick={() => setIsWaitlistPromptOpen(true)}
              disabled={unit.status === 'maintenance'}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                unit.status === 'maintenance'
                  ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-700/30'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-cyan-500/30 hover:border-cyan-400/60 active:scale-98 cursor-pointer'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Join Waitlist</span>
            </button>
          </div>
        )}

        {/* --- COMPACT SLIDE-IN BOOKING PANEL --- */}
        {isBookingOpen && (
          <div className="mt-3 pt-3 border-t border-cyan-500/20 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-cyan-400 text-[11px] uppercase tracking-wider font-semibold">
                Configure Reservation
              </span>
              <button
                onClick={() => setIsBookingOpen(false)}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Back
              </button>
            </div>

            {/* AI Smart Scheduling Assistant (Claude NLP + OR-Tools CP-SAT) */}
            <div className="mb-3.5 rounded-lg border border-cyan-500/30 bg-slate-950/60 p-2.5 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsAiOpen((prev) => !prev)}
              >
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="font-semibold text-[11px] text-cyan-300">
                    AI Smart Slot Assistant
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono">
                    Claude + CP-SAT
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isAiOpen ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </div>

              {isAiOpen && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-2 animate-in fade-in">
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAiSchedule();
                        }
                      }}
                      placeholder='e.g. "I need a GPU for 3 hours on Friday afternoon"'
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-[11px] placeholder:text-slate-500 focus:border-cyan-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAiSchedule}
                      disabled={isAiLoading || !aiPrompt.trim()}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer ${
                        isAiLoading || !aiPrompt.trim()
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                      }`}
                    >
                      {isAiLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      <span>{isAiLoading ? 'Solving...' : 'Suggest'}</span>
                    </button>
                  </div>

                  {/* Quick Prompts */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      '2 hours tomorrow afternoon',
                      '3 hours Friday morning',
                      '1 hour today evening',
                    ].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => {
                          setAiPrompt(quick);
                        }}
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition cursor-pointer"
                      >
                        "{quick}"
                      </button>
                    ))}
                  </div>

                  {/* Error notification */}
                  {aiError && (
                    <div className="p-1.5 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[10px] flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {/* Top 3 Suggested Slots */}
                  {aiSuggestions.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono text-cyan-400 block font-semibold">
                        Top 3 Optimal Slots (Ranked by OR-Tools):
                      </span>
                      {aiSuggestions.map((sug, idx) => {
                        const sTime = sug.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const eTime = sug.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const dateStr = sug.startTime.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });

                        return (
                          <div
                            key={idx}
                            className="p-2 rounded bg-slate-900/90 border border-cyan-500/25 hover:border-cyan-400/60 transition flex flex-col space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] font-bold text-white">
                                  {dateStr} {sTime} - {eTime}
                                </span>
                                <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-300">
                                  {sug.unitNumber}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-emerald-400">
                                Score {Math.round(sug.score)}/100
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">
                              {sug.recommendationReason}
                            </div>
                            <div className="pt-1 flex items-center justify-between">
                              <span className="text-[9px] text-slate-400 font-mono">
                                Demand: <strong className="text-cyan-300">{sug.demandLevel}</strong> · Util: <strong className="text-slate-200">{Math.round(sug.utilizationRate * 100)}%</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleApplyAiSuggestion(sug)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition cursor-pointer flex items-center space-x-1"
                              >
                                <span>Apply Slot</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date Selector Chips */}
            <div className="mb-3">
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Select Date</label>
              <div className="flex space-x-1.5 overflow-x-auto pb-1">
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const isSelected = selectedDayOffset === offset;
                  const label = offset === 0 ? 'Today' : offset === 1 ? 'Tmrw' : d.toLocaleDateString([], { weekday: 'short' });
                  const dateStr = d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

                  return (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => setSelectedDayOffset(offset)}
                      className={`px-2.5 py-1 rounded text-center shrink-0 border transition ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                          : 'bg-slate-900/80 text-slate-300 border-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-[10px] leading-tight">{label}</div>
                      <div className="text-[9px] font-mono opacity-80">{dateStr}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Window (15-min increments) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">Start Time (15m)</label>
                <select
                  value={startHourStr}
                  onChange={(e) => setStartHourStr(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                >
                  {timeOptions.slice(0, -1).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">End Time (15m)</label>
                <select
                  value={endHourStr}
                  onChange={(e) => setEndHourStr(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                >
                  {timeOptions.slice(1).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Purpose Input */}
            <div className="mb-3">
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Purpose / Project Title</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. CVPR Model Evaluation"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-xs focus:border-cyan-400 outline-none"
              />
            </div>

            {/* LIVE CONFLICT / AVAILABILITY STATUS */}
            {!availability.ok ? (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 animate-in fade-in">
                <div className="flex items-start space-x-1.5 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[11px] block text-rose-200">
                      Clash Detected ({availability.conflictingBookings.length} conflict)
                    </span>
                    <p className="text-[10px] text-rose-300/90 leading-tight mt-0.5">
                      {availability.reason}
                    </p>
                  </div>
                </div>

                {/* Suggested Alternative Slots as 1-click Chips */}
                {availability.suggestedAlternativeSlots.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-rose-500/20">
                    <span className="text-[10px] font-mono text-slate-300 block mb-1">
                      Suggested alternative free slots:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {availability.suggestedAlternativeSlots.map((slot, idx) => {
                        const dayName =
                          slot.start.getDate() === new Date().getDate()
                            ? 'Today'
                            : slot.start.toLocaleDateString([], { weekday: 'short' });
                        const sTime = slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const eTime = slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectAlternativeSlot(slot)}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition cursor-pointer"
                            title="Click to apply this slot"
                          >
                            {dayName} {sTime} - {eTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fallback Action: Join Waitlist for this clashing slot */}
                <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex justify-between items-center">
                  <span className="text-[10px] text-slate-300">Slot occupied?</span>
                  <button
                    type="button"
                    onClick={handleConfirmWaitlist}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center space-x-1"
                  >
                    <Zap className="w-3 h-3 text-slate-950" />
                    <span>Join waitlist for this slot</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-3 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center space-x-1.5 text-emerald-300 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Slot available · Zero interval conflicts detected</span>
              </div>
            )}

            {/* Confirm Button */}
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={!availability.ok || isSubmitting}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                availability.ok && !isSubmitting
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-98 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-700/30'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Locking Reservation...' : 'Confirm Reservation'}</span>
            </button>
          </div>
        )}

        {/* --- QUICK WAITLIST PROMPT (Direct Modal Action) --- */}
        {isWaitlistPromptOpen && (
          <div className="mt-3 pt-3 border-t border-cyan-500/20 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-cyan-400 text-[11px] uppercase tracking-wider font-semibold">
                Join Priority Waitlist
              </span>
              <button
                onClick={() => setIsWaitlistPromptOpen(false)}
                className="text-[11px] text-slate-400 hover:text-white underline"
              >
                Cancel
              </button>
            </div>

            <p className="text-[11px] text-slate-300 mb-2">
              Waitlist ranking uses role weight, urgency factor, and no-show history.
            </p>

            <div className="mb-3">
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Project Urgency</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['low', 'medium', 'high'] as const).map((urg) => (
                  <button
                    key={urg}
                    type="button"
                    onClick={() => setWaitlistUrgency(urg)}
                    className={`py-1 rounded text-center text-xs uppercase font-mono border transition ${
                      waitlistUrgency === urg
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {urg}
                  </button>
                ))}
              </div>
            </div>

            {/* Score Preview */}
            <div className="mb-3 p-2 rounded bg-slate-900/80 border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Computed Priority Score</span>
                <span className="text-sm font-bold font-mono text-cyan-300">
                  {priorityPreview.totalScore} / 100
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 text-right">
                <div>Role: {priorityPreview.roleScore} (40%)</div>
                <div>Urgency: {priorityPreview.urgencyScore} (40%)</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmWaitlist}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition cursor-pointer"
            >
              Submit Waitlist Entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
