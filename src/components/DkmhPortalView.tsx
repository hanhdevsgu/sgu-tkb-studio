import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  RefreshCw,
  Trash2,
  LogIn,
  LogOut,
  Target,
  Printer,
  Search,
  BookOpen,
  Filter,
  Check,
  X,
  Square,
  AlertTriangle,
  ChevronsUpDown,
  Pencil,
  Calendar,
  Zap,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup } from '../types/course';
import { checkGroupConflict } from '../utils/conflictDetector';
import {
  SguDkmhService,
  SguAuthUser,
  EnrolledCourseItem,
  RegistrationResultItem,
  parseSguError,
} from '../services/sguDkmhService';
import { playSniperSuccessSound } from '../utils/audio';

export interface SnipingStatusItem {
  id: string; // id_to_hoc
  courseCode: string;
  courseName: string;
  group: string;
  credits: number;
  attempts: number;
  lastChecked: string;
  lastMessage: string;
}

export const DkmhPortalView: React.FC = () => {
  const {
    plans,
    activeTabId,
    allCourses,
    allSubjects,
    setToastMessage,
    setAppViewMode,
    renamePlan,
    syncCatalogData,
    setAuthSessionState,
    isAuthModalOpen,
    setAuthModalOpen,
  } = useTimetableStore();

  // 1. AUTH & ACCOUNT STATE
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sgu_dkmh_token') || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<SguAuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('sgu_dkmh_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMssv, setLoginMssv] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Multi-Account switch list
  const [savedAccounts, setSavedAccounts] = useState<Array<{ mssv: string; name: string; token: string; lop?: string }>>(() => {
    try {
      const raw = localStorage.getItem('sgu_dkmh_saved_accounts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // 2. PORTAL TIME WINDOW & REGISTRATION GATE
  const [portalOpen, setPortalOpen] = useState<boolean>(true);
  const [portalMessage, setPortalMessage] = useState<string>('Trong thời gian đăng ký');

  // 3. ENROLLED COURSES (CSDL SGU - Table 2)
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseItem[]>([]);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [droppingId, setDroppingId] = useState<string | null>(null);
  const [confirmDropCourse, setConfirmDropCourse] = useState<EnrolledCourseItem | null>(null);

  // 4. FILTER CONDITIONS (Khối 1: ĐIỀU KIỆN LỌC)
  // 1: Mở theo lớp SV (Default SGU - DCT1241), 10: Theo môn học, 99: Lọc theo TKB đã xếp, 2: Trong CTĐT, 4: Chưa học CTĐT, 5: Cần học lại, 3: Theo khoa, 6: Theo lớp
  const [filterType, setFilterType] = useState<number>(1);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');
  const [subjectSearchInput, setSubjectSearchInput] = useState<string>('');
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const [customStudentClass, setCustomStudentClass] = useState<string>(() => {
    try {
      return localStorage.getItem('sgu_dkmh_student_class') || '';
    } catch {
      return '';
    }
  });

  const studentClass = useMemo(() => {
    if (customStudentClass.trim()) return customStudentClass.trim().toUpperCase();
    if ((user as any)?.lop) return String((user as any).lop).trim().toUpperCase();
    const detectedFromEnrolled = enrolledCourses.find(
      (e) => e.lop && !e.lop.includes(',') && /^[A-Z]{2,5}\d{3,5}$/i.test(e.lop.trim())
    );
    if (detectedFromEnrolled?.lop) return detectedFromEnrolled.lop.trim().toUpperCase();
    if (user?.mssv?.startsWith('312441')) return 'DCT1241';
    return 'DCT1241';
  }, [customStudentClass, user, enrolledCourses]);

  const handleEditStudentClass = () => {
    const nextClass = window.prompt('Nhập mã lớp sinh viên của bạn để lọc môn mở theo lớp (VD: DCT1241, DCT1242):', studentClass);
    if (nextClass !== null) {
      const cleaned = nextClass.trim().toUpperCase();
      setCustomStudentClass(cleaned);
      try {
        if (cleaned) localStorage.setItem('sgu_dkmh_student_class', cleaned);
        else localStorage.removeItem('sgu_dkmh_student_class');
      } catch {}
      setToastMessage(`✅ Đã cập nhật lớp sinh viên mặc định: ${cleaned || 'DCT1241'}`);
    }
  };

  const [modeFilterIds, setModeFilterIds] = useState<{ idToHocs: Set<string>; maMons: Set<string> }>({
    idToHocs: new Set(),
    maMons: new Set(),
  });

  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedClassText, setSelectedClassText] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  // Sorting for Table 1 (Open Courses) & Table 2 (Enrolled Courses)
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [enrolledSortCol, setEnrolledSortCol] = useState<string>('');
  const [enrolledSortOrder, setEnrolledSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortOrder('asc');
    }
  };

  const handleEnrolledSort = (col: string) => {
    if (enrolledSortCol === col) {
      setEnrolledSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setEnrolledSortCol(col);
      setEnrolledSortOrder('asc');
    }
  };

  // Column search keywords for Table 1 (DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ)
  const [searchMaMon, setSearchMaMon] = useState('');
  const [searchTenMon, setSearchTenMon] = useState('');
  const [searchNhom, setSearchNhom] = useState('');
  const [searchLop, setSearchLop] = useState('');

  // 5. SELECTION & SUBMISSION QUEUE
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingCourseId, setSubmittingCourseId] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<RegistrationResultItem[]>([]);

  // 6. AUTO-SNIPER & NON-BLOCKING BACKGROUND RADAR (Mặc định luôn tự động tranh giành slot khi môn hết chỗ)
  const autoSnipeEnabled = true;
  const [delaySeconds, setDelaySeconds] = useState<number>(0); // Siêu tốc 0s, 1s, 3s
  const [activeSnipingMap, setActiveSnipingMap] = useState<Map<string, SnipingStatusItem>>(new Map());
  const activeSnipingMapRef = useRef<Map<string, SnipingStatusItem>>(new Map());
  const stopSnipingSignalRef = useRef(false);
  const isSniperLoopRunningRef = useRef(false);

  // 7. PRINT PREVIEW MODAL & ENROLLED TKB DETAIL MODAL
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [viewingTkbCourse, setViewingTkbCourse] = useState<EnrolledCourseItem | null>(null);

  // Dừng ngầm sniper loop khi component unmount để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      stopSnipingSignalRef.current = true;
    };
  }, []);

  // Filtered subjects for Combobox (allows typing code or name)
  const filteredSubjects = useMemo(() => {
    const q = subjectSearchInput.trim().toLowerCase();
    if (!q) {
      return allSubjects.slice(0, 80);
    }
    return allSubjects
      .filter((s) => s.ma_mon.toLowerCase().includes(q) || s.ten_mon.toLowerCase().includes(q))
      .slice(0, 100);
  }, [allSubjects, subjectSearchInput]);

  // Click outside to close combobox dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSubject = (s: { ma_mon: string; ten_mon: string }) => {
    setSelectedSubjectCode(s.ma_mon);
    setSubjectSearchInput(`${s.ten_mon} (${s.ma_mon})`);
    setIsSubjectDropdownOpen(false);
  };

  const handleClearSubject = () => {
    setSelectedSubjectCode('');
    setSubjectSearchInput('');
    setIsSubjectDropdownOpen(false);
  };

  const handleRenameCurrentPlan = () => {
    const currentPlan = plans.find((p) => p.id === selectedPlanId);
    if (!currentPlan) return;
    const newName = window.prompt('Nhập tên mới cho phương án thời khóa biểu này:', currentPlan.name);
    if (newName && newName.trim()) {
      renamePlan(currentPlan.id, newName.trim());
      setToastMessage(`✅ Đã đổi tên phương án thành "${newName.trim()}"`);
    }
  };

  const handleRefreshLiveCatalog = async () => {
    setIsRefreshingCatalog(true);
    setToastMessage('⏳ Đang làm mới dữ liệu môn học & sĩ số từ cổng đào tạo SGU...');
    try {
      let activeToken = token || (() => {
        try { return localStorage.getItem('sgu_dkmh_token'); } catch { return null; }
      })();

      let syncExpired = false;
      if (activeToken) {
        try {
          const syncRes = await fetch('/api-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: activeToken }),
          });
          let syncData = await syncRes.json().catch(() => null);
          if (syncData?.newToken) {
            activeToken = syncData.newToken;
            setToken(syncData.newToken);
            try { localStorage.setItem('sgu_dkmh_token', syncData.newToken); } catch {}
          }
          if (syncData && syncData.success === false && (syncData.reason === 'expired' || syncData.reason === 'unauthorized')) {
            const refreshed = await SguDkmhService.tryRefreshToken(activeToken || '');
            if (refreshed) {
              activeToken = refreshed;
              setToken(refreshed);
              const retryRes = await fetch('/api-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: refreshed }),
              });
              syncData = await retryRes.json().catch(() => null);
            }
            if (!syncData?.success) {
              syncExpired = true;
              setAuthSessionState('expired');
            } else {
              setAuthSessionState('valid');
            }
          }
        } catch {}
      }

      const ok = await syncCatalogData(false);
      if (activeToken) {
        await fetchEnrolledList(activeToken);
        await checkGateStatus(activeToken);
      }
      if (syncExpired) {
        setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn. Đang hiển thị bộ nhớ đệm, vui lòng đăng nhập lại để cập nhật sĩ số thực tế!');
      } else if (ok) {
        setToastMessage('✅ Đã cập nhật dữ liệu môn học & sĩ số mới nhất!');
      } else {
        setToastMessage('⚠️ Đã làm mới với bộ nhớ dữ liệu hiện tại.');
      }
    } catch {
      setToastMessage('⚠️ Không thể kết nối cổng SGU khi làm mới.');
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  /* -------------------------------------------------------------
   * INITIAL CHECKS & LOADERS
   * ------------------------------------------------------------- */
  const checkGateStatus = useCallback(async (authToken?: string | null) => {
    if (!authToken) {
      setPortalOpen(false);
      setPortalMessage('Chưa đăng nhập SGU');
      setAuthSessionState('none');
      return;
    }
    try {
      const res = await SguDkmhService.checkRegistrationPeriod(authToken);
      if (res.newToken) {
        setToken(res.newToken);
      }
      if (res.status === 401 || res.message.includes('hết hạn')) {
        setAuthSessionState('expired');
      } else if (res.isOpen) {
        setAuthSessionState('valid');
      }
      setPortalOpen(res.isOpen);
      setPortalMessage(res.message);
    } catch {
      setPortalOpen(true);
      setPortalMessage('Trong thời gian đăng ký');
    }
  }, [setAuthSessionState]);

  const fetchEnrolledList = useCallback(async (authToken?: string) => {
    const t = authToken || token;
    if (!t) return;
    try {
      setIsLoadingEnrolled(true);
      const res = await SguDkmhService.getEnrolledCourses(t);
      if (res?.newToken) {
        setToken(res.newToken);
        setAuthSessionState('valid');
      }
      if (res?.authExpired) {
        setAuthSessionState('expired');
        return;
      }
      if (res && Array.isArray(res.courses)) {
        setEnrolledCourses(res.courses);
      }
    } catch (e: any) {
      console.warn('Could not fetch enrolled list:', e.message);
    } finally {
      setIsLoadingEnrolled(false);
    }
  }, [token, setAuthSessionState]);

  const syncStudentProfile = useCallback((authToken: string) => {
    SguDkmhService.fetchStudentInfo(authToken).then((info) => {
      if (info?.newToken) {
        setToken(info.newToken);
      }
      if (!info?.lop && !info?.name) return;
      setUser((prev) => {
        const updated: SguAuthUser = {
          name: info.name || prev?.name || '',
          mssv: info.mssv || prev?.mssv || '',
          lop: info.lop || prev?.lop,
          khoa: info.khoa || prev?.khoa,
        };
        try {
          localStorage.setItem('sgu_dkmh_user', JSON.stringify(updated));
        } catch {}
        if (updated.mssv && updated.lop) {
          setSavedAccounts((prevAccs) => {
            const nextAccs = prevAccs.map((a) =>
              a.mssv === updated.mssv ? { ...a, name: updated.name || a.name, lop: updated.lop } : a
            );
            try {
              localStorage.setItem('sgu_dkmh_saved_accounts', JSON.stringify(nextAccs));
            } catch {}
            return nextAccs;
          });
        }
        return updated;
      });
    });
  }, []);

  useEffect(() => {
    if (token) {
      checkGateStatus(token);
      fetchEnrolledList(token);
      syncStudentProfile(token);
    } else {
      // Tự động thử khôi phục phiên đăng nhập từ .env cục bộ nếu trình duyệt chưa có token
      SguDkmhService.loginFromEnv()
        .then((envAuth) => {
          setToken(envAuth.token);
          setUser(envAuth.user);
          setAuthSessionState('valid');
          try {
            localStorage.setItem('sgu_dkmh_token', envAuth.token);
            localStorage.setItem('sgu_dkmh_user', JSON.stringify(envAuth.user));
          } catch {}
          syncStudentProfile(envAuth.token);
        })
        .catch(() => {
          setPortalOpen(false);
          setPortalMessage('Chưa đăng nhập SGU');
        });
    }
  }, [token, checkGateStatus, fetchEnrolledList, syncStudentProfile, setAuthSessionState]);

  // Truy vấn trực tiếp SGU khi chọn chế độ 2 (Trong CTĐT), 4 (Chưa học CTĐT), 5 (Cần học lại)
  useEffect(() => {
    if ((filterType === 2 || filterType === 4 || filterType === 5) && token) {
      let cancelled = false;
      SguDkmhService.fetchFilteredCourseIdsByMode(token, filterType).then((res) => {
        if (cancelled) return;
        if (res.newToken) {
          setToken(res.newToken);
          setAuthSessionState('valid');
        }
        if (res.authExpired) {
          setAuthSessionState('expired');
          return;
        }
        setModeFilterIds({ idToHocs: res.idToHocs, maMons: res.maMons });
      });
      return () => {
        cancelled = true;
      };
    } else {
      setModeFilterIds({ idToHocs: new Set(), maMons: new Set() });
    }
  }, [filterType, token, setAuthSessionState]);

  // Ánh xạ chính xác từng ID trong phương án sang đúng 1 dòng lớp học phần (tránh nhân bản các Tổ thực hành 01, 02 dùng chung id_to_hoc)
  const resolvePlanCourseList = useCallback(
    (planSelectedIds: string[]): ClassGroup[] => {
      const resolved: ClassGroup[] = [];
      const seenRowIds = new Set<string>();
      for (const selId of planSelectedIds) {
        const match =
          allCourses.find((c) => c.id === selId) ||
          allCourses.find((c) => c.id_to_hoc === selId);
        if (match && match.id && !seenRowIds.has(match.id)) {
          seenRowIds.add(match.id);
          resolved.push(match);
        }
      }
      return resolved;
    },
    [allCourses]
  );

  // Tự động gỡ khỏi hàng đợi tích chọn (selectedCourseIds) VÀ Radar Sniper những môn đã đăng ký thành công trong CSDL SGU
  useEffect(() => {
    if (enrolledCourses.length === 0) return;
    const enrolledMaMonSet = new Set(enrolledCourses.map((e) => e.ma_mon));
    setSelectedCourseIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        const matched = allCourses.find((c) => c.id === id || c.id_to_hoc === id);
        if (matched && enrolledMaMonSet.has(matched.ma_mon)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // Nếu môn đang bắn trong Radar Sniper đã được đăng ký thành công (ở nhóm đó hoặc nhóm khác), tự động dừng canh môn đó
    if (activeSnipingMapRef.current.size > 0) {
      let sniperChanged = false;
      const nextMap = new Map(activeSnipingMapRef.current);
      for (const [idToHoc, item] of nextMap.entries()) {
        if (enrolledMaMonSet.has(item.courseCode)) {
          nextMap.delete(idToHoc);
          sniperChanged = true;
        }
      }
      if (sniperChanged) {
        activeSnipingMapRef.current = nextMap;
        setActiveSnipingMap(nextMap);
        if (nextMap.size === 0) {
          stopSnipingSignalRef.current = true;
        }
      }
    }
  }, [enrolledCourses, allCourses]);

  // Pre-load selected items from current active timetable plan when using filterType 99 (Chỉ hiện môn trong TKB và tự động tick sẵn các môn chưa đăng ký)
  useEffect(() => {
    if (filterType === 99) {
      const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.id === activeTabId) || plans[0];
      if (currentPlan && currentPlan.selectedIds.length > 0) {
        const enrolledMaMonSet = new Set(enrolledCourses.map((e) => e.ma_mon));
        const planCourses = resolvePlanCourseList(currentPlan.selectedIds);
        const toSelect = new Set<string>();
        planCourses.forEach((c) => {
          if (c.id && !enrolledMaMonSet.has(c.ma_mon)) {
            toSelect.add(c.id);
          }
        });
        setSelectedCourseIds(toSelect);
      } else {
        setSelectedCourseIds(new Set());
      }
    }
  }, [selectedPlanId, filterType, plans, resolvePlanCourseList, enrolledCourses, activeTabId]);

  /* -------------------------------------------------------------
   * FILTERED COURSES (DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ)
   * ------------------------------------------------------------- */
  const faculties = useMemo(() => {
    const set = new Set<string>();
    allCourses.forEach((c) => {
      c.ds_khoa?.forEach((k) => k && set.add(k));
    });
    return Array.from(set).sort();
  }, [allCourses]);

  const displayCourses = useMemo(() => {
    let list = allCourses;

    // Filter by mode
    if (filterType === 1) {
      // 1. Môn học mở theo lớp sinh viên (VD: DCT1241)
      const targetClass = studentClass.toUpperCase();
      list = allCourses.filter((c) => {
        const lopUpper = (c.lop || '').toUpperCase();
        const inDsLop = (c.ds_lop || []).some((l) => l.toUpperCase().includes(targetClass));
        return lopUpper.includes(targetClass) || inDsLop;
      });
    } else if (filterType === 2 || filterType === 4 || filterType === 5) {
      // 2. Trong CTĐT kế hoạch | 4. Chưa học CTĐT | 5. Cần học lại
      // Khớp dữ liệu trực tiếp từ API w-locdsnhomto (loai_dk = 2, 4, 5). Ngoài đợt SGU trả rỗng -> list = []
      if (modeFilterIds.idToHocs.size > 0 || modeFilterIds.maMons.size > 0) {
        list = allCourses.filter(
          (c) =>
            (c.id_to_hoc && modeFilterIds.idToHocs.has(c.id_to_hoc)) ||
            (c.ma_mon && modeFilterIds.maMons.has(c.ma_mon))
        );
      } else {
        list = [];
      }
    } else if (filterType === 10 && selectedSubjectCode) {
      // 10. Theo môn học
      list = allCourses.filter((c) => c.ma_mon === selectedSubjectCode);
    } else if (filterType === 3 && selectedFaculty) {
      // 3. Theo khoa
      list = allCourses.filter((c) => c.ds_khoa?.includes(selectedFaculty));
    } else if (filterType === 6 && selectedClassText.trim()) {
      // 6. Theo lớp
      const q = selectedClassText.trim().toLowerCase();
      list = allCourses.filter((c) => {
        const fullLop = (c.ds_lop && c.ds_lop.length > 0 ? c.ds_lop.join(', ') : c.lop || '').toLowerCase();
        return fullLop.includes(q);
      });
    } else if (filterType === 99) {
      // 99. Nạp từ phương án TKB đã xếp (CHỈ hiển thị đúng những lớp đã xếp trong phương án)
      const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.id === activeTabId) || plans[0];
      if (currentPlan && currentPlan.selectedIds.length > 0) {
        list = resolvePlanCourseList(currentPlan.selectedIds);
      } else {
        list = [];
      }
    }

    // Column search filters
    if (searchMaMon.trim()) {
      const q = searchMaMon.trim().toLowerCase();
      list = list.filter((c) => c.ma_mon.toLowerCase().includes(q));
    }
    if (searchTenMon.trim()) {
      const q = searchTenMon.trim().toLowerCase();
      list = list.filter((c) => c.ten_mon.toLowerCase().includes(q));
    }
    if (searchNhom.trim()) {
      const q = searchNhom.trim().toLowerCase();
      list = list.filter((c) => (c.nhom_to || '').toLowerCase().includes(q));
    }
    if (searchLop.trim()) {
      const q = searchLop.trim().toLowerCase();
      list = list.filter((c) => {
        const fullLop = (c.ds_lop && c.ds_lop.length > 0 ? c.ds_lop.join(', ') : c.lop || '').toLowerCase();
        return fullLop.includes(q);
      });
    }

    // Column sorting
    if (sortColumn) {
      list = [...list].sort((a, b) => {
        if (sortColumn === 'so_tc' || sortColumn === 'sl_cp' || sortColumn === 'sl_cl') {
          const numA = Number((a as any)[sortColumn]) || 0;
          const numB = Number((b as any)[sortColumn]) || 0;
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        let strA = '';
        let strB = '';
        if (sortColumn === 'ma_mon') { strA = a.ma_mon || ''; strB = b.ma_mon || ''; }
        else if (sortColumn === 'ten_mon') { strA = a.ten_mon || ''; strB = b.ten_mon || ''; }
        else if (sortColumn === 'nhom_to') { strA = a.nhom_to || ''; strB = b.nhom_to || ''; }
        else if (sortColumn === 'to_hoc') { strA = a.to_hoc || a.to || ''; strB = b.to_hoc || b.to || ''; }
        else if (sortColumn === 'lop') {
          strA = a.ds_lop && a.ds_lop.length > 0 ? a.ds_lop.join(', ') : a.lop || '';
          strB = b.ds_lop && b.ds_lop.length > 0 ? b.ds_lop.join(', ') : b.lop || '';
        }
        const cmp = strA.localeCompare(strB, 'vi', { numeric: true });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [
    allCourses,
    filterType,
    studentClass,
    modeFilterIds,
    selectedPlanId,
    plans,
    selectedSubjectCode,
    selectedFaculty,
    selectedClassText,
    enrolledCourses,
    searchMaMon,
    searchTenMon,
    searchNhom,
    searchLop,
    sortColumn,
    sortOrder,
    activeTabId,
    resolvePlanCourseList,
  ]);

  // Self-healing: bảo toàn các môn đang tích chọn trên bảng ĐKMH khi dữ liệu SGU đồng bộ ngầm và đổi mã id_to_hoc
  const prevCoursesRef = useRef<ClassGroup[]>([]);
  useEffect(() => {
    const prev = prevCoursesRef.current;
    prevCoursesRef.current = allCourses;
    if (prev.length === 0 || allCourses.length === 0) return;

    const newIdSet = new Set(allCourses.map((c) => c.id));
    setSelectedCourseIds((currentSelected) => {
      if (currentSelected.size === 0) return currentSelected;
      let changed = false;
      const healed = new Set<string>();
      for (const oldId of currentSelected) {
        if (newIdSet.has(oldId)) {
          healed.add(oldId);
          continue;
        }
        const oldCourse = prev.find((c) => c.id === oldId || c.id_to_hoc === oldId);
        if (oldCourse) {
          const replacement =
            allCourses.find(
              (c) =>
                c.ma_mon === oldCourse.ma_mon &&
                c.nhom_to === oldCourse.nhom_to &&
                (c.to_hoc || '') === (oldCourse.to_hoc || '')
            ) ||
            allCourses.find(
              (c) => c.ma_mon === oldCourse.ma_mon && c.nhom_to === oldCourse.nhom_to
            );
          if (replacement?.id) {
            healed.add(replacement.id);
            changed = true;
            continue;
          }
        }
        healed.add(oldId);
      }
      return changed ? healed : currentSelected;
    });
  }, [allCourses]);

  // Danh sách các môn học đang được chọn hợp lệ (trên toàn bộ danh mục học phần)
  const selectedCoursesList = useMemo(() => {
    return allCourses.filter((c) => Boolean(c.id && selectedCourseIds.has(c.id)));
  }, [allCourses, selectedCourseIds]);

  const selectedCount = selectedCoursesList.length;

  const selectedTotalCredits = useMemo(() => {
    return selectedCoursesList.reduce((sum, c) => sum + (c.so_tc || 0), 0);
  }, [selectedCoursesList]);

  /* -------------------------------------------------------------
   * SELECTION HANDLERS (1 NHÓM / 1 MÃ MÔN HỌC + CẢNH BÁO TRÙNG LỊCH TỨC THÌ)
   * ------------------------------------------------------------- */
  const toggleSelectCourse = (id: string) => {
    const matched =
      allCourses.find((c) => c.id === id) ||
      allCourses.find((c) => c.id_to_hoc === id);
    const rowId = matched?.id || id;
    let replacedOtherGroup = false;
    const wasSelected = selectedCourseIds.has(rowId);

    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      const alreadySelected = next.has(rowId);

      if (alreadySelected) {
        next.delete(rowId);
        if (matched?.id_to_hoc && next.has(matched.id_to_hoc)) {
          next.delete(matched.id_to_hoc);
        }
      } else {
        // Nếu đã chọn 1 nhóm khác của cùng ma_mon -> tự động thay thế sang nhóm mới
        if (matched?.ma_mon) {
          for (const c of allCourses) {
            if (c.ma_mon === matched.ma_mon && c.id !== rowId) {
              if (c.id && next.has(c.id)) {
                next.delete(c.id);
                replacedOtherGroup = true;
              }
            }
          }
        }
        next.add(rowId);
      }
      return next;
    });

    if (!wasSelected && matched) {
      // Kiểm tra trùng lịch với các môn đã tích chọn (khác mã môn) + các môn đã đăng ký trong CSDL
      const enrolledClassGroups = enrolledCourses
        .map((e) =>
          allCourses.find(
            (c) =>
              c.ma_mon === e.ma_mon &&
              c.nhom_to === e.nhom_to &&
              (!e.to_hoc || (c.to_hoc || c.to || '') === e.to_hoc)
          )
        )
        .filter((c): c is ClassGroup => Boolean(c));

      const otherSelected = selectedCoursesList.filter((c) => c.ma_mon !== matched.ma_mon);
      const conflictRes = checkGroupConflict(matched, [...otherSelected, ...enrolledClassGroups]);
      if (conflictRes.hasConflict) {
        setToastMessage(
          `⚠️ Cảnh báo trùng lịch: ${matched.ten_mon} (Nhóm ${matched.nhom_to}${matched.to_hoc ? ` - Tổ ${matched.to_hoc}` : ''}) — ${conflictRes.reason}!`
        );
        return;
      }
    }

    if (replacedOtherGroup && matched) {
      setToastMessage(
        `🔄 Đã đổi môn ${matched.ten_mon} sang Nhóm ${matched.nhom_to}${matched.to_hoc ? ` (Tổ ${matched.to_hoc})` : ''}`
      );
    }
  };

  const toggleSelectAllDisplay = () => {
    const enrolledMaMonSet = new Set(enrolledCourses.map((e) => e.ma_mon));
    const eligibleCourses = displayCourses.filter((c) => !enrolledMaMonSet.has(c.ma_mon));
    const uniqueSubjectCodes = new Set(eligibleCourses.map((c) => c.ma_mon));
    const anyDisplayedSelected = eligibleCourses.some((c) => Boolean(c.id && selectedCourseIds.has(c.id)));
    const allSubjectsCovered =
      uniqueSubjectCodes.size > 0 &&
      Array.from(uniqueSubjectCodes).every((ma) =>
        eligibleCourses.some((c) => c.ma_mon === ma && Boolean(c.id && selectedCourseIds.has(c.id)))
      );

    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (allSubjectsCovered || (uniqueSubjectCodes.size === 1 && anyDisplayedSelected)) {
        // Bỏ chọn tất cả các lớp đang hiển thị
        displayCourses.forEach((c) => {
          if (c.id) next.delete(c.id);
        });
      } else {
        // Chọn tối đa 1 nhóm cho mỗi mã môn học (ưu tiên nhóm còn chỗ sl_cl > 0)
        const pickedSubjects = new Set<string>();
        // Giữ nguyên các môn đã được chọn từ trước trong danh sách hiển thị
        for (const c of eligibleCourses) {
          if (c.id && next.has(c.id)) {
            pickedSubjects.add(c.ma_mon);
          }
        }
        // Ưu tiên chọn nhóm còn chỗ trước
        for (const c of eligibleCourses) {
          if (!pickedSubjects.has(c.ma_mon) && (c.sl_cl ?? 0) > 0 && c.id) {
            next.add(c.id);
            pickedSubjects.add(c.ma_mon);
          }
        }
        // Nếu môn nào tất cả các nhóm đều hết chỗ, chọn nhóm đầu tiên để Sniper canh slot
        for (const c of eligibleCourses) {
          if (!pickedSubjects.has(c.ma_mon) && c.id) {
            next.add(c.id);
            pickedSubjects.add(c.ma_mon);
          }
        }
      }
      return next;
    });
  };

  /* -------------------------------------------------------------
   * NON-BLOCKING CONCURRENT REGISTRATION & AUTO-SNIPER CORE
   * ------------------------------------------------------------- */
  const stopAllSniping = useCallback(() => {
    stopSnipingSignalRef.current = true;
    activeSnipingMapRef.current = new Map();
    setActiveSnipingMap(new Map());
    setToastMessage('🛑 Đã dừng toàn bộ radar tranh giành slot.');
  }, [setToastMessage]);

  const removeSingleSnipingCourse = useCallback((idToHoc: string) => {
    const next = new Map(activeSnipingMapRef.current);
    const removed = next.get(idToHoc);
    next.delete(idToHoc);
    activeSnipingMapRef.current = next;
    setActiveSnipingMap(next);
    if (next.size === 0) {
      stopSnipingSignalRef.current = true;
    }
    if (removed) {
      setToastMessage(`🛑 Đã dừng canh slot môn: ${removed.courseName} (Nhóm ${removed.group})`);
    }
  }, [setToastMessage]);

  // Vòng lặp bắn radar ngầm cho các môn hết chỗ (chống chạy trùng 2 vòng lặp song song)
  const runBackgroundSniperLoop = useCallback(async () => {
    if (isSniperLoopRunningRef.current) return;
    isSniperLoopRunningRef.current = true;

    try {
      while (!stopSnipingSignalRef.current) {
        const currentMap = new Map(activeSnipingMapRef.current);
        if (currentMap.size === 0) break;

        let activeToken =
          (() => {
            try {
              return localStorage.getItem('sgu_dkmh_token');
            } catch {
              return null;
            }
          })() || token;
        if (!activeToken) {
          setToastMessage('⚠️ Sniper dừng: Chưa có token phiên đăng nhập SGU');
          break;
        }

        const entries = Array.from(currentMap.entries());
        for (const [idToHoc, item] of entries) {
          if (stopSnipingSignalRef.current) break;
          if (!activeSnipingMapRef.current.has(idToHoc)) continue;

          try {
            const res = await SguDkmhService.registerSingleCourse(activeToken, idToHoc);
            if (res.newToken) {
              activeToken = res.newToken;
              setToken(res.newToken);
            }
            const parsed = res.parsedError || parseSguError(res.message);

            if (res.authExpired || parsed.category === 'PHIEN_HET_HAN') {
              setAuthSessionState('expired');
              setShowLoginModal(true);
              setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại!');
              stopSnipingSignalRef.current = true;
              activeSnipingMapRef.current = new Map();
              setActiveSnipingMap(new Map());
              return;
            }

            if (res.success || parsed.category === 'DA_DANG_KY') {
              // CHIẾM SLOT THÀNH CÔNG!
              playSniperSuccessSound();
              setToastMessage(`🎉 CHIẾM SLOT THÀNH CÔNG: ${item.courseName} (Nhóm ${item.group})!`);

              // Xóa khỏi radar & bỏ chọn trong danh sách chờ
              const next = new Map(activeSnipingMapRef.current);
              next.delete(idToHoc);
              activeSnipingMapRef.current = next;
              setActiveSnipingMap(next);

              setSelectedCourseIds((prev) => {
                const copy = new Set(prev);
                copy.delete(idToHoc);
                for (const c of allCourses) {
                  if (c.id_to_hoc === idToHoc && c.id) {
                    copy.delete(c.id);
                  }
                }
                return copy;
              });

              // Cập nhật trạng thái trong bảng kết quả batchResults sang Đã đăng ký
              setBatchResults((prev) =>
                prev.map((r) =>
                  r.id === idToHoc
                    ? { ...r, success: true, message: '🎉 Sniper đã chiếm slot thành công!', parsedError: undefined }
                    : r
                )
              );

              // Cập nhật CSDL đã đăng ký
              fetchEnrolledList(activeToken);
            } else if (
              ['TIEN_QUYET', 'TRUNG_LICH', 'VUOT_TIN_CHI', 'HOC_PHI', 'KHONG_DUNG_CTDT', 'NGOAI_GIO'].includes(
                parsed.category
              )
            ) {
              // Khi lớp có chỗ nhưng bị SGU từ chối vì lỗi quy chế cố định -> dừng canh môn này và báo rõ nguyên nhân
              const next = new Map(activeSnipingMapRef.current);
              next.delete(idToHoc);
              activeSnipingMapRef.current = next;
              setActiveSnipingMap(next);

              setBatchResults((prev) =>
                prev.map((r) =>
                  r.id === idToHoc
                    ? { ...r, success: false, message: res.message, parsedError: parsed }
                    : r
                )
              );
              setToastMessage(`⚠️ Dừng canh slot [${item.courseName}]: ${res.message}`);
            } else {
              // Vẫn chưa có người nhả chỗ -> Cập nhật số lần thử
              const next = new Map(activeSnipingMapRef.current);
              const cur = next.get(idToHoc);
              if (cur) {
                next.set(idToHoc, {
                  ...cur,
                  attempts: cur.attempts + 1,
                  lastChecked: new Date().toLocaleTimeString('vi-VN'),
                  lastMessage: res.message || 'Lớp đã hết chỗ',
                });
                activeSnipingMapRef.current = next;
                setActiveSnipingMap(next);
              }
            }
          } catch (err: any) {
            console.warn('Sniper loop error:', err);
          }

          // Nghỉ vi bước giữa các môn đang săn (600ms)
          await new Promise((r) => setTimeout(r, 600));
        }

        // Nghỉ chu kỳ an toàn giữa các vòng radar: 3.5s - 4.3s có jitter ngẫu nhiên
        if (!stopSnipingSignalRef.current && activeSnipingMapRef.current.size > 0) {
          const cycleDelay = 3500 + Math.floor(Math.random() * 800);
          await new Promise((r) => setTimeout(r, cycleDelay));
        }
      }
    } finally {
      isSniperLoopRunningRef.current = false;
    }
  }, [token, allCourses, fetchEnrolledList, setToastMessage, setAuthSessionState]);

  /**
   * ĐĂNG KÝ HÀNG LOẠT KHÔNG CHẶN (PIPELINED REGISTRATION):
   * Ví dụ chọn 6 môn: Môn 1, 2, 3 thành công -> Môn 4 HẾT CHỖ:
   * -> Kích hoạt ngay chế độ tranh giành slot cho Môn 4
   * -> KHÔNG DỪNG LẠI! Tiếp tục đăng ký ngay Môn 5 và Môn 6!
   */
  const handleRegisterBatch = async (coursesToRegister?: ClassGroup[]) => {
    if (!token) {
      setShowLoginModal(true);
      setToastMessage('Vui lòng đăng nhập tài khoản sinh viên trước khi đăng ký.');
      return;
    }

    const rawTargetList = coursesToRegister || selectedCoursesList;
    // Khử trùng lặp theo id_to_hoc để không bao giờ gửi 2 request trùng id_to_hoc lên máy chủ SGU
    const seenIdToHoc = new Set<string>();
    const targetList = rawTargetList.filter((c) => {
      const key = c.id_to_hoc || c.id;
      if (seenIdToHoc.has(key)) return false;
      seenIdToHoc.add(key);
      return true;
    });

    if (targetList.length === 0) {
      setToastMessage('Vui lòng tích chọn ít nhất 1 môn học để đăng ký.');
      return;
    }

    setIsSubmitting(true);
    setBatchResults([]);
    stopSnipingSignalRef.current = false;
    setToastMessage(`⚡ Bắt đầu gửi đăng ký ${targetList.length} môn học...`);

    let currentToken = token;
    let successCount = 0;
    const fullSlotCourses: ClassGroup[] = [];
    const accumulatedResults: RegistrationResultItem[] = [];

    // VÒNG QUÉT ĐỒNG THỜI TOÀN BỘ CÁC MÔN (KHÔNG BỊ BLOCK KHI GẶP LỚP HẾT CHỖ)
    for (let i = 0; i < targetList.length; i++) {
      const course = targetList[i];
      const idToHoc = course.id_to_hoc || course.id;

      setSubmittingCourseId(idToHoc);

      try {
        const res = await SguDkmhService.registerSingleCourse(currentToken, idToHoc);
        if (res.newToken) {
          currentToken = res.newToken;
          setToken(res.newToken);
        }
        const parsed = res.parsedError || parseSguError(res.message);

        const groupLabel = course.to_hoc ? `${course.nhom_to} (Tổ ${course.to_hoc})` : course.nhom_to;

        if (res.authExpired || parsed.category === 'PHIEN_HET_HAN') {
          accumulatedResults.push({
            id: idToHoc,
            ma_mon: course.ma_mon,
            ten_mon: course.ten_mon,
            nhom_to: groupLabel,
            so_tc: course.so_tc ?? 0,
            success: false,
            message: res.message,
            parsedError: parsed,
          });
          setBatchResults([...accumulatedResults]);
          setAuthSessionState('expired');
          setShowLoginModal(true);
          setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại!');
          break;
        }

        const isRegistered = res.success || parsed.category === 'DA_DANG_KY';

        accumulatedResults.push({
          id: idToHoc,
          ma_mon: course.ma_mon,
          ten_mon: course.ten_mon,
          nhom_to: groupLabel,
          so_tc: course.so_tc ?? 0,
          success: isRegistered,
          message: res.message,
          parsedError: isRegistered ? undefined : parsed,
        });
        setBatchResults([...accumulatedResults]);

        if (isRegistered) {
          successCount++;
          playSniperSuccessSound();
          setToastMessage(`✅ Đăng ký thành công: ${course.ten_mon} (Nhóm ${groupLabel})`);
          // Bỏ chọn môn đã đăng ký thành công khỏi hàng đợi chọn
          setSelectedCourseIds((prev) => {
            const next = new Set(prev);
            if (course.id) next.delete(course.id);
            if (course.id_to_hoc) next.delete(course.id_to_hoc);
            return next;
          });
        } else {
          // Chỉ coi là hết chỗ khi phản hồi thực tế từ SGU thuộc nhóm HET_CHO (không nhầm với TRUNG_LICH, TIEN_QUYET, NGOAI_GIO, VUOT_TIN_CHI)
          const isFull =
            parsed.category === 'HET_CHO' ||
            /hết chỗ|sĩ số|không còn chỗ|đủ số lượng|full/i.test(res.message || '') ||
            (parsed.category === 'UNKNOWN_ERROR' && !res.transient && course.sl_cl !== undefined && course.sl_cl <= 0);

          if (isFull && autoSnipeEnabled) {
            // MÔN NÀY BỊ FULL CHỖ:
            // 1. Kích hoạt radar tranh slot ngay tại dòng môn học này
            fullSlotCourses.push(course);
            const nextMap = new Map(activeSnipingMapRef.current);
            nextMap.set(idToHoc, {
              id: idToHoc,
              courseCode: course.ma_mon,
              courseName: course.ten_mon,
              group: groupLabel,
              credits: course.so_tc ?? 0,
              attempts: 1,
              lastChecked: new Date().toLocaleTimeString('vi-VN'),
              lastMessage: res.message || 'Lớp hết chỗ. Đang canh người nhả lớp...',
            });
            activeSnipingMapRef.current = nextMap;
            setActiveSnipingMap(nextMap);

            setToastMessage(`🎯 [${course.ten_mon}] hết chỗ -> Tự động kích hoạt radar tranh slot. Đang gửi tiếp các môn còn lại!`);
            // 2. KHÔNG DỪNG LẠI! TIẾP TỤC VÒNG LẶP SANG MÔN TIẾP THEO (MÔN 5, MÔN 6...)!
          } else {
            setToastMessage(`⚠️ [${course.ten_mon}]: ${res.message || 'Không thể đăng ký'}`);
          }
        }
      } catch (err: any) {
        const fallbackMsg = err.message || 'Lỗi kết nối khi gửi đăng ký';
        accumulatedResults.push({
          id: idToHoc,
          ma_mon: course.ma_mon,
          ten_mon: course.ten_mon,
          nhom_to: course.nhom_to,
          so_tc: course.so_tc ?? 0,
          success: false,
          message: fallbackMsg,
          parsedError: parseSguError(fallbackMsg),
        });
        setBatchResults([...accumulatedResults]);
        setToastMessage(`❌ Lỗi kết nối khi gửi ${course.ten_mon}: ${fallbackMsg}`);
      }

      // Nghỉ vi bước theo lựa chọn nhịp gửi (0s = 100ms, 1s = 1000ms, 3s = 3000ms)
      if (i < targetList.length - 1) {
        const waitMs = delaySeconds > 0 ? delaySeconds * 1000 : 100;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    setSubmittingCourseId(null);
    setIsSubmitting(false);

    // Đồng bộ lại CSDL SGU sau lượt gửi đầu
    await fetchEnrolledList(currentToken);

    // NẾU CÓ MÔN HẾT CHỖ: KÍCH HOẠT VÒNG LẶP RADAR TRANH SLOT NGẦM CHO ĐẾN KHI GIÀNH ĐƯỢC CHỖ
    if (fullSlotCourses.length > 0 && autoSnipeEnabled) {
      setToastMessage(`🎯 Đã đăng ký thành công ${successCount} môn. Đang tự động canh giành slot cho ${fullSlotCourses.length} môn hết chỗ!`);
      // Bắt đầu vòng lặp radar ngầm
      runBackgroundSniperLoop();
    } else if (successCount > 0) {
      setToastMessage(`🎉 Hoàn tất! Đã đăng ký thành công ${successCount}/${targetList.length} môn học.`);
    }
  };

  /* -------------------------------------------------------------
   * DROP COURSE (HỦY MÔN HỌC KHỎI CSDL TRƯỜNG)
   * ------------------------------------------------------------- */
  const handleExecuteDrop = async () => {
    if (!token || !confirmDropCourse) return;
    const course = confirmDropCourse;
    setConfirmDropCourse(null);
    setDroppingId(course.id_kqdk);

    try {
      const res = await SguDkmhService.dropCourse(token, course.id_kqdk, course.id_to_hoc);
      const effectiveToken = res.newToken || token;
      if (res.newToken) {
        setToken(res.newToken);
        setAuthSessionState('valid');
      }
      if (res.authExpired) {
        setAuthSessionState('expired');
        setShowLoginModal(true);
        setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại!');
        return;
      }
      if (res.success) {
        setToastMessage(`✅ Đã hủy đăng ký thành công môn: ${course.ten_mon}`);
        fetchEnrolledList(effectiveToken);
      } else {
        setToastMessage(`❌ Không thể hủy môn: ${res.message || 'Lỗi từ máy chủ SGU'}`);
      }
    } catch (e: any) {
      setToastMessage(`❌ Lỗi kết nối khi hủy môn: ${e.message}`);
    } finally {
      setDroppingId(null);
    }
  };

  /* -------------------------------------------------------------
   * AUTH MODAL HANDLERS
   * ------------------------------------------------------------- */
  const handlePerformLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginMssv.trim() || !loginPassword.trim()) {
      setLoginError('Vui lòng nhập đầy đủ MSSV và Mật khẩu.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await SguDkmhService.login(loginMssv, loginPassword);
      setToken(res.token);
      setUser(res.user);

      try {
        localStorage.setItem('sgu_dkmh_token', res.token);
        localStorage.setItem('sgu_dkmh_user', JSON.stringify(res.user));
        // Save to saved accounts list
        const updated = [{ mssv: res.user.mssv, name: res.user.name, token: res.token }, ...savedAccounts.filter((a) => a.mssv !== res.user.mssv)];
        setSavedAccounts(updated);
        localStorage.setItem('sgu_dkmh_saved_accounts', JSON.stringify(updated));
      } catch {}

      // Lưu tài khoản + token vào .env và giữ mật khẩu trong bộ nhớ RAM máy chủ để tự động refresh khi 401
      await SguDkmhService.updateEnvAccount(res.user.mssv, loginPassword, res.token, res.user.name);

      setAuthSessionState('valid');
      setAuthModalOpen(false);
      setShowLoginModal(false);
      setLoginPassword('');
      setToastMessage(`✅ Đăng nhập thành công: ${res.user.name} (${res.user.mssv})`);

      checkGateStatus(res.token);
      fetchEnrolledList(res.token);
      syncStudentProfile(res.token);
    } catch (err: any) {
      setLoginError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setToken(null);
    setUser(null);
    setAuthSessionState('none');
    try {
      localStorage.removeItem('sgu_dkmh_token');
      localStorage.removeItem('sgu_dkmh_user');
      localStorage.removeItem('sgu_dkmh_token_expired');
    } catch {}
    await SguDkmhService.clearEnvAccount();
    setEnrolledCourses([]);
    setToastMessage('Đã đăng xuất tài khoản sinh viên.');
  };

  const totalEnrolledCredits = useMemo(() => {
    return enrolledCourses.reduce((sum, c) => sum + (c.so_tc || 0), 0);
  }, [enrolledCourses]);

  const sortedEnrolledCourses = useMemo(() => {
    if (!enrolledSortCol) return enrolledCourses;
    return [...enrolledCourses].sort((a, b) => {
      if (enrolledSortCol === 'so_tc') {
        const numA = Number(a.so_tc) || 0;
        const numB = Number(b.so_tc) || 0;
        return enrolledSortOrder === 'asc' ? numA - numB : numB - numA;
      }
      let strA = '';
      let strB = '';
      if (enrolledSortCol === 'ma_mon') { strA = a.ma_mon || ''; strB = b.ma_mon || ''; }
      else if (enrolledSortCol === 'ten_mon') { strA = a.ten_mon || ''; strB = b.ten_mon || ''; }
      else if (enrolledSortCol === 'nhom_to') { strA = a.nhom_to || ''; strB = b.nhom_to || ''; }
      else if (enrolledSortCol === 'lop') { strA = a.lop || ''; strB = b.lop || ''; }
      else if (enrolledSortCol === 'ngay_dang_ky') { strA = a.ngay_dang_ky || ''; strB = b.ngay_dang_ky || ''; }

      const cmp = strA.localeCompare(strB, 'vi', { numeric: true });
      return enrolledSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [enrolledCourses, enrolledSortCol, enrolledSortOrder]);

  const activeSnipingCount = activeSnipingMap.size;

  /* -------------------------------------------------------------
   * RENDER UI: 100% SGU COURSE-REGISTRATION MATCHING
   * ------------------------------------------------------------- */
  return (
    <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-5 py-4 space-y-4 font-sans text-slate-800 dark:text-slate-100">
      {/* 1. TOP HEADER BANNER: ĐĂNG KÝ MÔN HỌC & TRẠNG THÁI KHUNG GIỜ (Chuẩn SGU Image 1) */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-950/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-blue-900 dark:text-blue-200 uppercase m-0">
              ĐĂNG KÝ MÔN HỌC - HỌC KỲ 2 - NĂM HỌC 2026 - 2027
            </h1>
          </div>
          <div>
            {(() => {
              const isAuthNotice = !user || !token || portalMessage.includes('hết hạn') || portalMessage.includes('Chưa đăng nhập') || portalMessage.includes('401');
              return (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                      portalOpen
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                    }`}
                  >
                    {portalOpen ? 'TRONG THỜI GIAN ĐĂNG KÝ' : 'NGOÀI THỜI GIAN ĐĂNG KÝ'}
                  </span>
                  {isAuthNotice && (
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                    >
                      ({portalMessage} • Đăng nhập)
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Student Profile & Account Switcher */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card shadow-xs text-xs">
              <div className="size-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="font-bold text-foreground leading-tight">{user.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{user.mssv}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-2 text-muted-foreground hover:text-rose-600 transition-colors p-1"
                title="Đăng xuất"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <LogIn className="size-3.5" />
              <span>Đăng nhập tài khoản SGU</span>
            </button>
          )}

          {/* Jump to Planner button */}
          <button
            type="button"
            onClick={() => setAppViewMode('planner')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            <BookOpen className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Chuyển sang Xếp lịch</span>
          </button>
        </div>
      </div>

      {/* ACTIVE RADAR BANNER (Khi có môn đang chạy tranh giành slot ngầm) */}
      {activeSnipingCount > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <Target className="size-5 text-amber-600 animate-spin" />
            <div>
              <span className="font-bold text-sm">
                Đang tự động tranh giành slot cho {activeSnipingCount} môn hết chỗ:
              </span>{' '}
              <span className="font-semibold underline">
                {Array.from(activeSnipingMap.values())
                  .map((s) => `${s.courseName} (Lần #${s.attempts})`)
                  .join(', ')}
              </span>
              <p className="m-0 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                Radar liên tục kiểm tra và chiếm chỗ ngay giây phút có sinh viên khác nhả môn. Chuông sẽ reo khi thành công!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={stopAllSniping}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
          >
            <Square className="size-3.5 fill-current" />
            <span>Dừng tranh slot</span>
          </button>
        </div>
      )}

      {/* 2. KHỐI 1: ĐIỀU KIỆN LỌC (Chuẩn 100% SGU Image 1 & Image 2) */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-950/70 bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-indigo-50/80 dark:bg-slate-900/90 border-b border-indigo-200/80 dark:border-indigo-950/80 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 m-0 flex items-center gap-1.5">
            <Filter className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>ĐIỀU KIỆN LỌC</span>
          </h2>
          {filterType === 1 && (
            <button
              type="button"
              onClick={handleEditStudentClass}
              className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
              title="Đổi mã lớp sinh viên mặc định để lọc môn mở theo lớp"
            >
              <Pencil className="size-3" />
              <span>Lớp: {studentClass} (Đổi lớp)</span>
            </button>
          )}
          {filterType === 99 && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              ⚡ Đang nạp danh sách từ phương án: [{plans.find((p) => p.id === selectedPlanId)?.name || 'Phương án 1'}]
            </span>
          )}
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-950/40">
          {filterType === 1 || filterType === 2 || filterType === 4 || filterType === 5 ? (
            /* 100% SGU Image 10: Single full-width dropdown */
            <div className="w-full">
              <select
                value={filterType}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFilterType(val);
                }}
                className="w-full h-10 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              >
                <option value={10}>Lọc theo môn học</option>
                <option value={1}>Môn học mở theo lớp sinh viên - {studentClass}</option>
                <option value={2}>Môn trong chương trình đào tạo kế hoạch</option>
                <option value={4}>Môn chưa học trong CTĐT kế hoạch</option>
                <option value={5}>Môn sinh viên cần học lại (đã rớt)</option>
                <option value={3}>Lọc theo khoa quản lý môn học</option>
                <option value={6}>Lọc theo lớp</option>
                <option value={99}>⚡ Lọc theo TKB đã xếp</option>
              </select>
            </div>
          ) : (
            /* 2-Column layout when specific input/combobox is required (Image 3) */
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              {/* Dropdown Tiêu chí lọc */}
              <div className="w-full md:w-1/2 shrink-0">
                <select
                  value={filterType}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilterType(val);
                  }}
                  className="w-full h-10 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value={10}>Lọc theo môn học</option>
                  <option value={1}>Môn học mở theo lớp sinh viên - {studentClass}</option>
                  <option value={2}>Môn trong chương trình đào tạo kế hoạch</option>
                  <option value={4}>Môn chưa học trong CTĐT kế hoạch</option>
                  <option value={5}>Môn sinh viên cần học lại (đã rớt)</option>
                  <option value={3}>Lọc theo khoa quản lý môn học</option>
                  <option value={6}>Lọc theo lớp</option>
                  <option value={99}>⚡ Lọc theo TKB đã xếp</option>
                </select>
              </div>

              {/* Ô nhập liệu tương ứng */}
              <div className="flex-1 min-w-0">
                {filterType === 10 ? (
                  /* Searchable Combobox for Subjects: 100% SGU Image 3 & Image 4 */
                  <div ref={comboboxRef} className="relative w-full">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="- Chọn môn học --"
                        value={subjectSearchInput}
                        onChange={(e) => {
                          setSubjectSearchInput(e.target.value);
                          setIsSubjectDropdownOpen(true);
                        }}
                        onFocus={() => setIsSubjectDropdownOpen(true)}
                        className="w-full h-10 pl-3 pr-16 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                      />

                      <div className="absolute right-2 flex items-center gap-1 text-muted-foreground">
                        {(subjectSearchInput || selectedSubjectCode) && (
                          <button
                            type="button"
                            onClick={handleClearSubject}
                            className="p-1 hover:text-foreground rounded cursor-pointer transition-colors"
                            title="Xóa lựa chọn (xem tất cả)"
                          >
                            <X className="size-3.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsSubjectDropdownOpen((prev) => !prev)}
                          className="p-1 hover:text-foreground rounded cursor-pointer transition-colors"
                          title="Mở danh sách"
                        >
                          <ChevronsUpDown className="size-3.5 text-slate-500" />
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Popup List (Chuẩn 100% SGU Image 4: Tên môn in đậm + Mã môn bên dưới) */}
                    {isSubjectDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
                        {filteredSubjects.length === 0 ? (
                          <div className="p-3 text-xs text-center text-muted-foreground">
                            Không tìm thấy môn học nào khớp với "{subjectSearchInput}"
                          </div>
                        ) : (
                          filteredSubjects.map((s) => {
                            const isSelected = selectedSubjectCode === s.ma_mon;
                            return (
                              <div
                                key={s.ma_mon}
                                onClick={() => handleSelectSubject(s)}
                                className={`px-3.5 py-2.5 cursor-pointer transition-colors text-left ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                                }`}
                              >
                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                  {s.ten_mon}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                  Mã: {s.ma_mon}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : filterType === 99 ? (
                  /* Plan Selector with Inline Rename button */
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="flex-1 h-10 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.selectedIds.length} môn đã xếp)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleRenameCurrentPlan}
                      className="h-10 px-3 rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
                      title="Đổi tên phương án thời khóa biểu này cho dễ nhớ"
                    >
                      <Pencil className="size-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Đổi tên</span>
                    </button>
                  </div>
                ) : filterType === 3 ? (
                  /* Bộ lọc theo khoa */
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Tất cả các khoa / đơn vị quản lý --</option>
                    {faculties.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : filterType === 6 ? (
                  /* Bộ lọc theo lớp sinh viên */
                  <input
                    type="text"
                    placeholder="Nhập mã lớp (VD: DCT1241, DTH1231)..."
                    value={selectedClassText}
                    onChange={(e) => setSelectedClassText(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. KHỐI 2: DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ (Table 1 chuẩn SGU) */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-950/70 bg-card overflow-hidden shadow-xs space-y-0">
        {/* Table 1 Header Toolbar - 100% SGU Image 1 & Image 10 */}
        <div className="px-4 py-3 bg-blue-50/80 dark:bg-slate-900/90 border-b border-blue-200/80 dark:border-blue-950/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 m-0">
              DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Làm mới chuẩn SGU */}
            <button
              type="button"
              onClick={handleRefreshLiveCatalog}
              disabled={isRefreshingCatalog}
              className="h-8 px-3 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Làm mới danh sách môn học và sĩ số từ cổng SGU"
            >
              <RefreshCw className={`size-3.5 ${isRefreshingCatalog ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Bảng dữ liệu môn học mở đăng ký - Chuẩn 100% SGU Image 10 (10 cột, không có THAO TÁC) */}
        <div className="overflow-x-auto max-h-[520px] scrollbar-thin">
          <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
              {/* Cột chính - 100% SGU Image 10 */}
              <tr>
                <th className="w-12 text-center p-2 font-bold uppercase text-[11px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>CHỌN</span>
                    <input
                      type="checkbox"
                      checked={(() => {
                        const enrolledMaMonSet = new Set(enrolledCourses.map((e) => e.ma_mon));
                        const eligible = displayCourses.filter((c) => !enrolledMaMonSet.has(c.ma_mon));
                        if (eligible.length === 0) return false;
                        const uniqueSubjects = Array.from(new Set(eligible.map((c) => c.ma_mon)));
                        return uniqueSubjects.every((ma) =>
                          eligible.some((c) => c.ma_mon === ma && Boolean(c.id && selectedCourseIds.has(c.id)))
                        );
                      })()}
                      onChange={toggleSelectAllDisplay}
                      className="rounded size-3.5 cursor-pointer"
                      title="Chọn 1 nhóm cho mỗi môn học đang hiển thị"
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ma_mon')}
                  className="w-24 p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Mã môn"
                >
                  <div className="flex items-center justify-between">
                    <span>MÃ MH</span>
                    <span className="text-muted-foreground">{sortColumn === 'ma_mon' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ten_mon')}
                  className="p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Tên môn học"
                >
                  <div className="flex items-center justify-between">
                    <span>TÊN MÔN HỌC</span>
                    <span className="text-muted-foreground">{sortColumn === 'ten_mon' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('nhom_to')}
                  className="w-16 text-center p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Nhóm"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>NHÓM</span>
                    <span className="text-muted-foreground">{sortColumn === 'nhom_to' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('to_hoc')}
                  className="w-14 text-center p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Tổ"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TỔ</span>
                    <span className="text-muted-foreground">{sortColumn === 'to_hoc' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('so_tc')}
                  className="w-16 text-center p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Số tín chỉ"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>SỐ TC</span>
                    <span className="text-muted-foreground">{sortColumn === 'so_tc' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lop')}
                  className="w-28 p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Lớp"
                >
                  <div className="flex items-center justify-between">
                    <span>LỚP</span>
                    <span className="text-muted-foreground">{sortColumn === 'lop' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sl_cp')}
                  className="w-20 text-center p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Số lượng sĩ số"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>SỐ LƯỢNG</span>
                    <span className="text-muted-foreground">{sortColumn === 'sl_cp' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sl_cl')}
                  className="w-20 text-center p-2 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Còn lại"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>CÒN LẠI</span>
                    <span className="text-muted-foreground">{sortColumn === 'sl_cl' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="p-2 font-bold uppercase text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>THỜI KHÓA BIỂU</span>
                    <span className="text-muted-foreground">↕</span>
                  </div>
                </th>
              </tr>

              {/* Dòng bộ lọc tìm kiếm nhanh theo cột - 100% SGU Image 10 */}
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-t border-border/50 text-[11px]">
                <th className="p-1 text-center">
                  <Search className="size-3 text-muted-foreground mx-auto" />
                </th>
                <th className="p-1">
                  <input
                    type="text"
                    placeholder="Mã..."
                    value={searchMaMon}
                    onChange={(e) => setSearchMaMon(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-xs rounded border border-border bg-card text-foreground"
                  />
                </th>
                <th className="p-1">
                  <input
                    type="text"
                    placeholder="Tên..."
                    value={searchTenMon}
                    onChange={(e) => setSearchTenMon(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-xs rounded border border-border bg-card text-foreground"
                  />
                </th>
                <th className="p-1">
                  <input
                    type="text"
                    placeholder="Nhóm..."
                    value={searchNhom}
                    onChange={(e) => setSearchNhom(e.target.value)}
                    className="w-full px-1 py-0.5 text-xs rounded border border-border bg-card text-foreground text-center"
                  />
                </th>
                <th className="p-1"></th>
                <th className="p-1"></th>
                <th className="p-1">
                  <input
                    type="text"
                    placeholder="Lớp..."
                    value={searchLop}
                    onChange={(e) => setSearchLop(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-xs rounded border border-border bg-card text-foreground"
                  />
                </th>
                <th className="p-1"></th>
                <th className="p-1"></th>
                <th className="p-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {displayCourses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    {filterType === 99 ? (
                      <div className="py-2 space-y-1">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          Phương án [{plans.find((p) => p.id === selectedPlanId)?.name || 'này'}] chưa có môn học nào được xếp.
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Bạn hãy bấm vào nút <span className="font-semibold text-blue-600 dark:text-blue-400">"Chuyển sang Xếp lịch"</span> ở góc trên để chọn lớp vào phương án này nhé!
                        </div>
                      </div>
                    ) : (
                      <div className="py-2">
                        <div className="text-xs sm:text-[13px] font-normal text-slate-600 dark:text-slate-300">
                          Không tìm thấy môn học nào phù hợp với điều kiện tra cứu
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          Vui lòng thử chọn lại điều kiện lọc hoặc xóa từ khóa tìm kiếm theo cột
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                displayCourses.map((c, idx) => {
                  const idToHoc = c.id_to_hoc || c.id;
                  const isSelected = Boolean(c.id && selectedCourseIds.has(c.id));
                  const isEnrolled = enrolledCourses.some((e) => {
                    if (e.ma_mon !== c.ma_mon || e.nhom_to !== c.nhom_to) return false;
                    const cTo = (c.to_hoc || c.to || '').trim();
                    const eTo = (e.to_hoc || '').trim();
                    if (cTo && eTo) return cTo === eTo;
                    return true;
                  });
                  const isSubjectEnrolled = enrolledCourses.some((e) => e.ma_mon === c.ma_mon);
                  const isFull = (c.sl_cl !== undefined && c.sl_cl <= 0) || (c.sl_cp !== undefined && c.sl_dk !== undefined && c.sl_dk >= c.sl_cp);
                  const isBeingSubmitted = submittingCourseId === idToHoc;
                  const snipingStatus = activeSnipingMap.get(idToHoc);

                  return (
                    <tr
                      key={`${idToHoc}_${c.ma_mon}_${c.nhom_to}_${c.to_hoc || ''}_${idx}`}
                      className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors ${
                        snipingStatus
                          ? 'bg-amber-500/10'
                          : isEnrolled
                          ? 'bg-emerald-500/10'
                          : isSelected
                          ? 'bg-blue-500/10'
                          : ''
                      }`}
                    >
                      {/* 1. Checkbox chọn */}
                      <td className="text-center p-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isSubjectEnrolled || isBeingSubmitted}
                          onChange={() => toggleSelectCourse(c.id || c.id_to_hoc)}
                          className="rounded size-4 cursor-pointer disabled:opacity-40"
                          title={isSubjectEnrolled ? 'Môn học này đã có trong danh sách đã đăng ký' : undefined}
                        />
                      </td>

                      {/* 2. Mã môn */}
                      <td className="p-2 font-mono font-bold text-blue-700 dark:text-blue-300">
                        {c.ma_mon}
                      </td>

                      {/* 3. Tên môn */}
                      <td className="p-2 font-semibold text-foreground">
                        {c.ten_mon}
                      </td>

                      {/* 4. Nhóm */}
                      <td className="text-center p-2 font-mono font-bold">{c.nhom_to}</td>

                      {/* 5. Tổ */}
                      <td className="text-center p-2 font-mono">{c.to_hoc || c.to || ''}</td>

                      {/* 6. Số TC */}
                      <td className="text-center p-2 font-mono font-bold">{c.so_tc}</td>

                      {/* 7. Lớp */}
                      <td
                        className="p-2 text-muted-foreground truncate max-w-[140px]"
                        title={c.ds_lop && c.ds_lop.length > 0 ? c.ds_lop.join(', ') : c.lop || ''}
                      >
                        {c.ds_lop && c.ds_lop.length > 0 ? c.ds_lop.join(', ') : c.lop || ''}
                      </td>

                      {/* 8. SỐ LƯỢNG */}
                      <td className="text-center p-2 font-mono">{c.sl_cp}</td>

                      {/* 9. CÒN LẠI */}
                      <td className="text-center p-2 font-mono font-bold">
                        {isFull ? (
                          <span className="text-rose-600 dark:text-rose-400">0</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">{c.sl_cl}</span>
                        )}
                      </td>

                      {/* 10. THỜI KHÓA BIỂU - 100% SGU Image 10 */}
                      <td className="p-2 text-slate-700 dark:text-slate-300 leading-snug">
                        {Array.isArray((c as any).tkb) && (c as any).tkb.length > 0 ? (
                          <div className="space-y-0.5 text-[11px]">
                            {(c as any).tkb.map((t: any, idx: number) => {
                              const cleanPart = (val?: string) =>
                                val && val !== 'Chưa xếp' && val !== 'Chưa phân công' ? val : '';
                              const parts = [
                                cleanPart(t.thu),
                                cleanPart(t.thoi_gian)?.replace('->', ' → '),
                                cleanPart(t.phong),
                                cleanPart(t.giang_vien),
                                cleanPart(t.ngay),
                              ].filter(Boolean);
                              return <div key={idx}>{parts.length > 0 ? parts.join(', ') : 'Chưa xếp lịch'}</div>;
                            })}
                          </div>
                        ) : c.parsedSessions && c.parsedSessions.length > 0 ? (
                          <div className="space-y-0.5 text-[11px]">
                            {c.parsedSessions.map((s, idx) => {
                              const cleanPart = (val?: string) =>
                                val && val !== 'Chưa xếp' && val !== 'Chưa phân công' ? val : '';
                              const timeStr =
                                cleanPart(s.thoi_gian)?.replace('->', ' → ') ||
                                (s.tietStart && s.tietEnd ? `tiết ${s.tietStart} → ${s.tietEnd}` : '');
                              const parts = [
                                cleanPart(s.thuStr),
                                timeStr,
                                cleanPart(s.phong),
                                cleanPart(s.gv),
                                cleanPart(s.dates),
                              ].filter(Boolean);
                              return <div key={idx}>{parts.length > 0 ? parts.join(', ') : 'Chưa xếp lịch'}</div>;
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Chưa xếp lịch</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. KHỐI 3: DANH SÁCH MÔN HỌC ĐÃ ĐĂNG KÝ (Table 2 CSDL SGU chính thức) */}
      <div className="rounded-xl border border-teal-200 dark:border-teal-950/70 bg-card overflow-hidden shadow-xs space-y-0">
        <div className="px-4 py-3 bg-teal-50/80 dark:bg-slate-900/90 border-b border-teal-200/80 dark:border-teal-950/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-teal-900 dark:text-teal-200 m-0">
              DANH SÁCH MÔN HỌC ĐÃ ĐĂNG KÝ
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-[#00a651] text-white shadow-2xs">
              Đã đăng ký: {enrolledCourses.length} môn ({totalEnrolledCredits} TC)
            </span>
            <button
              type="button"
              disabled={isLoadingEnrolled || !token}
              onClick={() => fetchEnrolledList(token || undefined)}
              className="h-8 px-3 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Làm mới danh sách môn đã đăng ký từ cổng SGU"
            >
              <RefreshCw className={`size-3.5 ${isLoadingEnrolled ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="h-8 px-3 rounded-lg border border-border bg-white dark:bg-slate-900 text-foreground text-xs font-semibold hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Xuất hoặc in phiếu đăng ký môn học"
            >
              <Printer className="size-3.5 text-blue-600" />
              <span>In phiếu</span>
            </button>
          </div>
        </div>

        {/* Bảng kết quả đã đăng ký chính thức - Chuẩn 9 cột 100% SGU Image 1 */}
        <div className="overflow-x-auto max-h-[360px] scrollbar-thin">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
              <tr>
                <th className="w-12 text-center p-2.5 font-bold uppercase text-[11px]">XOÁ</th>
                <th
                  onClick={() => handleEnrolledSort('ma_mon')}
                  className="w-24 p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Mã môn học"
                >
                  <div className="flex items-center justify-between">
                    <span>MÃ MH</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'ma_mon' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleEnrolledSort('ten_mon')}
                  className="p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Tên môn học"
                >
                  <div className="flex items-center justify-between">
                    <span>TÊN MÔN HỌC</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'ten_mon' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleEnrolledSort('nhom_to')}
                  className="w-20 text-center p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Nhóm tổ"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>NHÓM TỔ</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'nhom_to' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleEnrolledSort('so_tc')}
                  className="w-16 text-center p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Số tín chỉ"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>SỐ TC</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'so_tc' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleEnrolledSort('lop')}
                  className="w-28 p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Lớp"
                >
                  <div className="flex items-center justify-between">
                    <span>LỚP</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'lop' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleEnrolledSort('ngay_dang_ky')}
                  className="w-36 p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Ngày đăng ký"
                >
                  <div className="flex items-center justify-between">
                    <span>NGÀY ĐĂNG KÝ</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'ngay_dang_ky' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : 'ˇ'}</span>
                  </div>
                </th>
                <th className="w-36 text-center p-2.5 font-bold uppercase text-[11px]">
                  <div className="flex items-center justify-center gap-1">
                    <span>TRẠNG THÁI</span>
                    <span className="text-muted-foreground font-normal">↕</span>
                  </div>
                </th>
                <th className="w-16 text-center p-2.5 font-bold uppercase text-[11px]">TKB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {sortedEnrolledCourses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Chưa có môn học nào được đăng ký trong học kỳ này trên hệ thống SGU.
                  </td>
                </tr>
              ) : (
                sortedEnrolledCourses.map((c) => {
                  const isDropping = droppingId === c.id_kqdk;
                  return (
                    <tr key={c.id_kqdk} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Nút hủy môn */}
                      <td className="text-center p-2">
                        <button
                          type="button"
                          disabled={isDropping}
                          onClick={() => setConfirmDropCourse(c)}
                          className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer disabled:opacity-40"
                          title="Hủy đăng ký môn học này"
                        >
                          {isDropping ? (
                            <RefreshCw className="size-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </td>

                      {/* 2. Mã môn */}
                      <td className="p-2 font-mono font-bold text-teal-700 dark:text-teal-300">{c.ma_mon}</td>

                      {/* 3. Tên môn */}
                      <td className="p-2 font-semibold text-foreground">{c.ten_mon}</td>

                      {/* 4. Nhóm tổ */}
                      <td className="text-center p-2 font-mono font-bold">
                        {c.nhom_to}{c.to_hoc ? ` (Tổ ${c.to_hoc})` : ''}
                      </td>

                      {/* 5. Số TC */}
                      <td className="text-center p-2 font-mono font-bold">{c.so_tc}</td>

                      {/* 6. Lớp */}
                      <td className="p-2 text-muted-foreground font-mono">
                        {c.lop || ''}
                      </td>

                      {/* 7. Ngày đăng ký */}
                      <td className="p-2 text-muted-foreground text-[11px] font-mono">
                        {(() => {
                          const rawDate = c.ngay_dang_ky?.trim();
                          if (!rawDate) return '';
                          if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(rawDate)) {
                            return rawDate.replace(/-/g, '/');
                          }
                          const parsedDate = new Date(rawDate);
                          return !Number.isNaN(parsedDate.getTime())
                            ? parsedDate.toLocaleDateString('vi-VN')
                            : rawDate;
                        })()}
                      </td>

                      {/* 8. Trạng thái CSDL */}
                      <td className="text-center p-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-800 dark:text-teal-200 text-[11px] font-bold">
                          <Check className="size-3" strokeWidth={3} />
                          Đã ghi nhận CSDL
                        </span>
                      </td>

                      {/* 9. TKB */}
                      <td className="text-center p-2">
                        <button
                          type="button"
                          onClick={() => setViewingTkbCourse(c)}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                          title="Xem thời khóa biểu môn này"
                        >
                          <Calendar className="size-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. KHỐI ĐIỀU KHIỂN RIÊNG BIỆT (GUI RIÊNG Ở DƯỚI) - SGU SNIPER & BỘ ĐIỀU KHIỂN ĐĂNG KÝ */}
      <div className="rounded-2xl border-2 border-blue-500/30 dark:border-blue-500/20 bg-gradient-to-b from-blue-50/70 via-card to-indigo-50/30 dark:from-slate-900/90 dark:via-card dark:to-blue-950/20 p-5 shadow-lg space-y-5">
        {/* Header Khối GUI */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap className="size-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-wide m-0 flex items-center gap-2">
                <span>BẢNG ĐIỀU KHIỂN ĐĂNG KÝ & CANH GIÀNH SLOT (SNIPER)</span>
              </h3>
              <p className="text-xs text-muted-foreground m-0">
                Gửi request song song trực tiếp từ máy cục bộ • Tự động giành slot khi lớp hết chỗ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 shadow-2xs">
              <Check className="size-3.5" strokeWidth={3} />
              <span>Sniper: Mặc định bật (Chạy song song không nghẽn)</span>
            </span>
          </div>
        </div>

        {/* 3 Cột chức năng */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CỘT 1: THAO TÁC ĐĂNG KÝ CHÍNH */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-slate-800 bg-card shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  1. Môn học đã chọn
                </span>
                <div className="flex items-center gap-2">
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCourseIds(new Set())}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                      title="Bỏ chọn toàn bộ các môn đang tích"
                    >
                      Bỏ chọn tất cả
                    </button>
                  )}
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                    {selectedTotalCredits} Tín chỉ
                  </span>
                </div>
              </div>

              <div className="text-2xl font-black text-blue-700 dark:text-blue-400">
                {selectedCount} <span className="text-xs font-bold text-foreground">môn trong danh sách</span>
              </div>

              {selectedCount > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin p-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-border/60">
                  {selectedCoursesList.map((c) => (
                    <span
                      key={c.id || c.id_to_hoc}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-white dark:bg-slate-800 text-foreground border border-border shadow-2xs"
                    >
                      <span>{c.ma_mon} (N{c.nhom_to}{c.to_hoc ? `-Tổ ${c.to_hoc}` : ''})</span>
                      <button
                        type="button"
                        onClick={() => toggleSelectCourse(c.id || c.id_to_hoc)}
                        className="text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                        title="Bỏ chọn môn này"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Tích chọn các môn bạn muốn đăng ký trong bảng danh sách phía trên (hoặc chọn bộ lọc <em>⚡ Lọc theo TKB đã xếp</em> để nạp sẵn cả bộ môn).
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (selectedCount === 0) {
                  setToastMessage('⚠️ Vui lòng tích chọn ít nhất 1 môn học trong bảng danh sách phía trên để gửi đăng ký!');
                  return;
                }
                handleRegisterBatch();
              }}
              className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                selectedCount > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-[0.99]'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>ĐANG GỬI ĐĂNG KÝ SGU...</span>
                </>
              ) : (
                <>
                  <Zap className="size-4 text-amber-300 fill-amber-300" />
                  <span>
                    {selectedCount > 0
                      ? `⚡ BẮT ĐẦU ĐĂNG KÝ (${selectedCount} MÔN)`
                      : '⚡ BẮT ĐẦU ĐĂNG KÝ (HÃY CHỌN MÔN)'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* CỘT 2: TÙY CHỈNH NHỊP GỬI (DELAY) */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-slate-800 bg-card shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>2. Tùy chỉnh nhịp gửi (Delay)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Khoảng thời gian nghỉ giữa các request khi gửi nhiều môn:
              </p>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {([
                  { s: 0, label: '⚡ Siêu tốc (0s)', desc: 'Micro-jitter 120ms' },
                  { s: 1, label: '1 giây', desc: 'An toàn chuẩn' },
                  { s: 3, label: '3 giây', desc: 'Chậm rãi' },
                ] as const).map((opt) => (
                  <button
                    key={opt.s}
                    type="button"
                    onClick={() => setDelaySeconds(opt.s)}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      delaySeconds === opt.s
                        ? 'border-blue-600 bg-blue-600 text-white font-bold shadow-xs'
                        : 'border-border bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className={`text-[10px] ${delaySeconds === opt.s ? 'text-blue-100' : 'text-muted-foreground'}`}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              💡 <strong>Cơ chế không nghẽn:</strong> Nếu môn nào bị hết chỗ, hệ thống sẽ tiếp tục nộp ngay các môn còn lại trong danh sách, đồng thời tự động đưa môn hết chỗ vào Radar Sniper săn slot!
            </div>
          </div>

          {/* CỘT 3: RADAR CANH GIÀNH SLOT THỜI GIAN THỰC */}
          <div className="p-4 rounded-xl border border-teal-200 dark:border-slate-800 bg-card shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="size-3.5 text-teal-600 dark:text-teal-400" />
                  <span>3. Radar canh giành slot</span>
                </span>
                {activeSnipingMap.size > 0 && (
                  <button
                    type="button"
                    onClick={stopAllSniping}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                  >
                    Dừng toàn bộ
                  </button>
                )}
              </div>

              {activeSnipingMap.size > 0 ? (
                <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin">
                  {Array.from(activeSnipingMap.values()).map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-amber-900 dark:text-amber-200 truncate max-w-[165px]">
                          {item.courseName}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            Nhóm {item.group}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSingleSnipingCourse(item.id)}
                            className="p-0.5 text-muted-foreground hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Dừng canh slot môn này"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Đã bắn: <strong>{item.attempts}</strong> lần</span>
                        <span>{item.lastChecked}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground text-xs space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Chưa có môn nào trong Radar săn slot
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Khi bạn bấm Đăng ký những lớp đã hết chỗ (còn lại 0), radar sẽ tự động hiển thị ở đây!
                  </div>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center border-t border-border/60 pt-2 flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Chạy cục bộ 100% tại máy • Bảo đảm an toàn tuyệt đối</span>
            </div>
          </div>
        </div>

        {/* BẢNG TỔNG HỢP KẾT QUẢ PHẢN HỒI TỪ CỔNG SGU CHO TỪNG MÔN TRONG ĐỢT GỬI */}
        {batchResults.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                📋 Kết quả phản hồi chi tiết từ máy chủ SGU ({batchResults.filter((r) => r.success).length}/{batchResults.length} thành công)
              </span>
              <button
                type="button"
                onClick={() => setBatchResults([])}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
              >
                <X className="size-3.5" />
                <span>Ẩn kết quả</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin">
              {batchResults.map((r, i) => {
                const isSniping = activeSnipingMap.has(r.id);
                return (
                  <div
                    key={`${r.id}_${i}`}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1 ${
                      r.success
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : isSniping
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-rose-500/5 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground truncate">
                        {r.ma_mon} - {r.ten_mon} (Nhóm {r.nhom_to})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          r.success
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : isSniping
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : r.parsedError?.badgeColor || 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                        }`}
                      >
                        {r.success
                          ? 'Đã đăng ký'
                          : isSniping
                          ? 'Đang canh slot'
                          : r.parsedError?.badgeLabel || 'Chưa thành công'}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      {r.message}
                      {!r.success && r.parsedError?.suggestion ? ` • 💡 ${r.parsedError.suggestion}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL XÁC NHẬN HỦY ĐĂNG KÝ (Chuẩn SGU popup) */}
      {confirmDropCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-6 shrink-0" />
              <h3 className="text-base font-bold text-foreground m-0">Xác nhận hủy đăng ký</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed m-0">
              Thao tác này sẽ xóa môn học <span className="font-bold text-foreground">{confirmDropCourse.ten_mon}</span> (Nhóm {confirmDropCourse.nhom_to}) khỏi danh sách môn đã đăng ký trên cổng đào tạo SGU.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDropCourse(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={handleExecuteDrop}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Đồng ý hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐĂNG NHẬP TÀI KHOẢN SINH VIÊN SGU */}
      {(showLoginModal || isAuthModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <LogIn className="size-5" />
                <h3 className="text-base font-bold text-foreground m-0">Đăng nhập tài khoản sinh viên SGU</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setAuthModalOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handlePerformLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mã số sinh viên (MSSV):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 3124410007"
                  value={loginMssv}
                  onChange={(e) => setLoginMssv(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mật khẩu đào tạo:</label>
                <input
                  type="password"
                  placeholder="Mật khẩu cổng dkmh.sgu.edu.vn"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                  {loginError}
                </div>
              )}

              {/* Danh sách nick đã lưu trên máy để chuyển đổi 1 click */}
              {savedAccounts.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase">Tài khoản đã lưu trên máy:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {savedAccounts.map((acc) => (
                      <button
                        key={acc.mssv}
                        type="button"
                        onClick={() => {
                          setToken(acc.token);
                          setUser({ name: acc.name, mssv: acc.mssv, lop: acc.lop });
                          try {
                            localStorage.setItem('sgu_dkmh_token', acc.token);
                            localStorage.setItem('sgu_dkmh_user', JSON.stringify({ name: acc.name, mssv: acc.mssv, lop: acc.lop }));
                          } catch {}
                          SguDkmhService.updateEnvAccount(acc.mssv, '', acc.token, acc.name);
                          setAuthSessionState('valid');
                          setShowLoginModal(false);
                          setAuthModalOpen(false);
                          setToastMessage(`✅ Đã chuyển sang tài khoản: ${acc.name} (${acc.mssv})`);
                          checkGateStatus(acc.token);
                          fetchEnrolledList(acc.token);
                          syncStudentProfile(acc.token);
                        }}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold border border-border bg-muted hover:bg-blue-500/10 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {acc.name} ({acc.mssv})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setAuthModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL XUẤT / IN PHIẾU ĐĂNG KÝ (Print preview) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-white text-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1 border-b pb-4">
              <div className="text-xs uppercase font-bold text-slate-500">TRƯỜNG ĐẠI HỌC SÀI GÒN</div>
              <div className="text-xs uppercase font-bold text-slate-500">PHÒNG ĐÀO TẠO</div>
              <h2 className="text-lg font-black uppercase text-blue-900 mt-2">KẾT QUẢ ĐĂNG KÝ HỌC PHẦN</h2>
              <p className="text-xs text-slate-500">Học kỳ 2 - Năm học 2026 - 2027</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-2">
              <div>Họ tên: <span className="font-bold">{user?.name || '—'}</span></div>
              <div>Mã SV: <span className="font-bold">{user?.mssv || '—'}</span></div>
              <div>Ngày in: <span className="font-bold">{new Date().toLocaleDateString('vi-VN')}</span></div>
              <div>Tổng số tín chỉ: <span className="font-bold text-blue-700">{totalEnrolledCredits} TC</span></div>
            </div>

            <table className="w-full text-xs text-left border border-slate-300">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-10">STT</th>
                  <th className="p-2 border-r border-slate-300">Mã MH</th>
                  <th className="p-2 border-r border-slate-300">Tên môn học</th>
                  <th className="p-2 border-r border-slate-300 text-center">Nhóm tổ</th>
                  <th className="p-2 border-r border-slate-300 text-center">Số TC</th>
                  <th className="p-2 text-right">Học phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {enrolledCourses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                      Chưa có môn học nào được đăng ký trong học kỳ này
                    </td>
                  </tr>
                ) : (
                  enrolledCourses.map((c, i) => (
                    <tr key={c.id_kqdk}>
                      <td className="p-2 text-center border-r border-slate-200">{i + 1}</td>
                      <td className="p-2 font-mono font-bold border-r border-slate-200">{c.ma_mon}</td>
                      <td className="p-2 border-r border-slate-200">{c.ten_mon}</td>
                      <td className="p-2 text-center border-r border-slate-200">
                        {c.nhom_to}{c.to_hoc ? ` (Tổ ${c.to_hoc})` : ''}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200">{c.so_tc}</td>
                      <td className="p-2 text-right">{c.hoc_phi_tam_tinh ? `${c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                In phiếu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL XEM CHI TIẾT THỜI KHÓA BIỂU MÔN ĐÃ ĐĂNG KÝ */}
      {viewingTkbCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Calendar className="size-5" />
                <h3 className="text-sm sm:text-base font-bold text-foreground m-0">
                  Thời khóa biểu: {viewingTkbCourse.ten_mon}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingTkbCourse(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-lg border border-border/60">
              <div>Mã môn: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{viewingTkbCourse.ma_mon}</span></div>
              <div>Nhóm tổ: <span className="font-mono font-bold">{viewingTkbCourse.nhom_to}{viewingTkbCourse.to_hoc ? ` (Tổ ${viewingTkbCourse.to_hoc})` : ''}</span></div>
              <div>Số tín chỉ: <span className="font-bold">{viewingTkbCourse.so_tc} TC</span></div>
              <div>Lớp: <span className="font-mono font-bold">{viewingTkbCourse.lop || '—'}</span></div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[11px]">Lịch học chi tiết:</div>
              {(() => {
                const matched = allCourses.find((c) => {
                  if (viewingTkbCourse.to_hoc && (c.to_hoc || c.to || '') !== viewingTkbCourse.to_hoc) return false;
                  return (
                    (viewingTkbCourse.id_to_hoc && (c.id_to_hoc === viewingTkbCourse.id_to_hoc || c.id === viewingTkbCourse.id_to_hoc)) ||
                    (c.ma_mon === viewingTkbCourse.ma_mon && c.nhom_to === viewingTkbCourse.nhom_to)
                  );
                });
                const rawTkb = Array.isArray(viewingTkbCourse.tkb) && viewingTkbCourse.tkb.length > 0
                  ? viewingTkbCourse.tkb
                  : Array.isArray((matched as any)?.tkb) && (matched as any).tkb.length > 0
                  ? (matched as any).tkb
                  : null;

                if (rawTkb) {
                  return (
                    <div className="space-y-1.5">
                      {rawTkb.map((t: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-border bg-background font-medium">
                          {[t.thu, t.thoi_gian?.replace('->', ' → '), t.phong, t.giang_vien, t.ngay].filter(Boolean).join(', ')}
                        </div>
                      ))}
                    </div>
                  );
                }

                if (matched?.parsedSessions && matched.parsedSessions.length > 0) {
                  return (
                    <div className="space-y-1.5">
                      {matched.parsedSessions.map((s, idx) => {
                        const timeStr = s.thoi_gian?.replace('->', ' → ') || (s.tietStart && s.tietEnd ? `tiết ${s.tietStart} → ${s.tietEnd}` : '');
                        return (
                          <div key={idx} className="p-2.5 rounded-lg border border-border bg-background font-medium">
                            {[s.thuStr, timeStr, s.phong, s.gv, s.dates].filter(Boolean).join(', ')}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <div className="p-3 rounded-lg border border-border bg-background text-muted-foreground">
                    {viewingTkbCourse.ten_giang_vien
                      ? `Giảng viên: ${viewingTkbCourse.ten_giang_vien}`
                      : 'Lịch học đã được ghi nhận trên CSDL đào tạo SGU.'}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingTkbCourse(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DkmhPortalView;
