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

  // Actions
  initData: () => Promise<void>;
  syncCatalogData: (silent?: boolean) => Promise<boolean>;
  setSelectedSubjectCode: (code: string | null) => void;
  toggleTheme: () => void;

  // Tab management
  addPlan: () => void;
  removePlan: (planId: string) => void;
  switchPlan: (planId: string) => void;

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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [{ id: 'plan-1', name: 'TKB_1', selectedIds: [] }];
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
      if (hash === '#planner') return 'planner';

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
      // Skip heavy state update if timestamp has not changed and courses are already loaded
      if (currentSync && currentSync === live.meta?.last_sync && get().allCourses.length > 0) {
        return true;
      }

      // In-place atomic update: keeps active plans, selectedIds, tabs and UI state completely intact!
      set({
        allCourses: live.courses,
        allSubjects: live.subjects,
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
    const newPlanName = `TKB_${newIndex}`;
    const nextPlans = [...plans, { id: newPlanId, name: newPlanName, selectedIds: [] }];

    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
    localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_TAB, newPlanId);

    set({ plans: nextPlans, activeTabId: newPlanId });
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
      get().setToastMessage('Lịch trùng !');
      return { success: false, error: 'Lịch trùng !' };
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
      let importedIds: string[] = [];

      if (Array.isArray(jsonData)) {
        // Could be array of IDs or array of items with id_to_hoc
        importedIds = jsonData.map(item => (typeof item === 'string' ? item : item.id_to_hoc || item.id)).filter(Boolean);
      } else if (jsonData && typeof jsonData === 'object') {
        if (Array.isArray(jsonData.selectedIds)) {
          importedIds = jsonData.selectedIds;
        } else if (Array.isArray(jsonData.classes)) {
          importedIds = jsonData.classes.map((c: any) => c.id_to_hoc || c.id).filter(Boolean);
        }
      }

      // Filter against valid courses
      const validIds = importedIds.filter(id => allCourses.some(c => c.id === id));
      if (validIds.length === 0) {
        get().setToastMessage('Không tìm thấy môn học hợp lệ trong file JSON!');
        return false;
      }

      const nextPlans = plans.map(p => (p.id === activeTabId ? { ...p, selectedIds: validIds } : p));
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
      set({ plans: nextPlans });
      get().setToastMessage(`Đã khôi phục thành công ${validIds.length} môn học!`);
      return true;
    } catch (e) {
      get().setToastMessage('Lỗi đọc file JSON!');
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
        id_to_hoc: c.id_to_hoc,
        ma_mon: c.ma_mon,
        ten_mon: c.ten_mon,
        nhom_to: c.nhom_to,
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
    } else if (hash === '#planner' && currentMode !== 'planner') {
      useTimetableStore.getState().setAppViewMode('planner');
    }
  });
}
