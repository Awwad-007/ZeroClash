import React, { useState, useRef, useEffect } from 'react';
import { useCampusStore } from '../store/campusStore';
import { User, UserRole } from '../types';
import { UserCheck, ChevronDown, Shield, BookOpen, Sparkles, Calendar } from 'lucide-react';

export const UserSwitcher: React.FC = () => {
  const currentUser = useCampusStore((s) => s.currentUser);
  const allUsers = useCampusStore((s) => s.allUsers);
  const setCurrentUser = useCampusStore((s) => s.setCurrentUser);
  const bookings = useCampusStore((s) => s.bookings);
  const holds = useCampusStore((s) => s.holds);
  const isMyBookingsOpen = useCampusStore((s) => s.isMyBookingsOpen);
  const setIsMyBookingsOpen = useCampusStore((s) => s.setIsMyBookingsOpen);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Active bookings count for current user
  const myBookingsCount = bookings.filter(
    (b) => b.userId === currentUser.id && b.status === 'active'
  ).length;

  // Holds for current user
  const myHoldsCount = holds.filter(
    (h) => h.userId === currentUser.id && !h.expired && !h.confirmed
  ).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Lab Admin':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'Faculty':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'Researcher':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Student':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div className="flex items-center space-x-2 pointer-events-auto" ref={dropdownRef}>
      {/* "My Bookings" Drawer Button */}
      <button
        onClick={() => setIsMyBookingsOpen(!isMyBookingsOpen)}
        className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-cyan-500/30 hover:border-cyan-400 transition shadow-[0_0_15px_rgba(0,240,255,0.15)] active:scale-95"
        title="View My Bookings & Waitlist Holds"
      >
        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">My Bookings</span>
        {myBookingsCount > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500 text-slate-950 font-bold">
            {myBookingsCount}
          </span>
        )}
        {myHoldsCount > 0 && (
          <span
            className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-400 text-slate-950 font-bold animate-pulse"
            title={`${myHoldsCount} hold ready for confirmation`}
          >
            !
          </span>
        )}
      </button>

      {/* User Switcher Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800/90 text-slate-200 border border-slate-700/60 hover:border-slate-500 transition shadow-lg active:scale-95"
        >
          <div className="w-5 h-5 rounded-full bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-[10px] text-cyan-400 font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-white text-xs font-semibold leading-tight">{currentUser.name}</span>
            <span className={`text-[10px] px-1 py-0.1 rounded border w-fit font-mono ${getRoleBadge(currentUser.role)}`}>
              {currentUser.role}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95">
            <div className="px-2 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Select Active Persona
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Demo Mode</span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {allUsers.map((user) => {
                const isSelected = user.id === currentUser.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-200'
                        : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-white">{user.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${getRoleBadge(user.role)}`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono line-clamp-1">{user.department}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-emerald-400">
                        {user.reliabilityScore}% rel
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
