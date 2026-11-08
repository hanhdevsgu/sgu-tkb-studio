import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sun,
  Moon,
  RefreshCw,
  LayoutGrid,
  Zap,
  Calendar,
  AlertTriangle,
  Key,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguLogo } from './SguLogo';

const useRefreshData = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    syncCatalogData,
    setToastMessage,
    setAppViewMode,
    setAuthSessionState,
    setAuthModalOpen,
  } = useTimetableStore();

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setToastMessage('Đang đồng bộ dữ liệu thời khóa biểu & sĩ số mới nhất từ SGU...');

    try {
      const activeToken = localStorage.getItem('sgu_dkmh_token');
      const syncRes = await fetch('/api-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken || '' })
      });
      const syncData = await syncRes.json();

      if (!syncData.success) {
        if (syncData.reason === 'expired' || syncData.reason === 'unauthorized' || !activeToken) {
          setAuthSessionState('expired');
          setToastMessage('⚠️ Phiên SGU đã hết hạn. Vui lòng đăng nhập lại để cập nhật sĩ số!');
          setAppViewMode('dkmh');
          setAuthModalOpen(true);
          return;
        }
        setToastMessage(`Chưa thể đồng bộ: ${syncData.error || 'Lỗi kết nối máy chủ'}`);
        return;
      }

      setAuthSessionState('valid');
      // 2. Tải và hợp nhất dữ liệu mới vào RAM không reload trang
      await syncCatalogData(false);
      setToastMessage('✅ Đã cập nhật dữ liệu môn học & sĩ số mới nhất từ SGU!');
    } catch {
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
    authSessionState,
    setAuthSessionState,
    setAuthModalOpen,
  } = useTimetableStore();

  const [currentTime, setCurrentTime] = useState('');
  const { isRefreshing, handleManualRefresh } = useRefreshData();

  // Initial and periodic Token Validity Check
  useEffect(() => {
    const activeToken = localStorage.getItem('sgu_dkmh_token');
    if (!activeToken) {
      setAuthSessionState('none');
      return;
    }

    // Verify token validity against SGU endpoint
    fetch('/api/dkmh/w-thoigiansinhviendkmh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idpc': '0',
        'Authorization': `Bearer ${activeToken}`,
      },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (res.status === 401) {
          setAuthSessionState('expired');
        } else if (res.ok) {
          setAuthSessionState('valid');
        }
      })
      .catch(() => {});
  }, [setAuthSessionState]);

  const syncAgeInfo = useMemo(() => {
    if (!lastSyncTime) return null;
    try {
      const d = new Date(lastSyncTime);
      const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / 60000));

      let ageStr = 'vừa xong';
      if (diffMins >= 60) {
        const hours = Math.floor(diffMins / 60);
        ageStr = `${hours} giờ trước`;
      } else if (diffMins >= 1) {
        ageStr = `${diffMins} phút trước`;
      }

      // Is stale if older than 30 mins
      const isStale = diffMins >= 30;

      return {
        formatted: `Cập nhật ${timeStr} (${ageStr})`,
        isStale,
        diffMins,
      };
    } catch {
      return null;
    }
  }, [lastSyncTime, currentTime]);

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
    };

    updateClock();
    // Synchronize interval with exact second boundary
    const initialDelay = 1000 - (Date.now() % 1000);
    let timer: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      updateClock();
      timer = setInterval(updateClock, 1000);
    }, initialDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
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
          {/* Real-time Clock - Single clean clock with tabular figures, no redundant countdown */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-xs text-muted-foreground rounded-xl shadow-xs select-none"
            title="Đồng hồ thời gian thực"
          >
            <Clock className="size-3.5 text-primary shrink-0" />
            <span className="font-mono text-foreground font-semibold tabular-nums text-xs">
              {currentTime.split(' • ')[1] || '00:00:00'}
            </span>
          </div>

          {/* Academic Semester Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-card text-muted-foreground border border-border shadow-xs font-medium">
            <Calendar className="size-3.5 text-primary" />
            <span>HK1 • 2026-2027</span>
          </div>

          {/* Refresh / Token Expired Warning Button */}
          {authSessionState === 'expired' ? (
            <button
              onClick={() => {
                setAppViewMode('dkmh');
                setAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98] animate-in fade-in"
              title="Phiên đăng nhập SGU đã hết hạn. Bấm để đăng nhập lại và cập nhật sĩ số!"
              type="button"
            >
              <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
              <span>Token hết hạn (Bấm đăng nhập lại)</span>
            </button>
          ) : authSessionState === 'none' ? (
            <button
              onClick={() => {
                setAppViewMode('dkmh');
                setAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              title="Chưa kết nối tài khoản SGU. Bấm để đăng nhập!"
              type="button"
            >
              <Key className="size-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Chưa đăng nhập SGU</span>
            </button>
          ) : (
            <button
              onClick={handleManualRefresh}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer shadow-xs active:scale-[0.98] group/ref ${
                syncAgeInfo?.isStale
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15'
                  : 'border-border bg-card hover:bg-muted text-foreground'
              }`}
              title={
                syncAgeInfo?.isStale
                  ? `Dữ liệu môn học đã cũ (${syncAgeInfo.diffMins} phút trước). Bấm để cập nhật lại trước giờ G!`
                  : 'Làm mới dữ liệu môn học từ máy chủ'
              }
              type="button"
            >
              <RefreshCw
                className={`size-3.5 ${syncAgeInfo?.isStale ? 'text-amber-500 animate-pulse' : 'text-primary'} transition-transform duration-500 ${
                  isRefreshing ? 'animate-spin' : 'group-hover/ref:rotate-90'
                }`}
              />
              <span className="hidden sm:inline">
                {syncAgeInfo ? syncAgeInfo.formatted : 'Làm mới'}
              </span>
            </button>
          )}

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
