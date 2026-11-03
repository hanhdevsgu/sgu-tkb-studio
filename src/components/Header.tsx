import React, { useState, useEffect } from 'react';
import { Sun, Moon, Radio } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguLogo } from './SguLogo';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTimetableStore();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${d}/${m}/${y}: ${hh}:${mm}:${ss}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Branding & Subtitle */}
        <div className="flex items-center gap-3">
          <SguLogo size={38} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5 font-sans">
                SGU Timetable
              </h1>
              <span className="text-[10px] font-bold font-mono tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase">
                Studio
              </span>
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground font-medium">
              Sắp xếp thời khóa biểu thông minh Đại học Sài Gòn
            </p>
          </div>
        </div>

        {/* Center: System Clock (matching SGU Portal) */}
        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1.5 bg-card/90 border border-border font-mono text-xs sm:text-sm text-foreground flex items-center gap-2 shadow-2xs rounded-lg"
            title="Thời gian hệ thống đào tạo SGU"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-wide font-medium">{currentTime || 'Đang đồng bộ...'}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Status indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md bg-muted/60 text-muted-foreground border border-border">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>API Live</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center size-9 rounded-lg border border-border bg-card text-foreground hover:bg-muted/80 hover:text-foreground transition-all duration-200 cursor-pointer shadow-2xs"
            title={`Giao diện: ${theme === 'dark' ? 'Tối' : 'Sáng'}`}
            type="button"
          >
            <Sun className="h-4 w-4 rotate-0 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-cyan-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
