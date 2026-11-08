import React, { useRef, useEffect } from 'react';
import { CircleCheck, Users, CheckCheck, X, Bell } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const NotificationPopover: React.FC = () => {
  const {
    isNotificationPopoverOpen,
    setNotificationPopoverOpen,
    markNotificationsAsRead,
  } = useTimetableStore();

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setNotificationPopoverOpen(false);
      }
    }
    if (isNotificationPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationPopoverOpen, setNotificationPopoverOpen]);

  if (!isNotificationPopoverOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center sm:items-start justify-center sm:justify-end p-2 sm:p-4 pt-16">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs sm:bg-transparent"
        onClick={() => setNotificationPopoverOpen(false)}
      />

      <div
        ref={popoverRef}
        className="relative z-50 text-popover-foreground w-[min(580px,calc(100vw-1.5rem))] p-0 rounded-2xl shadow-2xl border border-border/80 bg-background overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-200"
      >
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
          {/* Header */}
          <div className="bg-card px-4 py-3 sm:px-6 sm:py-4 border-b border-border/80 flex items-center justify-between gap-3 shadow-xs shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                <Bell className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm sm:text-base text-foreground tracking-tight">
                    Thông Báo Thời Khóa Biểu
                  </h3>
                  <CircleCheck className="w-4 h-4 text-emerald-500 fill-emerald-500/20 shrink-0" />
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span>Hệ thống</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> Sinh viên
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={markNotificationsAsRead}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-md border border-primary/20 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đã đọc</span>
              </button>

              <button
                onClick={() => setNotificationPopoverOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feed Content */}
          <div className="relative flex-1 min-h-0 p-4 bg-muted/20 overflow-y-auto space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-bold text-primary">Thông báo học kỳ</span>
                <span className="font-mono">HK2 • 2026-2027</span>
              </div>
              <h4 className="font-bold text-foreground">
                Thời khóa biểu Học kỳ 2 đã sẵn sàng
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Dữ liệu môn học, nhóm tổ và phòng học đã được cập nhật đầy đủ. Sinh viên có thể chọn môn và sắp xếp lịch học trực quan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
