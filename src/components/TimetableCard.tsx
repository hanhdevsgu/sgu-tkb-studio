import React, { useRef, useMemo } from 'react';
import {
  Calendar,
  LayoutGrid,
  TableProperties,
  Trash,
  Trash2,
  Camera,
  Upload,
  Download,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup, ScheduleSession } from '../types/course';

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

const DAYS = [
  { day: 2, label: 'Thứ 2' },
  { day: 3, label: 'Thứ 3' },
  { day: 4, label: 'Thứ 4' },
  { day: 5, label: 'Thứ 5' },
  { day: 6, label: 'Thứ 6' },
  { day: 7, label: 'Thứ 7' },
  { day: 8, label: 'Chủ nhật' },
];

// Refined, human-friendly color palette (soft modern tones, not neon)
const COLOR_THEMES = [
  {
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-l-sky-500 border-sky-200/80 dark:border-sky-800/50',
    text: 'text-sky-950 dark:text-sky-100',
    subtext: 'text-sky-900/80 dark:text-sky-200/80',
    badge: 'bg-sky-100/80 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-200/60 dark:border-sky-800/40',
  },
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-l-emerald-500 border-emerald-200/80 dark:border-emerald-800/50',
    text: 'text-emerald-950 dark:text-emerald-100',
    subtext: 'text-emerald-900/80 dark:text-emerald-200/80',
    badge: 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200/60 dark:border-emerald-800/40',
  },
  {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-l-violet-500 border-violet-200/80 dark:border-violet-800/50',
    text: 'text-violet-950 dark:text-violet-100',
    subtext: 'text-violet-900/80 dark:text-violet-200/80',
    badge: 'bg-violet-100/80 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 border-violet-200/60 dark:border-violet-800/40',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-l-amber-500 border-amber-200/80 dark:border-amber-800/50',
    text: 'text-amber-950 dark:text-amber-100',
    subtext: 'text-amber-900/80 dark:text-amber-200/80',
    badge: 'bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200/60 dark:border-amber-800/40',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-l-rose-500 border-rose-200/80 dark:border-rose-800/50',
    text: 'text-rose-950 dark:text-rose-100',
    subtext: 'text-rose-900/80 dark:text-rose-200/80',
    badge: 'bg-rose-100/80 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-200/60 dark:border-rose-800/40',
  },
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-l-indigo-500 border-indigo-200/80 dark:border-indigo-800/50',
    text: 'text-indigo-950 dark:text-indigo-100',
    subtext: 'text-indigo-900/80 dark:text-indigo-200/80',
    badge: 'bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border-indigo-200/60 dark:border-indigo-800/40',
  },
];

interface TimetableCardProps {
  onTriggerUpload: () => void;
}

export const TimetableCard: React.FC<TimetableCardProps> = ({ onTriggerUpload }) => {
  const {
    getSelectedCoursesInActivePlan,
    getTotalCreditsInActivePlan,
    clearActiveTabSelection,
    removeGroupFromActiveTab,
    timetableViewMode,
    setTimetableViewMode,
    selectedListViewMode,
    setSelectedListViewMode,
    exportScheduleJson,
    setToastMessage,
  } = useTimetableStore();

  const timetableRef = useRef<HTMLDivElement>(null);
  const selectedCourses = getSelectedCoursesInActivePlan();
  const totalCredits = getTotalCreditsInActivePlan();

  // Unscheduled courses (no day or period assigned yet by SGU)
  const unscheduledCourses = useMemo(() => {
    return selectedCourses.filter((c) =>
      c.isUnscheduled || c.parsedSessions.some((s) => s.isUnscheduled || s.thu === 0 || !s.tietStart)
    );
  }, [selectedCourses]);

  // Color map for selected subjects
  const subjectColorMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedCourses.forEach((c, idx) => {
      if (!map.has(c.ma_mon)) {
        map.set(c.ma_mon, idx % COLOR_THEMES.length);
      }
    });
    return map;
  }, [selectedCourses]);

  // Handle capture image
  const handleCaptureImage = async () => {
    if (!timetableRef.current) return;
    try {
      setToastMessage('Đang chuẩn bị ảnh thời khóa biểu...');
      const canvas = await html2canvas(timetableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0b0f19' : '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `tkb-sgu-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setToastMessage('Đã tải xuống ảnh thời khóa biểu!');
    } catch (err) {
      console.error(err);
      setToastMessage('Lỗi khi chụp ảnh thời khóa biểu');
    }
  };

  // Handle download JSON
  const handleDownloadJson = () => {
    const jsonStr = exportScheduleJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `tkb-sgu-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setToastMessage('Đã xuất file JSON thành công!');
  };

  // Empty state
  if (selectedCourses.length === 0) {
    return (
      <div className="bg-card border border-border/80 overflow-hidden shadow-xs rounded-2xl">
        <div className="px-6 py-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Calendar className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold text-foreground font-display">
                Chưa có môn học nào được chọn
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Tìm kiếm và chọn các môn học bạn muốn đăng ký ở ô phía trên, hoặc tải lên file JSON để khôi phục lịch học đã lưu.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onTriggerUpload}
                className="inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 h-10 px-4 py-2 gap-2 rounded-xl cursor-pointer active:scale-[0.97]"
                type="button"
              >
                <Upload className="w-4 h-4 text-primary" />
                Tải lên file JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card shadow-xs border border-border/80 overflow-hidden rounded-2xl">
        {/* Card Header & Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 sm:px-6 py-4 border-b border-border/70">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-foreground font-display">
              Thời khóa biểu của bạn
            </h2>
            <span className="text-xs font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full tabular-nums">
              {totalCredits} tín chỉ
            </span>
            <span className="text-xs font-medium text-muted-foreground px-2.5 py-0.5 bg-muted rounded-full border border-border/60 tabular-nums">
              {selectedCourses.length} môn
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Thẻ / Lưới */}
            <div className="flex items-center border border-border/80 p-0.5 bg-muted/40 rounded-xl">
              <button
                onClick={() => setTimetableViewMode('card')}
                className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1.5 h-8 px-3 text-xs rounded-lg cursor-pointer ${
                  timetableViewMode === 'card'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                type="button"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Thẻ
              </button>
              <button
                onClick={() => setTimetableViewMode('grid')}
                className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1.5 h-8 px-3 text-xs rounded-lg cursor-pointer ${
                  timetableViewMode === 'grid'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                type="button"
              >
                <TableProperties className="w-3.5 h-3.5" />
                Lưới
              </button>
            </div>

            {/* Clear All */}
            <button
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa tất cả môn học trong phương án này?')) {
                  clearActiveTabSelection();
                }
              }}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs size-9 h-8 w-8 cursor-pointer rounded-xl hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-[0.97] group/del"
              title="Xóa tất cả môn học"
              type="button"
            >
              <Trash className="w-4 h-4 text-muted-foreground group-hover/del:text-rose-500 transition-colors" />
            </button>

            {/* Capture PNG */}
            <button
              onClick={handleCaptureImage}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 size-9 h-8 w-8 cursor-pointer rounded-xl active:scale-[0.97]"
              title="Chụp ảnh thời khóa biểu (PNG)"
              type="button"
            >
              <Camera className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* Upload JSON */}
            <button
              onClick={onTriggerUpload}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 size-9 h-8 w-8 cursor-pointer rounded-xl active:scale-[0.97]"
              title="Tải lên file JSON"
              type="button"
            >
              <Upload className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* Download JSON */}
            <button
              onClick={handleDownloadJson}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 size-9 h-8 w-8 cursor-pointer rounded-xl active:scale-[0.97]"
              title="Tải xuống file JSON"
              type="button"
            >
              <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        {/* Unscheduled courses alert banner */}
        {unscheduledCourses.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <div className="font-semibold text-sm font-display">
                  Có {unscheduledCourses.length} môn học đã chọn nhưng trường chưa xếp lịch (chưa có Thứ/Tiết):
                </div>
                <div className="space-y-1 text-xs">
                  {unscheduledCourses.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">• {c.ten_mon}</span>
                      <span className="px-2 py-0.2 rounded bg-amber-500/20 text-amber-900 dark:text-amber-100 text-[11px] tabular-nums">
                        Mã: {c.ma_mon} - Nhóm {c.nhom_to}
                      </span>
                      <span>— {c.so_tc} tín chỉ</span>
                      {c.parsedSessions[0]?.gv && <span className="opacity-80">({c.parsedSessions[0].gv})</span>}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] opacity-75 italic pt-0.5">
                  * Môn này vẫn được tính đủ {unscheduledCourses.reduce((sum, c) => sum + c.so_tc, 0)} tín chỉ vào tổng kết, nhưng chưa hiển thị trên lịch tuần do trường chưa sắp xếp phòng & ngày học.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timetable Content: Grid or Card Mode */}
        {timetableViewMode === 'grid' ? (
          <div className="px-3 sm:px-6 py-5">
            <div className="w-full space-y-2">
              {/* Mobile notice */}
              <div className="md:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span>←</span> Vuốt ngang để xem đủ 7 ngày <span>→</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-muted rounded-md border border-border">
                  Lưới TKB
                </span>
              </div>

              {/* Grid Target for Capture */}
              <div className="overflow-x-auto md:overflow-x-visible overscroll-x-contain rounded-xl border border-border/80">
                <div className="w-full min-w-[1050px] md:min-w-0">
                  <div
                    ref={timetableRef}
                    className="timetable-capture-target w-full bg-background overflow-hidden"
                  >
                    {/* Grid Days Header */}
                    <div className="grid grid-cols-[46px_82px_repeat(7,minmax(130px,1fr))] md:grid-cols-[50px_84px_repeat(7,1fr)] lg:grid-cols-[54px_90px_repeat(7,1fr)]">
                      <div className="flex items-center justify-center border-r border-b border-border py-2.5 text-xs font-semibold text-muted-foreground bg-muted/60">
                        Tiết
                      </div>
                      <div className="flex items-center justify-center border-r border-b border-border py-2.5 text-xs font-semibold text-muted-foreground bg-muted/60">
                        Giờ
                      </div>
                      {DAYS.map((d) => (
                        <div
                          key={d.day}
                          className="flex flex-col items-center justify-center py-2.5 border-r border-b border-border bg-muted/60"
                        >
                          <span className="text-xs sm:text-sm font-semibold text-foreground font-display">
                            {d.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Grid Body */}
                    <div className="grid grid-cols-[46px_82px_repeat(7,minmax(130px,1fr))] md:grid-cols-[50px_84px_repeat(7,1fr)] lg:grid-cols-[54px_90px_repeat(7,1fr)] text-xs bg-background relative">
                      {/* Column 1: Periods 1 to 13 */}
                      <div className="border-r border-border bg-background">
                        {Array.from({ length: 13 }, (_, i) => (
                          <div
                            key={i + 1}
                            className="border-b border-border flex items-center justify-center text-xs font-semibold text-muted-foreground tabular-nums"
                            style={{ height: '70px' }}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>

                      {/* Column 2: Exact Period Hours */}
                      <div className="border-r border-border bg-background">
                        {PERIOD_HOURS.map((hr, i) => (
                          <div
                            key={i}
                            className="border-b border-border flex flex-col items-center justify-center text-[10px] sm:text-[11px] text-muted-foreground leading-tight px-1 tabular-nums"
                            style={{ height: '70px' }}
                          >
                            <span className="font-medium text-foreground/80">{hr.start}</span>
                            <span className="text-[9px] text-muted-foreground/40 font-sans">↓</span>
                            <span className="text-muted-foreground/80">{hr.end}</span>
                          </div>
                        ))}
                      </div>

                      {/* Columns 3 to 9: Days (Thứ 2 to Chủ nhật) */}
                      {DAYS.map((d) => {
                        const daySessions: Array<{
                          course: ClassGroup;
                          session: ScheduleSession;
                        }> = [];

                        selectedCourses.forEach((course) => {
                          course.parsedSessions.forEach((sess) => {
                            if (sess.thu === d.day && !sess.isUnscheduled && sess.tietStart > 0) {
                              daySessions.push({ course, session: sess });
                            }
                          });
                        });

                        return (
                          <div
                            key={d.day}
                            className="relative border-r border-border bg-background hover:bg-muted/15 transition-colors"
                            style={{ minHeight: '910px' }}
                          >
                            {/* 13 Period Grid Cell lines */}
                            {Array.from({ length: 13 }, (_, i) => (
                              <div
                                key={i}
                                className="border-b border-border/70"
                                style={{ height: '70px' }}
                              />
                            ))}

                            {/* Render Schedule Blocks with Silky Smooth Hover */}
                            {daySessions.map(({ course, session }, idx) => {
                              const themeIdx = subjectColorMap.get(course.ma_mon) || 0;
                              const theme = COLOR_THEMES[themeIdx];

                              const numPeriods =
                                session.soTiet || Math.max(1, session.tietEnd - session.tietStart + 1);
                              const topPx = (session.tietStart - 1) * 70 + 3;
                              const heightPx = numPeriods * 70 - 6;

                              return (
                                <div
                                  key={`${course.id}-day-${d.day}-${idx}`}
                                  className={`tkb-session-block absolute inset-x-1 sm:inset-x-1.5 border border-l-4 ${theme.border} ${theme.bg} ${theme.subtext} p-2 rounded-xl cursor-pointer overflow-hidden flex flex-col justify-between`}
                                  title={`${course.ten_mon}\n${session.gv}\nTiết ${session.tietStart}–${session.tietEnd}\n${session.phong}`}
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                  }}
                                >
                                  <div>
                                    {/* Course Title */}
                                    <div
                                      className={`text-xs sm:text-[13px] font-bold ${theme.text} leading-snug line-clamp-2 text-center mb-1`}
                                    >
                                      {course.ten_mon}
                                    </div>

                                    {/* Group & Room badge */}
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium leading-tight flex-wrap mb-1">
                                      <span className="px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-black/25 border border-black/5 dark:border-white/10 text-foreground/80 tabular-nums">
                                        N{course.nhom_to}
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${theme.badge}`}>
                                        <MapPin className="w-2.5 h-2.5" />
                                        {session.phong}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="space-y-0.5">
                                    {/* Lecturer */}
                                    <div className="text-[10px] font-medium leading-tight text-center line-clamp-1 opacity-80">
                                      {session.gv}
                                    </div>

                                    {/* Period range */}
                                    <div className="text-[10px] opacity-60 text-center tabular-nums">
                                      Tiết {session.tietStart}–{session.tietEnd}
                                    </div>
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
            </div>
          </div>
        ) : (
          /* Card View Mode */
          <div className="px-3 sm:px-6 py-6 space-y-6">
            {DAYS.map((d) => {
              const dayClasses = selectedCourses.filter((c) =>
                c.parsedSessions.some((s) => s.thu === d.day && !s.isUnscheduled && s.tietStart > 0)
              );

              if (dayClasses.length === 0) return null;

              return (
                <div key={d.day} className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground font-display flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                    {d.label}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dayClasses.map((c) => {
                      const sess = c.parsedSessions.find((s) => s.thu === d.day)!;
                      const themeIdx = subjectColorMap.get(c.ma_mon) || 0;
                      const theme = COLOR_THEMES[themeIdx];

                      return (
                        <div
                          key={c.id}
                          className={`p-4 rounded-xl border border-border/80 ${theme.bg} shadow-2xs hover:shadow-sm transition-all duration-150 space-y-2`}
                        >
                          <div className="font-bold text-sm text-foreground font-display">{c.ten_mon}</div>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div>Mã môn: <span className="tabular-nums font-medium">{c.ma_mon}</span> - Nhóm <span className="tabular-nums font-medium">{c.nhom_to}</span></div>
                            <div>Thời gian: Tiết {sess.tietStart}–{sess.tietEnd} ({sess.thoi_gian})</div>
                            <div>Phòng: {sess.phong}</div>
                            <div>Giảng viên: {sess.gv}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Section: Selected Courses List */}
      <div className="px-4 sm:px-6 py-5 border border-border/80 bg-card shadow-xs rounded-2xl">
        <div className="w-full">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="text-sm sm:text-base tracking-tight font-bold text-foreground font-display">
              Danh sách nhóm tổ đã chọn ({selectedCourses.length})
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full tabular-nums">
                Tổng: {totalCredits} tín chỉ
              </div>
              <div className="flex items-center border border-border/80 p-0.5 bg-muted/40 rounded-xl">
                <button
                  onClick={() => setSelectedListViewMode('card')}
                  className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1.5 h-7 px-2.5 text-xs rounded-lg cursor-pointer ${
                    selectedListViewMode === 'card'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  type="button"
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                  Thẻ
                </button>
                <button
                  onClick={() => setSelectedListViewMode('table')}
                  className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1.5 h-7 px-2.5 text-xs rounded-lg cursor-pointer ${
                    selectedListViewMode === 'table'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  type="button"
                >
                  <TableProperties className="w-3.5 h-3.5 mr-1" />
                  Bảng
                </button>
              </div>
            </div>
          </div>

          {selectedListViewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedCourses.map((course) => (
                <div
                  key={course.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-background hover:bg-muted/30 transition-all duration-150 flex items-start justify-between gap-3 group/item shadow-2xs"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-foreground truncate font-display">
                      {course.ten_mon}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-foreground font-medium tabular-nums">
                        {course.ma_mon}
                      </span>
                      <span className="tabular-nums">Nhóm {course.nhom_to}</span>
                      <span className="tabular-nums">{course.so_tc} TC</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                        Còn {course.sl_cl}
                      </span>
                    </div>
                    {course.isUnscheduled && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        ⚠️ Chưa xếp lịch học (chờ trường công bố)
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeGroupFromActiveTab(course.id)}
                    className="inline-flex items-center justify-center size-8 rounded-xl border border-border/80 bg-background hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 text-muted-foreground transition-all duration-150 cursor-pointer shrink-0 active:scale-[0.97]"
                    title="Xóa nhóm tổ"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
              <div className="min-w-[620px] text-xs sm:text-sm">
                <div className="grid grid-cols-[100px_1fr_80px_110px_60px_60px] bg-muted/60 border-b border-border/80 text-xs font-semibold text-muted-foreground">
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60">Mã môn</div>
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60">Tên môn học</div>
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center">Nhóm</div>
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center">Chỗ trống</div>
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center">TC</div>
                  <div className="px-2 py-2.5 text-center">Xóa</div>
                </div>
                <div className="divide-y divide-border/60">
                  {selectedCourses.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[100px_1fr_80px_110px_60px_60px] hover:bg-muted/30 transition-colors items-center"
                    >
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 font-medium text-foreground/80 tabular-nums">
                        {c.ma_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 font-medium text-foreground leading-snug">
                        {c.ten_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center font-medium text-foreground tabular-nums">
                        {c.nhom_to}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          Còn {c.sl_cl}
                        </span>
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center font-medium text-foreground tabular-nums">
                        {c.so_tc}
                      </div>
                      <div className="px-2 py-2 flex justify-center">
                        <button
                          onClick={() => removeGroupFromActiveTab(c.id)}
                          className="inline-flex items-center justify-center size-8 rounded-xl border border-border/80 bg-background hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 text-muted-foreground transition-all duration-150 cursor-pointer active:scale-[0.97]"
                          title="Xóa môn này"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
