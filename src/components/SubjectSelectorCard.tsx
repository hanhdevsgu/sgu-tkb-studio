import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronsUpDown, RotateCcw, Search, Check, Zap, BookOpen } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { removeVietnameseTones } from '../utils/text';
import { SguApiImportModal } from './SguApiImportModal';
import sguMeta from '../data/sguMeta.json';

export const SubjectSelectorCard: React.FC = () => {
  const {
    allCourses,
    allSubjects,
    selectedSubjectCode,
    setSelectedSubjectCode,
    plans,
    activeTabId,
    toggleGroupSelection,
  } = useTimetableStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close combobox when clicking outside or pressing Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Selected subject object
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectCode) return null;
    return allSubjects.find((s) => s.ma_mon === selectedSubjectCode) || null;
  }, [allSubjects, selectedSubjectCode]);

  // Filtered subjects in combobox dropdown
  const filteredSubjects = useMemo(() => {
    const cleanSearch = removeVietnameseTones(searchTerm.trim()).toLowerCase();
    if (!cleanSearch) return allSubjects;

    return allSubjects.filter((s) => {
      const matchName = removeVietnameseTones(s.ten_mon).toLowerCase().includes(cleanSearch);
      const matchCode = s.ma_mon.toLowerCase().includes(cleanSearch);
      return matchName || matchCode;
    });
  }, [allSubjects, searchTerm]);

  // Groups for selected subject
  const currentGroups = useMemo(() => {
    if (!selectedSubjectCode) return [];
    return allCourses.filter((c) => c.ma_mon === selectedSubjectCode);
  }, [allCourses, selectedSubjectCode]);

  const activePlan = plans.find((p) => p.id === activeTabId) || plans[0];
  const selectedIds = activePlan.selectedIds;

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
    <div className="bg-card shadow-xs border border-border/80 rounded-2xl relative transition-all">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-4 sm:px-6 py-4 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Danh Mục Môn Học & Lớp Mở
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs text-muted-foreground">Học kỳ hiện tại :</span>
            <span className="text-xs font-semibold text-primary font-mono">
              {allSubjects.length} môn học sẵn sàng
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Cập nhật lúc: {formattedSyncTime}
            </span>
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
              className="inline-flex items-center gap-2 text-sm font-medium transition-all border border-border/80 bg-background hover:bg-muted/40 py-2 flex-1 min-w-0 max-w-xl justify-between h-10 px-3.5 shadow-2xs cursor-pointer rounded-xl"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {selectedSubject
                  ? `${selectedSubject.ten_mon} (Mã: ${selectedSubject.ma_mon})`
                  : 'Tìm kiếm hoặc chọn môn học...'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
            </button>

            {/* Reset button */}
            <button
              onClick={() => {
                setSelectedSubjectCode(null);
                setSearchTerm('');
              }}
              className="inline-flex items-center justify-center border border-border/80 bg-background hover:bg-muted/40 size-10 h-10 w-10 shadow-2xs cursor-pointer rounded-xl transition-colors shrink-0"
              title="Làm mới lựa chọn"
              type="button"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Quick SGU API Import Button */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-3 h-10 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-2xs cursor-pointer rounded-xl transition-colors shrink-0"
              title="Nạp trực tiếp dữ liệu từ API SGU / window._dkmhData"
              type="button"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nạp API SGU</span>
            </button>

            {/* Solid Opaque Dropdown */}
            {isOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsOpen(false)}
                />

                <div className="absolute top-full mt-2 left-0 sm:left-[70px] z-50 w-[min(580px,calc(100vw-2rem))] bg-white dark:bg-slate-900 text-foreground border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
                  {/* Search Input */}
                  <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/60">
                    <Search className="w-4 h-4 text-muted-foreground mr-2.5 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Gõ tên môn học hoặc mã môn (VD: 841108, Cấu trúc dữ liệu)..."
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-xs text-muted-foreground hover:text-foreground px-1 font-mono"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {filteredSubjects.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                        Không tìm thấy môn học nào khớp với từ khóa
                      </div>
                    ) : (
                      filteredSubjects.map((sub) => {
                        const isSelected = sub.ma_mon === selectedSubjectCode;
                        return (
                          <div
                            key={sub.ma_mon}
                            onClick={() => {
                              setSelectedSubjectCode(sub.ma_mon);
                              setIsOpen(false);
                            }}
                            className={`flex flex-col items-start gap-1 px-4 py-2.5 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-semibold text-foreground font-sans">
                                {sub.ten_mon}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-bold">
                                Mã: {sub.ma_mon}
                              </span>
                              <span>•</span>
                              <span>{sub.so_tc} tín chỉ</span>
                              <span>•</span>
                              <span>{sub.groupCount} nhóm tổ</span>
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

      {/* Group Table Area */}
      <div className="px-4 sm:px-6 pb-5 pt-2">
        <div className="space-y-3">
          {!selectedSubject ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-border/80 bg-muted/10 p-6">
              <div className="max-w-sm mx-auto space-y-2">
                <BookOpen className="w-8 h-8 text-muted-foreground/60 mx-auto stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-foreground">Chưa chọn môn học</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vui lòng bấm vào ô tìm kiếm phía trên để chọn môn học bạn muốn đăng ký và xem số lượng slot còn lại.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Selected Subject Summary Banner */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2.5 mb-3 rounded-xl bg-muted/40 border border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground font-sans uppercase">
                    {selectedSubject.ten_mon}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {selectedSubject.ma_mon}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
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
              <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border/80 bg-card">
                <table className="w-full min-w-[960px] text-xs sm:text-sm border-collapse">
                  <thead className="bg-muted/70 text-foreground">
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
                      <th className="w-[130px] px-3 py-3 text-center font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-r border-border/60">
                        Slot còn lại
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

                      // Slot status pill
                      let slotBadge = null;
                      if (group.sl_cl > 10) {
                        slotBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Còn {group.sl_cl}
                          </span>
                        );
                      } else if (group.sl_cl > 0) {
                        slotBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Sắp hết ({group.sl_cl})
                          </span>
                        );
                      } else {
                        slotBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Kín chỗ (0)
                          </span>
                        );
                      }

                      return sessions.map((sess, idx) => {
                        const isFirstSession = idx === 0;

                        return (
                          <tr
                            key={`${group.id}-sess-${idx}`}
                            onClick={() => toggleGroupSelection(group.id)}
                            className={`border-b border-border/60 transition select-none cursor-pointer hover:bg-muted/40 ${
                              isChecked ? 'bg-primary/5 dark:bg-primary/10' : ''
                            }`}
                          >
                            {isFirstSession && (
                              <>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-12 px-3 py-3 text-center align-top border-r border-border/60"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="h-4 w-4 rounded-md border-border text-primary cursor-pointer accent-primary"
                                  />
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[80px] px-3 py-3 font-mono font-bold text-xs text-foreground align-top border-r border-border/60"
                                >
                                  {group.ma_mon}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="min-w-[200px] px-3 py-3 font-medium text-foreground text-xs sm:text-sm leading-snug align-top border-r border-border/60"
                                >
                                  {group.ten_mon}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[50px] px-2 py-3 text-center text-foreground font-mono text-xs sm:text-sm align-top border-r border-border/60"
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
                                  className="w-[130px] px-3 py-3 text-center align-top border-r border-border/60"
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
                              {sess.thuStr || `Thứ ${sess.thu}`}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center font-mono text-xs border-r border-border/60">
                              {sess.tietStart}
                            </td>
                            <td className="w-[70px] px-2.5 py-2.5 text-center font-mono text-xs border-r border-border/60">
                              {sess.soTiet}
                            </td>
                            <td className="min-w-[90px] px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                              {sess.phong}
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
