import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Check,
  ChevronsUpDown,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { SguApiImportModal } from './SguApiImportModal';
import sguMeta from '../data/sguMeta.json';

export const SubjectSelectorCard: React.FC = () => {
  const {
    allSubjects,
    allCourses,
    selectedSubjectCode,
    setSelectedSubjectCode,
    activeTabId,
    plans,
    toggleGroupSelection,
  } = useTimetableStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'selected' | 'available'>('all');
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Active plan selected course ids
  const activePlan = plans.find((p) => p.id === activeTabId);
  const selectedIds = useMemo(() => activePlan?.selectedIds || [], [activePlan]);

  // Currently selected subject object
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectCode) return null;
    return allSubjects.find((s) => s.ma_mon === selectedSubjectCode) || null;
  }, [allSubjects, selectedSubjectCode]);

  // Groups for current selected subject
  const currentGroups = useMemo(() => {
    if (!selectedSubjectCode) return [];
    return allCourses.filter((c) => c.ma_mon === selectedSubjectCode);
  }, [allCourses, selectedSubjectCode]);

  // Filtered subjects list for combobox
  const filteredSubjects = useMemo(() => {
    let list = allSubjects;

    if (filterMode === 'selected') {
      const selectedSubjectCodes = new Set(
        allCourses.filter((c) => selectedIds.includes(c.id)).map((c) => c.ma_mon)
      );
      list = list.filter((s) => selectedSubjectCodes.has(s.ma_mon));
    }

    if (!searchTerm.trim()) return list.slice(0, 80);

    const term = searchTerm.toLowerCase().trim();
    return list
      .filter(
        (s) =>
          s.ten_mon.toLowerCase().includes(term) ||
          s.ma_mon.toLowerCase().includes(term)
      )
      .slice(0, 80);
  }, [allSubjects, allCourses, selectedIds, searchTerm, filterMode]);

  // Click outside listener for combobox
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format last sync time from metadata
  const formattedSyncTime = useMemo(() => {
    try {
      if (!sguMeta?.last_sync) return 'Mới cập nhật';
      const date = new Date(sguMeta.last_sync);
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${hh}:${mm}:${ss} (${d}/${m}/${y})`;
    } catch {
      return 'Vừa xong';
    }
  }, []);

  return (
    <div className="bg-card/90 backdrop-blur-md shadow-md border border-border/80 rounded-2xl relative transition-all duration-300 hover:border-cyan-500/30 hover:shadow-cyan-500/5 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-4 sm:px-6 py-4 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-2xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight font-sans">
                Danh Mục Môn Học & Lớp Mở
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-xs text-muted-foreground">Học kỳ hiện tại :</span>
              <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 font-mono">
                {allSubjects.length} môn học sẵn sàng
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground font-mono">
                Thời gian: {formattedSyncTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Combobox Search Row */}
      <div className="flex items-center gap-3 flex-wrap px-4 sm:px-6 py-4 relative">
        <div className="flex-1 min-w-0 sm:min-w-[320px]" ref={dropdownRef}>
          <div className="flex items-center gap-2 sm:gap-2.5 w-full relative">
            <span className="text-xs font-bold text-muted-foreground shrink-0 uppercase tracking-wider font-mono hidden sm:inline">
              Môn học:
            </span>

            {/* Combobox Trigger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              role="combobox"
              aria-expanded={isOpen}
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium transition-all duration-200 border border-border/80 bg-background/90 hover:bg-muted/60 hover:border-cyan-500/40 py-2 flex-1 min-w-0 max-w-xl justify-between h-10 px-3.5 shadow-2xs cursor-pointer rounded-xl group"
            >
              <span className="truncate text-sm font-medium text-foreground flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
                {selectedSubject
                  ? `${selectedSubject.ten_mon} (Mã: ${selectedSubject.ma_mon})`
                  : 'Tìm kiếm hoặc chọn môn học...'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {/* Reset button */}
            <button
              onClick={() => {
                setSelectedSubjectCode(null);
                setSearchTerm('');
              }}
              className="inline-flex items-center justify-center border border-border/80 bg-background/90 hover:bg-muted/60 hover:border-border hover:scale-105 active:scale-95 size-10 h-10 w-10 shadow-2xs cursor-pointer rounded-xl transition-all duration-200 shrink-0"
              title="Làm mới lựa chọn"
              type="button"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>

            {/* Import Button */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium px-3.5 h-10 border border-border/80 bg-background/90 hover:bg-muted/60 hover:border-cyan-500/40 shadow-2xs cursor-pointer rounded-xl transition-all duration-200 shrink-0 text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95"
              title="Nhập dữ liệu thời khóa biểu"
              type="button"
            >
              <Zap className="h-3.5 w-3.5 text-cyan-500" />
              <span className="hidden sm:inline">Nhập dữ liệu</span>
            </button>

            {/* Solid Opaque Dropdown Menu */}
            {isOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsOpen(false)}
                />

                <div className="absolute top-full mt-2 left-0 sm:left-[70px] z-50 w-[min(580px,calc(100vw-2rem))] bg-white dark:bg-slate-900 text-foreground border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                  {/* Search Input Bar */}
                  <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/70">
                    <Search className="w-4 h-4 text-muted-foreground mr-2.5 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Gõ tên môn hoặc mã môn (VD: 841108, Cấu trúc dữ liệu)..."
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-xs text-muted-foreground hover:text-foreground px-1 cursor-pointer"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-xs">
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tất cả ({allSubjects.length})
                    </button>
                    <button
                      onClick={() => setFilterMode('selected')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        filterMode === 'selected'
                          ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Đã chọn ({selectedIds.length})
                    </button>
                  </div>

                  {/* List of Subjects */}
                  <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-0.5">
                    {filteredSubjects.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        Không tìm thấy môn học nào khớp với từ khóa.
                      </div>
                    ) : (
                      filteredSubjects.map((s) => {
                        const isSelected = selectedSubjectCode === s.ma_mon;
                        return (
                          <div
                            key={s.ma_mon}
                            onClick={() => {
                              setSelectedSubjectCode(s.ma_mon);
                              setIsOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                                {s.ma_mon}
                              </span>
                              <span className="truncate">{s.ten_mon}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs text-muted-foreground font-mono">
                                {s.so_tc} TC
                              </span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-cyan-500 shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="px-4 sm:px-6 pb-6">
        <div className="min-h-[200px]">
          {!selectedSubject ? (
            <div className="flex items-center justify-center py-12 px-4 border border-dashed border-border/80 rounded-2xl bg-muted/20">
              <div className="text-center max-w-md space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto mb-2 border border-cyan-500/20">
                  <BookOpen className="w-6 h-6 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-bold text-foreground font-sans">
                  Chưa chọn môn học
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vui lòng bấm vào ô tìm kiếm phía trên để chọn môn học bạn muốn đăng ký và xem danh sách các nhóm lớp.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Selected Subject Summary Banner */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 mb-3 rounded-xl bg-muted/40 border border-border/70 backdrop-blur-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-foreground font-sans uppercase tracking-tight">
                    {selectedSubject.ten_mon}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20">
                    Mã: {selectedSubject.ma_mon}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                    {selectedSubject.so_tc} tín chỉ
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {currentGroups.length} nhóm lớp mở
                </span>
              </div>

              {/* Mobile Swipe Notice */}
              <div className="sm:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground font-mono mb-2">
                <span>← Vuốt ngang để xem đủ bảng →</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border/80 bg-card shadow-xs">
                <table className="w-full min-w-[960px] text-xs sm:text-sm border-collapse">
                  <thead className="bg-muted/70 text-foreground sticky top-0 z-10">
                    <tr className="border-b border-border/80">
                      <th className="w-12 px-3 py-3 text-center border-r border-border/60">
                        <span className="sr-only">Chọn</span>
                      </th>
                      <th className="w-[80px] px-3 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Mã môn
                      </th>
                      <th className="min-w-[200px] px-3 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Tên môn
                      </th>
                      <th className="w-[50px] px-2 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        TC
                      </th>
                      <th className="w-[65px] px-2.5 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Nhóm
                      </th>
                      <th className="w-[120px] px-3 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Chỗ trống
                      </th>
                      <th className="min-w-[150px] px-3 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Giảng viên
                      </th>
                      <th className="w-[70px] px-2.5 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Thứ
                      </th>
                      <th className="w-[70px] px-2.5 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Tiết BĐ
                      </th>
                      <th className="w-[70px] px-2.5 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Số tiết
                      </th>
                      <th className="min-w-[90px] px-3 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                        Phòng
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentGroups.map((group) => {
                      const isChecked = selectedIds.includes(group.id);
                      const sessions =
                        group.parsedSessions.length > 0
                          ? group.parsedSessions
                          : [
                              {
                                thu: 2,
                                thuStr: 'Chưa xếp',
                                thoi_gian: '',
                                tietStart: 1,
                                tietEnd: 1,
                                soTiet: 1,
                                phong: 'Chưa xếp',
                                gv: 'Chưa phân công',
                              },
                            ];

                      const rowSpanCount = sessions.length;

                      // Slot status pill - Always display "Còn X" only
                      const slotBadge = (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border transition-colors ${
                            group.sl_cl > 0
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                              : 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20'
                          }`}
                        >
                          Còn {group.sl_cl}
                        </span>
                      );

                      return sessions.map((sess, idx) => {
                        const isFirstSession = idx === 0;

                        return (
                          <tr
                            key={`${group.id}-sess-${idx}`}
                            onClick={() => toggleGroupSelection(group.id)}
                            className={`border-b border-border/60 transition-all duration-150 select-none cursor-pointer hover:bg-cyan-500/5 dark:hover:bg-cyan-500/10 ${
                              isChecked
                                ? 'bg-cyan-500/10 dark:bg-cyan-500/15 border-l-4 border-l-cyan-500'
                                : ''
                            }`}
                          >
                            {/* Checkbox and Group-level columns */}
                            {isFirstSession && (
                              <>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-12 px-3 py-3 text-center align-top border-r border-border/60"
                                >
                                  <div className="flex items-center justify-center pt-0.5">
                                    <div
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-200 ${
                                        isChecked
                                          ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs scale-110'
                                          : 'border-border/80 bg-background hover:border-cyan-400'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                  </div>
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[80px] px-3 py-3 text-left font-mono font-bold text-xs text-foreground align-top border-r border-border/60"
                                >
                                  {group.ma_mon}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="min-w-[200px] px-3 py-3 text-left font-medium text-foreground align-top border-r border-border/60 leading-snug"
                                >
                                  {group.ten_mon}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[50px] px-2 py-3 text-center font-mono text-foreground font-semibold align-top border-r border-border/60"
                                >
                                  {group.so_tc}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[65px] px-2.5 py-3 text-center text-foreground font-mono font-bold text-xs sm:text-sm align-top border-r border-border/60"
                                >
                                  {group.nhom_to}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[120px] px-3 py-3 text-center align-top border-r border-border/60"
                                >
                                  {slotBadge}
                                </td>
                              </>
                            )}

                            {/* Session-specific columns */}
                            <td className="min-w-[150px] px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground border-r border-border/60">
                              {sess.gv}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center text-xs text-foreground font-medium border-r border-border/60">
                              {sess.isUnscheduled || sess.thu === 0 ? (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono font-medium">
                                  Chưa xếp
                                </span>
                              ) : (
                                sess.thuStr || `Thứ ${sess.thu}`
                              )}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center font-mono text-xs border-r border-border/60">
                              {sess.isUnscheduled || !sess.tietStart ? '-' : sess.tietStart}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center font-mono text-xs border-r border-border/60">
                              {sess.isUnscheduled || !sess.soTiet ? '-' : sess.soTiet}
                            </td>
                            <td className="min-w-[90px] px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                              {sess.isUnscheduled || sess.phong === 'Chưa xếp' ? (
                                <span className="text-muted-foreground/60 italic">Chưa xếp</span>
                              ) : (
                                sess.phong
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <SguApiImportModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
      />
    </div>
  );
};
