import React from 'react';
import { useCampusStore } from '../store/campusStore';
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const toasts = useCampusStore((s) => s.toasts);
  const removeToast = useCampusStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        let border = 'border-cyan-500/40';
        let bg = 'bg-cyan-950/85';
        let iconColor = 'text-cyan-400';
        let Icon = CheckCircle2;

        if (toast.type === 'error') {
          border = 'border-rose-500/40';
          bg = 'bg-rose-950/90';
          iconColor = 'text-rose-400';
          Icon = AlertCircle;
        } else if (toast.type === 'warning') {
          border = 'border-amber-500/40';
          bg = 'bg-amber-950/90';
          iconColor = 'text-amber-400';
          Icon = AlertTriangle;
        } else if (toast.type === 'info') {
          border = 'border-blue-500/40';
          bg = 'bg-slate-900/90';
          iconColor = 'text-blue-400';
          Icon = Info;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${bg} ${border}`}
          >
            <Icon className={`w-4 h-4 ${iconColor} mt-0.5 mr-2.5 shrink-0`} />
            <div className="flex-1 mr-2 text-xs">
              <h4 className="font-semibold text-slate-100">{toast.title}</h4>
              <p className="text-slate-300/90 text-[11px] mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
