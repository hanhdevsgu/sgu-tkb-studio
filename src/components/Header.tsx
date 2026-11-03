import React, { useState, useEffect } from 'react';
import { Sun, Moon, RefreshCw, Calendar, Clock, Zap, LayoutGrid } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguLogo } from './SguLogo';

export const Header: React.FC = () => {
  const { theme, toggleTheme, initData, setToastMessage, allSubjects, appViewMode, setAppViewMode } = useTimetableStore();
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

        {/* Center: Navigation View Switcher */}
        <div className="flex items-center p-1 bg-muted/80 rounded-xl border border-border/80 text-xs font-medium shadow-2xs">
          <button
            onClick={() => setAppViewMode('planner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
              appViewMode === 'planner'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            type="button"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
            <span>Xếp Lịch Học</span>
          </button>
          <button
            onClick={() => setAppViewMode('dkmh')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer relative ${
              appViewMode === 'dkmh'
                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-emerald-500'
            }`}
            type="button"
          >
            <Zap className={`w-3.5 h-3.5 ${appViewMode === 'dkmh' ? 'text-amber-300 fill-amber-300' : 'text-emerald-500'}`} />
            <span>Cổng Đăng Ký</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Clock for registrations */}
          <div
            className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-card border border-border/80 text-xs text-muted-foreground rounded-xl shadow-2xs tabular-nums font-medium"
            title="Đồng hồ hệ thống chính xác"
          >
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="tracking-normal text-foreground/85 font-mono">{currentTime || '...'}</span>
          </div>

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
