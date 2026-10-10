import React, { useState, useEffect } from 'react';
import { useCampusStore } from '../store/campusStore';
import { Booking } from '../types';
import { X, Calendar, Clock, AlertCircle, Edit2, Trash2, Check, ArrowRight, ShieldCheck, QrCode, LogIn, LogOut } from 'lucide-react';
import { QRPassModal } from './QRPassModal';

export const MyBookingsDrawer: React.FC = () => {
  const isMyBookingsOpen = useCampusStore((s) => s.isMyBookingsOpen);
  const setIsMyBookingsOpen = useCampusStore((s) => s.setIsMyBookingsOpen);
  const currentUser = useCampusStore((s) => s.currentUser);
  const bookings = useCampusStore((s) => s.bookings);
  const holds = useCampusStore((s) => s.holds);
  const equipment = useCampusStore((s) => s.equipment);
  const cancelBooking = useCampusStore((s) => s.cancelBooking);
  const modifyBooking = useCampusStore((s) => s.modifyBooking);
  const confirmHold = useCampusStore((s) => s.confirmHold);
  const checkInBooking = useCampusStore((s) => s.checkInBooking);
  const checkOutBooking = useCampusStore((s) => s.checkOutBooking);

  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [selectedQRBooking, setSelectedQRBooking] = useState<Booking | null>(null);
  const [modifyStartHour, setModifyStartHour] = useState<string>('14:00');
  const [modifyEndHour, setModifyEndHour] = useState<string>('16:00');
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Close on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMyBookingsOpen) {
        setIsMyBookingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMyBookingsOpen, setIsMyBookingsOpen]);

  if (!isMyBookingsOpen) return null;

  // Filter bookings for current user
  const userBookings = bookings.filter((b) => b.userId === currentUser.id);
  const activeBookings = userBookings.filter((b) => b.status === 'active' || b.status === 'in_use');
  const pastBookings = userBookings.filter((b) => b.status !== 'active' && b.status !== 'in_use');

  // Filter holds for current user
  const userHolds = holds.filter((h) => h.userId === currentUser.id && !h.expired && !h.confirmed);

  const handleStartModify = (b: Booking) => {
    setEditingBookingId(b.id);
    const sH = b.startTime.getHours().toString().padStart(2, '0');
    const sM = b.startTime.getMinutes().toString().padStart(2, '0');
    const eH = b.endTime.getHours().toString().padStart(2, '0');
    const eM = b.endTime.getMinutes().toString().padStart(2, '0');
    setModifyStartHour(`${sH}:${sM}`);
    setModifyEndHour(`${eH}:${eM}`);
    setModifyError(null);
  };

  const handleSaveModify = async (b: Booking) => {
    try {
      setModifyError(null);
      const [sH, sM] = modifyStartHour.split(':').map(Number);
      const [eH, eM] = modifyEndHour.split(':').map(Number);

      const newStart = new Date(b.startTime);
      newStart.setHours(sH, sM, 0, 0);

      const newEnd = new Date(b.endTime);
      newEnd.setHours(eH, eM, 0, 0);

      if (newStart.getTime() >= newEnd.getTime()) {
        setModifyError('Start time must be before end time');
        return;
      }

      await modifyBooking(b.id, newStart, newEnd);
      setEditingBookingId(null);
    } catch (err: any) {
      setModifyError(err.message || 'Slot collision during reschedule');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={() => setIsMyBookingsOpen(false)}
    >
      <div
        className="w-full max-w-md h-full bg-[#050b14]/95 border-l border-cyan-500/30 shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">My Reservations</h2>
              <p className="text-xs text-slate-400 font-mono">
                {currentUser.name} · <span className="text-cyan-400">{currentUser.role}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMyBookingsOpen(false)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provisional Holds Section (if any assigned from cascade) */}
        {userHolds.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-amber-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>PROVISIONAL HOLD AVAILABLE</span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30">
                10-Min Window
              </span>
            </div>
            {userHolds.map((hold) => {
              const unit = equipment[hold.unitId];
              return (
                <div key={hold.id} className="mt-2 text-xs">
                  <p className="text-slate-200">
                    Slot opened for <strong className="text-white">{unit?.name} {unit?.unitNumber}</strong>!
                  </p>
                  <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                    {hold.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {hold.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <button
                    onClick={() => confirmHold(hold.id)}
                    className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.4)] transition cursor-pointer"
                  >
                    Confirm & Lock Reservation
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Active Reservations */}
        <div className="flex-1 space-y-4">
          <h3 className="text-xs font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
            <span>Active Reservations</span>
            <span className="text-cyan-400 font-bold">{activeBookings.length}</span>
          </h3>

          {activeBookings.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800 text-slate-500 text-xs">
              No active reservations for this persona. Use the 3D map or hero modal to reserve equipment!
            </div>
          ) : (
            activeBookings.map((b) => {
              const unit = equipment[b.unitId];
              const isEditing = editingBookingId === b.id;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/25 hover:border-cyan-500/40 transition shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center space-x-1.5">
                        <span>{unit?.name || 'Equipment'}</span>
                        <span className="text-cyan-400 font-mono text-xs">{unit?.unitNumber}</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">{unit?.buildingName}</p>
                    </div>
                    {b.status === 'in_use' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>IN USE</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        CONFIRMED
                      </span>
                    )}
                  </div>

                  {/* Purpose */}
                  <p className="text-xs text-slate-300 mt-2 bg-slate-950/50 p-2 rounded border border-slate-800">
                    "{b.purpose}"
                  </p>

                  {/* Time Window */}
                  {!isEditing ? (
                    <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                      <div className="flex items-center space-x-1.5 text-cyan-300">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          {b.startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
                          {b.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {b.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleStartModify(b)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
                          title="Modify Time Window"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => cancelBooking(b.id)}
                          className="p-1.5 rounded hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition"
                          title="Cancel Reservation (Triggers Waitlist Cascade)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Inline Modify Editor */
                    <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs animate-in fade-in">
                      <div className="text-[11px] font-mono text-cyan-400 mb-2">Atomic Reschedule:</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] text-slate-400">Start Time</label>
                          <input
                            type="time"
                            value={modifyStartHour}
                            onChange={(e) => setModifyStartHour(e.target.value)}
                            className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">End Time</label>
                          <input
                            type="time"
                            value={modifyEndHour}
                            onChange={(e) => setModifyEndHour(e.target.value)}
                            className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          />
                        </div>
                      </div>

                      {modifyError && (
                        <p className="text-[11px] text-rose-400 mb-2 leading-tight flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{modifyError}</span>
                        </p>
                      )}

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSaveModify(b)}
                          className="flex-1 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-[11px] transition"
                        >
                          Confirm Reschedule
                        </button>
                        <button
                          onClick={() => setEditingBookingId(null)}
                          className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] hover:bg-slate-700 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Bar: View QR Pass & Check In / Out */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedQRBooking(b)}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 hover:text-white hover:border-cyan-400 text-xs font-mono transition shadow-sm active:scale-95 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>View QR Pass</span>
                    </button>

                    {b.status === 'in_use' ? (
                      <button
                        onClick={() => checkOutBooking(b.id)}
                        className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Check Out</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => checkInBooking(b.id, b.qrToken)}
                        className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Check In</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Past / Cancelled History */}
          {pastBookings.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-xs font-mono uppercase text-slate-500 mb-3">Previous History</h3>
              <div className="space-y-2 opacity-60">
                {pastBookings.map((pb) => (
                  <div key={pb.id} className="p-2.5 rounded bg-slate-950/40 border border-slate-800 text-xs flex justify-between">
                    <div>
                      <span className="font-semibold text-slate-300">{equipment[pb.unitId]?.name}</span>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {pb.startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{pb.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Digital QR Pass Modal */}
      <QRPassModal
        booking={selectedQRBooking}
        isOpen={Boolean(selectedQRBooking)}
        onClose={() => setSelectedQRBooking(null)}
      />
    </div>
  );
};
