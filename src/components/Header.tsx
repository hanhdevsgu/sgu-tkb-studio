import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sun,
  Moon,
  RefreshCw,
  LayoutGrid,
  Zap,
  Calendar,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguLogo } from './SguLogo';

export const useRefreshData = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { initData, setToastMessage } = useTimetableStore();

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setToastMessage('Đang đồng bộ dữ liệu thời khóa biểu & sĩ số mới nhất...');

    try {
      // 1. Trigger crawler in local server mode if available
      try {
        await fetch('/api-sync');
      } catch (e) {}

      // 2. Refresh catalog
      await initData();
      setToastMessage('Đã cập nhật dữ liệu môn học thành công!');
    } catch (err: any) {
      setToastMessage('Không thể kết nối máy chủ đồng bộ.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return { isRefreshing, handleManualRefresh };
};

export const Header: React.FC = () => {
  const {
    theme,
    toggleTheme,
    allSubjects,
    appViewMode,
    setAppViewMode,
    lastSyncTime,
  } = useTimetableStore();

  const [currentTime, setCurrentTime] = useState('');
  const [countdownTo7AM, setCountdownTo7AM] = useState('');
  const { isRefreshing, handleManualRefresh } = useRefreshData();

  const formattedSyncTime = useMemo(() => {
    if (!lastSyncTime) return null;
    try {
      const d = new Date(lastSyncTime);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [lastSyncTime]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
      setCurrentTime(`${dateStr} • ${timeStr}`);

      // Target: today 7:00:00 AM
      const target = new Date();
      target.setHours(7, 0, 0, 0);
      if (now > target) {
        target.setDate(target.getDate() + 1);
      }
      const diffMs = target.getTime() - now.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;

      const pad = (n: number) => String(n).padStart(2, '0');
      setCountdownTo7AM(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md transition-colors">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Brand / Academic Identity */}
        <div className="flex items-center gap-3">
          <SguLogo size={36} className="rounded-xl shadow-xs" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                SGU Timetable Studio
              </h1>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border hidden sm:inline">
                Dữ liệu Cổng SGU
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
            <span>Xếp lịch</span>
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
            <span>Đăng ký học phần</span>
          </button>
        </nav>

        {/* Right: Actions & Institutional Telemetry */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Clock for registrations - Clean, tabular, only in DKMH mode */}
          {appViewMode === 'dkmh' && (
            <div
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-card border border-border text-xs text-muted-foreground rounded-xl shadow-xs select-none"
              title="Đồng hồ đếm ngược cổng đăng ký SGU (07:00:00)"
            >
              <Clock className="size-3.5 text-primary shrink-0" />
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className="text-muted-foreground text-[11px]">07:00:</span>
                <span className="font-semibold text-primary">{countdownTo7AM || '--:--:--'}</span>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-foreground font-medium">{currentTime.split(' • ')[1] || '00:00:00'}</span>
              </div>
            </div>
          )}

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
            <span className="hidden sm:inline">
              {formattedSyncTime ? `Cập nhật ${formattedSyncTime}` : 'Làm mới'}
            </span>
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
