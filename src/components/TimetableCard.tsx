import React, { useRef } from 'react';
import {
  Calendar,
  LayoutGrid,
  TableProperties,
  Trash,
  Camera,
  Upload,
  Download,
  Trash2,
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

// Color palette cycle for distinct subjects
const COLOR_THEMES = [
  {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    border: 'border-blue-500 dark:border-blue-400',
    text: 'text-sky-900 dark:text-sky-100',
    subtext: 'text-slate-700 dark:text-slate-300',
  },
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    border: 'border-emerald-500 dark:border-emerald-400',
    text: 'text-emerald-900 dark:text-emerald-100',
    subtext: 'text-slate-700 dark:text-slate-300',
  },
  {
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    border: 'border-purple-500 dark:border-purple-400',
    text: 'text-purple-900 dark:text-purple-100',
    subtext: 'text-slate-700 dark:text-slate-300',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-500 dark:border-amber-400',
    text: 'text-amber-900 dark:text-amber-100',
    subtext: 'text-slate-700 dark:text-slate-300',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'border-rose-500 dark:border-rose-400',
    text: 'text-rose-900 dark:text-rose-100',
    subtext: 'text-slate-700 dark:text-slate-300',
  },
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    border: 'border-indigo-500 dark:border-indigo-400',
    text: 'text-indigo-900 dark:text-indigo-100',
    subtext: 'text-slate-700 dark:text-slate-300',
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

  // Color map for selected subjects
  const subjectColorMap = React.useMemo(() => {
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
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0a0a0a' : '#ffffff',
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

  // If no courses selected in this plan
  if (selectedCourses.length === 0) {
    return (
      <div className="bg-card border border-border overflow-hidden shadow-sm">
        <div className="px-6 py-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center justify-center text-muted-foreground">
              <Calendar className="w-16 h-16 stroke-[1.5]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Chưa có môn học nào</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tìm kiếm và chọn các môn học bạn muốn đăng ký ở trên, hoặc tải lên file JSON để khôi
                phục thời khóa biểu
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onTriggerUpload}
                className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-4 py-2 gap-2 rounded-none cursor-pointer"
                type="button"
              >
                <Upload className="w-4 h-4" />
                Tải lên TKB
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card shadow-sm border border-border overflow-hidden">
        {/* Card Header & Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-3 sm:px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">Thời khóa biểu của bạn</h2>
            <span className="text-xs font-mono font-medium text-muted-foreground px-2.5 py-1 bg-muted border border-border">
              {totalCredits} tín chỉ
            </span>
            <span className="text-xs font-mono font-medium text-muted-foreground px-2.5 py-1 bg-muted border border-border">
              {selectedCourses.length} môn
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* View Mode Toggle: Thẻ / Lưới */}
            <div className="flex items-center border border-border p-0.5 bg-muted/40">
              <button
                onClick={() => setTimetableViewMode('card')}
                className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all gap-1.5 h-8 px-2.5 text-xs font-mono rounded-none cursor-pointer ${
                  timetableViewMode === 'card'
                    ? 'bg-secondary text-secondary-foreground shadow-xs'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                }`}
                type="button"
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                Thẻ
              </button>
              <button
                onClick={() => setTimetableViewMode('grid')}
                className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all gap-1.5 h-8 px-2.5 text-xs font-mono rounded-none cursor-pointer ${
                  timetableViewMode === 'grid'
                    ? 'bg-secondary text-secondary-foreground shadow-xs'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                }`}
                type="button"
              >
                <TableProperties className="w-3.5 h-3.5 mr-1" />
                Lưới
              </button>
            </div>

            {/* Clear All */}
            <button
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa tất cả môn học trong phiên bản này?')) {
                  clearActiveTabSelection();
                }
              }}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-8 w-8 cursor-pointer rounded-none hover:text-destructive hover:bg-destructive/10"
              title="Xóa tất cả"
              type="button"
            >
              <Trash className="w-4 h-4" />
            </button>

            {/* Chụp ảnh */}
            <button
              onClick={handleCaptureImage}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-8 w-8 cursor-pointer rounded-none"
              title="Chụp ảnh"
              type="button"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Tải lên TKB */}
            <button
              onClick={onTriggerUpload}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-8 w-8 cursor-pointer rounded-none"
              title="Tải lên TKB"
              type="button"
            >
              <Upload className="w-4 h-4" />
            </button>

            {/* Tải xuống TKB */}
            <button
              onClick={handleDownloadJson}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-8 w-8 cursor-pointer rounded-none"
              title="Tải xuống TKB"
              type="button"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Timetable Content: Grid or Card Mode */}
        {timetableViewMode === 'grid' ? (
          <div className="px-3 sm:px-6 py-4">
            <div className="w-full space-y-2">
              {/* Mobile notice */}
              <div className="md:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <span>←</span> Vuốt ngang để xem đủ 7 ngày <span>→</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-muted border border-border">
                  Lưới TKB
                </span>
              </div>

              {/* Grid Target for Capture */}
              <div className="overflow-x-auto md:overflow-x-visible overscroll-x-contain">
                <div className="w-full min-w-[1100px] md:min-w-0">
                  <div
                    ref={timetableRef}
                    className="timetable-capture-target w-full bg-background overflow-hidden border border-b-0 border-r-0 dark:border-b dark:border-r"
                  >
                    {/* Grid Days Header */}
                    <div className="grid grid-cols-[42px_80px_repeat(7,minmax(140px,1fr))] md:grid-cols-[48px_82px_repeat(7,1fr)] lg:grid-cols-[56px_96px_repeat(7,1fr)]">
                      <div className="flex items-center justify-center border-r border-b border-border py-3 text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted">
                        Tiết
                      </div>
                      <div className="flex items-center justify-center border-r border-b border-border py-3 text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted">
                        Giờ
                      </div>
                      {DAYS.map((d) => (
                        <div
                          key={d.day}
                          className="flex flex-col items-center justify-center py-3 border-r border-b border-border bg-muted"
                        >
                          <span className="text-sm font-bold text-foreground">{d.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Grid Body */}
                    <div className="grid grid-cols-[42px_80px_repeat(7,minmax(140px,1fr))] md:grid-cols-[48px_82px_repeat(7,1fr)] lg:grid-cols-[56px_96px_repeat(7,1fr)] text-xs bg-background relative">
                      {/* Column 1: Periods 1 to 13 */}
                      <div className="border-r border-border bg-background">
                        {Array.from({ length: 13 }, (_, i) => (
                          <div
                            key={i + 1}
                            className="border-b border-border flex items-center justify-center text-xs font-mono font-semibold text-muted-foreground"
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
                            className="border-b border-border flex flex-col items-center justify-center text-[10px] sm:text-[11px] font-mono text-muted-foreground leading-tight px-1"
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
                        // Gather all sessions happening on day d.day
                        const daySessions: Array<{
                          course: ClassGroup;
                          session: ScheduleSession;
                        }> = [];

                        selectedCourses.forEach((course) => {
                          course.parsedSessions.forEach((sess) => {
                            if (sess.thu === d.day) {
                              daySessions.push({ course, session: sess });
                            }
                          });
                        });

                        return (
                          <div
                            key={d.day}
                            className="relative border-r border-border bg-background"
                            style={{ minHeight: '910px' }}
                          >
                            {/* 13 Period Grid Cell lines */}
                            {Array.from({ length: 13 }, (_, i) => (
                              <div
                                key={i}
                                className="border-b border-border"
                                style={{ height: '70px' }}
                              />
                            ))}

                            {/* Render Schedule Blocks */}
                            {daySessions.map(({ course, session }, idx) => {
                              const themeIdx =
                                subjectColorMap.get(course.ma_mon) || 0;
                              const theme = COLOR_THEMES[themeIdx];

                              const numPeriods = session.soTiet || Math.max(1, session.tietEnd - session.tietStart + 1);
                              const topPx = (session.tietStart - 1) * 70 + 3;
                              const heightPx = numPeriods * 70 - 6;

                              return (
                                <div
                                  key={`${course.id}-day-${d.day}-${idx}`}
                                  className={`absolute inset-x-1 sm:inset-x-1.5 shadow-xs cursor-pointer overflow-hidden ${theme.bg} border-l-4 ${theme.border} ${theme.subtext} px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-md transition-transform hover:scale-[1.01] hover:z-10`}
                                  title={`${course.ten_mon}\n${session.gv}\nTiết ${session.tietStart}–${session.tietEnd}\n${session.phong}`}
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                  }}
                                >
                                  <div
                                    className={`text-xs sm:text-[13px] font-bold ${theme.text} leading-snug line-clamp-2 text-center mb-0.5 sm:mb-1`}
                                  >
                                    {course.ten_mon}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] font-medium leading-tight text-center">
                                    Mã môn: {course.ma_mon}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] font-medium leading-tight text-center">
                                    Phòng: {session.phong}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] font-medium leading-tight text-center mt-0.5 line-clamp-2">
                                    {session.gv}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] font-medium leading-tight text-muted-foreground text-center mt-0.5">
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
                c.parsedSessions.some((s) => s.thu === d.day)
              );

              if (dayClasses.length === 0) return null;

              return (
                <div key={d.day} className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-2">
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
                          className={`p-3 rounded-lg border border-border ${theme.bg} space-y-2`}
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
      <div className="px-3 sm:px-6 py-4 border border-border mt-4 bg-card shadow-sm">
        <div className="w-full bg-card">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3 sm:mb-4">
            <div className="uppercase text-sm sm:text-base tracking-wide font-bold text-foreground">
              Danh sách nhóm tổ đã chọn ({selectedCourses.length})
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs font-mono font-bold bg-muted px-2.5 py-1 text-foreground border border-border">
                Tổng: {totalCredits} tín chỉ
              </div>
              <div className="flex items-center border border-border p-0.5 bg-muted/40">
                <button
                  onClick={() => setSelectedListViewMode('card')}
                  className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all gap-1.5 h-7 px-2 text-xs font-mono rounded-none cursor-pointer ${
                    selectedListViewMode === 'card'
                      ? 'bg-secondary text-secondary-foreground shadow-xs'
                      : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }`}
                  type="button"
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                  Thẻ
                </button>
                <button
                  onClick={() => setSelectedListViewMode('table')}
                  className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all gap-1.5 h-7 px-2 text-xs font-mono rounded-none cursor-pointer ${
                    selectedListViewMode === 'table'
                      ? 'bg-secondary text-secondary-foreground shadow-xs'
                      : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
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
            /* Selected Cards View */
            <div className="block space-y-2.5">
              {selectedCourses.map((course) => (
                <div
                  key={course.id}
                  className="border border-border p-3 bg-card flex items-center justify-between gap-3 shadow-2xs hover:border-foreground/20 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {course.ten_mon}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
                      <span className="bg-muted px-1.5 py-0.5 text-foreground font-medium">
                        Mã: {course.ma_mon}
                      </span>
                      <span>Nhóm: {course.nhom_to}</span>
                      <span>{course.so_tc} TC</span>
                      <span>
                        {course.sl_cl}/{course.sl_cp} chỗ
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeGroupFromActiveTab(course.id)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium border bg-background shadow-xs dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 transition cursor-pointer rounded-none shrink-0"
                    title="Xóa nhóm tổ"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Selected Table View */
            <div>
              <div className="sm:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground font-mono mb-1.5">
                <span className="flex items-center gap-1">
                  <span>←</span> Vuốt ngang để xem đủ <span>→</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-muted border border-border">
                  Đã chọn
                </span>
              </div>
              <div className="overflow-x-auto overscroll-x-contain border border-border bg-card">
                <div className="w-full min-w-[780px]">
                  <div className="grid grid-cols-[90px_minmax(240px,1fr)_75px_100px_75px_65px] font-bold text-xs sm:text-sm border-b border-border bg-muted">
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider font-bold">
                      Mã
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider font-bold">
                      Tên môn
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider font-bold">
                      Nhóm
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider font-bold">
                      Số lượng
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider font-bold">
                      Số TC
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 text-center text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider font-bold">
                      Xóa
                    </div>
                  </div>

                  {selectedCourses.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[90px_minmax(240px,1fr)_75px_100px_75px_65px] text-xs sm:text-sm border-b border-border last:border-b-0 hover:bg-muted/50 transition items-center"
                    >
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border font-mono font-bold text-foreground">
                        {c.ma_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border font-medium text-foreground leading-snug">
                        {c.ten_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center font-mono text-foreground">
                        {c.nhom_to}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium text-foreground bg-muted">
                          {c.sl_cl}/{c.sl_cp}
                        </span>
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center font-mono font-bold text-foreground">
                        {c.so_tc}
                      </div>
                      <div className="px-2 py-2 flex justify-center">
                        <button
                          onClick={() => removeGroupFromActiveTab(c.id)}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium border bg-background shadow-xs dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 transition cursor-pointer rounded-none"
                          title="Xóa nhóm tổ"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-[90px_minmax(240px,1fr)_75px_100px_75px_65px] font-semibold text-xs sm:text-sm bg-muted/60 border-t border-border">
                    <div className="col-span-4 px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-foreground font-bold">
                      Tổng số tín chỉ
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-r border-border text-center font-mono font-bold text-foreground">
                      {totalCredits}
                    </div>
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
