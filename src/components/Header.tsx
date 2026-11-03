import React, { useState, useEffect } from 'react';
import { Sun, Moon, RefreshCw, Calendar, Clock } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguLogo } from './SguLogo';

export const Header: React.FC = () => {
  const { theme, toggleTheme, initData, setToastMessage, allSubjects } = useTimetableStore();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${d}/${m}/${y} • ${hh}:${mm}:${ss}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    initData();
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage('Đã làm mới dữ liệu thời khóa biểu!');
    }, 600);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl transition-all duration-300 shadow-xs">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Branding & Subtitle */}
        <div className="flex items-center gap-3.5 group">
          <div className="relative">
            <SguLogo size={42} className="group-hover:scale-105 transition-transform duration-300 drop-shadow-md" />
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5 font-sans">
                SGU Timetable
              </h1>
              <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 uppercase shadow-2xs">
                Studio
              </span>
            </div>
            <p className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>Hệ thống xếp lịch học trực quan</span>
              <span>•</span>
              <span className="text-foreground/75 font-mono">{allSubjects.length} môn học</span>
            </p>
          </div>
        </div>

        {/* Center: System Clock */}
        <div className="hidden md:flex items-center gap-2">
          <div
            className="px-3.5 py-1.5 bg-card/80 border border-border/70 font-mono text-xs text-foreground/90 flex items-center gap-2 shadow-2xs rounded-xl backdrop-blur-md"
            title="Thời gian hiện tại"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            <span className="tracking-wide font-medium">{currentTime || '...'}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Semester Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-xl bg-card/60 text-muted-foreground border border-border/70 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>HK1 • 2026-2027</span>
          </div>

          {/* Manual Refresh Button - Student can refresh at will */}
          <button
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted/70 text-foreground text-xs font-medium transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 group/ref"
            title="Làm mới dữ liệu môn học"
            type="button"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-cyan-500 transition-transform duration-500 ${
                isRefreshing ? 'animate-spin text-cyan-400' : 'group-hover/ref:rotate-90'
              }`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-border/70 bg-card text-foreground hover:bg-muted/70 transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 group/thm"
            title={`Giao diện: ${theme === 'dark' ? 'Tối' : 'Sáng'}`}
            type="button"
          >
            <Sun className="h-4 w-4 rotate-0 transition-all dark:-rotate-90 dark:scale-0 text-amber-500 group-hover/thm:rotate-45" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-cyan-400 group-hover/thm:-rotate-12" />
          </button>
        </div>
      </div>
    </header>
  );
};
