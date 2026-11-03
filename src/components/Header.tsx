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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api-sync');
      await initData();
      setToastMessage('Đã cập nhật dữ liệu thời khóa biểu mới nhất!');
    } catch {
      await initData();
      setToastMessage('Đã làm mới dữ liệu!');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur-md transition-all duration-200">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Branding & Subtitle */}
        <div className="flex items-center gap-3">
          <SguLogo size={38} className="rounded-xl shadow-xs" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground font-display">
                SGU Timetable
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Studio
              </span>
            </div>
            <p className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
              <span>Xếp lịch học thông minh</span>
              <span>•</span>
              <span className="text-foreground/80 font-medium tabular-nums">{allSubjects.length} môn học</span>
            </p>
          </div>
        </div>

        {/* Center: System Clock */}
        <div className="hidden md:flex items-center gap-2">
          <div
            className="px-3 py-1 bg-card border border-border/80 text-xs text-muted-foreground flex items-center gap-2 rounded-full shadow-2xs tabular-nums font-medium"
            title="Thời gian hiện tại"
          >
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="tracking-normal text-foreground/85">{currentTime || '...'}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Semester Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-muted/60 text-muted-foreground border border-border/70 font-medium">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>HK1 • 2026-2027</span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted/80 text-foreground text-xs font-medium transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.97] group/ref"
            title="Làm mới dữ liệu môn học"
            type="button"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-primary transition-transform duration-500 ${
                isRefreshing ? 'animate-spin' : 'group-hover/ref:rotate-90'
              }`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.97]"
            title={`Giao diện: ${theme === 'dark' ? 'Tối' : 'Sáng'}`}
            type="button"
          >
            <Sun className="h-4 w-4 rotate-0 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-sky-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
