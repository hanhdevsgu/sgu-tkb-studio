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
  { day: 2, label: 'Thứ 2', short: 'T2' },
  { day: 3, label: 'Thứ 3', short: 'T3' },
  { day: 4, label: 'Thứ 4', short: 'T4' },
  { day: 5, label: 'Thứ 5', short: 'T5' },
  { day: 6, label: 'Thứ 6', short: 'T6' },
  { day: 7, label: 'Thứ 7', short: 'T7' },
  { day: 8, label: 'Chủ nhật', short: 'CN' },
];

// Rich, high-contrast color palette with glass tinting & glowing borders
const COLOR_THEMES = [
  {
    bg: 'bg-cyan-500/10 dark:bg-cyan-950/40 backdrop-blur-xs',
    border: 'border-l-cyan-500 dark:border-l-cyan-400 border-cyan-500/30',
    text: 'text-cyan-950 dark:text-cyan-100',
    subtext: 'text-cyan-900/80 dark:text-cyan-200/80',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  },
  {
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/40 backdrop-blur-xs',
    border: 'border-l-emerald-500 dark:border-l-emerald-400 border-emerald-500/30',
    text: 'text-emerald-950 dark:text-emerald-100',
    subtext: 'text-emerald-900/80 dark:text-emerald-200/80',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  {
    bg: 'bg-indigo-500/10 dark:bg-indigo-950/40 backdrop-blur-xs',
    border: 'border-l-indigo-500 dark:border-l-indigo-400 border-indigo-500/30',
    text: 'text-indigo-950 dark:text-indigo-100',
    subtext: 'text-indigo-900/80 dark:text-indigo-200/80',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  {
    bg: 'bg-amber-500/10 dark:bg-amber-950/40 backdrop-blur-xs',
    border: 'border-l-amber-500 dark:border-l-amber-400 border-amber-500/30',
    text: 'text-amber-950 dark:text-amber-100',
    subtext: 'text-amber-900/80 dark:text-amber-200/80',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    bg: 'bg-rose-500/10 dark:bg-rose-950/40 backdrop-blur-xs',
    border: 'border-l-rose-500 dark:border-l-rose-400 border-rose-500/30',
    text: 'text-rose-950 dark:text-rose-100',
    subtext: 'text-rose-900/80 dark:text-rose-200/80',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  {
    bg: 'bg-purple-500/10 dark:bg-purple-950/40 backdrop-blur-xs',
    border: 'border-l-purple-500 dark:border-l-purple-400 border-purple-500/30',
    text: 'text-purple-950 dark:text-purple-100',
    subtext: 'text-purple-900/80 dark:text-purple-200/80',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
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
        backgroundColor: document.documentElement.classList.contains('dark') ? '#080c14' : '#ffffff',
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
      <div className="bg-card/90 backdrop-blur-md border border-border/80 overflow-hidden shadow-md rounded-2xl transition-all duration-300 hover:border-cyan-500/30">
        <div className="px-6 py-14 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto border border-cyan-500/20 shadow-xs">
              <Calendar className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-foreground font-sans">
                Chưa có môn học nào được chọn
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Tìm kiếm và chọn các môn học bạn muốn đăng ký ở ô phía trên, hoặc tải lên file JSON để khôi phục lịch học đã lưu.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onTriggerUpload}
                className="inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm font-medium transition-all duration-200 border border-border/80 bg-background/90 shadow-2xs hover:bg-muted/60 hover:border-cyan-500/40 h-10 px-4 py-2 gap-2 rounded-xl cursor-pointer hover:scale-105 active:scale-95"
                type="button"
              >
                <Upload className="w-4 h-4 text-cyan-500" />
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
      <div className="bg-card/90 backdrop-blur-md shadow-md border border-border/80 overflow-hidden rounded-2xl transition-all duration-300 hover:border-cyan-500/30 hover:shadow-cyan-500/5 hover:shadow-xl">
        {/* Card Header & Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 sm:px-6 py-4 border-b border-border/70">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-foreground font-sans tracking-tight">
              Thời khóa biểu của bạn
            </h2>
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 px-3 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/25">
              {totalCredits} tín chỉ
            </span>
            <span className="text-xs font-mono font-medium text-muted-foreground px-2.5 py-0.5 bg-muted rounded-full border border-border/60">
              {selectedCourses.length} môn
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Thẻ / Lưới */}
            <div className="flex items-center border border-border/80 p-0.5 bg-muted/50 rounded-xl">
              <button
                onClick={() => setTimetableViewMode('card')}
                className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 gap-1.5 h-8 px-3 text-xs font-mono rounded-lg cursor-pointer ${
                  timetableViewMode === 'card'
                    ? 'bg-card text-cyan-600 dark:text-cyan-400 shadow-xs font-bold border border-border/50'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                type="button"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Thẻ
              </button>
              <button
                onClick={() => setTimetableViewMode('grid')}
                className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 gap-1.5 h-8 px-3 text-xs font-mono rounded-lg cursor-pointer ${
                  timetableViewMode === 'grid'
                    ? 'bg-card text-cyan-600 dark:text-cyan-400 shadow-xs font-bold border border-border/50'
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
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 border border-border/80 bg-background/90 shadow-2xs size-9 h-8 w-8 cursor-pointer rounded-xl hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 hover:scale-105 active:scale-95 group/del"
              title="Xóa tất cả môn học"
              type="button"
            >
              <Trash className="w-4 h-4 text-muted-foreground group-hover/del:text-rose-500 transition-colors" />
            </button>

            {/* Capture PNG */}
            <button
              onClick={handleCaptureImage}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 border border-border/80 bg-background/90 shadow-2xs hover:bg-muted/60 hover:border-cyan-500/40 size-9 h-8 w-8 cursor-pointer rounded-xl hover:scale-105 active:scale-95"
              title="Chụp ảnh thời khóa biểu (PNG)"
              type="button"
            >
              <Camera className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* Upload JSON */}
            <button
              onClick={onTriggerUpload}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 border border-border/80 bg-background/90 shadow-2xs hover:bg-muted/60 hover:border-cyan-500/40 size-9 h-8 w-8 cursor-pointer rounded-xl hover:scale-105 active:scale-95"
              title="Tải lên file JSON"
              type="button"
            >
              <Upload className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* Download JSON */}
            <button
              onClick={handleDownloadJson}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 border border-border/80 bg-background/90 shadow-2xs hover:bg-muted/60 hover:border-cyan-500/40 size-9 h-8 w-8 cursor-pointer rounded-xl hover:scale-105 active:scale-95"
              title="Tải xuống file JSON"
              type="button"
            >
              <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        {/* Unscheduled courses alert banner */}
        {unscheduledCourses.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 backdrop-blur-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <div className="font-bold text-amber-800 dark:text-amber-200 text-sm">
                  Có {unscheduledCourses.length} môn học đã chọn nhưng trường chưa xếp lịch (chưa có Thứ/Tiết):
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  {unscheduledCourses.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">• {c.ten_mon}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                        Mã: {c.ma_mon} - Nhóm {c.nhom_to}
                      </span>
                      <span>— {c.so_tc} tín chỉ</span>
                      {c.parsedSessions[0]?.gv && <span>({c.parsedSessions[0].gv})</span>}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] opacity-80 italic pt-0.5">
                  * Các môn này vẫn được tính đủ {unscheduledCourses.reduce((sum, c) => sum + c.so_tc, 0)} tín chỉ vào tổng kết, nhưng chưa hiển thị trên lưới thời khóa biểu do trường chưa sắp xếp phòng & ngày học.
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
              <div className="md:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <span>←</span> Vuốt ngang để xem đủ 7 ngày <span>→</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-muted rounded-md border border-border">
                  Lưới TKB
                </span>
              </div>

              {/* Grid Target for Capture */}
              <div className="overflow-x-auto md:overflow-x-visible overscroll-x-contain rounded-xl border border-border/80 shadow-xs">
                <div className="w-full min-w-[1100px] md:min-w-0">
                  <div
                    ref={timetableRef}
                    className="timetable-capture-target w-full bg-background overflow-hidden"
                  >
                    {/* Grid Days Header */}
                    <div className="grid grid-cols-[48px_86px_repeat(7,minmax(140px,1fr))] md:grid-cols-[52px_88px_repeat(7,1fr)] lg:grid-cols-[58px_96px_repeat(7,1fr)]">
                      <div className="flex items-center justify-center border-r border-b border-border py-3 text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted/70">
                        Tiết
                      </div>
                      <div className="flex items-center justify-center border-r border-b border-border py-3 text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted/70">
                        Giờ
                      </div>
                      {DAYS.map((d) => (
                        <div
                          key={d.day}
                          className="flex flex-col items-center justify-center py-3 border-r border-b border-border bg-muted/70"
                        >
                          <span className="text-sm font-bold text-foreground font-sans">{d.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Grid Body */}
                    <div className="grid grid-cols-[48px_86px_repeat(7,minmax(140px,1fr))] md:grid-cols-[52px_88px_repeat(7,1fr)] lg:grid-cols-[58px_96px_repeat(7,1fr)] text-xs bg-background relative">
                      {/* Column 1: Periods 1 to 13 */}
                      <div className="border-r border-border bg-background">
                        {Array.from({ length: 13 }, (_, i) => (
                          <div
                            key={i + 1}
                            className="border-b border-border flex items-center justify-center text-xs font-mono font-bold text-muted-foreground/90 hover:text-cyan-500 hover:bg-cyan-500/5 transition-colors"
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
                            className="border-b border-border flex flex-col items-center justify-center text-[10px] sm:text-[11px] font-mono text-muted-foreground leading-tight px-1 hover:bg-cyan-500/5 transition-colors"
                            style={{ height: '70px' }}
                          >
                            <span className="font-medium text-foreground/90">{hr.start}</span>
                            <span className="text-[9px] text-muted-foreground/40 font-sans">↓</span>
                            <span className="text-muted-foreground/90">{hr.end}</span>
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
                            className="relative border-r border-border bg-background hover:bg-muted/10 transition-colors"
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

                            {/* Render Schedule Blocks with Hover Motion & Glow */}
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
                                  className={`absolute inset-x-1 sm:inset-x-1.5 shadow-sm border border-l-4 ${theme.border} ${theme.bg} ${theme.subtext} px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.03] hover:shadow-xl hover:shadow-cyan-500/15 hover:z-30 overflow-hidden group/block`}
                                  title={`${course.ten_mon}\n${session.gv}\nTiết ${session.tietStart}–${session.tietEnd}\n${session.phong}`}
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                  }}
                                >
                                  {/* Course Title */}
                                  <div
                                    className={`text-xs sm:text-[13px] font-bold ${theme.text} leading-snug line-clamp-2 text-center mb-1 group-hover/block:text-cyan-500 dark:group-hover/block:text-cyan-400 transition-colors`}
                                  >
                                    {course.ten_mon}
                                  </div>

                                  {/* Code & Group badge */}
                                  <div className="flex items-center justify-center gap-1 text-[10px] font-mono font-medium leading-tight mb-1">
                                    <span className="px-1.5 py-0.2 rounded-md bg-background/60 shadow-2xs">
                                      {course.ma_mon}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded-md bg-background/60 shadow-2xs font-bold">
                                      N{course.nhom_to}
                                    </span>
                                  </div>

                                  {/* Room Badge */}
                                  <div className="text-[10px] sm:text-[11px] font-mono font-semibold text-center leading-tight mb-0.5">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${theme.badge} shadow-2xs`}>
                                      <MapPin className="w-2.5 h-2.5" />
                                      {session.phong}
                                    </span>
                                  </div>

                                  {/* Lecturer */}
                                  <div className="text-[10px] font-medium leading-tight text-center line-clamp-1 opacity-90 mt-0.5">
                                    {session.gv}
                                  </div>

                                  {/* Period range */}
                                  <div className="text-[10px] font-mono opacity-75 text-center mt-0.5">
                                    Tiết {session.tietStart}–{session.tietEnd}
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
                  <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block shadow-xs shadow-cyan-500/50"></span>
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
                          className={`p-4 rounded-xl border border-border/80 ${theme.bg} shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-2`}
                        >
                          <div className="font-bold text-sm text-foreground">{c.ten_mon}</div>
                          <div className="text-xs space-y-1 text-muted-foreground font-mono">
                            <div>Mã môn: {c.ma_mon} - Nhóm {c.nhom_to}</div>
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
      <div className="px-4 sm:px-6 py-5 border border-border/80 bg-card/90 backdrop-blur-md shadow-md rounded-2xl transition-all duration-300 hover:border-cyan-500/30">
        <div className="w-full">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="text-sm sm:text-base tracking-tight font-bold text-foreground font-sans">
              Danh sách nhóm tổ đã chọn ({selectedCourses.length})
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="text-xs font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/25">
                Tổng: {totalCredits} tín chỉ
              </div>
              <div className="flex items-center border border-border/80 p-0.5 bg-muted/50 rounded-xl">
                <button
                  onClick={() => setSelectedListViewMode('card')}
                  className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 gap-1.5 h-7 px-2.5 text-xs font-mono rounded-lg cursor-pointer ${
                    selectedListViewMode === 'card'
                      ? 'bg-card text-cyan-600 dark:text-cyan-400 shadow-xs font-bold'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  type="button"
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                  Thẻ
                </button>
                <button
                  onClick={() => setSelectedListViewMode('table')}
                  className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 gap-1.5 h-7 px-2.5 text-xs font-mono rounded-lg cursor-pointer ${
                    selectedListViewMode === 'table'
                      ? 'bg-card text-cyan-600 dark:text-cyan-400 shadow-xs font-bold'
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
                  className="p-3.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/40 hover:border-cyan-500/40 hover:-translate-y-0.5 shadow-2xs hover:shadow-md transition-all duration-200 flex items-start justify-between gap-3 group/item"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-foreground truncate font-sans">
                      {course.ten_mon}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-foreground font-medium">
                        Mã: {course.ma_mon}
                      </span>
                      <span>Nhóm: {course.nhom_to}</span>
                      <span>{course.so_tc} TC</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                        Còn {course.sl_cl}
                      </span>
                    </div>
                    {course.isUnscheduled && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                        ⚠️ Chưa xếp lịch học (chờ trường công bố)
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeGroupFromActiveTab(course.id)}
                    className="inline-flex items-center justify-center size-8 rounded-xl border border-border/80 bg-background hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 text-muted-foreground transition-all duration-200 cursor-pointer shrink-0 hover:scale-105 active:scale-95"
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
              <div className="min-w-[640px] text-xs sm:text-sm">
                <div className="grid grid-cols-[100px_1fr_80px_110px_60px_60px] bg-muted/70 border-b border-border/80 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                  <div className="px-3 sm:px-4 py-3 border-r border-border/60">Mã môn</div>
                  <div className="px-3 sm:px-4 py-3 border-r border-border/60">Tên môn</div>
                  <div className="px-3 sm:px-4 py-3 border-r border-border/60 text-center">Nhóm</div>
                  <div className="px-3 sm:px-4 py-3 border-r border-border/60 text-center">Chỗ trống</div>
                  <div className="px-3 sm:px-4 py-3 border-r border-border/60 text-center">TC</div>
                  <div className="px-2 py-3 text-center">Xóa</div>
                </div>
                <div className="divide-y divide-border/60">
                  {selectedCourses.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[100px_1fr_80px_110px_60px_60px] hover:bg-cyan-500/5 transition-colors items-center"
                    >
                      <div className="px-3 sm:px-4 py-3 border-r border-border/60 font-mono font-bold text-foreground">
                        {c.ma_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-3 border-r border-border/60 font-medium text-foreground leading-snug">
                        {c.ten_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-3 border-r border-border/60 text-center font-mono text-foreground font-bold">
                        {c.nhom_to}
                      </div>
                      <div className="px-3 sm:px-4 py-3 border-r border-border/60 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          Còn {c.sl_cl}
                        </span>
                      </div>
                      <div className="px-3 sm:px-4 py-3 border-r border-border/60 text-center font-mono font-bold text-foreground">
                        {c.so_tc}
                      </div>
                      <div className="px-2 py-2 flex justify-center">
                        <button
                          onClick={() => removeGroupFromActiveTab(c.id)}
                          className="inline-flex items-center justify-center size-8 rounded-xl border border-border/80 bg-background hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 text-muted-foreground transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
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
