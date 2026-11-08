import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Search, RotateCcw } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { checkGroupConflict } from '../utils/conflictDetector';
import { DuplicateSubjectModal } from './DuplicateSubjectModal';

/* ---------- Types ---------- */
export interface SubjectOption {
  code: string;
  name: string;
  credits: number;
  /** "general" = môn chung toàn trường, "major" = môn chuyên ngành */
  scope: 'general' | 'major';
  groupCount: number;
  targetClasses: string[];
  registered: number;
  capacity: number;
  /** Có môn khác mã nhưng cùng tên */
  hasSameNameVariant: boolean;
}

export interface GroupRowSession {
  day: number; // 2..8 (8 = CN, 0 = Chưa xếp)
  startPeriod: number;
  periodCount: number;
  room: string;
  teacher: string;
}

export interface GroupRow {
  id: string;
  group: string; // "01"
  targetClass: string; // "DCT1261"
  capacity: number;
  registered: number;
  teacher: string;
  room: string;
  sessions: GroupRowSession[];
  /** Tên môn đã chọn mà nhóm này đang trùng lịch (nếu có) */
  conflictWith?: string;
}

export interface SubjectSelectorCardViewProps {
  subjects: SubjectOption[];
  selectedSubjectCode: string | null;
  onSelectSubject: (code: string) => void;
  groups: GroupRow[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string) => void;
  onClearSubjectSelection?: () => void;
  onOpenDuplicateModal?: () => void;
}

/* ---------- Helpers ---------- */
const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

const dayLabel = (d: number) => (d === 8 ? 'CN' : d === 0 ? 'Chưa xếp' : `Thứ ${d}`);

const SCOPE_LABEL = { general: 'Chung trường', major: 'Chuyên ngành' } as const;

type SeatState = 'full' | 'low' | 'ok';
const seatState = (left: number, cap: number): SeatState =>
  left <= 0 ? 'full' : left <= Math.max(3, Math.ceil(cap * 0.1)) ? 'low' : 'ok';

const SEAT_STYLE: Record<SeatState, { text: string; bar: string }> = {
  full: { text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-600 dark:bg-rose-400' },
  low: { text: 'text-amber-800 dark:text-amber-300', bar: 'bg-amber-600 dark:bg-amber-400' },
  ok: { text: 'text-emerald-800 dark:text-emerald-300', bar: 'bg-emerald-600 dark:bg-emerald-400' },
};

/* ---------- Subject Combobox with Keyboard Nav & ARIA ---------- */
function SubjectCombobox({
  subjects,
  selected,
  onSelect,
}: {
  subjects: SubjectOption[];
  selected: SubjectOption | undefined;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = stripAccents(query.trim());
    if (!q) return subjects.slice(0, 50);
    return subjects
      .filter((s) => stripAccents(s.name).includes(q) || s.code.toLowerCase().includes(q))
      .slice(0, 50);
  }, [subjects, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const commit = (s: SubjectOption) => {
    onSelect(s.code);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      commit(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-primary shadow-xs transition-all cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="subject-listbox"
          aria-activedescendant={open ? `subject-opt-${active}` : undefined}
          value={open ? query : selected ? `${selected.code} · ${selected.name}` : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Tìm theo tên môn hoặc mã môn (gõ không dấu)..."
          className="h-12 w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground cursor-text"
        />
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      </div>

      {open && (
        <ul
          id="subject-listbox"
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-96 w-full overflow-auto rounded-xl border border-border bg-card shadow-xl"
        >
          {results.length === 0 && (
            <li className="px-3.5 py-4 text-sm text-muted-foreground">
              Không tìm thấy môn khớp với “{query}”. Thử nhập mã môn hoặc bỏ bớt từ khóa.
            </li>
          )}
          {results.map((s, i) => {
            const left = s.capacity - s.registered;
            return (
              <li
                key={s.code}
                id={`subject-opt-${i}`}
                role="option"
                aria-selected={s.code === selected?.code}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(s)}
                className={`cursor-pointer border-b border-border/60 px-3.5 py-2.5 last:border-0 transition-colors ${
                  i === active ? 'bg-secondary' : 'hover:bg-secondary/60'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground font-semibold">{s.code}</span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{s.name}</span>
                  <span className="font-mono text-xs tabular-nums text-foreground font-semibold">{s.credits} TC</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {s.hasSameNameVariant && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-600/40 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                      <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
                      Có môn cùng tên khác mã · {SCOPE_LABEL[s.scope]}
                    </span>
                  )}
                  {!s.hasSameNameVariant && <span>{SCOPE_LABEL[s.scope]}</span>}
                  <span>{s.groupCount} nhóm</span>
                  {s.targetClasses.length > 0 && (
                    <span className="truncate font-mono">{s.targetClasses.slice(0, 3).join(', ')}</span>
                  )}
                  <span className={`ml-auto font-mono tabular-nums ${SEAT_STYLE[seatState(left, s.capacity)].text}`}>
                    còn {Math.max(left, 0)}/{s.capacity}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- 16px Seat Cell with Progress Bar ---------- */
function SeatCell({ capacity, registered }: { capacity: number; registered: number }) {
  const left = capacity - registered;
  const state = seatState(left, capacity);
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 100;

  return (
    <div className="min-w-[100px]">
      <div className={`font-mono text-base font-bold leading-none tabular-nums ${SEAT_STYLE[state].text}`}>
        {state === 'full' ? 'Hết chỗ' : `Còn ${left}`}
      </div>
      <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
        {registered}/{capacity} đã đăng ký
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted border border-border/40" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-300 ${SEAT_STYLE[state].bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Pure Presentational View (Claude Design) ---------- */
export function SubjectSelectorCardView({
  subjects,
  selectedSubjectCode,
  onSelectSubject,
  groups,
  selectedGroupId,
  onSelectGroup,
  onClearSubjectSelection,
  onOpenDuplicateModal,
}: SubjectSelectorCardViewProps) {
  const selected = subjects.find((s) => s.code === selectedSubjectCode);

  // Nhóm còn chỗ lên trước, nhóm trùng lịch / hết chỗ xuống cuối
  const sorted = useMemo(() => {
    const rank = (g: GroupRow) =>
      g.capacity - g.registered <= 0 ? 2 : g.conflictWith ? 1 : 0;
    return [...groups].sort((a, b) => rank(a) - rank(b) || a.group.localeCompare(b.group));
  }, [groups]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">Chọn môn và nhóm lớp</h2>
        {selected && onClearSubjectSelection && (
          <button
            type="button"
            onClick={onClearSubjectSelection}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="size-3" />
            <span>Bỏ chọn</span>
          </button>
        )}
      </div>

      <SubjectCombobox subjects={subjects} selected={selected} onSelect={onSelectSubject} />

      {selected && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-sm font-bold text-foreground">{selected.name}</h3>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {selected.code} · {selected.credits} TC
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {SCOPE_LABEL[selected.scope]}
            </span>
            {selected.hasSameNameVariant && (
              <button
                type="button"
                onClick={onOpenDuplicateModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                title="Nhấn để mở bảng so sánh chi tiết giữa các mã môn cùng tên"
              >
                <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Có môn cùng tên khác mã · Xem so sánh</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground font-semibold">
                <tr>
                  <th className="w-12 px-3.5 py-2.5">Chọn</th>
                  <th className="px-3.5 py-2.5">Nhóm / Lớp</th>
                  <th className="px-3.5 py-2.5">Chỗ trống</th>
                  <th className="px-3.5 py-2.5">Lịch học</th>
                  <th className="px-3.5 py-2.5">Phòng</th>
                  <th className="px-3.5 py-2.5">Giảng viên</th>
                </tr>
              </thead>
              <tbody role="radiogroup" aria-label="Nhóm lớp">
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Không có nhóm lớp nào khả dụng cho môn học này.
                    </td>
                  </tr>
                )}
                {sorted.map((g) => {
                  const full = g.capacity - g.registered <= 0;
                  const isSelected = g.id === selectedGroupId;

                  return (
                    <tr
                      key={g.id}
                      onClick={() => !full && onSelectGroup(g.id)}
                      className={`border-t border-border align-top transition-colors ${
                        isSelected
                          ? 'bg-primary/10'
                          : g.conflictWith
                          ? 'bg-amber-50/70 dark:bg-amber-400/5'
                          : ''
                      } ${full ? 'opacity-70' : 'cursor-pointer hover:bg-secondary/60'}`}
                    >
                      <td className="px-3.5 py-3">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={`Chọn nhóm ${g.group} lớp ${g.targetClass}`}
                          disabled={full}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGroup(g.id);
                          }}
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                              : 'border-muted-foreground/40 hover:border-foreground'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
                        </button>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-mono text-sm font-bold tabular-nums text-foreground">
                          Nhóm {g.group}
                        </div>
                        {g.targetClass && (
                          <div className="font-mono text-xs tabular-nums text-muted-foreground font-medium">{g.targetClass}</div>
                        )}
                        {g.conflictWith && (
                          <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                            Trùng lịch với {g.conflictWith}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <SeatCell capacity={g.capacity} registered={g.registered} />
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3 font-mono text-xs tabular-nums text-foreground">
                        {g.sessions.length > 0 && g.sessions.some((s) => s.day > 0 && s.startPeriod > 0)
                          ? g.sessions
                              .filter((s) => s.day > 0 && s.startPeriod > 0)
                              .map((s, idx) => (
                                <div key={idx} className={idx > 0 ? 'mt-0.5 text-muted-foreground' : ''}>
                                  {dayLabel(s.day)}, tiết {s.startPeriod}–{s.startPeriod + s.periodCount - 1}
                                </div>
                              ))
                          : 'Chưa xếp lịch'}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs tabular-nums text-foreground">
                        {g.sessions.length > 0 ? g.sessions.map((s) => s.room).filter(Boolean).join(', ') || g.room : g.room}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-muted-foreground">
                        {g.sessions.length > 0 ? g.sessions.map((s) => s.teacher).filter(Boolean).join(', ') || g.teacher : g.teacher}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Connected Smart Component ---------- */
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

  const activePlan = plans.find((p) => p.id === activeTabId) || plans[0];
  const selectedIds = useMemo(() => activePlan?.selectedIds || [], [activePlan]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const currentlySelectedClasses = useMemo(() => {
    return allCourses.filter((c) => selectedIds.includes(c.id));
  }, [allCourses, selectedIds]);

  // Convert allSubjects to SubjectOption[]
  const subjectOptions: SubjectOption[] = useMemo(() => {
    return allSubjects.map((s) => ({
      code: s.ma_mon,
      name: s.ten_mon,
      credits: s.so_tc,
      scope: s.scope || 'major',
      groupCount: s.groupCount || 0,
      targetClasses: s.targetClasses || [],
      registered: s.totalRegistered || 0,
      capacity: s.totalCapacity || 0,
      hasSameNameVariant: Boolean(s.hasSameNameVariant),
    }));
  }, [allSubjects]);

  // Filter groups for current subject
  const groupRows: GroupRow[] = useMemo(() => {
    if (!selectedSubjectCode) return [];
    const rawGroups = allCourses.filter((c) => c.ma_mon === selectedSubjectCode);

    return rawGroups.map((g) => {
      const conflictRes = checkGroupConflict(g, currentlySelectedClasses);
      const conflictWith = conflictRes.hasConflict
        ? conflictRes.conflictingClass?.ten_mon || 'môn khác'
        : undefined;

      const sessions: GroupRowSession[] = (g.parsedSessions || []).map((s) => ({
        day: s.thu,
        startPeriod: s.tietStart,
        periodCount: s.soTiet || (s.tietEnd - s.tietStart + 1),
        room: s.phong,
        teacher: s.gv,
      }));

      return {
        id: g.id,
        group: g.to_hoc ? `${g.nhom_to} (Tổ ${g.to_hoc})` : g.nhom_to,
        targetClass: g.lop || (g.ds_lop && g.ds_lop.length > 0 ? g.ds_lop.join(', ') : ''),
        capacity: g.sl_cp,
        registered: g.sl_dk != null ? g.sl_dk : Math.max(0, g.sl_cp - g.sl_cl),
        teacher: sessions[0]?.teacher || 'Chưa phân công',
        room: sessions[0]?.room || 'Chưa xếp',
        sessions,
        conflictWith,
      };
    });
  }, [allCourses, selectedSubjectCode, currentlySelectedClasses]);

  // Selected group ID in the active plan for this subject
  const selectedGroupId = useMemo(() => {
    const found = groupRows.find((g) => selectedIds.includes(g.id));
    return found ? found.id : null;
  }, [groupRows, selectedIds]);

  const handleSelectGroup = (id: string) => {
    toggleGroupSelection(id);
  };

  return (
    <>
      <SubjectSelectorCardView
        subjects={subjectOptions}
        selectedSubjectCode={selectedSubjectCode}
        onSelectSubject={setSelectedSubjectCode}
        groups={groupRows}
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        onClearSubjectSelection={() => setSelectedSubjectCode('')}
        onOpenDuplicateModal={() => setShowDuplicateModal(true)}
      />

      {showDuplicateModal && (
        <DuplicateSubjectModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          currentSubjectCode={selectedSubjectCode}
          allSubjects={allSubjects}
          allCourses={allCourses}
          onSelectSubject={(code) => setSelectedSubjectCode(code)}
        />
      )}
    </>
  );
};
