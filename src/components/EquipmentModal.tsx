import React, { useEffect, useState } from 'react';
import { X, Calendar, CheckCircle2, AlertTriangle, Clock, ShieldCheck, Zap } from 'lucide-react';
import { useCampusStore } from '../store/campusStore';
import { MOCK_EQUIPMENT } from '../data/mock';

export const EquipmentModal: React.FC = () => {
  const isModalOpen = useCampusStore((s) => s.isModalOpen);
  const selectedUnitId = useCampusStore((s) => s.selectedUnitId);
  const closeModal = useCampusStore((s) => s.closeModal);

  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState<string | null>(null);

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal]);

  if (!isModalOpen || !selectedUnitId) return null;

  const unit = MOCK_EQUIPMENT[selectedUnitId];
  if (!unit) return null;

  const handleBookSlot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unit.status !== 'available') return;
    setBookingSuccess(`Slot confirmed for ${unit.name} ${unit.unitNumber}! Reserved until next scheduled window.`);
    setTimeout(() => setBookingSuccess(null), 4000);
  };

  const handleJoinWaitlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unit.status === 'maintenance') return;
    setWaitlistSuccess(`Added to priority waitlist for ${unit.name} ${unit.unitNumber} (Priority Score: 92/100).`);
    setTimeout(() => setWaitlistSuccess(null), 4000);
  };

  return (
    <div
      className="absolute top-24 right-6 md:right-16 z-50 w-80 md:w-96 select-none pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glass-panel-highlight rounded-xl p-5 border border-cyan-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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
          <div className="w-9 h-9 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={unit.iconUrl}
              alt={unit.name}
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide flex items-center space-x-1.5">
              <span>{unit.name}</span>
              <span className="text-cyan-400 font-mono text-sm">{unit.unitNumber}</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono line-clamp-1">
              {unit.specs.model}
            </p>
          </div>
        </div>

        {/* Status Line */}
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
          <div className="flex items-center space-x-1.5 text-xs text-slate-300/90 mb-4 font-sans bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-700/30">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Next booking: <strong className="text-slate-100 font-medium">{unit.nextBooking.startTime} - {unit.nextBooking.endTime}</strong> ({unit.nextBooking.userName})
            </span>
          </div>
        )}

        {/* Current Active Booking Details if Booked */}
        {unit.currentBooking && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-300/90 mb-4 font-sans bg-rose-950/20 px-2.5 py-1.5 rounded border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>
              In use by <strong className="text-rose-200">{unit.currentBooking.userName}</strong> ({unit.currentBooking.userRole})
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-1">
          {/* Book Slot Button */}
          <button
            type="button"
            onClick={handleBookSlot}
            disabled={unit.status !== 'available'}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              unit.status === 'available'
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-98 cursor-pointer'
                : 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/30'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Slot</span>
          </button>

          {/* Join Waitlist Button */}
          <button
            type="button"
            onClick={handleJoinWaitlist}
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

        {/* Feedback Notifications */}
        {bookingSuccess && (
          <div className="mt-3 p-2.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 flex items-center space-x-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{bookingSuccess}</span>
          </div>
        )}

        {waitlistSuccess && (
          <div className="mt-3 p-2.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-[11px] text-cyan-300 flex items-center space-x-1.5 animate-in fade-in">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{waitlistSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};
