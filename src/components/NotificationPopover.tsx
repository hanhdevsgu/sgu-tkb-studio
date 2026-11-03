import React, { useRef, useEffect } from 'react';
import {
  CircleCheck,
  Users,
  CheckCheck,
  Pin,
  X,
  ExternalLink,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const NotificationPopover: React.FC = () => {
  const {
    isNotificationPopoverOpen,
    setNotificationPopoverOpen,
    markNotificationsAsRead,
  } = useTimetableStore();

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
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
      {/* Dimmed backdrop on mobile */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs sm:bg-transparent"
        onClick={() => setNotificationPopoverOpen(false)}
      />

      {/* Popover container */}
      <div
        ref={popoverRef}
        className="relative z-50 text-popover-foreground w-[min(780px,calc(100vw-1.5rem))] p-0 rounded-2xl shadow-2xl border border-border/80 bg-background overflow-hidden flex flex-col h-[650px] max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-200"
      >
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
          {/* Header */}
          <div className="bg-card px-4 py-3 sm:px-6 sm:py-4 border-b border-border/80 flex items-center justify-between gap-3 shadow-xs shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-600 p-[2px] shadow-xs">
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center font-bold text-sm sm:text-base text-rose-600 dark:text-rose-400">
                    SGU
                  </div>
                </div>
                <div
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center text-[8px] text-white font-bold"
                  title="Đang hoạt động"
                >
                  ✓
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="font-bold text-sm sm:text-lg text-foreground truncate tracking-tight">
                    Thông Báo & Cập Nhật TKB SGU
                  </h3>
                  <CircleCheck className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500 fill-sky-500/20 shrink-0" />
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                  <span className="font-medium text-foreground/85">Quản trị viên</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Sinh viên SGU
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={markNotificationsAsRead}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md border border-rose-500/20 transition-colors cursor-pointer shadow-xs"
                title="Đánh dấu tất cả là đã đọc"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đã đọc tất cả</span>
              </button>

              <button
                onClick={() => setNotificationPopoverOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pinned banner */}
          <div className="bg-rose-500/10 dark:bg-rose-950/40 px-3 py-2 sm:px-5 sm:py-2.5 border-b border-rose-500/20 flex items-center justify-between gap-2 text-xs sm:text-sm shrink-0">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0 fill-rose-500/40" />
              <div className="truncate flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-rose-600 dark:text-rose-400 shrink-0 whitespace-nowrap">
                  Tin đã ghim:
                </span>
                <span className="text-foreground/90 truncate">
                  🔥 Ra mắt SGU Extension Toolkit: Siêu phẩm trợ thủ GPA & TKB đỉnh chóp cho anh em SGU! 🚀
                </span>
              </div>
            </div>
          </div>

          {/* Feed Content */}
          <div className="relative flex-1 min-h-0 h-full p-3 sm:p-6 bg-zinc-50/70 dark:bg-zinc-950/60 overflow-y-auto space-y-6">
            {/* Notification 6 (Pinned) */}
            <div className="space-y-3">
              <div className="flex items-center justify-center my-2">
                <div className="bg-background/90 dark:bg-zinc-800/90 border border-border/70 px-3.5 py-0.5 rounded-full text-[11px] font-semibold text-muted-foreground shadow-xs">
                  17 tháng 09, 2026
                </div>
              </div>

              <div className="flex items-start gap-3 w-full">
                <img
                  alt="Nguyễn Công Quân"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-xs border border-border/80 ring-1 ring-border/50 shrink-0 mt-0.5"
                  src="https://i.pinimg.com/1200x/0b/8f/27/0b8f27e38d1cdce79fec49d465e9be1d.jpg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-xs sm:text-sm text-foreground">
                      Nguyễn Công Quân
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                      Admin
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">15:35</span>
                    <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                      Mới
                    </span>
                  </div>

                  <div className="relative rounded-2xl rounded-tl-xs p-3.5 sm:p-4.5 border bg-card border-rose-500/40 ring-2 ring-rose-500/20 shadow-md space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 pb-1.5 border-b border-border/50">
                      <Pin className="w-3.5 h-3.5 fill-rose-500" />
                      <span>Thông báo quan trọng đã ghim</span>
                    </div>

                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                      🔥 Ra mắt SGU Extension Toolkit: Siêu phẩm trợ thủ GPA & TKB đỉnh chóp cho anh em SGU! 🚀
                    </h4>

                    <p className="text-xs sm:text-sm text-foreground/90 dark:text-zinc-300 leading-relaxed whitespace-pre-line font-normal">
                      Hế lô toàn thể anh em SGU yêu dấu! 😎✨ Hôm nay Admin ngoi lên flex nhẹ với anh em một món &quot;vũ khí tối thượng&quot; siêu cấp xịn sò: SGU Extension Toolkit! 🚀🔥{'\n\n'}
                      Học ở SGU mà không có bộ công cụ này trong trình duyệt là quá sức thiệt thòi luôn á nha. Điểm danh sương sương vài tính năng bá cháy bọ chét nè:{'\n'}
                      • 📊 Tính GPA & Xếp loại tự động: Đồng bộ điểm trong 1 nốt nhạc, tự tính chuẩn đét GPA hệ 4, thang 10 & tín chỉ tích lũy! 🧮✨{'\n'}
                      • 🎯 Dự đoán tốt nghiệp & Mục tiêu điểm: Mô phỏng xem cần cày thêm bao nhiêu môn A/B để ẵm trọn bằng Giỏi (3.2) hay Xuất sắc (3.6)! 🏆🔥{'\n'}
                      • 📅 Quản lý & Xuất TKB đa năng: Xem TKB theo tuần siêu mượt, tải ảnh PNG nét căng flex story, hoặc xuất file .ics đồng bộ thẳng Google Calendar! ⏰📱{'\n'}
                      • 🔒 Local-First an toàn tuyệt đối: Toàn bộ token và điểm số lưu thẳng trên trình duyệt máy bạn, bảo mật 100%! 🛡️💯
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">#SGUExtension 🚀</span>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">#SGUToolkit 🛠️</span>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">#BaoBoiSGU ✨</span>
                    </div>

                    <div className="pt-2">
                      <a
                        href="https://evanescent-tanker-aac.notion.site/MY-SHARE-3ded6446927b802f8322e378fb5b14ff"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl bg-muted/60 hover:bg-muted/90 transition-all border border-border group/link"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Liên kết đính kèm
                          </div>
                          <div className="text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 truncate">
                            🚀 Xem & Tải SGU Extension Toolkit
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center shadow-xs group-hover/link:scale-110 transition-transform shrink-0">
                          <ExternalLink className="w-3.5 h-3.5 text-rose-500" />
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification 5 */}
            <div className="space-y-3">
              <div className="flex items-center justify-center my-2">
                <div className="bg-background/90 dark:bg-zinc-800/90 border border-border/70 px-3.5 py-0.5 rounded-full text-[11px] font-semibold text-muted-foreground shadow-xs">
                  15 tháng 08, 2026
                </div>
              </div>

              <div className="flex items-start gap-3 w-full">
                <img
                  alt="Nguyễn Công Quân"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-xs border border-border/80 ring-1 ring-border/50 shrink-0 mt-0.5"
                  src="https://i.pinimg.com/1200x/0b/8f/27/0b8f27e38d1cdce79fec49d465e9be1d.jpg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-xs sm:text-sm text-foreground">
                      Nguyễn Công Quân
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                      Admin
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">13:41</span>
                  </div>

                  <div className="relative rounded-2xl rounded-tl-xs p-3.5 sm:p-4.5 border bg-card border-border shadow-md space-y-2">
                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                      Cập nhật dữ liệu Thời khóa biểu Học kỳ 1 (2026 - 2027)
                    </h4>
                    <p className="text-xs sm:text-sm text-foreground/90 dark:text-zinc-300 leading-relaxed whitespace-pre-line font-normal">
                      Hệ thống TKB SGU đã đồng bộ dữ liệu môn học, nhóm tổ và phòng học mới nhất cho Học kỳ 1 - Năm học 2026 - 2027.{'\n\n'}
                      Các bạn sinh viên có thể bắt đầu tra cứu mã môn, sắp xếp lịch học thử và kiểm tra xung đột lịch ngay bây giờ. Chúc các bạn đăng ký môn học thuận lợi!
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">#HK1_2026_2027</span>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">#CậpNhậtTKB</span>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">#SGU</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification 4 */}
            <div className="space-y-3">
              <div className="flex items-center justify-center my-2">
                <div className="bg-background/90 dark:bg-zinc-800/90 border border-border/70 px-3.5 py-0.5 rounded-full text-[11px] font-semibold text-muted-foreground shadow-xs">
                  01 tháng 08, 2026
                </div>
              </div>

              <div className="flex items-start gap-3 w-full">
                <img
                  alt="Nguyễn Công Quân"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-xs border border-border/80 ring-1 ring-border/50 shrink-0 mt-0.5"
                  src="https://i.pinimg.com/1200x/0b/8f/27/0b8f27e38d1cdce79fec49d465e9be1d.jpg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-xs sm:text-sm text-foreground">
                      Nguyễn Công Quân
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                      Admin
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">14:22</span>
                  </div>

                  <div className="relative rounded-2xl rounded-tl-xs p-3.5 sm:p-4.5 border bg-card border-border shadow-md space-y-2">
                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                      Đồng bộ số lượng chỗ còn lại của các nhóm tổ
                    </h4>
                    <p className="text-xs sm:text-sm text-foreground/90 dark:text-zinc-300 leading-relaxed whitespace-pre-line font-normal">
                      Đã cập nhật lại chính xác số lượng sinh viên còn lại (chỗ trống) và sức chứa phòng học của từng nhóm tổ trong cơ sở dữ liệu để các bạn tiện theo dõi tình trạng lớp học.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

