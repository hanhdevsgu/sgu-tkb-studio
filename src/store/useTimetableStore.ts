import { create } from 'zustand';
import { ClassGroup, SubjectSummary, PlanVersion, ConflictInfo } from '../types/course';
import { loadAllCourses, fetchLiveSguData } from '../utils/sguDataLoader';
import { checkGroupConflict, detectConflicts } from '../utils/conflictDetector';

interface TimetableState {
  // Course data
  allCourses: ClassGroup[];
  allSubjects: SubjectSummary[];
  selectedSubjectCode: string | null;
  lastSyncTime: string | null;

  // Tabs / Plans
  plans: PlanVersion[];
  activeTabId: string;

  // View modes
  timetableViewMode: 'grid' | 'card';
  selectedListViewMode: 'card' | 'table';
  appViewMode: 'planner' | 'dkmh';

  // Theme
  theme: 'light' | 'dark';

  // Modals & UI states
  isDonateModalOpen: boolean;
  isNotificationPopoverOpen: boolean;
  toastMessage: string | null;
  unreadNotifications: number;
  authSessionState: 'valid' | 'expired' | 'none';
  isAuthModalOpen: boolean;

  // Actions
  initData: () => Promise<void>;
  syncCatalogData: (silent?: boolean) => Promise<boolean>;
  mergeLiveCatalog: (rawItems: any[], rawSubjects?: any[]) => number;
  setSelectedSubjectCode: (code: string | null) => void;
  toggleTheme: () => void;
  setAuthSessionState: (state: 'valid' | 'expired' | 'none') => void;
  setAuthModalOpen: (open: boolean) => void;

  // Tab management
  addPlan: () => void;
  removePlan: (planId: string) => void;
  switchPlan: (planId: string) => void;
  renamePlan: (planId: string, newName: string) => void;

  // Selection actions
  toggleGroupSelection: (groupId: string) => { success: boolean; error?: string };
  removeGroupFromActiveTab: (groupId: string) => void;
  clearActiveTabSelection: () => void;

  // View mode setters
  setTimetableViewMode: (mode: 'grid' | 'card') => void;
  setSelectedListViewMode: (mode: 'card' | 'table') => void;
  setAppViewMode: (mode: 'planner' | 'dkmh') => void;

  // Modal setters
  setDonateModalOpen: (open: boolean) => void;
  setNotificationPopoverOpen: (open: boolean) => void;
  setToastMessage: (msg: string | null) => void;
  markNotificationsAsRead: () => void;

  // Import / Export
  importScheduleJson: (json: any) => boolean;
  exportScheduleJson: () => string;

  // Selectors / Getters
  getActivePlan: () => PlanVersion;
  getSelectedCoursesInActivePlan: () => ClassGroup[];
  getTotalCreditsInActivePlan: () => number;
  getActivePlanConflicts: () => { conflicts: ConflictInfo[]; conflictClassIds: Set<string> };
}

const LOCAL_STORAGE_KEY_PLANS = 'sgu_tkb_plans_v2';
const LOCAL_STORAGE_KEY_ACTIVE_TAB = 'sgu_tkb_active_tab_v2';
const LOCAL_STORAGE_KEY_THEME = 'sgu_tkb_theme';

const initialPlans: PlanVersion[] = (() => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p, idx) => ({
          ...p,
          name: p.name && !p.name.startsWith('TKB_') ? p.name : (p.name?.replace('TKB_', 'Phương án ') || `Phương án ${idx + 1}`),
        }));
      }
    }
  } catch (e) {}
  return [{ id: 'plan-1', name: 'Phương án 1', selectedIds: [] }];
})();

const initialActiveTabId: string = (() => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_TAB);
  if (saved && initialPlans.some(p => p.id === saved)) return saved;
  return initialPlans[0].id;
})();

const LOCAL_STORAGE_KEY_VIEW_MODE = 'sgu_app_view_mode';

const initialAppViewMode: 'planner' | 'dkmh' = (() => {
  try {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#dkmh') return 'dkmh';
      if (hash === '#planner' || hash === '#schedule') return 'planner';

      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_VIEW_MODE);
      if (saved === 'dkmh' || saved === 'planner') return saved;
    }
  } catch {}
  return 'planner';
})();

const initialTheme: 'light' | 'dark' = (() => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY_THEME);
  if (saved === 'light' || saved === 'dark') return saved;
  // Default to system preference or dark
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();

// Apply theme to document element
if (initialTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

const healPlansWithCourses = (
  currentPlans: PlanVersion[],
  prevCourses: ClassGroup[],
  nextCourses: ClassGroup[]
): { plans: PlanVersion[]; plansUpdated: boolean } => {
  let plansUpdated = false;
  const newIdSet = new Set(nextCourses.map((c) => c.id));

  const healedPlans = currentPlans.map((plan) => {
    let changed = false;
    const nextIds = plan.selectedIds.map((oldId) => {
      if (newIdSet.has(oldId)) return oldId;
      const oldCourse = prevCourses.find((c) => c.id === oldId || c.id_to_hoc === oldId);
      if (oldCourse) {
        const replacement =
          nextCourses.find(
            (c) =>
              c.ma_mon === oldCourse.ma_mon &&
              c.nhom_to === oldCourse.nhom_to &&
              (c.to_hoc || '') === (oldCourse.to_hoc || '')
          ) ||
          nextCourses.find(
            (c) => c.ma_mon === oldCourse.ma_mon && c.nhom_to === oldCourse.nhom_to
          );
        if (replacement) {
          changed = true;
          plansUpdated = true;
          return replacement.id;
        }
      }
      return oldId;
    });
    return changed ? { ...plan, selectedIds: Array.from(new Set(nextIds)) } : plan;
  });

  if (plansUpdated) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(healedPlans));
    } catch {}
  }

  return { plans: plansUpdated ? healedPlans : currentPlans, plansUpdated };
};

export const useTimetableStore = create<TimetableState>((set, get) => ({
  allCourses: [],
  allSubjects: [],
  selectedSubjectCode: null,

  plans: initialPlans,
  activeTabId: initialActiveTabId,

  timetableViewMode: 'grid',
  selectedListViewMode: 'card',
  appViewMode: initialAppViewMode,

  theme: initialTheme,

  isDonateModalOpen: false,
  isNotificationPopoverOpen: false,
  toastMessage: null,
  unreadNotifications: 6,
  authSessionState: (() => {
    try {
      const token = localStorage.getItem('sgu_dkmh_token');
      if (!token) return 'none';
      if (localStorage.getItem('sgu_dkmh_token_expired') === 'true') return 'expired';
      return 'valid';
    } catch {
      return 'none';
    }
  })(),
  setAuthSessionState: (state) => {
    try {
      if (state === 'expired') {
        localStorage.setItem('sgu_dkmh_token_expired', 'true');
      } else {
        localStorage.removeItem('sgu_dkmh_token_expired');
      }
    } catch {}
    set({ authSessionState: state });
  },
  isAuthModalOpen: false,
  setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
  lastSyncTime: (() => {
    try {
      return localStorage.getItem('sgu_last_sync_time') || null;
    } catch {
      return null;
    }
  })(),

  initData: async () => {
    // 1. Initial immediate load from memory/fallback so UI renders with 0ms delay
    if (get().allCourses.length === 0) {
      const { courses, subjects } = loadAllCourses();
      set({ allCourses: courses, allSubjects: subjects });
    }

    // 2. Fetch fresh live data silently without reload
    await get().syncCatalogData(true);
  },

  syncCatalogData: async (silent = true) => {
    try {
      const live = await fetchLiveSguData();
      if (!live) return false;

      const currentSync = get().lastSyncTime;
      // Skip heavy state update on silent background sync if timestamp has not changed and courses are already loaded
      if (silent && currentSync && currentSync === live.meta?.last_sync && get().allCourses.length > 0) {
        return true;
      }

      // Self-healing: nếu Phòng Đào Tạo SGU cập nhật lại mã hash id_to_hoc của 1 nhóm lớp giữa các đợt sync,
      // tự động ánh xạ lại selectedIds theo (ma_mon, nhom_to, to_hoc) để sinh viên không bao giờ bị mất môn đã xếp!
      const prevCourses = get().allCourses;
      const currentPlans = get().plans;
      const { plans: healedPlans, plansUpdated } = healPlansWithCourses(currentPlans, prevCourses, live.courses);

      // In-place atomic update: keeps active plans, selectedIds, tabs and UI state completely intact!
      set({
        allCourses: live.courses,
        allSubjects: live.subjects,
        plans: plansUpdated ? healedPlans : currentPlans,
        lastSyncTime: live.meta?.last_sync || new Date().toISOString(),
      });

      try {
        if (live.meta?.last_sync) {
          localStorage.setItem('sgu_last_sync_time', live.meta.last_sync);
        }
      } catch {}

      if (!silent) {
        get().setToastMessage('Đã đồng bộ môn học & sĩ số mới nhất từ SGU!');
      }
      return true;
    } catch (err) {
      if (!silent) {
        get().setToastMessage('Không thể kết nối máy chủ đồng bộ.');
      }
      return false;
    }
  },

  mergeLiveCatalog: (rawItems: any[], rawSubjects?: any[]) => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return 0;

    const subjectNameMap = new Map<string, string>();
    if (Array.isArray(rawSubjects)) {
      for (const s of rawSubjects) {
        const ma = String(s?.ma || s?.ma_mon || '').normalize('NFC').trim();
        const ten = String(s?.ten || s?.ten_mon || '').normalize('NFC').trim();
        if (ma && ten) subjectNameMap.set(ma, ten);
      }
    }

    const prepared = rawItems.map((item, idx) => {
      const maMon = String(item?.ma_mon || '').normalize('NFC').trim();
      const tenMon = subjectNameMap.get(maMon) || String(item?.ten_mon || '').trim() || `Môn ${maMon}`;
      return {
        ...item,
        ma_mon: maMon,
        ten_mon: tenMon,
        nhom_to: String(item?.nhom_to ?? item?.to_hoc ?? '').normalize('NFC').trim(),
        to: String(item?.to ?? '').normalize('NFC').trim(),
        id_to_hoc: String(item?.id_to_hoc || item?.id || `${maMon}_${item?.nhom_to ?? idx}`),
      };
    });

    const live = loadAllCourses(prepared);
    if (live.courses.length === 0) return 0;

    const prevCourses = get().allCourses;
    const prevSubjects = get().allSubjects;
    const currentPlans = get().plans;

    const liveByKey = new Map<string, ClassGroup>();
    const liveById = new Map<string, ClassGroup>();
    const consumedLiveIds = new Set<string>();

    for (const c of live.courses) {
      const key = `${c.ma_mon}|${c.nhom_to}|${c.to_hoc || ''}`;
      if (!liveByKey.has(key)) liveByKey.set(key, c);
      if (c.id_to_hoc && !liveById.has(c.id_to_hoc)) liveById.set(c.id_to_hoc, c);
    }

    const mergedCourses: ClassGroup[] = prevCourses.map((prev) => {
      const key = `${prev.ma_mon}|${prev.nhom_to}|${prev.to_hoc || ''}`;
      const liveMatch = liveByKey.get(key) || (prev.id_to_hoc ? liveById.get(prev.id_to_hoc) : undefined);
      if (!liveMatch) return prev;
      consumedLiveIds.add(liveMatch.id);
      return {
        ...prev,
        ...liveMatch,
        ds_lop: liveMatch.ds_lop && liveMatch.ds_lop.length > 0 ? liveMatch.ds_lop : prev.ds_lop,
        lop: liveMatch.lop || prev.lop,
        ds_khoa: liveMatch.ds_khoa && liveMatch.ds_khoa.length > 0 ? liveMatch.ds_khoa : prev.ds_khoa,
      };
    });

    for (const c of live.courses) {
      if (!consumedLiveIds.has(c.id)) {
        mergedCourses.push(c);
      }
    }

    const subjectMap = new Map<string, SubjectSummary>();
    for (const s of prevSubjects) subjectMap.set(s.ma_mon, s);
    for (const s of live.subjects) subjectMap.set(s.ma_mon, s);
    const mergedSubjects = Array.from(subjectMap.values()).sort((a, b) =>
      a.ten_mon.localeCompare(b.ten_mon)
    );

    const { plans: healedPlans } = healPlansWithCourses(currentPlans, prevCourses, mergedCourses);
    const nowIso = new Date().toISOString();

    set({
      allCourses: mergedCourses,
      allSubjects: mergedSubjects,
      plans: healedPlans,
      lastSyncTime: nowIso,
    });

    return live.courses.length;
  },

  setSelectedSubjectCode: (code) => set({ selectedSubjectCode: code }),

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_THEME, nextTheme);
    set({ theme: nextTheme });
  },

  addPlan: () => {
    const { plans } = get();
    if (plans.length >= 5) {
      get().setToastMessage('Chỉ được tạo tối đa 5 phiên bản thời khóa biểu!');
      return;
    }
    const newIndex = plans.length + 1;
    const newPlanId = `plan-${Date.now()}`;
    const newPlanName = `Phương án ${newIndex}`;
    const nextPlans = [...plans, { id: newPlanId, name: newPlanName, selectedIds: [] }];

    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_TAB, newPlanId);

    set({ plans: nextPlans, activeTabId: newPlanId });
  },

  renamePlan: (planId: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    const { plans } = get();
    const nextPlans = plans.map(p => p.id === planId ? { ...p, name: cleanName } : p);
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    set({ plans: nextPlans });
  },

  removePlan: (planId) => {
    const { plans, activeTabId } = get();
    if (plans.length <= 1) {
      get().setToastMessage('Phải giữ lại ít nhất 1 phiên bản!');
      return;
    }
    const nextPlans = plans.filter(p => p.id !== planId);
    let nextActiveTabId = activeTabId;
    if (activeTabId === planId) {
      nextActiveTabId = nextPlans[0].id;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_TAB, nextActiveTabId);

    set({ plans: nextPlans, activeTabId: nextActiveTabId });
  },

  switchPlan: (planId) => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_TAB, planId);
    set({ activeTabId: planId });
  },

  toggleGroupSelection: (groupId) => {
    const { allCourses, plans, activeTabId } = get();
    const candidate = allCourses.find(c => c.id === groupId);
    if (!candidate) return { success: false, error: 'Không tìm thấy nhóm môn học' };

    const activePlan = plans.find(p => p.id === activeTabId) || plans[0];
    const isCurrentlySelected = activePlan.selectedIds.includes(groupId);

    if (isCurrentlySelected) {
      // Uncheck / Deselect
      const nextIds = activePlan.selectedIds.filter(id => id !== groupId);
      const nextPlans = plans.map(p => (p.id === activePlan.id ? { ...p, selectedIds: nextIds } : p));
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
      set({ plans: nextPlans });
      return { success: true };
    }

    // Checking: verify conflict with other selected courses (excluding same subject code)
    const currentSelectedClasses = allCourses.filter(c => activePlan.selectedIds.includes(c.id));
    const conflictResult = checkGroupConflict(candidate, currentSelectedClasses);

    if (conflictResult.hasConflict) {
      const msg = conflictResult.reason ? `⚠️ ${conflictResult.reason}!` : '⚠️ Lịch trùng với môn đã chọn!';
      get().setToastMessage(msg);
      return { success: false, error: msg };
    }

    // If another group of the same course is currently selected, replace it!
    const sameCourseOtherGroupIds = allCourses
      .filter(c => c.ma_mon === candidate.ma_mon)
      .map(c => c.id);

    const filteredIds = activePlan.selectedIds.filter(id => !sameCourseOtherGroupIds.includes(id));
    const nextIds = [...filteredIds, groupId];

    const nextPlans = plans.map(p => (p.id === activePlan.id ? { ...p, selectedIds: nextIds } : p));
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    set({ plans: nextPlans });

    if ((candidate.sl_cl ?? 0) <= 0) {
      get().setToastMessage(
        `⚠️ Nhóm ${candidate.nhom_to} hiện đã hết chỗ — Đã thêm vào phương án để bạn bật Sniper canh slot!`
      );
    }

    return { success: true };
  },

  removeGroupFromActiveTab: (groupId) => {
    const { plans, activeTabId } = get();
    const activePlan = plans.find(p => p.id === activeTabId) || plans[0];
    const nextIds = activePlan.selectedIds.filter(id => id !== groupId);
    const nextPlans = plans.map(p => (p.id === activePlan.id ? { ...p, selectedIds: nextIds } : p));
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    set({ plans: nextPlans });
  },

  clearActiveTabSelection: () => {
    const { plans, activeTabId } = get();
    const nextPlans = plans.map(p => (p.id === activeTabId ? { ...p, selectedIds: [] } : p));
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    set({ plans: nextPlans });
  },

  setTimetableViewMode: (mode) => set({ timetableViewMode: mode }),
  setSelectedListViewMode: (mode) => set({ selectedListViewMode: mode }),
  setAppViewMode: (mode) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY_VIEW_MODE, mode);
        window.location.hash = mode;
      }
    } catch {}
    set({ appViewMode: mode });
  },

  setDonateModalOpen: (open) => set({ isDonateModalOpen: open }),
  setNotificationPopoverOpen: (open) => set({ isNotificationPopoverOpen: open }),

  setToastMessage: (msg) => {
    set({ toastMessage: msg });
    if (msg) {
      setTimeout(() => {
        if (get().toastMessage === msg) {
          set({ toastMessage: null });
        }
      }, 3000);
    }
  },

  markNotificationsAsRead: () => set({ unreadNotifications: 0 }),

  importScheduleJson: (jsonData) => {
    try {
      const { plans, activeTabId, allCourses } = get();
      const resolvedIds: string[] = [];

      const resolveCourseId = (rawItem: any): string | null => {
        if (!rawItem) return null;
        if (typeof rawItem === 'string') {
          const byExactId = allCourses.find((c) => c.id === rawItem);
          if (byExactId) return byExactId.id;
          const byIdToHoc = allCourses.find((c) => c.id_to_hoc === rawItem);
          return byIdToHoc ? byIdToHoc.id : null;
        }
        if (typeof rawItem === 'object') {
          if (rawItem.id) {
            const byId = allCourses.find((c) => c.id === String(rawItem.id));
            if (byId) return byId.id;
          }
          if (rawItem.ma_mon && rawItem.nhom_to) {
            const byComposite =
              allCourses.find(
                (c) =>
                  c.ma_mon === String(rawItem.ma_mon).trim() &&
                  c.nhom_to === String(rawItem.nhom_to).trim() &&
                  (c.to_hoc || '') === String(rawItem.to_hoc || rawItem.to || '').trim()
              ) ||
              allCourses.find(
                (c) =>
                  c.ma_mon === String(rawItem.ma_mon).trim() &&
                  c.nhom_to === String(rawItem.nhom_to).trim()
              );
            if (byComposite) return byComposite.id;
          }
          if (rawItem.id_to_hoc) {
            const byIdToHoc = allCourses.find((c) => c.id_to_hoc === String(rawItem.id_to_hoc));
            if (byIdToHoc) return byIdToHoc.id;
          }
        }
        return null;
      };

      const seenMaMons = new Set<string>();
      const pushUniqueCourse = (cid: string | null) => {
        if (!cid || resolvedIds.includes(cid)) return;
        const matched = allCourses.find((c) => c.id === cid);
        if (matched?.ma_mon) {
          if (seenMaMons.has(matched.ma_mon)) return;
          seenMaMons.add(matched.ma_mon);
        }
        resolvedIds.push(cid);
      };

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          pushUniqueCourse(resolveCourseId(item));
        }
      } else if (jsonData && typeof jsonData === 'object') {
        if (Array.isArray(jsonData.classes) && jsonData.classes.length > 0) {
          for (const cls of jsonData.classes) {
            pushUniqueCourse(resolveCourseId(cls));
          }
        }
        if (resolvedIds.length === 0 && Array.isArray(jsonData.selectedIds)) {
          for (const rawId of jsonData.selectedIds) {
            pushUniqueCourse(resolveCourseId(rawId));
          }
        }
      }

      if (resolvedIds.length === 0) {
        get().setToastMessage('Không tìm thấy môn học hợp lệ trong file JSON!');
        return false;
      }

      const nextPlans = plans.map(p => (p.id === activeTabId ? { ...p, selectedIds: resolvedIds } : p));
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
      set({ plans: nextPlans });
      get().setToastMessage(`✅ Đã khôi phục thành công ${resolvedIds.length} môn học!`);
      return true;
    } catch (e) {
      get().setToastMessage('❌ Lỗi đọc file JSON!');
      return false;
    }
  },

  exportScheduleJson: () => {
    const { plans, activeTabId, allCourses } = get();
    const activePlan = plans.find(p => p.id === activeTabId) || plans[0];
    const selected = allCourses.filter(c => activePlan.selectedIds.includes(c.id));

    const exportData = {
      version: '2.1.0',
      exportedAt: new Date().toISOString(),
      planName: activePlan.name,
      totalCredits: selected.reduce((sum, c) => sum + (c.so_tc || 0), 0),
      selectedIds: activePlan.selectedIds,
      classes: selected.map(c => ({
        id: c.id,
        id_to_hoc: c.id_to_hoc,
        ma_mon: c.ma_mon,
        ten_mon: c.ten_mon,
        nhom_to: c.nhom_to,
        to_hoc: c.to_hoc || '',
        so_tc: c.so_tc,
        tkb: c.parsedSessions,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  },

  getActivePlan: () => {
    const { plans, activeTabId } = get();
    return plans.find(p => p.id === activeTabId) || plans[0];
  },

  getSelectedCoursesInActivePlan: () => {
    const { allCourses } = get();
    const activePlan = get().getActivePlan();
    return allCourses.filter(c => activePlan.selectedIds.includes(c.id));
  },

  getTotalCreditsInActivePlan: () => {
    const selected = get().getSelectedCoursesInActivePlan();
    return selected.reduce((sum, c) => sum + (c.so_tc || 0), 0);
  },

  getActivePlanConflicts: () => {
    const selected = get().getSelectedCoursesInActivePlan();
    return detectConflicts(selected);
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.toLowerCase();
    const currentMode = useTimetableStore.getState().appViewMode;
    if (hash === '#dkmh' && currentMode !== 'dkmh') {
      useTimetableStore.getState().setAppViewMode('dkmh');
    } else if ((hash === '#planner' || hash === '#schedule') && currentMode !== 'planner') {
      useTimetableStore.getState().setAppViewMode('planner');
    }
  });
}
