import React from 'react';

interface SguLogoProps {
  className?: string;
  size?: number;
}

export const SguLogo: React.FC<SguLogoProps> = ({ className = 'w-9 h-9', size = 36 }) => {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-[1.5px] shadow-sm hover:scale-105 transition-transform duration-200 ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-[10px] bg-slate-950 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:6px_6px]" />

        {/* Vector SVG Emblem */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 relative z-10 text-cyan-400"
        >
          {/* Calendar / Timetable frame */}
          <rect
            x="4"
            y="6"
            width="24"
            height="21"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
            className="text-cyan-400"
          />
          {/* Top binder rings */}
          <line x1="9" y1="4" x2="9" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="4" x2="16" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="23" y1="4" x2="23" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          
          {/* Timetable matrix active blocks */}
          <rect x="8" y="11" width="4" height="4" rx="1" fill="#38bdf8" />
          <rect x="14" y="11" width="4" height="4" rx="1" fill="#818cf8" />
          <rect x="20" y="11" width="4" height="4" rx="1" fill="#34d399" />
          <rect x="8" y="17" width="4" height="4" rx="1" fill="#818cf8" />
          <rect x="14" y="17" width="10" height="4" rx="1" fill="#38bdf8" fillOpacity="0.8" />
        </svg>
      </div>
    </div>
  );
};
