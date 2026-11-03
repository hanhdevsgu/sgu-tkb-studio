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
  const [filterMode, setFilterMode] = useState<'all' | 'selected'>('all');
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
    <div className="bg-card border border-border/80 rounded-2xl shadow-xs transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-4 sm:px-6 py-4 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground font-display">
                Danh mục môn học & Lớp mở
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-muted-foreground font-normal">
              <span>Học kỳ 1</span>
              <span>•</span>
              <span className="font-medium text-foreground/85 tabular-nums">
                {allSubjects.length} môn học sẵn sàng
              </span>
              <span>•</span>
              <span className="tabular-nums">
                Cập nhật: {formattedSyncTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Combobox Search Row */}
      <div className="flex items-center gap-2.5 flex-wrap px-4 sm:px-6 py-4 relative">
        <div className="flex-1 min-w-0 sm:min-w-[320px]" ref={dropdownRef}>
          <div className="flex items-center gap-2 sm:gap-2.5 w-full relative">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 hidden sm:inline">
              Môn học:
            </span>

            {/* Combobox Trigger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              role="combobox"
              aria-expanded={isOpen}
              type="button"
              className="inline-flex items-center gap-2 text-sm transition-all duration-150 border border-border/80 bg-background hover:bg-muted/50 py-2 flex-1 min-w-0 max-w-xl justify-between h-10 px-3.5 shadow-2xs cursor-pointer rounded-xl group"
            >
              <span className="truncate text-sm text-foreground flex items-center gap-2 font-normal">
                <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                {selectedSubject ? (
                  <span>
                    <strong className="font-semibold text-foreground">{selectedSubject.ten_mon}</strong>{' '}
                    <span className="text-muted-foreground text-xs">({selectedSubject.ma_mon})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Chọn môn học để xem các lớp...</span>
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {/* Reset button */}
            <button
              onClick={() => {
                setSelectedSubjectCode(null);
                setSearchTerm('');
              }}
              className="inline-flex items-center justify-center border border-border/80 bg-background hover:bg-muted/60 size-10 h-10 w-10 shadow-2xs cursor-pointer rounded-xl transition-all duration-150 shrink-0 text-muted-foreground hover:text-foreground active:scale-[0.97]"
              title="Làm mới lựa chọn môn"
              type="button"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Import Button */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium px-3.5 h-10 border border-border/80 bg-background hover:bg-muted/60 shadow-2xs cursor-pointer rounded-xl transition-all duration-150 shrink-0 text-muted-foreground hover:text-foreground active:scale-[0.97]"
              title="Nhập dữ liệu thời khóa biểu"
              type="button"
            >
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Nhập dữ liệu</span>
            </button>

            {/* Solid Dropdown Menu */}
            {isOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsOpen(false)}
                />

                <div className="absolute top-full mt-2 left-0 sm:left-[60px] z-50 w-[min(580px,calc(100vw-2rem))] bg-card text-foreground border border-border shadow-xl rounded-2xl overflow-hidden animate-in fade-in-0 duration-150">
                  {/* Search Input Bar */}
                  <div className="flex items-center border-b border-border/80 px-3.5 py-2.5 bg-muted/30">
                    <Search className="w-4 h-4 text-muted-foreground mr-2.5 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm tên môn học hoặc mã môn (VD: Cấu trúc dữ liệu, 841108)..."
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-normal"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/80 bg-muted/10 text-xs">
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tất cả ({allSubjects.length})
                    </button>
                    <button
                      onClick={() => setFilterMode('selected')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        filterMode === 'selected'
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Đã chọn ({selectedIds.length})
                    </button>
                  </div>

                  {/* List of Subjects */}
                  <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-0.5">
                    {filteredSubjects.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Không tìm thấy môn học nào khớp với từ khóa tìm kiếm.
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
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer transition-colors duration-100 ${
                              isSelected
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'hover:bg-muted/70 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium shrink-0 tabular-nums">
                                {s.ma_mon}
                              </span>
                              <span className="truncate font-medium">{s.ten_mon}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {s.so_tc} TC
                              </span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-primary shrink-0" />
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
        <div className="min-h-[160px]">
          {!selectedSubject ? (
            <div className="flex items-center justify-center py-10 px-4 border border-dashed border-border/80 rounded-2xl bg-muted/15">
              <div className="text-center max-w-md space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1">
                  <BookOpen className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-semibold text-foreground font-display">
                  Chưa chọn môn học
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nhấp vào ô tìm kiếm phía trên để chọn môn bạn muốn đăng ký và xem danh sách các nhóm lớp.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Selected Subject Summary Banner */}
              <div className="flex items-center justify-between flex-wrap gap-2.5 px-4 py-3 mb-3.5 rounded-xl bg-muted/40 border border-border/70">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-foreground font-display">
                    {selectedSubject.ten_mon}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                    Mã: {selectedSubject.ma_mon}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground/80 font-medium tabular-nums">
                    {selectedSubject.so_tc} tín chỉ
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums font-medium">
                  {currentGroups.length} nhóm lớp
                </span>
              </div>

              {/* Mobile Swipe Notice */}
              <div className="sm:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground mb-2">
                <span>← Vuốt ngang để xem đủ bảng →</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border/80 bg-card">
                <table className="w-full min-w-[920px] text-xs sm:text-sm border-collapse">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr className="border-b border-border/70 text-xs font-semibold">
                      <th className="w-12 px-3 py-3 text-center border-r border-border/60">
                        <span className="sr-only">Chọn</span>
                      </th>
                      <th className="w-[85px] px-3 py-3 text-left border-r border-border/60">
                        Mã môn
                      </th>
                      <th className="min-w-[200px] px-3 py-3 text-left border-r border-border/60">
                        Tên môn học
                      </th>
                      <th className="w-[50px] px-2 py-3 text-center border-r border-border/60">
                        TC
                      </th>
                      <th className="w-[65px] px-2.5 py-3 text-center border-r border-border/60">
                        Nhóm
                      </th>
                      <th className="w-[110px] px-3 py-3 text-center border-r border-border/60">
                        Chỗ trống
                      </th>
                      <th className="min-w-[150px] px-3 py-3 text-left border-r border-border/60">
                        Giảng viên
                      </th>
                      <th className="w-[70px] px-2.5 py-3 text-center border-r border-border/60">
                        Thứ
                      </th>
                      <th className="w-[70px] px-2.5 py-3 text-center border-r border-border/60">
                        Tiết BĐ
                      </th>
                      <th className="w-[70px] px-2.5 py-3 text-center border-r border-border/60">
                        Số tiết
                      </th>
                      <th className="min-w-[90px] px-3 py-3 text-left">
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums border ${
                            group.sl_cl > 0
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
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
                            className={`border-b border-border/60 transition-colors duration-150 select-none cursor-pointer hover:bg-muted/40 ${
                              isChecked
                                ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary'
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
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors duration-150 ${
                                        isChecked
                                          ? 'bg-primary border-primary text-white shadow-2xs'
                                          : 'border-border/80 bg-background hover:border-primary/50'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                                    </div>
                                  </div>
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[85px] px-3 py-3 text-left font-medium text-xs text-foreground/80 align-top border-r border-border/60 tabular-nums"
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
                                  className="w-[50px] px-2 py-3 text-center text-foreground/80 font-medium align-top border-r border-border/60 tabular-nums"
                                >
                                  {group.so_tc}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[65px] px-2.5 py-3 text-center text-foreground font-semibold text-xs sm:text-sm align-top border-r border-border/60 tabular-nums"
                                >
                                  {group.nhom_to}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[110px] px-3 py-3 text-center align-top border-r border-border/60"
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
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                  Chưa xếp
                                </span>
                              ) : (
                                sess.thuStr || `Thứ ${sess.thu}`
                              )}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center text-xs border-r border-border/60 tabular-nums text-foreground/80">
                              {sess.isUnscheduled || !sess.tietStart ? '-' : sess.tietStart}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center text-xs border-r border-border/60 tabular-nums text-foreground/80">
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
