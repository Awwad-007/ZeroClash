import React, { useState } from 'react';
import { useCampusStore } from '../store/campusStore';
import { X, Lock, Mail, User as UserIcon, Shield, Building, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

export const AuthModal: React.FC = () => {
  const isAuthModalOpen = useCampusStore((s) => s.isAuthModalOpen);
  const setAuthModalOpen = useCampusStore((s) => s.setAuthModalOpen);
  const login = useCampusStore((s) => s.login);
  const register = useCampusStore((s) => s.register);
  const allUsers = useCampusStore((s) => s.allUsers);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('campus123');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('Student');
  const [department, setDepartment] = useState('Computer Science');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password, role, department);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemoPersona = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('campus123');
    setErrorMsg(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={() => setAuthModalOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl glass-panel-highlight border border-cyan-500/40 p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] relative text-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>ZeroClash Security Core</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-wide mb-1">
          {mode === 'login' ? 'Authentication Required' : 'Create Academic Account'}
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Role-based JWT security protecting equipment reservations and lab infrastructure.
        </p>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-slate-900/90 p-1 border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
              mode === 'login'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In (JWT)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
              mode === 'register'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register Account
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Jordan Bell"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-cyan-400 outline-none"
                  >
                    <option value="Student">Student</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Researcher">Researcher</option>
                    <option value="Lab Admin">Lab Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Robotics"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Campus Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.m@campus.edu"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{mode === 'login' ? 'Authorize Session' : 'Create & Sign In'}</span>
          </button>
        </form>

        {/* Quick Demo Personas Selector */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>1-Click Demo Personas (Hackathon)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Student', email: 'alex.m@campus.edu', name: 'Alex M.' },
              { label: 'Faculty', email: 'e.reed@campus.edu', name: 'Dr. Reed' },
              { label: 'Researcher', email: 'devin.t@campus.edu', name: 'Devin T.' },
              { label: 'Lab Admin', email: 'admin.jenkins@campus.edu', name: 'Admin Sarah' },
            ].map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handleSelectDemoPersona(p.email)}
                className={`p-1.5 rounded-lg border text-left transition flex flex-col ${
                  email === p.email
                    ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-600 text-slate-300'
                }`}
              >
                <span className="text-[10px] font-bold text-white leading-tight">{p.label}</span>
                <span className="text-[9px] font-mono text-slate-400 truncate">{p.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
