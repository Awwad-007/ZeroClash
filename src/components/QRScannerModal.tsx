import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useCampusStore } from '../store/campusStore';
import { X, QrCode, Camera, CheckCircle2, AlertTriangle, LogIn, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose }) => {
  const checkInBooking = useCampusStore((s) => s.checkInBooking);
  const checkOutBooking = useCampusStore((s) => s.checkOutBooking);
  const bookings = useCampusStore((s) => s.bookings);
  const equipment = useCampusStore((s) => s.equipment);

  const [mode, setMode] = useState<'check-in' | 'check-out'>('check-in');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    bookingId?: string;
    unitName?: string;
    userName?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'zero-clash-qr-reader';

  // Cleanup scanner on unmount or close
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      scannerRef.current = null;
      setCameraActive(false);
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    setScanResult(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleTokenScanned(decodedText);
        },
        () => {
          // Frame scan error - ignore normal scan cycle noise
        }
      );
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions or enter token below.');
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Auto start camera if available
      startScanner();
    } else {
      stopScanner();
      setScanResult(null);
      setManualToken('');
      setCameraError(null);
    }
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const handleTokenScanned = async (rawInput: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const token = rawInput.trim();
    // Parse token format: booking_id:expiry:signature
    let bookingId = token;
    if (token.includes(':')) {
      bookingId = token.split(':')[0];
    }

    try {
      if (mode === 'check-in') {
        const updated = await checkInBooking(bookingId, token);
        const unit = equipment[updated.unitId];
        setScanResult({
          success: true,
          message: `Check-in Verified! Session active for ${updated.userName}.`,
          bookingId: updated.id,
          unitName: unit ? `${unit.name} (${unit.unitNumber})` : updated.unitId,
          userName: updated.userName,
        });
      } else {
        const updated = await checkOutBooking(bookingId);
        const unit = equipment[updated.unitId];
        setScanResult({
          success: true,
          message: `Check-out Completed! Unit freed for immediate reuse.`,
          bookingId: updated.id,
          unitName: unit ? `${unit.name} (${unit.unitNumber})` : updated.unitId,
          userName: updated.userName,
        });
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: err.message || 'Operation failed. Outside allowed window or invalid token.',
        bookingId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#050b14]/95 border border-cyan-500/40 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop accent */}
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-wide flex items-center space-x-2">
                <span>Lab Staff QR Scanner</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  STAFF MODE
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Verify booking tokens & check in/out students at lab doors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMode('check-in')}
            className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'check-in'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Check-In Session</span>
          </button>
          <button
            onClick={() => setMode('check-out')}
            className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'check-out'
                ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Check-Out Session</span>
          </button>
        </div>

        {/* Live Video Camera Viewfinder */}
        <div className="relative mb-4 rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950 min-h-[240px] flex items-center justify-center">
          <div id={containerId} className="w-full max-w-[320px] rounded-lg overflow-hidden" />

          {!cameraActive && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-400 space-y-2">
              <Camera className="w-8 h-8 text-cyan-400 animate-pulse" />
              <p className="text-xs font-mono">Initializing optical camera...</p>
            </div>
          )}

          {cameraError && (
            <div className="p-4 text-center max-w-xs text-xs">
              <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-slate-300 font-medium mb-1">Camera Feed Inactive</p>
              <p className="text-slate-400 text-[11px] font-mono mb-3">{cameraError}</p>
              <button
                onClick={startScanner}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>
            </div>
          )}
        </div>

        {/* Scan Status Feedback */}
        {scanResult && (
          <div
            className={`p-3.5 rounded-xl border mb-4 text-xs animate-in zoom-in-95 ${
              scanResult.success
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {scanResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{scanResult.message}</p>
                {scanResult.unitName && (
                  <p className="text-[11px] font-mono text-slate-300 mt-1">
                    Equipment: <strong className="text-white">{scanResult.unitName}</strong>
                  </p>
                )}
                {scanResult.bookingId && (
                  <p className="text-[10px] font-mono text-slate-400">
                    Booking Ref: {scanResult.bookingId}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manual Token Verification fallback */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
            Manual Token or Booking ID Entry
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="e.g. bk-101 or bk-101:1791...:hmac"
              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
            />
            <button
              disabled={!manualToken.trim() || isProcessing}
              onClick={() => handleTokenScanned(manualToken)}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
