import React from 'react';
import { ChevronDown } from 'lucide-react';

interface ScrollIndicatorProps {
  onScrollDown?: () => void;
  label?: string;
}

export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({
  onScrollDown,
  label = 'Scroll down to explore details & schedule',
}) => {
  const handleClick = () => {
    if (onScrollDown) {
      onScrollDown();
    } else if (typeof window !== 'undefined') {
      window.scrollBy({
        top: window.innerHeight,
        behavior: 'smooth',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex flex-col items-center justify-center text-slate-400 hover:text-cyan-400 transition-colors duration-200 pointer-events-auto select-none focus:outline-none"
    >
      <div className="flex items-center space-x-1.5 text-xs font-mono tracking-wide opacity-80 group-hover:opacity-100 transition">
        <span>↓</span>
        <span>{label}</span>
      </div>
      <ChevronDown className="w-4 h-4 mt-0.5 animate-bounce text-cyan-400/80 group-hover:text-cyan-300" />
    </button>
  );
};
