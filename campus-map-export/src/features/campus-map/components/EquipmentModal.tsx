import React, { useEffect } from 'react';
import {
  X,
  Calendar,
  AlertTriangle,
  Clock,
  Zap,
  Info,
} from 'lucide-react';
import { useCampusStore } from '../store/campusStore';

interface EquipmentModalProps {
  onBookSlot?: (unitId: string) => void;
  onJoinWaitlist?: (unitId: string) => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  onBookSlot,
  onJoinWaitlist,
}) => {
  const isModalOpen = useCampusStore((s) => s.isModalOpen);
  const selectedUnitId = useCampusStore((s) => s.selectedUnitId);
  const equipment = useCampusStore((s) => s.equipment);
  const closeModal = useCampusStore((s) => s.closeModal);

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [closeModal]);

  const unit = selectedUnitId ? equipment[selectedUnitId] : null;

  if (!isModalOpen || !unit) return null;

  // Disabled button rules per data contract:
  // - maintenance: both Book Slot and Join Waitlist are disabled
  // - booked: only waitlist is allowed (Book Slot is disabled)
  // - available: both buttons are enabled
  const isBookDisabled = unit.status === 'maintenance' || unit.status === 'booked';
  const isWaitlistDisabled = unit.status === 'maintenance';

  return (
    <div
      className="absolute top-24 right-6 md:right-16 z-50 w-80 sm:w-84 md:w-[410px] select-none pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95"
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
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800/60 transition cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Equipment Title & Unit ID */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={unit.iconUrl}
              alt={unit.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white tracking-wide flex items-center space-x-1.5">
              <span>{unit.name}</span>
              <span className="text-cyan-400 font-mono text-sm">{unit.unitNumber}</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono line-clamp-1">{unit.specs?.model}</p>
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
              In use by <strong className="text-rose-200">{unit.currentBooking.userName}</strong>
              {unit.currentBooking.userRole ? ` (${unit.currentBooking.userRole})` : ''}
            </span>
          </div>
        )}

        {/* Specifications snippet */}
        {unit.specs && (unit.specs.resolution || unit.specs.vram || unit.specs.features) && (
          <div className="mb-3 text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-2 rounded border border-slate-800/60 font-mono">
            {unit.specs.resolution && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Resolution</span>
                <span className="text-slate-300">{unit.specs.resolution}</span>
              </div>
            )}
            {unit.specs.vram && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">VRAM</span>
                <span className="text-slate-300">{unit.specs.vram}</span>
              </div>
            )}
            {unit.specs.features && (
              <div className="text-[10px] text-slate-400 border-t border-slate-800/40 pt-1 mt-1">
                {unit.specs.features}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-1">
          {/* Book Slot Button */}
          <button
            type="button"
            onClick={() => {
              if (!isBookDisabled) {
                onBookSlot?.(unit.id);
              }
            }}
            disabled={isBookDisabled}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              isBookDisabled
                ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-700/30'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-98 cursor-pointer'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{unit.status === 'booked' ? 'Booked (Waitlist Only)' : 'Book Slot'}</span>
          </button>

          {/* Join Waitlist Button */}
          <button
            type="button"
            onClick={() => {
              if (!isWaitlistDisabled) {
                onJoinWaitlist?.(unit.id);
              }
            }}
            disabled={isWaitlistDisabled}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              isWaitlistDisabled
                ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-700/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-cyan-500/30 hover:border-cyan-400/60 active:scale-98 cursor-pointer'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Join Waitlist</span>
          </button>
        </div>
      </div>
    </div>
  );
};
