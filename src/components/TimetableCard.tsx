import React, { useMemo, useState } from 'react';
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
  Clock,
  Zap,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup, ScheduleSession } from '../types/course';
import { doDateRangesOverlap } from '../utils/conflictDetector';
import { ExportPngModal } from './ExportPngModal';

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
];

// Refined, human-friendly color palette with good contrast
const COLOR_THEMES = [
  {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-l-sky-500 border-sky-300 dark:border-sky-800',
    text: 'text-sky-950 dark:text-sky-100',
    subtext: 'text-sky-900/90 dark:text-sky-200/90',
    badge: 'bg-sky-100/90 dark:bg-sky-900/50 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800',
  },
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-l-emerald-500 border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-950 dark:text-emerald-100',
    subtext: 'text-emerald-900/90 dark:text-emerald-200/90',
    badge: 'bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
  },
  {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-l-violet-500 border-violet-300 dark:border-violet-800',
    text: 'text-violet-950 dark:text-violet-100',
    subtext: 'text-violet-900/90 dark:text-violet-200/90',
    badge: 'bg-violet-100/90 dark:bg-violet-900/50 text-violet-900 dark:text-violet-200 border-violet-300 dark:border-violet-800',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-l-amber-500 border-amber-300 dark:border-amber-800',
    text: 'text-amber-950 dark:text-amber-100',
    subtext: 'text-amber-900/90 dark:text-amber-200/90',
    badge: 'bg-amber-100/90 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-l-rose-500 border-rose-300 dark:border-rose-800',
    text: 'text-rose-950 dark:text-rose-100',
    subtext: 'text-rose-900/90 dark:text-rose-200/90',
    badge: 'bg-rose-100/90 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
  },
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-l-indigo-500 border-indigo-300 dark:border-indigo-800',
    text: 'text-indigo-950 dark:text-indigo-100',
    subtext: 'text-indigo-900/90 dark:text-indigo-200/90',
    badge: 'bg-indigo-100/90 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800',
  },
];

/**
 * Deterministic color index based on course code so each course always gets a stable color
 */
function getCourseColorIndex(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % COLOR_THEMES.length;
}

/**
 * Lane layout algorithm:
 * 1. Merges multi-phase sessions of the same course that share the exact same day & period range
 * 2. Splits genuinely overlapping sessions into parallel columns per overlap cluster
 */
function layoutDaySessions(items: Array<{ course: ClassGroup; session: ScheduleSession }>) {
  // Merge same-course sessions on the exact same period range (e.g. different date phases)
  const mergedMap = new Map<string, { course: ClassGroup; session: ScheduleSession }>();
  for (const item of items) {
    const key = `${item.course.id}__${item.session.tietStart}__${item.session.tietEnd}`;
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, { course: item.course, session: { ...item.session } });
    } else {
      const s1 = existing.session;
      const s2 = item.session;
      if (s2.phong && s2.phong !== s1.phong && !s1.phong.includes(s2.phong)) {
        s1.phong = s1.phong ? `${s1.phong} / ${s2.phong}` : s2.phong;
      }
      if (s2.gv && s2.gv !== s1.gv && !s1.gv.includes(s2.gv)) {
        s1.gv = s1.gv ? `${s1.gv} / ${s2.gv}` : s2.gv;
      }
      if (s2.dates && s2.dates !== s1.dates && !(s1.dates || '').includes(s2.dates)) {
        s1.dates = s1.dates ? `${s1.dates}; ${s2.dates}` : s2.dates;
      }
    }
  }

  const deduped = Array.from(mergedMap.values()).sort(
    (a, b) => a.session.tietStart - b.session.tietStart || a.session.tietEnd - b.session.tietEnd
  );

  // Group into connected period-overlap clusters so non-overlapping periods keep 100% width
  const results: Array<{ course: ClassGroup; session: ScheduleSession; lane: number; clusterLaneCount: number }> = [];
  let cluster: Array<{ course: ClassGroup; session: ScheduleSession }> = [];
  let clusterMaxEnd = -1;

  const flushCluster = (grp: Array<{ course: ClassGroup; session: ScheduleSession }>) => {
    if (grp.length === 0) return;
    const laneEnds: number[] = [];
    const placedGrp = grp.map((it) => {
      let lane = laneEnds.findIndex((end) => end < it.session.tietStart);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.session.tietEnd);
      } else {
        laneEnds[lane] = it.session.tietEnd;
      }
      return { ...it, lane };
    });
    const cLaneCount = Math.max(1, laneEnds.length);
    for (const p of placedGrp) {
      results.push({ ...p, clusterLaneCount: cLaneCount });
    }
  };

  for (const item of deduped) {
    if (cluster.length === 0 || item.session.tietStart <= clusterMaxEnd) {
      cluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.session.tietEnd);
    } else {
      flushCluster(cluster);
      cluster = [item];
      clusterMaxEnd = item.session.tietEnd;
    }
  }
  flushCluster(cluster);

  return { placed: results };
}

interface TimetableCardProps {
  onTriggerUpload: () => void;
}

export const TimetableCard: React.FC<TimetableCardProps> = ({ onTriggerUpload }) => {
  // Granular Zustand selectors - avoids re-renders on unrelated store changes
  const allCourses = useTimetableStore((s) => s.allCourses);
  const plans = useTimetableStore((s) => s.plans);
  const activeTabId = useTimetableStore((s) => s.activeTabId);
  const timetableViewMode = useTimetableStore((s) => s.timetableViewMode);
  const setTimetableViewMode = useTimetableStore((s) => s.setTimetableViewMode);
  const selectedListViewMode = useTimetableStore((s) => s.selectedListViewMode);
  const setSelectedListViewMode = useTimetableStore((s) => s.setSelectedListViewMode);
  const clearActiveTabSelection = useTimetableStore((s) => s.clearActiveTabSelection);
  const removeGroupFromActiveTab = useTimetableStore((s) => s.removeGroupFromActiveTab);
  const exportScheduleJson = useTimetableStore((s) => s.exportScheduleJson);
  const setToastMessage = useTimetableStore((s) => s.setToastMessage);
  const setAppViewMode = useTimetableStore((s) => s.setAppViewMode);

  const [showExportModal, setShowExportModal] = useState(false);

  // Default mobile day: today's day (2=Mon..7=Sat; Sunday defaults to Mon=2)
  const todayDay = useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 2 : jsDay + 1;
  }, []);

  const [mobileSelectedDay, setMobileSelectedDay] = useState<number | null>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? todayDay : null;
  });

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activeTabId) ?? plans[0],
    [plans, activeTabId]
  );
  const planName = activePlan ? activePlan.name : 'Phương án 1';

  const selectedIds = useMemo(
    () => (activePlan ? activePlan.selectedIds : []),
    [activePlan]
  );

  const selectedCourses = useMemo(() => {
    const idSet = new Set(selectedIds);
    return allCourses.filter((c) => idSet.has(c.id));
  }, [allCourses, selectedIds]);

  const totalCredits = useMemo(() => {
    return selectedCourses.reduce((sum, c) => sum + (c.so_tc || 0), 0);
  }, [selectedCourses]);

  // Unscheduled courses (courses where ALL sessions have no day or period assigned yet by SGU)
  const unscheduledCourses = useMemo(() => {
    return selectedCourses.filter(
      (c) =>
        c.isUnscheduled ||
        !c.parsedSessions ||
        c.parsedSessions.length === 0 ||
        c.parsedSessions.every((s) => s.isUnscheduled || s.thu === 0 || !s.tietStart)
    );
  }, [selectedCourses]);

  // Handle download JSON
  const handleDownloadJson = () => {
    const jsonStr = exportScheduleJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `tkb-sgu-${planName}-${Date.now()}.json`;
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
                className="min-h-[44px] inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 px-4 py-2 gap-2 rounded-xl cursor-pointer active:scale-[0.97]"
                type="button"
                aria-label="Tải lên file JSON thời khóa biểu"
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
            {selectedCourses.length > 0 && (
              <button
                onClick={() => {
                  setAppViewMode('dkmh');
                  setToastMessage(
                    `⚡ Đã chuyển sang cổng Đăng ký học phần! Bấm nút "Nạp nhanh ${selectedCourses.length} môn từ ${planName}" để đưa vào hàng đợi.`
                  );
                }}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-bold transition-all duration-150 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 px-3 cursor-pointer rounded-xl active:scale-[0.97]"
                title={`Chuyển sang cổng Đăng ký học phần với ${selectedCourses.length} môn đã xếp trong ${planName}`}
                type="button"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Đăng ký phương án này</span>
              </button>
            )}

            {/* View Mode Toggle: Thẻ / Lưới */}
            <div className="flex items-center border border-border/80 p-0.5 bg-muted/40 rounded-xl">
              <button
                onClick={() => setTimetableViewMode('card')}
                className={`min-h-[36px] inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1.5 px-3 text-xs rounded-lg cursor-pointer ${
                  timetableViewMode === 'card'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                type="button"
                aria-label="Chuyển sang chế độ xem Thẻ"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Thẻ
              </button>
              <button
                onClick={() => setTimetableViewMode('grid')}
                className={`min-h-[36px] inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1.5 px-3 text-xs rounded-lg cursor-pointer ${
                  timetableViewMode === 'grid'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                type="button"
                aria-label="Chuyển sang chế độ xem Lưới"
              >
                <TableProperties className="w-3.5 h-3.5" />
                Lưới
              </button>
            </div>

            {/* Capture PNG (Opens multi-format modal) */}
            <button
              onClick={() => setShowExportModal(true)}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-semibold transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 px-3 cursor-pointer rounded-xl active:scale-[0.97]"
              title="Xuất ảnh thời khóa biểu (PNG)"
              type="button"
              aria-label="Xuất ảnh thời khóa biểu (PNG)"
            >
              <Camera className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Xuất ảnh PNG</span>
            </button>

            {/* Upload JSON */}
            <button
              onClick={onTriggerUpload}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 p-2 cursor-pointer rounded-xl active:scale-[0.97]"
              title="Tải lên file JSON"
              type="button"
              aria-label="Tải lên file JSON"
            >
              <Upload className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* Download JSON */}
            <button
              onClick={handleDownloadJson}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs hover:bg-muted/60 p-2 cursor-pointer rounded-xl active:scale-[0.97]"
              title="Tải xuống file JSON"
              type="button"
              aria-label="Tải xuống file JSON"
            >
              <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* Clear All - safely placed */}
            <button
              onClick={() => {
                if (window.confirm(`Bạn có chắc muốn xóa tất cả ${selectedCourses.length} môn học trong ${planName}?`)) {
                  clearActiveTabSelection();
                }
              }}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 border border-border/80 bg-background shadow-2xs p-2 cursor-pointer rounded-xl hover:text-rose-600 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-[0.97] group/del"
              title="Xóa tất cả môn học trong phương án này"
              type="button"
              aria-label="Xóa tất cả môn học trong phương án này"
            >
              <Trash className="w-4 h-4 text-muted-foreground group-hover/del:text-rose-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Unscheduled courses alert banner */}
        {unscheduledCourses.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <div className="font-semibold text-sm font-display">
                  Có {unscheduledCourses.length} môn học đã chọn nhưng trường chưa xếp lịch (chưa có Thứ/Tiết):
                </div>
                <div className="space-y-1 text-xs">
                  {unscheduledCourses.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">• {c.ten_mon}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-100 text-[11px] tabular-nums font-mono">
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
            <div className="w-full space-y-3">
              {/* Mobile Day Selector Bar */}
              <div className="md:hidden space-y-2 pb-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-medium">Chế độ xem di động:</span>
                  <span className="text-[11px] text-primary font-semibold">
                    {mobileSelectedDay === null ? 'Lưới cả tuần (Vuốt ngang)' : `Chi tiết ${DAYS.find(d => d.day === mobileSelectedDay)?.label}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setMobileSelectedDay(null)}
                    className={`min-h-[36px] shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                      mobileSelectedDay === null
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Cả tuần (Lưới)
                  </button>
                  {DAYS.map((d) => {
                    const count = selectedCourses.filter((c) =>
                      c.parsedSessions.some((s) => s.thu === d.day && !s.isUnscheduled && s.tietStart > 0)
                    ).length;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setMobileSelectedDay(d.day)}
                        className={`min-h-[36px] shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          mobileSelectedDay === d.day
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{d.label}</span>
                        {count > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-mono ${
                              mobileSelectedDay === d.day
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-background text-foreground'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* If a single day is selected on mobile */}
              {mobileSelectedDay !== null ? (
                <div className="md:hidden space-y-3 py-1">
                  {(() => {
                    const dayClasses: Array<{ course: ClassGroup; session: ScheduleSession }> = [];
                    selectedCourses.forEach((c) => {
                      c.parsedSessions.forEach((s) => {
                        if (s.thu === mobileSelectedDay && !s.isUnscheduled && s.tietStart > 0) {
                          dayClasses.push({ course: c, session: s });
                        }
                      });
                    });

                    if (dayClasses.length === 0) {
                      return (
                        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border bg-muted/20">
                          <p className="text-xs text-muted-foreground">
                            {DAYS.find((d) => d.day === mobileSelectedDay)?.label} không có tiết học nào.
                          </p>
                        </div>
                      );
                    }

                    dayClasses.sort((a, b) => a.session.tietStart - b.session.tietStart);

                    return dayClasses.map(({ course, session }, idx) => {
                      const isConflicting = dayClasses.some(
                        (other) =>
                          other.course.id !== course.id &&
                          Math.max(session.tietStart, other.session.tietStart) <=
                            Math.min(session.tietEnd, other.session.tietEnd) &&
                          doDateRangesOverlap(session.dates, other.session.dates)
                      );
                      const theme = COLOR_THEMES[getCourseColorIndex(course.ma_mon)];

                      return (
                        <div
                          key={`${course.id}-${idx}`}
                          className={`p-3.5 rounded-xl border ${
                            isConflicting
                              ? 'border-rose-600 bg-rose-50/90 dark:bg-rose-950/40 border-dashed'
                              : `${theme.border} ${theme.bg}`
                          } shadow-2xs space-y-2`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-foreground">
                                  {course.ma_mon}
                                </span>
                                <span className="font-mono text-xs font-semibold text-primary">
                                  Nhóm {course.nhom_to}
                                </span>
                                <span className="text-xs text-muted-foreground">({course.so_tc} TC)</span>
                              </div>
                              <h4 className="text-sm font-bold text-foreground font-display">
                                {course.ten_mon}
                              </h4>
                            </div>
                            {isConflicting && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-700 text-white font-bold text-[10px]">
                                <AlertTriangle className="size-3" /> Trùng tiết
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40 font-mono">
                            <div className="flex items-center gap-1">
                              <Clock className="size-3 text-primary shrink-0" />
                              <span>Tiết {session.tietStart}–{session.tietEnd}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="size-3 text-primary shrink-0" />
                              <span className="font-medium text-foreground">{session.phong}</span>
                            </div>
                          </div>
                          {session.gv && session.gv !== 'Chưa phân công' && (
                            <div className="text-[11px] text-muted-foreground">
                              Giảng viên: <strong className="text-foreground">{session.gv}</strong>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : null}

              {/* Grid View (Hidden on mobile if a specific day is selected) */}
              <div className={`overflow-x-auto md:overflow-x-visible overscroll-x-contain rounded-xl border border-border/80 ${mobileSelectedDay !== null ? 'hidden md:block' : 'block'}`}>
                <div className="w-full min-w-[1050px] md:min-w-0">
                  <div className="timetable-capture-target w-full bg-background overflow-hidden">
                    {/* Grid Days Header */}
                    <div className="grid grid-cols-[46px_82px_repeat(6,minmax(130px,1fr))] md:grid-cols-[50px_84px_repeat(6,1fr)] lg:grid-cols-[54px_90px_repeat(6,1fr)]">
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
                    <div className="grid grid-cols-[46px_82px_repeat(6,minmax(130px,1fr))] md:grid-cols-[50px_84px_repeat(6,1fr)] lg:grid-cols-[54px_90px_repeat(6,1fr)] text-xs bg-background relative">
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

                      {/* Columns 3 to 8: Days (Thứ 2 to Thứ 7) with Lane Layout */}
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

                        // Apply lane layout so overlapping sessions are placed side by side
                        const { placed } = layoutDaySessions(daySessions);

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

                            {/* Render Parallel Schedule Blocks with Lane Positioning */}
                            {placed.map(({ course, session, lane, clusterLaneCount }, idx) => {
                              const theme = COLOR_THEMES[getCourseColorIndex(course.ma_mon)];
                              const numPeriods =
                                session.soTiet || Math.max(1, session.tietEnd - session.tietStart + 1);
                              const topPx = (session.tietStart - 1) * 70 + 3;
                              const heightPx = numPeriods * 70 - 6;

                              const isConflicting = clusterLaneCount > 1 && placed.some(
                                (other) =>
                                  other.course.id !== course.id &&
                                  Math.max(session.tietStart, other.session.tietStart) <=
                                    Math.min(session.tietEnd, other.session.tietEnd) &&
                                  doDateRangesOverlap(session.dates, other.session.dates)
                              );

                              const widthPercent = 100 / clusterLaneCount;
                              const leftPercent = (lane * 100) / clusterLaneCount;

                              return (
                                <div
                                  key={`${course.id}-day-${d.day}-${idx}`}
                                  className={`tkb-session-block absolute p-1.5 sm:p-2 rounded-xl cursor-pointer overflow-hidden flex flex-col justify-between transition-all ${
                                    isConflicting
                                      ? 'border-2 border-dashed border-rose-600 bg-rose-50/95 dark:bg-rose-950/85 text-rose-950 dark:text-rose-100 shadow-sm ring-1 ring-rose-500/30'
                                      : `border border-l-4 ${theme.border} ${theme.bg} ${theme.subtext}`
                                  }`}
                                  title={`${course.ten_mon}\nMã: ${course.ma_mon} - Nhóm ${course.nhom_to}\n${session.gv}\nTiết ${session.tietStart}–${session.tietEnd}\n${session.phong}${isConflicting ? '\n⚠️ TRÙNG LỊCH HỌC VỚI MÔN KHÁC!' : ''}`}
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                    left: `calc(${leftPercent}% + 2px)`,
                                    width: `calc(${widthPercent}% - 4px)`,
                                  }}
                                >
                                  <div>
                                    {/* Subject Code & Group mono pill */}
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-mono text-[10px] font-bold opacity-80 tabular-nums truncate">
                                        {course.ma_mon}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/10 text-[9px] font-bold font-mono text-foreground shrink-0">
                                        N{course.nhom_to}
                                      </span>
                                    </div>

                                    {/* Visual Conflict Overlap badge with AAA contrast */}
                                    {isConflicting && (
                                      <div className="mb-1 flex items-center justify-center gap-1 px-1 py-0.5 rounded-md bg-rose-700 text-white font-bold text-[9px] shadow-xs">
                                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                        <span>TRÙNG TIẾT</span>
                                      </div>
                                    )}

                                    {/* Course Title */}
                                    <div
                                      className={`text-xs sm:text-[13px] font-bold leading-snug line-clamp-2 ${isConflicting ? 'text-rose-950 dark:text-rose-100' : theme.text}`}
                                    >
                                      {course.ten_mon}
                                    </div>

                                    {/* Room badge */}
                                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-tight">
                                      <MapPin className="w-3 h-3 shrink-0 opacity-70" />
                                      <span className="truncate">{session.phong}</span>
                                    </div>
                                  </div>

                                  <div className="pt-1 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[10px] font-mono opacity-80">
                                    <span className="truncate max-w-[70px]">{session.gv}</span>
                                    <span>T{session.tietStart}–{session.tietEnd}</span>
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
          /* Card View Mode - handles multiple sessions of a subject in same day */
          <div className="px-3 sm:px-6 py-6 space-y-6">
            {DAYS.map((d) => {
              const dayCards: Array<{ course: ClassGroup; session: ScheduleSession }> = [];
              selectedCourses.forEach((c) => {
                c.parsedSessions.forEach((s) => {
                  if (s.thu === d.day && !s.isUnscheduled && s.tietStart > 0) {
                    dayCards.push({ course: c, session: s });
                  }
                });
              });

              if (dayCards.length === 0) return null;
              dayCards.sort((a, b) => a.session.tietStart - b.session.tietStart);

              return (
                <div key={d.day} className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground font-display flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                    {d.label}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dayCards.map(({ course: c, session: sess }, idx) => {
                      const theme = COLOR_THEMES[getCourseColorIndex(c.ma_mon)];

                      return (
                        <div
                          key={`${c.id}-${idx}`}
                          className={`p-4 rounded-xl border border-border/80 ${theme.bg} shadow-2xs hover:shadow-sm transition-all duration-150 space-y-2`}
                        >
                          <div className="font-bold text-sm text-foreground font-display">{c.ten_mon}</div>
                          <div className="text-xs space-y-1 text-muted-foreground font-mono">
                            <div>Mã môn: <span className="tabular-nums font-medium text-foreground">{c.ma_mon}</span> - Nhóm <span className="tabular-nums font-medium text-foreground">{c.nhom_to}</span></div>
                            <div>Thời gian: Tiết {sess.tietStart}–{sess.tietEnd} ({sess.thoi_gian})</div>
                            <div>Phòng: <span className="text-foreground">{sess.phong}</span></div>
                            {sess.gv && <div>Giảng viên: {sess.gv}</div>}
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
                  className={`min-h-[32px] inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1 px-2.5 text-xs rounded-lg cursor-pointer ${
                    selectedListViewMode === 'card'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  type="button"
                  aria-label="Xem dạng thẻ"
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                  Thẻ
                </button>
                <button
                  onClick={() => setSelectedListViewMode('table')}
                  className={`min-h-[32px] inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 gap-1 px-2.5 text-xs rounded-lg cursor-pointer ${
                    selectedListViewMode === 'table'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  type="button"
                  aria-label="Xem dạng bảng"
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap font-mono">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-foreground font-medium tabular-nums">
                        {course.ma_mon}
                      </span>
                      <span className="tabular-nums">
                        Nhóm {course.nhom_to}{course.to_hoc ? ` (Tổ ${course.to_hoc})` : ''}
                      </span>
                      <span className="tabular-nums">{course.so_tc} TC</span>
                      <span className={`font-semibold tabular-nums ${course.sl_cl <= 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                        Còn {course.sl_cl}
                      </span>
                    </div>
                    {course.isUnscheduled && (
                      <div className="text-[11px] text-amber-800 dark:text-amber-300">
                        Chưa xếp lịch học
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeGroupFromActiveTab(course.id)}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-border/80 bg-background hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 text-muted-foreground transition-all duration-150 cursor-pointer shrink-0 active:scale-[0.97]"
                    title="Xóa nhóm tổ"
                    type="button"
                    aria-label={`Xóa môn ${course.ten_mon}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
              <div className="min-w-[620px] text-xs sm:text-sm font-mono">
                <div className="grid grid-cols-[100px_1fr_80px_110px_60px_60px] bg-muted/60 border-b border-border/80 text-xs font-semibold text-muted-foreground">
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60">Mã môn</div>
                  <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 font-sans">Tên môn học</div>
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
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 font-medium text-foreground leading-snug font-sans">
                        {c.ten_mon}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center font-medium text-foreground tabular-nums">
                        {c.nhom_to}{c.to_hoc ? `-${c.to_hoc}` : ''}
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${c.sl_cl <= 0 ? 'text-rose-700 dark:text-rose-300 bg-rose-500/10' : 'text-emerald-800 dark:text-emerald-300 bg-emerald-500/10'}`}>
                          Còn {c.sl_cl}
                        </span>
                      </div>
                      <div className="px-3 sm:px-4 py-2.5 border-r border-border/60 text-center font-medium text-foreground tabular-nums">
                        {c.so_tc}
                      </div>
                      <div className="px-2 py-2 flex justify-center">
                        <button
                          onClick={() => removeGroupFromActiveTab(c.id)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-border/80 bg-background hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 text-muted-foreground transition-all duration-150 cursor-pointer active:scale-[0.97]"
                          title="Xóa môn này"
                          type="button"
                          aria-label={`Xóa môn ${c.ten_mon}`}
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

      {/* Render export modal */}
      <ExportPngModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedCourses={selectedCourses}
        totalCredits={totalCredits}
        planName={planName}
        onToast={(msg) => setToastMessage(msg)}
      />
    </div>
  );
};
