import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor, User, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { ClassGroup, ScheduleSession } from '../types/course';
import { doDateRangesOverlap } from '../utils/conflictDetector';

interface ExportPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCourses: ClassGroup[];
  totalCredits: number;
  planName: string;
  onToast: (msg: string) => void;
}

const DAYS_ORDER = [
  { day: 2, label: 'Thứ 2' },
  { day: 3, label: 'Thứ 3' },
  { day: 4, label: 'Thứ 4' },
  { day: 5, label: 'Thứ 5' },
  { day: 6, label: 'Thứ 6' },
  { day: 7, label: 'Thứ 7' },
];

const PERIOD_HOURS = [
  { start: '07:00', end: '07:50' },
  { start: '07:50', end: '08:40' },
  { start: '09:00', end: '09:50' },
  { start: '09:50', end: '10:40' },
  { start: '10:40', end: '11:30' },
  { start: '13:00', end: '13:50' },
  { start: '13:50', end: '14:40' },
  { start: '15:00', end: '15:50' },
  { start: '15:50', end: '16:40' },
  { start: '16:40', end: '17:30' },
  { start: '17:40', end: '18:30' },
  { start: '18:30', end: '19:20' },
  { start: '19:20', end: '20:10' },
];

function getCourseColorIndex(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 6;
}

const COLOR_THEMES = [
  { bg: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-l-sky-500 border-sky-300 dark:border-sky-800', text: 'text-sky-950 dark:text-sky-100' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-l-emerald-500 border-emerald-300 dark:border-emerald-800', text: 'text-emerald-950 dark:text-emerald-100' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-l-violet-500 border-violet-300 dark:border-violet-800', text: 'text-violet-950 dark:text-violet-100' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-l-amber-500 border-amber-300 dark:border-amber-800', text: 'text-amber-950 dark:text-amber-100' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-l-rose-500 border-rose-300 dark:border-rose-800', text: 'text-rose-950 dark:text-rose-100' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-l-indigo-500 border-indigo-300 dark:border-indigo-800', text: 'text-indigo-950 dark:text-indigo-100' },
];

export const ExportPngModal: React.FC<ExportPngModalProps> = ({
  isOpen,
  onClose,
  selectedCourses,
  totalCredits,
  planName,
  onToast,
}) => {
  const [mode, setMode] = useState<'phone' | 'desktop'>('phone');
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const desktopOffscreenRef = useRef<HTMLDivElement>(null);
  const phoneOffscreenRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  // Read student info from localStorage if available
  let userDisplay = '';
  let mssvDisplay = '';
  try {
    const rawUser = localStorage.getItem('sgu_dkmh_user') || localStorage.getItem('sgu_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed.name) userDisplay = parsed.name;
      if (parsed.mssv) mssvDisplay = parsed.mssv;
    }
  } catch {}

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    onToast('Đang chuẩn bị ảnh chất lượng cao...');

    try {
      // Ensure fonts are loaded before capturing
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const targetEl = mode === 'desktop' ? desktopOffscreenRef.current : phoneOffscreenRef.current;
      if (!targetEl) throw new Error('Không tìm thấy khung mẫu xuất ảnh');

      const isDark = document.documentElement.classList.contains('dark');
      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#0a0e17' : '#f8fafc',
        logging: false,
      });

      const filename = `TKB-SGU-${planName}-${mode}-${Date.now()}.png`;

      // Check if Web Share API with files is available (iOS Safari, Android Chrome)
      if (navigator.canShare && window.File) {
        try {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/png')
          );
          if (blob) {
            const file = new File([blob], filename, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Thời khóa biểu SGU - ${planName}`,
              });
              onToast('Đã mở menu lưu ảnh!');
              onClose();
              return;
            }
          }
        } catch (shareErr) {
          // If user cancels share or share fails, fallback to download link
          console.warn('Share API fallback to direct download:', shareErr);
        }
      }

      // Fallback: standard link download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();

      onToast('Đã lưu ảnh thời khóa biểu thành công!');
      onClose();
    } catch (err: any) {
      console.error(err);
      onToast(`Lỗi xuất ảnh: ${err.message || 'Không thể chụp ảnh'}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* -------------------- MAIN MODAL DIALOG -------------------- */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 animate-fade-in"
        onClick={() => !isExporting && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        <div
          className="w-full max-w-xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 id="export-modal-title" className="text-sm sm:text-base font-bold text-foreground">
                Xuất ảnh Thời khóa biểu (PNG)
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Đóng hộp thoại"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border/80">
              <button
                type="button"
                onClick={() => setMode('phone')}
                className={`min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'phone'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>Hình nền điện thoại (9:16)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('desktop')}
                className={`min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'desktop'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="h-4 w-4" />
                <span>Lưới máy tính (16:9)</span>
              </button>
            </div>

            {/* Toggle Personal Info (Disabled by default for privacy) */}
            {mode === 'phone' && (userDisplay || mssvDisplay) && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={showPersonalInfo}
                  onChange={(e) => setShowPersonalInfo(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4"
                />
                <span>In tên và MSSV lên hình nền điện thoại</span>
              </label>
            )}
          </div>

          {/* Description & Preview Note */}
          <div className="p-5 overflow-y-auto space-y-3 text-xs text-muted-foreground leading-relaxed">
            {mode === 'phone' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>Hình nền khóa màn hình (Lockscreen 9:16)</span>
                </div>
                <p>
                  Thiết kế chừa vùng an toàn ở 1/4 phía trên để đồng hồ của điện thoại không che mất lịch học. Danh sách ngày được dàn trang đầy đủ, không bị cắt bớt môn.
                </p>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] space-y-1">
                  <div>• Kích thước xuất: <strong>Tỉ lệ 9:16 chuẩn smartphone</strong></div>
                  <div>• Số môn học: <strong>{selectedCourses.length} môn ({totalCredits} tín chỉ)</strong></div>
                  <div>• Bảo mật: {showPersonalInfo ? 'Hiển thị tên & MSSV' : 'Đã ẩn tên & MSSV riêng tư'}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Monitor className="h-4 w-4 text-primary" />
                  <span>Lưới thời khóa biểu 7 ngày (Desktop 16:9)</span>
                </div>
                <p>
                  Hệ thống dùng mẫu xuất độc lập ngoài màn hình, đảm bảo chụp đầy đủ cả 7 ngày với 13 tiết học và xử lý chia làn môn trùng tiết chuẩn xác, kể cả khi bạn đang mở chế độ xem thẻ trên điện thoại.
                </p>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] space-y-1">
                  <div>• Kích thước xuất: <strong>Khung lưới ngang 1280px sắc nét</strong></div>
                  <div>• Tự động căn chỉnh các tiết học trùng nhau cạnh nhau</div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border px-5 py-3.5 bg-muted/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Định dạng: <strong>PNG</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-secondary text-foreground cursor-pointer transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Đang tạo ảnh...' : 'Tải ảnh PNG'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- OFFSCREEN RENDER TEMPLATES -------------------- */}
      {/* Container positioned offscreen so it never interferes with DOM or gets hidden by mobile views */}
      <div
        style={{
          position: 'fixed',
          left: '-99999px',
          top: '-99999px',
          zIndex: -100,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {/* TEMPLATE 1: PHONE LOCKSCREEN WALLPAPER (Fixed 9:16 aspect ratio with clock safe area) */}
        <div
          ref={phoneOffscreenRef}
          className="w-[480px] min-h-[960px] bg-background text-foreground p-6 flex flex-col justify-between"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {/* Top Clock Safe Area (Empty space reserved for phone's OS lockscreen clock widget) */}
          <div className="h-28 flex flex-col items-center justify-center opacity-30 border-b border-border/40 pb-2">
            <div className="text-[11px] tracking-widest uppercase font-mono">
              [ VÙNG ĐỒNG HỒ ĐIỆN THOẠI ]
            </div>
          </div>

          {/* Timetable Header */}
          <div className="pt-4 pb-3 border-b border-border flex items-start justify-between">
            <div>
              <div className="text-xs font-extrabold text-primary tracking-wider uppercase font-display">
                SGU TIMETABLE STUDIO
              </div>
              <div className="text-lg font-extrabold text-foreground font-display">
                {planName}
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {totalCredits} TC
              </span>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {selectedCourses.length} môn học
              </div>
            </div>
          </div>

          {/* Student Info (Only if enabled) */}
          {showPersonalInfo && (userDisplay || mssvDisplay) && (
            <div className="my-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs">
              <User className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground truncate">{userDisplay || 'Sinh viên SGU'}</span>
              {mssvDisplay && <span className="font-mono text-muted-foreground ml-auto">{mssvDisplay}</span>}
            </div>
          )}

          {/* Day-by-Day Session Cards (No overflow scroll, fully expanded) */}
          <div className="space-y-3.5 my-3 flex-1">
            {DAYS_ORDER.map((d) => {
              const daySessions: Array<{ course: ClassGroup; session: ScheduleSession }> = [];
              selectedCourses.forEach((c) => {
                c.parsedSessions.forEach((s) => {
                  if (s.thu === d.day && !s.isUnscheduled && s.tietStart > 0) {
                    daySessions.push({ course: c, session: s });
                  }
                });
              });

              if (daySessions.length === 0) return null;
              daySessions.sort((a, b) => a.session.tietStart - b.session.tietStart);

              return (
                <div key={d.day} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{d.label}</span>
                  </div>
                  <div className="space-y-1.5">
                    {daySessions.map(({ course, session }, idx) => (
                      <div
                        key={`${course.id}-${idx}`}
                        className="rounded-xl border border-border/80 bg-card p-2.5 shadow-2xs text-xs space-y-1"
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="font-bold text-foreground truncate">
                            {course.ten_mon}
                          </span>
                          <span className="font-mono text-[10px] font-semibold text-primary shrink-0">
                            N{course.nhom_to}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                          <span>Tiết {session.tietStart}–{session.tietEnd} ({session.thoi_gian})</span>
                          <span className="font-medium text-foreground">{session.phong}</span>
                        </div>
                        {session.gv && session.gv !== 'Chưa phân công' && (
                          <div className="text-[10px] text-muted-foreground truncate opacity-85">
                            GV: {session.gv}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="pt-3 border-t border-border/50 text-center text-[10px] text-muted-foreground">
            Trường Đại học Sài Gòn · Đăng ký học phần
          </div>
        </div>

        {/* TEMPLATE 2: DESKTOP 7-DAY GRID (Full 1280px clean layout) */}
        <div
          ref={desktopOffscreenRef}
          className="w-[1280px] bg-background text-foreground p-6 rounded-2xl border border-border"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div>
              <div className="text-xs font-bold text-primary tracking-wider uppercase font-display">
                TRƯỜNG ĐẠI HỌC SÀI GÒN — SGU TIMETABLE STUDIO
              </div>
              <h1 className="text-xl font-extrabold text-foreground font-display">
                Thời khóa biểu: {planName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                Tổng: {totalCredits} tín chỉ
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedCourses.length} môn học
              </span>
            </div>
          </div>

          {/* Full 6 Days Grid */}
          <div className="border border-border rounded-xl overflow-hidden bg-background">
            {/* Header row */}
            <div className="grid grid-cols-[54px_90px_repeat(6,1fr)] bg-muted/60 border-b border-border text-xs font-semibold text-muted-foreground text-center">
              <div className="py-2.5 border-r border-border">Tiết</div>
              <div className="py-2.5 border-r border-border">Giờ</div>
              {DAYS_ORDER.map((d) => (
                <div key={d.day} className="py-2.5 border-r border-border last:border-0 font-bold text-foreground">
                  {d.label}
                </div>
              ))}
            </div>

            {/* Grid Body */}
            <div className="grid grid-cols-[54px_90px_repeat(6,1fr)] text-xs relative">
              {/* Periods col */}
              <div className="border-r border-border">
                {Array.from({ length: 13 }, (_, i) => (
                  <div key={i + 1} className="border-b border-border flex items-center justify-center font-bold text-muted-foreground" style={{ height: '65px' }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Hours col */}
              <div className="border-r border-border text-[10px] text-muted-foreground">
                {PERIOD_HOURS.map((hr, i) => (
                  <div key={i} className="border-b border-border flex flex-col items-center justify-center leading-tight" style={{ height: '65px' }}>
                    <span>{hr.start}</span>
                    <span>{hr.end}</span>
                  </div>
                ))}
              </div>
              {/* 7 Days cols */}
              {DAYS_ORDER.map((d) => {
                const daySessions: Array<{ course: ClassGroup; session: ScheduleSession }> = [];
                selectedCourses.forEach((c) => {
                  c.parsedSessions.forEach((s) => {
                    if (s.thu === d.day && !s.isUnscheduled && s.tietStart > 0) {
                      daySessions.push({ course: c, session: s });
                    }
                  });
                });

                // Lane layout algorithm for parallel conflicting sessions
                const sorted = [...daySessions].sort((a, b) => a.session.tietStart - b.session.tietStart);
                const laneEnds: number[] = [];
                const placed = sorted.map((it) => {
                  let lane = laneEnds.findIndex((end) => end < it.session.tietStart);
                  if (lane === -1) {
                    lane = laneEnds.length;
                    laneEnds.push(it.session.tietEnd);
                  } else {
                    laneEnds[lane] = it.session.tietEnd;
                  }
                  return { ...it, lane };
                });
                const laneCount = Math.max(1, laneEnds.length);

                return (
                  <div key={d.day} className="relative border-r border-border last:border-0" style={{ minHeight: `${13 * 65}px` }}>
                    {Array.from({ length: 13 }, (_, i) => (
                      <div key={i} className="border-b border-border/70" style={{ height: '65px' }} />
                    ))}
                    {placed.map(({ course, session, lane }, idx) => {
                      const colorIdx = getCourseColorIndex(course.ma_mon);
                      const theme = COLOR_THEMES[colorIdx];
                      const numPeriods = session.soTiet || Math.max(1, session.tietEnd - session.tietStart + 1);
                      const topPx = (session.tietStart - 1) * 65 + 2;
                      const heightPx = numPeriods * 65 - 4;

                      const isConflicting = laneCount > 1 && placed.some(
                        (other) =>
                          other.course.id !== course.id &&
                          other.course.ma_mon !== course.ma_mon &&
                          Math.max(session.tietStart, other.session.tietStart) <=
                            Math.min(session.tietEnd, other.session.tietEnd) &&
                          doDateRangesOverlap(session.dates, other.session.dates)
                      );

                      const widthPercent = 100 / laneCount;
                      const leftPercent = (lane * 100) / laneCount;

                      return (
                        <div
                          key={`${course.id}-${idx}`}
                          className={`absolute p-1.5 rounded-lg border flex flex-col justify-between ${
                            isConflicting
                              ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/80 text-rose-950 dark:text-rose-100 border-dashed'
                              : `${theme.border} ${theme.bg} ${theme.text}`
                          }`}
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            left: `calc(${leftPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - 4px)`,
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[9px] font-mono font-bold">
                              <span>{course.ma_mon}</span>
                              <span>N{course.nhom_to}</span>
                            </div>
                            <div className="text-[11px] font-bold line-clamp-2 leading-tight mt-0.5">
                              {course.ten_mon}
                            </div>
                          </div>
                          <div className="text-[10px] opacity-80 flex items-center justify-between font-mono">
                            <span>{session.phong}</span>
                            <span>T{session.tietStart}-{session.tietEnd}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
