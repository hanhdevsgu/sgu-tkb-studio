import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronsUpDown, RotateCcw, Search, Check, Zap } from 'lucide-react';
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
    <div className="bg-card shadow-sm border border-border relative">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-3 sm:px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">Thời Khóa Biểu</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-muted-foreground">Năm học 2026 - 2027 : </p>
            <span className="text-xs font-medium text-emerald-500 font-mono">
              {allSubjects.length} môn học
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

      {/* Combobox Row */}
      <div className="flex items-center gap-3 flex-wrap px-3 sm:px-6 py-4 relative">
        <div className="flex-1 min-w-0 sm:min-w-[300px]" ref={dropdownRef}>
          <div className="flex items-center gap-2 sm:gap-2.5 w-full relative">
            <span className="text-label font-bold text-muted-foreground shrink-0 uppercase tracking-wider font-mono text-xs hidden sm:inline">
              Môn học:
            </span>

            {/* Combobox Trigger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              role="combobox"
              aria-expanded={isOpen}
              type="button"
              className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-all border hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 py-2 flex-1 min-w-0 max-w-xl justify-between border-border bg-background hover:bg-accent text-left h-9 px-3 shadow-xs cursor-pointer rounded-none"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {selectedSubject
                  ? `${selectedSubject.ten_mon} (Mã: ${selectedSubject.ma_mon})`
                  : 'Chọn môn học...'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40 text-muted-foreground" />
            </button>

            {/* Reset button */}
            <button
              onClick={() => {
                setSelectedSubjectCode(null);
                setSearchTerm('');
              }}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all border bg-background hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-9 w-9 hover:bg-accent shadow-xs cursor-pointer rounded-none"
              title="Làm mới lựa chọn"
              type="button"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Quick SGU API Import Button */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-2.5 h-9 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-xs cursor-pointer rounded-none transition-colors"
              title="Nạp trực tiếp dữ liệu từ API SGU / window._dkmhData"
              type="button"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nạp API SGU</span>
            </button>

            {/* Solid Opaque Dropdown */}
            {isOpen && (
              <>
                {/* Backdrop to capture outside clicks immediately */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsOpen(false)}
                />

                <div className="absolute top-full mt-1.5 left-0 sm:left-[70px] z-50 w-[min(560px,calc(100vw-2rem))] bg-white dark:bg-[#18181b] text-foreground border border-border shadow-2xl rounded-none overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                  {/* Search Input */}
                  <div className="flex items-center border-b border-border px-3 py-2 bg-zinc-50 dark:bg-[#1f1f23]">
                    <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm môn học hoặc mã môn..."
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-xs text-muted-foreground hover:text-foreground px-1"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {/* Items List: Guaranteed Solid Opaque Background */}
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40 bg-white dark:bg-[#18181b]">
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
                            className={`flex flex-col items-start gap-1 px-3.5 py-2.5 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-semibold text-foreground font-sans">
                                {sub.ten_mon}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                            </div>
                            <div className="flex items-center gap-3 text-label text-muted-foreground font-medium text-xs font-mono">
                              <span>Mã: {sub.ma_mon}</span>
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
      <div className="px-3 sm:px-6 py-4">
        <div className="space-y-3 bg-card">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
              Danh sách nhóm tổ
            </h3>
          </div>

          {!selectedSubject ? (
            <div className="py-8 text-center text-xs text-muted-foreground font-mono border border-border border-dashed p-4">
              Chưa chọn môn học
            </div>
          ) : (
            <div>
              {/* Mobile Swipe Notice */}
              <div className="sm:hidden flex items-center justify-between py-1 px-1 text-xs text-muted-foreground font-mono mb-1.5">
                <span className="flex items-center gap-1">
                  <span>←</span> Vuốt ngang để xem đủ <span>→</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-muted border border-border">
                  Bảng nhóm tổ
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto overscroll-x-contain border border-border bg-card">
                <table className="w-full min-w-[1020px] text-xs sm:text-sm cursor-pointer border-collapse">
                  <thead className="bg-muted text-foreground">
                    <tr className="border-b border-border">
                      <th className="w-10 min-w-10 px-2.5 py-2.5 text-center border-r border-border">
                        <span className="sr-only">Chọn</span>
                      </th>
                      <th className="w-[85px] min-w-[85px] px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Mã
                      </th>
                      <th className="min-w-[240px] px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Tên môn
                      </th>
                      <th className="w-[50px] min-w-[50px] px-2 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        TC
                      </th>
                      <th className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Nhóm
                      </th>
                      <th className="w-[90px] min-w-[90px] px-3 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Số lượng
                      </th>
                      <th className="min-w-[150px] px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Giảng viên
                      </th>
                      <th className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Thứ
                      </th>
                      <th className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Tiết BD
                      </th>
                      <th className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border">
                        Số tiết
                      </th>
                      <th className="min-w-[90px] px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
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

                      return sessions.map((sess, idx) => {
                        const isFirstSession = idx === 0;

                        return (
                          <tr
                            key={`${group.id}-sess-${idx}`}
                            onClick={() => toggleGroupSelection(group.id)}
                            className={`border-b border-border transition select-none cursor-pointer hover:bg-muted/50 ${
                              isChecked ? 'bg-primary/5 dark:bg-primary/10' : ''
                            }`}
                          >
                            {isFirstSession && (
                              <>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-10 min-w-10 px-2.5 py-2.5 text-center align-top border-r border-border"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="h-4 w-4 rounded border-border text-primary cursor-pointer accent-primary"
                                  />
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[85px] min-w-[85px] px-3 py-2.5 font-mono font-bold text-xs text-foreground align-top border-r border-border"
                                >
                                  {group.ma_mon}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="min-w-[240px] px-3 py-2.5 font-medium text-foreground text-xs sm:text-sm leading-snug align-top border-r border-border"
                                >
                                  {group.ten_mon}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[50px] min-w-[50px] px-2 py-2.5 text-center text-foreground font-mono text-xs sm:text-sm align-top border-r border-border"
                                >
                                  {group.so_tc}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center text-foreground font-mono text-xs sm:text-sm align-top border-r border-border"
                                >
                                  {group.nhom_to}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="w-[90px] min-w-[90px] px-3 py-2.5 text-center align-top border-r border-border"
                                >
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-mono font-medium ${
                                      group.sl_cl <= 0
                                        ? 'bg-destructive/20 text-destructive'
                                        : 'text-foreground bg-muted'
                                    }`}
                                  >
                                    {group.sl_cl}/{group.sl_cp}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* Session-specific columns */}
                            <td className="min-w-[150px] px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground border-r border-border">
                              {sess.gv}
                            </td>
                            <td className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center text-xs text-foreground font-medium border-r border-border">
                              {sess.thuStr || `Thứ ${sess.thu}`}
                            </td>
                            <td className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center font-mono text-xs border-r border-border">
                              {sess.tietStart}
                            </td>
                            <td className="w-[65px] min-w-[65px] px-2.5 py-2.5 text-center font-mono text-xs border-r border-border">
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
