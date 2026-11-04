import React, { useState, useEffect } from 'react';
import { Sun, Moon, RefreshCw, Calendar, Clock, Zap, LayoutGrid } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguLogo } from './SguLogo';

export const Header: React.FC = () => {
  const { theme, toggleTheme, initData, setToastMessage, allSubjects, appViewMode, setAppViewMode } = useTimetableStore();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [countdownTo7AM, setCountdownTo7AM] = useState<string>('');
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

      // Target: today 7:00:00 AM
      const target = new Date();
      target.setHours(7, 0, 0, 0);
      if (now > target) {
        target.setDate(target.getDate() + 1);
      }
      const diffMs = target.getTime() - now.getTime();
      const ch = Math.floor(diffMs / (1000 * 60 * 60));
      const cm = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const cs = Math.floor((diffMs % (1000 * 60)) / 1000);
      setCountdownTo7AM(
        `${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}:${String(cs).padStart(2, '0')}`
      );
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
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md transition-colors">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: SGU Branding & University Title */}
        <div className="flex items-center gap-3">
          <SguLogo size={36} className="rounded-xl shadow-xs" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                SGU Timetable Studio
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Official
              </span>
            </div>
            <p className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Đại học Sài Gòn</span>
              <span>•</span>
              <span className="tabular-nums font-medium text-foreground/80">{allSubjects.length} môn học</span>
              <span>•</span>
              <span>Học kỳ 1</span>
            </p>
          </div>
        </div>

        {/* Center: Apple-style Segmented Navigation Switcher */}
        <nav
          aria-label="Chuyển chế độ xem"
          className="flex items-center p-1 bg-muted/80 rounded-xl border border-border text-xs font-medium shadow-xs"
        >
          <button
            onClick={() => setAppViewMode('planner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
              appViewMode === 'planner'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            type="button"
          >
            <LayoutGrid className="size-3.5" />
            <span>Xếp Lịch Học</span>
          </button>
          <button
            onClick={() => setAppViewMode('dkmh')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
              appViewMode === 'dkmh'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            type="button"
          >
            <Zap className="size-3.5" />
            <span>Cổng Đăng Ký</span>
          </button>
        </nav>

        {/* Right: Actions & Institutional Telemetry */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Clock for registrations - Clean, tabular, zero layout shift */}
          <div
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-card border border-border text-xs text-muted-foreground rounded-xl shadow-xs select-none"
            title="Đồng hồ hệ thống và đếm ngược cổng đăng ký SGU (07:00:00)"
          >
            <Clock className="size-3.5 text-primary shrink-0" />
            {appViewMode === 'dkmh' ? (
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className="text-muted-foreground text-[11px]">07:00:</span>
                <span className="font-semibold text-primary">{countdownTo7AM || '--:--:--'}</span>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-foreground font-medium">{currentTime.split(' • ')[1] || '00:00:00'}</span>
              </div>
            ) : (
              <span className="tabular-nums text-foreground font-medium">{currentTime || '...'}</span>
            )}
          </div>

          {/* Academic Semester Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-card text-muted-foreground border border-border shadow-xs font-medium">
            <Calendar className="size-3.5 text-primary" />
            <span>HK1 • 2026-2027</span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer shadow-xs active:scale-[0.98] group/ref"
            title="Làm mới dữ liệu môn học từ máy chủ"
            type="button"
          >
            <RefreshCw
              className={`size-3.5 text-primary transition-transform duration-500 ${
                isRefreshing ? 'animate-spin' : 'group-hover/ref:rotate-90'
              }`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
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
