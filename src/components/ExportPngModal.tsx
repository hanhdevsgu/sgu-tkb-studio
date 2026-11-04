import React, { useRef, useState } from 'react';
import { X, Download, Smartphone, Monitor, Check, Calendar, User, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { ClassGroup } from '../types/course';

interface ExportPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
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
  { day: 8, label: 'Chủ nhật' },
];

export const ExportPngModal: React.FC<ExportPngModalProps> = ({
  isOpen,
  onClose,
  gridRef,
  selectedCourses,
  totalCredits,
  planName,
  onToast,
}) => {
  const [mode, setMode] = useState<'desktop' | 'phone'>('phone');
  const [isExporting, setIsExporting] = useState(false);
  const wallpaperRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Lấy thông tin user nếu có trong localStorage
  let userDisplay = 'Sinh viên SGU';
  let mssvDisplay = '';
  try {
    const rawUser = localStorage.getItem('sgu_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed.name) userDisplay = parsed.name;
      if (parsed.mssv) mssvDisplay = parsed.mssv;
    }
  } catch {}

  const handleExport = async () => {
    setIsExporting(true);
    onToast('Đang khởi tạo ảnh độ phân giải cao...');

    try {
      let targetEl: HTMLElement | null = null;
      let filename = `TKB-SGU-${planName}-${Date.now()}.png`;

      if (mode === 'desktop') {
        targetEl = gridRef.current;
        if (!targetEl) throw new Error('Không tìm thấy bảng lưới');
      } else {
        targetEl = wallpaperRef.current;
        if (!targetEl) throw new Error('Không tìm thấy thẻ hình nền điện thoại');
      }

      const isDark = document.documentElement.classList.contains('dark');
      const canvas = await html2canvas(targetEl, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: isDark ? '#0b0f19' : '#ffffff',
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();

      onToast('Xuất ảnh thành công! Đã lưu về máy.');
      onClose();
    } catch (err: any) {
      console.error(err);
      onToast(`Lỗi xuất ảnh: ${err.message || 'Không thể chụp màn hình'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/40">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              Xuất ảnh Thời khóa biểu (PNG)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border/80">
            <button
              type="button"
              onClick={() => setMode('phone')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
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
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                mode === 'desktop'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Monitor className="h-4 w-4" />
              <span>Lưới máy tính (16:9)</span>
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="overflow-y-auto px-5 py-3 flex-1 flex flex-col items-center justify-center bg-muted/20">
          {mode === 'phone' ? (
            /* 9:16 Wallpaper Card Preview */
            <div className="py-2">
              <div
                ref={wallpaperRef}
                className="w-[300px] sm:w-[330px] rounded-3xl border-2 border-border/80 bg-background text-foreground p-5 shadow-xl flex flex-col space-y-4"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {/* Brand & Plan Header */}
                <div className="flex items-start justify-between border-b border-border/60 pb-3">
                  <div>
                    <div className="text-[11px] font-bold text-primary tracking-wider uppercase">
                      SGU TIMETABLE STUDIO
                    </div>
                    <div className="text-base font-extrabold text-foreground font-display">
                      {planName}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {totalCredits} TC
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedCourses.length} môn học
                    </div>
                  </div>
                </div>

                {/* User info if available */}
                {(userDisplay !== 'Sinh viên SGU' || mssvDisplay) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50 text-xs">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">{userDisplay}</span>
                    {mssvDisplay && (
                      <span className="font-mono text-muted-foreground ml-auto">{mssvDisplay}</span>
                    )}
                  </div>
                )}

                {/* Week Schedule List */}
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {DAYS_ORDER.map((d) => {
                    const daySessions: Array<{ course: ClassGroup; session: any }> = [];
                    selectedCourses.forEach((c) => {
                      c.parsedSessions.forEach((s) => {
                        if (s.thu === d.day && !s.isUnscheduled && s.tietStart > 0) {
                          daySessions.push({ course: c, session: s });
                        }
                      });
                    });

                    if (daySessions.length === 0) return null;

                    // Sắp xếp theo tiết bắt đầu
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
                              className="rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs text-xs space-y-1"
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
                                <span>Tiết {session.tietStart}–{session.tietEnd}</span>
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

                {/* Footer caption */}
                <div className="pt-2 border-t border-border/50 text-center text-[10px] text-muted-foreground">
                  Trường Đại học Sài Gòn · Đăng ký học phần
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Mode Info */
            <div className="p-8 text-center space-y-3 max-w-md">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Monitor className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Chế độ Chụp Lưới 7 Ngày (Desktop Landscape)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hệ thống sẽ chụp lại toàn bộ lưới thời khóa biểu từ Thứ 2 đến Chủ nhật với độ phân giải siêu nét (Retina 2.5x), sẵn sàng dán vào tài liệu hoặc in ấn.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border px-5 py-3.5 bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Định dạng: <strong>PNG 2.5x High-Res</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-secondary text-foreground cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Đang xuất...' : 'Tải ảnh PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
