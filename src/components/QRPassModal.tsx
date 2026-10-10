import React, { useState, useEffect } from 'react';
import { useCampusStore } from '../store/campusStore';
import { Booking } from '../types';
import { X, QrCode, ShieldCheck, Clock, CheckCircle2, AlertCircle, LogIn, LogOut, Download } from 'lucide-react';

interface QRPassModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QRPassModal: React.FC<QRPassModalProps> = ({ booking, isOpen, onClose }) => {
  const getBookingQR = useCampusStore((s) => s.getBookingQR);
  const checkInBooking = useCampusStore((s) => s.checkInBooking);
  const checkOutBooking = useCampusStore((s) => s.checkOutBooking);
  const equipment = useCampusStore((s) => s.equipment);

  const [qrData, setQrData] = useState<{ token: string; qrDataUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen && booking) {
      setLoading(true);
      setError(null);
      getBookingQR(booking.id)
        .then((res) => {
          setQrData({ token: res.token, qrDataUrl: res.qrDataUrl });
        })
        .catch((err) => {
          setError(err.message || 'Failed to load QR token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setQrData(null);
      setError(null);
    }
  }, [isOpen, booking, getBookingQR]);

  if (!isOpen || !booking) return null;

  const unit = equipment[booking.unitId];
  const now = new Date();
  const startTime = new Date(booking.startTime);
  const windowStart = new Date(startTime.getTime() - 10 * 60 * 1000);
  const windowEnd = new Date(startTime.getTime() + 15 * 60 * 1000);
  const isWithinWindow = now >= windowStart && now <= windowEnd;
  const isTooEarly = now < windowStart;
  const isTooLate = now > windowEnd;

  const handleCheckIn = async () => {
    if (!qrData) return;
    try {
      setActionLoading(true);
      await checkInBooking(booking.id, qrData.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      await checkOutBooking(booking.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#050b14]/95 border border-cyan-500/40 rounded-2xl shadow-2xl p-6 relative overflow-hidden flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop accent */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>ZERO-CLASH DIGITAL PASS</span>
        </div>

        <h3 className="text-lg font-bold text-white tracking-wide">
          {unit?.name || 'Equipment Pass'}
        </h3>
        <p className="text-xs text-cyan-400 font-mono mb-4">
          {unit?.unitNumber} · {unit?.buildingName}
        </p>

        {/* QR Code Canvas / Image Display */}
        <div className="p-4 bg-white rounded-2xl shadow-[0_0_25px_rgba(0,240,255,0.25)] border-2 border-cyan-400/50 mb-4 flex items-center justify-center w-52 h-52 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-2 text-slate-800">
              <QrCode className="w-10 h-10 animate-spin text-cyan-600" />
              <span className="text-[11px] font-mono">Signing Token...</span>
            </div>
          ) : qrData?.qrDataUrl ? (
            <img
              src={qrData.qrDataUrl}
              alt="Booking QR Token"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-rose-600 text-xs font-mono p-2">
              <AlertCircle className="w-6 h-6 mx-auto mb-1" />
              {error || 'Unable to render QR code'}
            </div>
          )}
        </div>

        {/* Booking & Token Details */}
        <div className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-left text-xs mb-4 space-y-1.5">
          <div className="flex justify-between text-slate-400 font-mono text-[11px]">
            <span>Holder:</span>
            <span className="text-white font-medium">{booking.userName}</span>
          </div>
          <div className="flex justify-between text-slate-400 font-mono text-[11px]">
            <span>Time Window:</span>
            <span className="text-cyan-300 font-medium">
              {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
              {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between text-slate-400 font-mono text-[11px]">
            <span>Status:</span>
            <span
              className={`font-semibold uppercase ${
                booking.status === 'in_use'
                  ? 'text-emerald-400'
                  : booking.status === 'active'
                  ? 'text-cyan-400'
                  : 'text-slate-400'
              }`}
            >
              {booking.status === 'in_use' ? 'In Use' : booking.status}
            </span>
          </div>
          {qrData?.token && (
            <div className="pt-1.5 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono block">HMAC Signature:</span>
              <span className="text-[9px] text-slate-400 font-mono break-all line-clamp-1">
                {qrData.token}
              </span>
            </div>
          )}
        </div>

        {/* Status Prompt & Action Buttons */}
        {booking.status === 'in_use' ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center space-x-1.5 text-emerald-400 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4" />
              <span>Session currently active</span>
            </div>
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="w-full py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{actionLoading ? 'Checking Out...' : 'Check Out (Free Slot)'}</span>
            </button>
          </div>
        ) : (
          <div className="w-full space-y-2">
            {isWithinWindow ? (
              <p className="text-[11px] text-emerald-400 font-mono flex items-center justify-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Check-in Window Open (-10m to +15m)</span>
              </p>
            ) : isTooEarly ? (
              <p className="text-[11px] text-amber-400 font-mono flex items-center justify-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Check-in opens 10 min before start</span>
              </p>
            ) : (
              <p className="text-[11px] text-rose-400 font-mono flex items-center justify-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Check-in expired (+15 min passed)</span>
              </p>
            )}

            <button
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="w-full py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-[0_0_15px_rgba(0,240,255,0.3)] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{actionLoading ? 'Verifying...' : 'Check In Now'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
