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
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup, ScheduleSession } from '../types/course';
import { checkGroupConflict } from '../utils/conflictDetector';
import { parseDayOfWeek, parsePeriodString } from '../utils/sguDataLoader';
import { parseTkbString } from '../utils/tkbParser';
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
  rowId?: string; // unique row id (c.id)
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
    mergeLiveCatalog,
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
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [loginTab, setLoginTab] = useState<'password' | 'token'>('password');
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

  // 3B. OTP 2FA VERIFICATION MODAL (SGU HTTP 412) & LIVE SESSION MAP
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [otpPromptMessage, setOtpPromptMessage] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const pendingOtpActionRef = useRef<
    | { type: 'batch'; courses: ClassGroup[] }
    | { type: 'drop'; course: EnrolledCourseItem }
    | { type: 'sniper' }
    | null
  >(null);
  const liveIdMapByKeyRef = useRef<Map<string, string>>(new Map());

  const resolveLiveIdToHoc = useCallback((course: ClassGroup, mapOverride?: Map<string, string>) => {
    const fallbackId = course.id_to_hoc || course.id;
    const map = mapOverride && mapOverride.size > 0 ? mapOverride : liveIdMapByKeyRef.current;
    if (!map || map.size === 0 || !course.ma_mon || !course.nhom_to) return fallbackId;
    const maMon = String(course.ma_mon).trim();
    const nhom = String(course.nhom_to).trim();
    const to = String(course.to_hoc || '').trim();
    return map.get(`${maMon}|${nhom}|${to}`) || map.get(`${maMon}|${nhom}`) || fallbackId;
  }, []);

  const syncAndApplyLiveCatalog = useCallback(
    async (authToken: string) => {
      const sync = await SguDkmhService.syncSessionCatalogAndIdRs(authToken);
      if (sync.refreshedToken) {
        setToken(sync.refreshedToken);
        setAuthSessionState('valid');
      }
      if (sync.authExpired) {
        setAuthSessionState('expired');
      }
      if (sync.idMapByKey.size > 0) {
        liveIdMapByKeyRef.current = sync.idMapByKey;
      }
      if (sync.dsNhomTo && sync.dsNhomTo.length > 0) {
        mergeLiveCatalog(sync.dsNhomTo, sync.dsMonHoc);
      }
      return sync;
    },
    [mergeLiveCatalog, setAuthSessionState]
  );

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
    return '';
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
      setToastMessage(
        cleaned
          ? `✅ Đã cập nhật lớp sinh viên mặc định: ${cleaned}`
          : '✅ Đã xóa lớp sinh viên mặc định'
      );
    }
  };

  const [modeFilterIds, setModeFilterIds] = useState<{ idToHocs: Set<string>; maMons: Set<string> }>({
    idToHocs: new Set(),
    maMons: new Set(),
  });
  const [modeFilterRefreshTick, setModeFilterRefreshTick] = useState<number>(0);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedClassText, setSelectedClassText] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  useEffect(() => {
    setSelectedPlanId(activeTabId);
  }, [activeTabId]);

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
  const isBatchSubmittingRef = useRef(false);
  const sniperRunIdRef = useRef(0);

  // 7. PRINT PREVIEW MODAL & ENROLLED TKB DETAIL MODAL
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [viewingTkbCourse, setViewingTkbCourse] = useState<EnrolledCourseItem | null>(null);

  // Dừng ngầm sniper loop khi component unmount để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      stopSnipingSignalRef.current = true;
      sniperRunIdRef.current += 1;
      isSniperLoopRunningRef.current = false;
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
        if (filterType === 2 || filterType === 4 || filterType === 5) {
          setModeFilterRefreshTick((t) => t + 1);
        }
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
      } else {
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
      if (res && !res.failed && Array.isArray(res.courses)) {
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
        if (updated.mssv && (updated.lop || updated.name)) {
          SguDkmhService.updateEnvAccount(updated.mssv, undefined, authToken, updated.name, updated.lop);
        }
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
      syncAndApplyLiveCatalog(token).catch(() => {});
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
        })
        .catch(() => {
          setPortalOpen(false);
          setPortalMessage('Chưa đăng nhập SGU');
        });
    }
  }, [token, checkGateStatus, fetchEnrolledList, syncStudentProfile, syncAndApplyLiveCatalog, setAuthSessionState]);

  // Giữ phiên đăng nhập luôn tươi & tự động cập nhật trạng thái mở cổng ĐKMH mỗi 60 giây khi đang nhàn rỗi
  useEffect(() => {
    if (!token) return;
    const keepAliveTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (isBatchSubmittingRef.current || isSniperLoopRunningRef.current) return;
      const latestToken = (() => {
        try { return localStorage.getItem('sgu_dkmh_token') || token; } catch { return token; }
      })();
      if (latestToken) {
        checkGateStatus(latestToken);
      }
    }, 60 * 1000);
    return () => clearInterval(keepAliveTimer);
  }, [token, checkGateStatus]);

  // Đồng bộ sự kiện cập nhật token & nút Làm mới từ thanh Header toàn cục
  useEffect(() => {
    const handleTokenUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const nextToken = detail?.token ?? (() => {
        try { return localStorage.getItem('sgu_dkmh_token'); } catch { return null; }
      })();
      const nextUser = detail?.user ?? (() => {
        try {
          const raw = localStorage.getItem('sgu_dkmh_user');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();
      if (nextToken !== undefined) setToken(nextToken || null);
      if (nextUser !== undefined) setUser(nextUser || null);
      try {
        const rawSaved = localStorage.getItem('sgu_dkmh_saved_accounts');
        if (rawSaved) {
          const parsedSaved = JSON.parse(rawSaved);
          if (Array.isArray(parsedSaved)) setSavedAccounts(parsedSaved);
        }
      } catch {}
    };

    const handleManualRefresh = (e: Event) => {
      const detailToken = (e as CustomEvent)?.detail?.token;
      const currentToken = detailToken || token || (() => {
        try { return localStorage.getItem('sgu_dkmh_token'); } catch { return null; }
      })();
      if (currentToken) {
        fetchEnrolledList(currentToken);
        checkGateStatus(currentToken);
        setModeFilterRefreshTick((t) => t + 1);
      }
    };

    window.addEventListener('sgu-token-updated', handleTokenUpdated);
    window.addEventListener('sgu-manual-refresh', handleManualRefresh);
    return () => {
      window.removeEventListener('sgu-token-updated', handleTokenUpdated);
      window.removeEventListener('sgu-manual-refresh', handleManualRefresh);
    };
  }, [token, fetchEnrolledList, checkGateStatus]);

  // Truy vấn trực tiếp SGU khi chọn chế độ 2 (Trong CTĐT), 4 (Chưa học CTĐT), 5 (Cần học lại)
  useEffect(() => {
    if ((filterType === 2 || filterType === 4 || filterType === 5) && token) {
      let cancelled = false;
      setIsFilterLoading(true);
      // Xóa ngay ID của bộ lọc cũ để không bao giờ bị giữ nguyên danh sách môn cũ khi đổi chế độ
      setModeFilterIds({ idToHocs: new Set(), maMons: new Set() });

      SguDkmhService.fetchFilteredCourseIdsByMode(token, filterType)
        .then((res) => {
          if (cancelled) return;
          setIsFilterLoading(false);
          if (res.newToken) {
            setToken(res.newToken);
            setAuthSessionState('valid');
          }
          if (res.authExpired) {
            setAuthSessionState('expired');
            return;
          }
          if (res.dsNhomTo && res.dsNhomTo.length > 0) {
            mergeLiveCatalog(res.dsNhomTo, res.dsMonHoc);
          }
          setModeFilterIds({ idToHocs: res.idToHocs, maMons: res.maMons });
        })
        .catch(() => {
          if (!cancelled) setIsFilterLoading(false);
        });

      return () => {
        cancelled = true;
      };
    } else {
      setIsFilterLoading(false);
      setModeFilterIds({ idToHocs: new Set(), maMons: new Set() });
    }
  }, [filterType, token, setAuthSessionState, modeFilterRefreshTick, mergeLiveCatalog]);

  // Tự động quay về trang 1 khi người dùng đổi bộ lọc hoặc gõ từ khóa tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterType,
    searchMaMon,
    searchTenMon,
    searchNhom,
    searchLop,
    selectedFaculty,
    selectedClassText,
    selectedSubjectCode,
    subjectSearchInput,
    selectedPlanId,
  ]);

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

  // Pre-load selected items from current active timetable plan when switching to filterType 99 or changing plan
  // (Tránh tự chạy lại khi enrolledCourses hoặc allCourses cập nhật ngầm làm mất các checkbox người dùng vừa tự chỉnh)
  const lastPreloadedPlanKeyRef = useRef<string>('');
  const preloadPlanCoursesIntoSelection = useCallback(
    (planIdToLoad?: string) => {
      const targetId = planIdToLoad || selectedPlanId || activeTabId;
      const currentPlan = plans.find((p) => p.id === targetId) || plans.find((p) => p.id === activeTabId) || plans[0];
      if (currentPlan && currentPlan.selectedIds.length > 0) {
        const enrolledMaSet = new Set(enrolledCourses.map((e) => e.ma_mon));
        const planCourses = resolvePlanCourseList(currentPlan.selectedIds);
        const toSelect = new Set<string>();
        planCourses.forEach((c) => {
          if (c.id && !enrolledMaSet.has(c.ma_mon)) {
            toSelect.add(c.id);
          }
        });
        setSelectedCourseIds(toSelect);
      } else {
        setSelectedCourseIds(new Set());
      }
    },
    [selectedPlanId, activeTabId, plans, enrolledCourses, resolvePlanCourseList]
  );

  useEffect(() => {
    if (filterType !== 99) {
      lastPreloadedPlanKeyRef.current = '';
      return;
    }
    if (allCourses.length === 0) return;
    const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.id === activeTabId) || plans[0];
    const preloadKey = `99_${currentPlan?.id || ''}_${(currentPlan?.selectedIds || []).join(',')}`;
    if (lastPreloadedPlanKeyRef.current !== preloadKey) {
      lastPreloadedPlanKeyRef.current = preloadKey;
      preloadPlanCoursesIntoSelection(currentPlan?.id);
    }
  }, [filterType, selectedPlanId, activeTabId, plans, allCourses.length, preloadPlanCoursesIntoSelection]);

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
      // 1. Môn học mở theo lớp sinh viên
      if (studentClass) {
        const targetClass = studentClass.toUpperCase();
        list = allCourses.filter((c) => {
          const lopUpper = (c.lop || '').toUpperCase();
          const inDsLop = (c.ds_lop || []).some((l) => l.toUpperCase().includes(targetClass));
          return lopUpper.includes(targetClass) || inDsLop;
        });
      } else {
        list = [];
      }
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
    } else if (filterType === 10) {
      // 10. Theo môn học: chỉ hiển thị khi đã chọn môn hoặc gõ từ khóa tìm môn
      if (selectedSubjectCode) {
        list = allCourses.filter((c) => c.ma_mon === selectedSubjectCode);
      } else if (subjectSearchInput.trim()) {
        const q = subjectSearchInput.trim().toLowerCase();
        list = allCourses.filter(
          (c) => c.ma_mon.toLowerCase().includes(q) || c.ten_mon.toLowerCase().includes(q)
        );
      } else {
        list = [];
      }
    } else if (filterType === 3) {
      // 3. Theo khoa: chỉ hiển thị khi đã chọn khoa cụ thể
      if (selectedFaculty) {
        list = allCourses.filter((c) => c.ds_khoa?.includes(selectedFaculty));
      } else {
        list = [];
      }
    } else if (filterType === 6) {
      // 6. Theo lớp: chỉ hiển thị khi đã nhập mã lớp cần lọc
      if (selectedClassText.trim()) {
        const q = selectedClassText.trim().toLowerCase();
        list = allCourses.filter((c) => {
          const fullLop = (c.ds_lop && c.ds_lop.length > 0 ? c.ds_lop.join(', ') : c.lop || '').toLowerCase();
          return fullLop.includes(q);
        });
      } else {
        list = [];
      }
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
    subjectSearchInput,
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

    // Tự động ánh xạ lại id_to_hoc trong Radar Sniper nếu SGU cập nhật mã id_to_hoc khi đồng bộ ngầm
    if (activeSnipingMapRef.current.size > 0) {
      let sniperHealed = false;
      const nextMap = new Map<string, SnipingStatusItem>();
      for (const [oldIdToHoc, item] of activeSnipingMapRef.current.entries()) {
        const stillExists = allCourses.some((c) => c.id_to_hoc === oldIdToHoc);
        if (stillExists) {
          nextMap.set(oldIdToHoc, item);
          continue;
        }
        const replacement =
          allCourses.find(
            (c) =>
              c.ma_mon === item.courseCode &&
              (c.to_hoc ? `${c.nhom_to} (Tổ ${c.to_hoc})` : c.nhom_to) === item.group
          ) || allCourses.find((c) => c.ma_mon === item.courseCode);
        if (replacement && replacement.id_to_hoc) {
          nextMap.set(replacement.id_to_hoc, {
            ...item,
            id: replacement.id_to_hoc,
            rowId: replacement.id || replacement.id_to_hoc,
          });
          sniperHealed = true;
        } else {
          nextMap.set(oldIdToHoc, item);
        }
      }
      if (sniperHealed) {
        activeSnipingMapRef.current = nextMap;
        setActiveSnipingMap(nextMap);
      }
    }
  }, [allCourses]);

  // Danh sách các môn học đang được chọn hợp lệ (trên toàn bộ danh mục học phần)
  const selectedCoursesList = useMemo(() => {
    return allCourses.filter((c) => Boolean(c.id && selectedCourseIds.has(c.id)));
  }, [allCourses, selectedCourseIds]);

  const selectedCount = selectedCoursesList.length;

  const selectedTotalCredits = useMemo(() => {
    return selectedCoursesList.reduce((sum, c) => sum + (c.so_tc || 0), 0);
  }, [selectedCoursesList]);

  // Bộ Set O(1) tra cứu môn đã đăng ký để tối ưu hiệu năng hiển thị 60fps (không lag khi render hàng trăm môn)
  const enrolledIdToHocSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of enrolledCourses) {
      if (e.id_to_hoc) s.add(e.id_to_hoc);
      if (e.id_kqdk) s.add(e.id_kqdk);
    }
    return s;
  }, [enrolledCourses]);

  const enrolledMaMonSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of enrolledCourses) {
      if (e.ma_mon) s.add(e.ma_mon);
    }
    return s;
  }, [enrolledCourses]);

  const totalFilteredCourses = displayCourses.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalFilteredCourses / pageSize) : 1;
  const paginatedCourses = useMemo(() => {
    if (pageSize <= 0) return displayCourses;
    const start = (currentPage - 1) * pageSize;
    return displayCourses.slice(start, start + pageSize);
  }, [displayCourses, currentPage, pageSize]);

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
        .map((e): ClassGroup | null => {
          const matchedInAll = allCourses.find(
            (c) =>
              (e.id_to_hoc && (c.id_to_hoc === e.id_to_hoc || c.id === e.id_to_hoc)) ||
              (c.ma_mon === e.ma_mon &&
                c.nhom_to === e.nhom_to &&
                (!e.to_hoc || (c.to_hoc || c.to || '') === e.to_hoc))
          );
          if (matchedInAll) return matchedInAll;

          let sessions: ScheduleSession[] = [];
          if (Array.isArray(e.tkb) && e.tkb.length > 0) {
            sessions = e.tkb.map((t: any) => {
              const thu = parseDayOfWeek(t.thu);
              const { start, end, count } = parsePeriodString(t.thoi_gian);
              return {
                thu,
                thuStr: thu > 0 ? `Thứ ${thu}` : 'Chưa xếp',
                thoi_gian: t.thoi_gian || '',
                tietStart: start,
                tietEnd: end,
                soTiet: count,
                phong: t.phong || 'Chưa xếp',
                gv: t.giang_vien || e.ten_giang_vien || 'Chưa phân công',
                dates: t.ngay || '',
                isUnscheduled: thu === 0 || start === 0,
              };
            });
          } else if (e.tkb_str) {
            sessions = parseTkbString(e.tkb_str);
          }

          if (sessions.length === 0) return null;

          return {
            id: e.id_to_hoc || `enrolled_${e.ma_mon}_${e.nhom_to}`,
            id_to_hoc: e.id_to_hoc || '',
            ma_mon: e.ma_mon,
            ten_mon: e.ten_mon,
            nhom_to: e.nhom_to,
            to_hoc: e.to_hoc || '',
            so_tc: e.so_tc,
            sl_cp: 0,
            sl_cl: 0,
            tkb_raw: e.tkb_str || '',
            parsedSessions: sessions,
          };
        })
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
    sniperRunIdRef.current += 1;
    isSniperLoopRunningRef.current = false;
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
      sniperRunIdRef.current += 1;
      isSniperLoopRunningRef.current = false;
    }
    if (removed) {
      setToastMessage(`🛑 Đã dừng canh slot môn: ${removed.courseName} (Nhóm ${removed.group})`);
    }
  }, [setToastMessage]);

  // Vòng lặp bắn radar ngầm cho các môn hết chỗ (chống chạy trùng 2 vòng lặp song song bằng generation counter)
  const runBackgroundSniperLoop = useCallback(async () => {
    if (isSniperLoopRunningRef.current) return;
    isSniperLoopRunningRef.current = true;
    const myRunId = ++sniperRunIdRef.current;

    const resolveCurrentSniperTarget = (idKey: string, sItem: SnipingStatusItem): string => {
      const map = liveIdMapByKeyRef.current;
      if (!map || map.size === 0 || !sItem.courseCode) return idKey;
      const storeCourse = useTimetableStore
        .getState()
        .allCourses.find((c) => c.id === sItem.rowId || c.id_to_hoc === idKey);
      if (storeCourse) {
        return resolveLiveIdToHoc(storeCourse, map);
      }
      const groupMatch = String(sItem.group || '').match(/^([^\s(]+)(?:\s*\(Tổ\s*([^)]+)\))?/i);
      const nhom = groupMatch ? groupMatch[1].trim() : '';
      const to = groupMatch?.[2] ? groupMatch[2].trim() : '';
      if (!nhom) return idKey;
      return map.get(`${sItem.courseCode.trim()}|${nhom}|${to}`) || map.get(`${sItem.courseCode.trim()}|${nhom}`) || idKey;
    };

    try {
      let wasGateClosedPrevCycle = false;
      while (!stopSnipingSignalRef.current && sniperRunIdRef.current === myRunId) {
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

        let cycleResynced = false;
        if (!SguDkmhService.getSessionContext().id_rs) {
          cycleResynced = true;
          const bootSync = await syncAndApplyLiveCatalog(activeToken);
          if (bootSync.refreshedToken) activeToken = bootSync.refreshedToken;
          if (bootSync.authExpired) {
            setAuthSessionState('expired');
            setShowLoginModal(true);
            setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại!');
            stopSnipingSignalRef.current = true;
            sniperRunIdRef.current += 1;
            isSniperLoopRunningRef.current = false;
            activeSnipingMapRef.current = new Map();
            setActiveSnipingMap(new Map());
            return;
          }
        }

        const entries = Array.from(currentMap.entries());
        let gateStillClosed = false;
        let fastBurstOnOpen = false;
        for (const [originalMapKey, item] of entries) {
          if (stopSnipingSignalRef.current || sniperRunIdRef.current !== myRunId) break;
          // Nhường đường nếu người dùng đang chủ động bấm gửi batch ở luồng chính để không bắn trùng 2 request cùng mili-giây
          while (isBatchSubmittingRef.current && !stopSnipingSignalRef.current && sniperRunIdRef.current === myRunId) {
            await new Promise((r) => setTimeout(r, 300));
          }
          if (stopSnipingSignalRef.current || sniperRunIdRef.current !== myRunId) break;
          if (!activeSnipingMapRef.current.has(originalMapKey)) continue;

          try {
            let idToHoc = resolveCurrentSniperTarget(originalMapKey, item);
            if (idToHoc !== originalMapKey) {
              const rekeyed = new Map(activeSnipingMapRef.current);
              rekeyed.delete(originalMapKey);
              rekeyed.set(idToHoc, { ...item, id: idToHoc });
              activeSnipingMapRef.current = rekeyed;
              setActiveSnipingMap(rekeyed);
            }

            let res = await SguDkmhService.registerSingleCourse(activeToken, idToHoc);
            if (stopSnipingSignalRef.current || sniperRunIdRef.current !== myRunId) break;
            if (res.newToken) {
              activeToken = res.newToken;
              setToken(res.newToken);
            }
            let parsed = res.parsedError || parseSguError(res.message);

            // Tự động làm mới id_rs & id_to_hoc khi cổng vừa chuyển từ NGOAI_GIO -> mở hoặc SGU đổi phiên / HTTP 500
            if (
              !res.success &&
              !res.authExpired &&
              !res.requiresOtp &&
              !res.otpNoEmail &&
              parsed.category !== 'NGOAI_GIO' &&
              parsed.category !== 'DA_DANG_KY' &&
              !cycleResynced &&
              (wasGateClosedPrevCycle || res.httpStatus === 500 || !SguDkmhService.getSessionContext().id_rs || parsed.category === 'UNKNOWN_ERROR')
            ) {
              cycleResynced = true;
              const freshSync = await syncAndApplyLiveCatalog(activeToken);
              if (freshSync.refreshedToken) activeToken = freshSync.refreshedToken;
              if (freshSync.ok || freshSync.idMapByKey.size > 0) {
                const updatedIdToHoc = resolveCurrentSniperTarget(idToHoc, item);
                if (updatedIdToHoc !== idToHoc) {
                  const rekeyed = new Map(activeSnipingMapRef.current);
                  rekeyed.delete(idToHoc);
                  rekeyed.set(updatedIdToHoc, { ...item, id: updatedIdToHoc });
                  activeSnipingMapRef.current = rekeyed;
                  setActiveSnipingMap(rekeyed);
                  idToHoc = updatedIdToHoc;
                }
                res = await SguDkmhService.registerSingleCourse(activeToken, idToHoc);
                if (stopSnipingSignalRef.current || sniperRunIdRef.current !== myRunId) break;
                if (res.newToken) {
                  activeToken = res.newToken;
                  setToken(res.newToken);
                }
                parsed = res.parsedError || parseSguError(res.message);
              }
            }

            if (res.authExpired || parsed.category === 'PHIEN_HET_HAN') {
              setAuthSessionState('expired');
              setShowLoginModal(true);
              setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại!');
              stopSnipingSignalRef.current = true;
              sniperRunIdRef.current += 1;
              isSniperLoopRunningRef.current = false;
              activeSnipingMapRef.current = new Map();
              setActiveSnipingMap(new Map());
              return;
            }

            if (res.otpNoEmail) {
              stopSnipingSignalRef.current = true;
              sniperRunIdRef.current += 1;
              isSniperLoopRunningRef.current = false;
              setToastMessage(`⚠️ ${res.message}`);
              return;
            }

            if (res.requiresOtp) {
              pendingOtpActionRef.current = { type: 'sniper' };
              setOtpPromptMessage(res.message || 'SGU yêu cầu nhập mã OTP 6 chữ số đã gửi tới email sinh viên.');
              setOtpCodeInput('');
              setOtpError(null);
              setOtpModalOpen(true);
              stopSnipingSignalRef.current = true;
              sniperRunIdRef.current += 1;
              isSniperLoopRunningRef.current = false;
              setToastMessage('🔐 Sniper tạm dừng: SGU yêu cầu xác thực mã OTP email (412).');
              return;
            }

            if (res.success || parsed.category === 'DA_DANG_KY') {
              // CHIẾM SLOT THÀNH CÔNG! Nếu trước đó cổng đang đóng -> bật burst tốc độ cao cho các môn còn lại
              fastBurstOnOpen = true;
              playSniperSuccessSound();
              setPortalOpen(true);
              setPortalMessage('Trong thời gian đăng ký');
              setToastMessage(`🎉 CHIẾM SLOT THÀNH CÔNG: ${item.courseName} (Nhóm ${item.group})!`);

              // Xóa khỏi radar (kể cả các nhóm khác của cùng mã môn) & bỏ chọn trong danh sách chờ
              const next = new Map(activeSnipingMapRef.current);
              next.delete(idToHoc);
              for (const [k, v] of next.entries()) {
                if (v.courseCode === item.courseCode) next.delete(k);
              }
              activeSnipingMapRef.current = next;
              setActiveSnipingMap(next);

              setSelectedCourseIds((prev) => {
                const copy = new Set(prev);
                copy.delete(idToHoc);
                if (item.rowId) copy.delete(item.rowId);
                for (const c of useTimetableStore.getState().allCourses) {
                  if ((c.id_to_hoc === idToHoc || c.ma_mon === item.courseCode) && c.id) {
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
              ['TIEN_QUYET', 'TRUNG_LICH', 'VUOT_TIN_CHI', 'HOC_PHI', 'KHONG_DUNG_CTDT'].includes(
                parsed.category
              )
            ) {
              fastBurstOnOpen = true;
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
              // Vẫn chưa có người nhả chỗ hoặc đang chờ cổng mở (NGOAI_GIO / HET_CHO / LOI_MANG) -> Cập nhật số lần thử
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
              // Nếu SGU báo NGOAI_GIO: cổng toàn trường đang đóng -> dừng quét các môn sau ở lượt này để tránh spam vô ích
              if (parsed.category === 'NGOAI_GIO') {
                gateStillClosed = true;
                break;
              }
            }
          } catch (err: any) {
            console.warn('Sniper loop error:', err);
          }

          // Nếu cổng vừa mở hoặc đang chế độ burst -> chạy nhanh 120-180ms; ngược lại nghỉ 500-700ms giữa các môn
          const stepDelay = fastBurstOnOpen
            ? 120 + Math.floor(Math.random() * 60)
            : 500 + Math.floor(Math.random() * 200);
          await new Promise((r) => setTimeout(r, stepDelay));
        }

        if (wasGateClosedPrevCycle && !gateStillClosed && !cycleResynced) {
          cycleResynced = true;
          void syncAndApplyLiveCatalog(activeToken);
        }
        wasGateClosedPrevCycle = gateStillClosed;

        // Nếu đang chờ mở cổng (NGOAI_GIO): thăm dò nhịp 900-1200ms để bắt đúng giây 07:00:00; nếu đang săn slot hết chỗ: 2.2s-2.8s
        if (!stopSnipingSignalRef.current && sniperRunIdRef.current === myRunId && activeSnipingMapRef.current.size > 0) {
          const cycleDelay = gateStillClosed
            ? 900 + Math.floor(Math.random() * 300)
            : 2200 + Math.floor(Math.random() * 600);
          await new Promise((r) => setTimeout(r, cycleDelay));
        }
      }
    } finally {
      if (sniperRunIdRef.current === myRunId) {
        isSniperLoopRunningRef.current = false;
      }
    }
  }, [token, resolveLiveIdToHoc, syncAndApplyLiveCatalog, fetchEnrolledList, setToastMessage, setAuthSessionState]);

  /**
   * ĐĂNG KÝ HÀNG LOẠT KHÔNG CHẶN (PIPELINED REGISTRATION):
   * Ví dụ chọn 6 môn: Môn 1, 2, 3 thành công -> Môn 4 HẾT CHỖ:
   * -> Kích hoạt ngay chế độ tranh giành slot cho Môn 4
   * -> KHÔNG DỪNG LẠI! Tiếp tục đăng ký ngay Môn 5 và Môn 6!
   */
  const handleRegisterBatch = async (coursesToRegister?: ClassGroup[]) => {
    const initialToken =
      token ||
      (() => {
        try {
          return localStorage.getItem('sgu_dkmh_token');
        } catch {
          return null;
        }
      })();
    if (!initialToken) {
      setShowLoginModal(true);
      setToastMessage('Vui lòng đăng nhập tài khoản sinh viên trước khi đăng ký.');
      return;
    }

    const rawTargetList = coursesToRegister || selectedCoursesList;
    // Khử trùng lặp theo id_to_hoc VÀ ma_mon, đồng thời bỏ qua nhóm lớp đã nằm sẵn trong CSDL SGU (enrolledIdToHocSet)
    const seenIdToHoc = new Set<string>();
    const seenMaMon = new Set<string>();
    const targetList = rawTargetList.filter((c) => {
      const key = c.id_to_hoc || c.id;
      if (!key || seenIdToHoc.has(key)) return false;
      if (c.ma_mon && seenMaMon.has(c.ma_mon)) return false;
      if (enrolledIdToHocSet.has(key) || (c.ma_mon && enrolledMaMonSet.has(c.ma_mon))) return false;
      seenIdToHoc.add(key);
      if (c.ma_mon) seenMaMon.add(c.ma_mon);
      return true;
    });

    if (targetList.length === 0) {
      setToastMessage('Vui lòng tích chọn ít nhất 1 môn học chưa đăng ký để gửi.');
      return;
    }

    setIsSubmitting(true);
    isBatchSubmittingRef.current = true;
    setBatchResults([]);
    stopSnipingSignalRef.current = false;
    setToastMessage(`⚡ Bắt đầu gửi đăng ký ${targetList.length} môn học...`);

    let currentToken = initialToken;
    let successCount = 0;
    const fullSlotCourses: ClassGroup[] = [];
    const accumulatedResults: RegistrationResultItem[] = [];
    // Khi bắn nhiều môn cùng lúc, giới hạn retry tức thời ở mức 1 lần (nếu vẫn nghẽn mạng sẽ chuyển ngay vào Radar ngầm để không làm chậm các môn phía sau)
    const perCourseMaxRetries = targetList.length > 1 ? 1 : 3;

    try {
      let batchResyncedCatalog = false;
      // Đảm bảo có id_rs phiên ĐKMH & id_to_hoc sống mới nhất trước khi gửi w-xulydkmhsinhvien
      if (!SguDkmhService.getSessionContext().id_rs || liveIdMapByKeyRef.current.size === 0) {
        batchResyncedCatalog = true;
        const liveSync = await syncAndApplyLiveCatalog(currentToken);
        if (liveSync.refreshedToken) {
          currentToken = liveSync.refreshedToken;
        }
      }

      // VÒNG QUÉT ĐỒNG THỜI TOÀN BỘ CÁC MÔN (KHÔNG BỊ BLOCK KHI GẶP LỚP HẾT CHỖ)
      for (let i = 0; i < targetList.length; i++) {
        const course = targetList[i];
        let idToHoc = resolveLiveIdToHoc(course);
        const groupLabel = course.to_hoc ? `${course.nhom_to} (Tổ ${course.to_hoc})` : course.nhom_to;

        setSubmittingCourseId(course.id || idToHoc);

        try {
          let res = await SguDkmhService.registerSingleCourse(
            currentToken,
            idToHoc,
            0,
            false,
            perCourseMaxRetries
          );
          if (res.newToken) {
            currentToken = res.newToken;
            setToken(res.newToken);
          }
          if (res.httpStatus === 500 && !batchResyncedCatalog && !res.authExpired) {
            batchResyncedCatalog = true;
            const freshSync = await syncAndApplyLiveCatalog(currentToken);
            if (freshSync.refreshedToken) {
              currentToken = freshSync.refreshedToken;
            }
            if (freshSync.ok || freshSync.idMapByKey.size > 0) {
              idToHoc = resolveLiveIdToHoc(course, freshSync.idMapByKey);
              res = await SguDkmhService.registerSingleCourse(
                currentToken,
                idToHoc,
                0,
                false,
                perCourseMaxRetries
              );
              if (res.newToken) {
                currentToken = res.newToken;
                setToken(res.newToken);
              }
            }
          }
          const parsed = res.parsedError || parseSguError(res.message);

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

          if (res.otpNoEmail) {
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
            setToastMessage(`⚠️ ${res.message}`);
            break;
          }

          if (res.requiresOtp) {
            pendingOtpActionRef.current = { type: 'batch', courses: targetList.slice(i) };
            setOtpPromptMessage(res.message || 'SGU yêu cầu nhập mã OTP 6 chữ số đã gửi về email sinh viên.');
            setOtpCodeInput('');
            setOtpError(null);
            setOtpModalOpen(true);
            accumulatedResults.push({
              id: idToHoc,
              ma_mon: course.ma_mon,
              ten_mon: course.ten_mon,
              nhom_to: groupLabel,
              so_tc: course.so_tc ?? 0,
              success: false,
              message: 'Đang chờ xác thực OTP email (HTTP 412)...',
              parsedError: parsed,
            });
            setBatchResults([...accumulatedResults]);
            setToastMessage('🔐 Cần nhập mã OTP 6 chữ số từ email SGU để tiếp tục gửi đăng ký.');
            break;
          }

          const isRegistered = res.success || parsed.category === 'DA_DANG_KY';
          const resultMessage = res.warningMessage ? `${res.message} (⚠️ ${res.warningMessage})` : res.message;

          accumulatedResults.push({
            id: idToHoc,
            ma_mon: course.ma_mon,
            ten_mon: course.ten_mon,
            nhom_to: groupLabel,
            so_tc: course.so_tc ?? 0,
            success: isRegistered,
            message: resultMessage,
            parsedError: isRegistered ? undefined : parsed,
          });
          setBatchResults([...accumulatedResults]);

          if (isRegistered) {
            successCount++;
            playSniperSuccessSound();
            setPortalOpen(true);
            setPortalMessage('Trong thời gian đăng ký');
            setToastMessage(
              res.warningMessage
                ? `✅ Đăng ký thành công (lưu ý tiên quyết): ${course.ten_mon} — ${res.warningMessage}`
                : `✅ Đăng ký thành công: ${course.ten_mon} (Nhóm ${groupLabel})`
            );
            // Bỏ chọn môn đã đăng ký thành công khỏi hàng đợi chọn & gỡ ngay khỏi Radar nếu có
            setSelectedCourseIds((prev) => {
              const next = new Set(prev);
              if (course.id) next.delete(course.id);
              if (course.id_to_hoc) next.delete(course.id_to_hoc);
              for (const c of allCourses) {
                if (c.ma_mon === course.ma_mon && c.id) next.delete(c.id);
              }
              return next;
            });
            if (activeSnipingMapRef.current.size > 0) {
              const nextMap = new Map(activeSnipingMapRef.current);
              let removedFromSniper = false;
              for (const [k, v] of nextMap.entries()) {
                if (k === idToHoc || v.courseCode === course.ma_mon) {
                  nextMap.delete(k);
                  removedFromSniper = true;
                }
              }
              if (removedFromSniper) {
                activeSnipingMapRef.current = nextMap;
                setActiveSnipingMap(nextMap);
              }
            }
          } else if (parsed.category === 'NGOAI_GIO' && autoSnipeEnabled) {
            // CỔNG SGU CHƯA MỞ (VD: Bấm lúc 06:59:58):
            // Tự động nạp ngay môn hiện tại và toàn bộ các môn còn lại trong danh sách vào Radar Canh Mở Cổng, không bắn tuần tự dư thừa
            const nextMap = new Map(activeSnipingMapRef.current);
            for (let j = i; j < targetList.length; j++) {
              const rem = targetList[j];
              const remId = rem.id_to_hoc || rem.id;
              const remGroup = rem.to_hoc ? `${rem.nhom_to} (Tổ ${rem.to_hoc})` : rem.nhom_to;
              fullSlotCourses.push(rem);
              nextMap.set(remId, {
                id: remId,
                rowId: rem.id || remId,
                courseCode: rem.ma_mon,
                courseName: rem.ten_mon,
                group: remGroup,
                credits: rem.so_tc ?? 0,
                attempts: j === i ? 1 : 0,
                lastChecked: new Date().toLocaleTimeString('vi-VN'),
                lastMessage: res.message || 'Cổng SGU chưa mở. Đang tự động canh mở cổng...',
              });
              if (j > i) {
                accumulatedResults.push({
                  id: remId,
                  ma_mon: rem.ma_mon,
                  ten_mon: rem.ten_mon,
                  nhom_to: remGroup,
                  so_tc: rem.so_tc ?? 0,
                  success: false,
                  message: 'Đã nạp vào Radar tự động canh mở cổng',
                  parsedError: parsed,
                });
              }
            }
            setBatchResults([...accumulatedResults]);
            activeSnipingMapRef.current = nextMap;
            setActiveSnipingMap(nextMap);
            setToastMessage(
              `🎯 Cổng SGU chưa mở (${res.message}) -> Đã tự động đưa ${targetList.length - i} môn vào Radar Canh Mở Cổng!`
            );
            break;
          } else {
            // Tự động đưa vào Radar Sniper khi lớp hết chỗ (HET_CHO) HOẶC khi máy chủ SGU quá tải tạm thời (502/504/timeout - LOI_MANG)
            const isFull =
              parsed.category === 'HET_CHO' ||
              /hết chỗ|sĩ số|không còn chỗ|đủ số lượng|đã đầy|full/i.test(res.message || '') ||
              (parsed.category === 'UNKNOWN_ERROR' && !res.transient && course.sl_cl !== undefined && course.sl_cl <= 0);
            const isTransientOverload = Boolean(res.transient);

            if ((isFull || isTransientOverload) && autoSnipeEnabled) {
              // MÔN NÀY BỊ FULL CHỖ HOẶC NGHẼN MẠNG TẠM THỜI:
              // 1. Kích hoạt radar tranh slot / thử lại ngầm ngay tại dòng môn học này
              fullSlotCourses.push(course);
              const nextMap = new Map(activeSnipingMapRef.current);
              nextMap.set(idToHoc, {
                id: idToHoc,
                rowId: course.id || idToHoc,
                courseCode: course.ma_mon,
                courseName: course.ten_mon,
                group: groupLabel,
                credits: course.so_tc ?? 0,
                attempts: 1,
                lastChecked: new Date().toLocaleTimeString('vi-VN'),
                lastMessage: res.message || (isFull ? 'Lớp hết chỗ. Đang canh người nhả lớp...' : 'Máy chủ SGU quá tải. Đang tự động gửi lại...'),
              });
              activeSnipingMapRef.current = nextMap;
              setActiveSnipingMap(nextMap);

              setToastMessage(
                isFull
                  ? `🎯 [${course.ten_mon}] hết chỗ -> Tự động kích hoạt radar tranh slot. Đang gửi tiếp các môn còn lại!`
                  : `⚡ [${course.ten_mon}] nghẽn mạng SGU -> Đã đưa vào Radar tự gửi lại ngầm. Đang gửi tiếp các môn còn lại!`
              );
              // 2. KHÔNG DỪNG LẠI! TIẾP TỤC VÒNG LẶP SANG MÔN TIẾP THEO (MÔN 5, MÔN 6...)!
            } else {
              // Nếu bị lỗi quy chế cố định (tiên quyết, trùng lịch, vượt TC, học phí, sai CTĐT) -> gỡ khỏi Radar nếu trước đó đang canh
              if (activeSnipingMapRef.current.has(idToHoc)) {
                const nextMap = new Map(activeSnipingMapRef.current);
                nextMap.delete(idToHoc);
                activeSnipingMapRef.current = nextMap;
                setActiveSnipingMap(nextMap);
              }
              setToastMessage(`⚠️ [${course.ten_mon}]: ${res.message || 'Không thể đăng ký'}`);
            }
          }
        } catch (err: any) {
          const fallbackMsg = err.message || 'Lỗi kết nối khi gửi đăng ký';
          accumulatedResults.push({
            id: idToHoc,
            ma_mon: course.ma_mon,
            ten_mon: course.ten_mon,
            nhom_to: groupLabel,
            so_tc: course.so_tc ?? 0,
            success: false,
            message: fallbackMsg,
            parsedError: parseSguError(fallbackMsg),
          });
          setBatchResults([...accumulatedResults]);
          setToastMessage(`❌ Lỗi kết nối khi gửi ${course.ten_mon}: ${fallbackMsg}`);
        }

        // Nghỉ vi bước theo lựa chọn nhịp gửi (0s = 120-180ms micro-jitter, 1s = 1000ms, 3s = 3000ms)
        if (i < targetList.length - 1) {
          const waitMs = delaySeconds > 0 ? delaySeconds * 1000 : 120 + Math.floor(Math.random() * 60);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    } finally {
      isBatchSubmittingRef.current = false;
      setSubmittingCourseId(null);
      setIsSubmitting(false);
    }

    // Đồng bộ lại CSDL SGU sau lượt gửi đầu
    await fetchEnrolledList(currentToken);

    // NẾU CÓ MÔN HẾT CHỖ, NGHẼN MẠNG HOẶC ĐANG CANH MỞ CỔNG: KÍCH HOẠT VÒNG LẶP RADAR NGẦM
    if ((fullSlotCourses.length > 0 || activeSnipingMapRef.current.size > 0) && autoSnipeEnabled) {
      if (fullSlotCourses.length > 0) {
        setToastMessage(`🎯 Đã đăng ký thành công ${successCount} môn. Đang tự động canh/gửi ngầm cho ${activeSnipingMapRef.current.size} môn còn lại!`);
      }
      // Bắt đầu vòng lặp radar ngầm
      runBackgroundSniperLoop();
    } else if (successCount > 0) {
      setToastMessage(`🎉 Hoàn tất! Đã đăng ký thành công ${successCount}/${targetList.length} môn học.`);
    }
  };

  /**
   * ĐƯA TRỰC TIẾP CÁC MÔN ĐANG CHỌN VÀO RADAR CANH MỞ CỔNG / CANH SLOT (Dùng trước 07:00 sáng hoặc khi canh lớp đầy)
   */
  const handleStartGateAndSlotSniper = async () => {
    const activeAuthToken =
      token ||
      (() => {
        try {
          return localStorage.getItem('sgu_dkmh_token');
        } catch {
          return null;
        }
      })();
    if (!activeAuthToken) {
      setShowLoginModal(true);
      setToastMessage('Vui lòng đăng nhập tài khoản sinh viên trước khi bật Radar canh cổng.');
      return;
    }
    if (selectedCoursesList.length === 0) {
      setToastMessage('⚠️ Vui lòng tích chọn ít nhất 1 môn học để đưa vào Radar canh mở cổng / canh slot!');
      return;
    }

    stopSnipingSignalRef.current = false;
    if (!SguDkmhService.getSessionContext().id_rs || liveIdMapByKeyRef.current.size === 0) {
      await syncAndApplyLiveCatalog(activeAuthToken);
    }

    const nextMap = new Map(activeSnipingMapRef.current);
    let addedCount = 0;

    for (const course of selectedCoursesList) {
      if (course.ma_mon && enrolledMaMonSet.has(course.ma_mon)) continue;
      const idToHoc = resolveLiveIdToHoc(course);
      const groupLabel = course.to_hoc ? `${course.nhom_to} (Tổ ${course.to_hoc})` : course.nhom_to;
      // Gỡ nhóm cũ của cùng mã môn (nếu trước đó đang canh nhóm khác) để chỉ canh đúng nhóm vừa chọn
      for (const [k, v] of nextMap.entries()) {
        if (v.courseCode === course.ma_mon && k !== idToHoc) {
          nextMap.delete(k);
        }
      }
      if (!nextMap.has(idToHoc)) {
        addedCount++;
      }
      nextMap.set(idToHoc, {
        id: idToHoc,
        rowId: course.id || idToHoc,
        courseCode: course.ma_mon,
        courseName: course.ten_mon,
        group: groupLabel,
        credits: course.so_tc ?? 0,
        attempts: nextMap.get(idToHoc)?.attempts || 0,
        lastChecked: new Date().toLocaleTimeString('vi-VN'),
        lastMessage: 'Đang canh mở cổng / canh slot tự động...',
      });
    }

    activeSnipingMapRef.current = nextMap;
    setActiveSnipingMap(nextMap);
    setToastMessage(`🎯 Đã kích hoạt Radar canh mở cổng & săn slot cho ${addedCount || nextMap.size} môn học!`);
    runBackgroundSniperLoop();
  };

  /* -------------------------------------------------------------
   * DROP COURSE (HỦY MÔN HỌC KHỎI CSDL TRƯỜNG)
   * ------------------------------------------------------------- */
  const executeDropCourse = async (course: EnrolledCourseItem) => {
    const activeAuthToken =
      token ||
      (() => {
        try {
          return localStorage.getItem('sgu_dkmh_token');
        } catch {
          return null;
        }
      })();
    if (!activeAuthToken || !course) return;
    setConfirmDropCourse(null);
    setDroppingId(course.id_kqdk);

    try {
      const res = await SguDkmhService.dropCourse(activeAuthToken, course.id_kqdk, course.id_to_hoc);
      const effectiveToken = res.newToken || activeAuthToken;
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
      if (res.otpNoEmail) {
        setToastMessage(`⚠️ ${res.message}`);
        return;
      }
      if (res.requiresOtp) {
        pendingOtpActionRef.current = { type: 'drop', course };
        setOtpPromptMessage(res.message || 'SGU yêu cầu nhập mã OTP 6 chữ số đã gửi về email sinh viên.');
        setOtpCodeInput('');
        setOtpError(null);
        setOtpModalOpen(true);
        setToastMessage('🔐 SGU yêu cầu xác thực OTP email để xác nhận hủy môn.');
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

  const handleExecuteDrop = async () => {
    if (confirmDropCourse) {
      await executeDropCourse(confirmDropCourse);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeAuthToken =
      token ||
      (() => {
        try {
          return localStorage.getItem('sgu_dkmh_token');
        } catch {
          return null;
        }
      })();
    if (!activeAuthToken) {
      setOtpModalOpen(false);
      setShowLoginModal(true);
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await SguDkmhService.validateOtp(activeAuthToken, otpCodeInput);
      if (res.refreshedToken) {
        setToken(res.refreshedToken);
      }
      if (res.authExpired) {
        setOtpModalOpen(false);
        setAuthSessionState('expired');
        setShowLoginModal(true);
        setToastMessage('⚠️ Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại!');
        return;
      }
      if (!res.ok) {
        setOtpError(res.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
        return;
      }
      const pending = pendingOtpActionRef.current;
      pendingOtpActionRef.current = null;
      setOtpModalOpen(false);
      setOtpCodeInput('');
      setOtpError(null);
      setToastMessage('✅ Xác thực OTP thành công! Đang gửi lại yêu cầu tới SGU...');

      if (pending?.type === 'batch') {
        handleRegisterBatch(pending.courses);
      } else if (pending?.type === 'drop') {
        executeDropCourse(pending.course);
      } else if (pending?.type === 'sniper') {
        stopSnipingSignalRef.current = false;
        runBackgroundSniperLoop();
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    const activeAuthToken =
      token ||
      (() => {
        try {
          return localStorage.getItem('sgu_dkmh_token');
        } catch {
          return null;
        }
      })();
    if (!activeAuthToken) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await SguDkmhService.setupOtp(activeAuthToken);
      if (res.refreshedToken) setToken(res.refreshedToken);
      if (res.autoVerified) {
        const pending = pendingOtpActionRef.current;
        pendingOtpActionRef.current = null;
        setOtpModalOpen(false);
        setToastMessage('✅ Phiên SGU đã tự động xác thực OTP! Đang gửi lại yêu cầu...');
        if (pending?.type === 'batch') handleRegisterBatch(pending.courses);
        else if (pending?.type === 'drop') executeDropCourse(pending.course);
        else if (pending?.type === 'sniper') {
          stopSnipingSignalRef.current = false;
          runBackgroundSniperLoop();
        }
        return;
      }
      if (res.ok) {
        setOtpPromptMessage(res.message || 'Đã gửi lại mã OTP mới tới email sinh viên SGU.');
        setToastMessage('📩 Đã gửi lại mã OTP mới vào email của bạn.');
      } else {
        setOtpError(res.message || 'Không thể gửi lại mã OTP.');
      }
    } finally {
      setIsVerifyingOtp(false);
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
      // Dừng mọi tiến trình Sniper cũ và làm sạch kết quả của phiên trước
      stopSnipingSignalRef.current = true;
      sniperRunIdRef.current += 1;
      isSniperLoopRunningRef.current = false;
      activeSnipingMapRef.current = new Map();
      setActiveSnipingMap(new Map());
      setBatchResults([]);
      setCustomStudentClass('');
      liveIdMapByKeyRef.current = new Map();
      pendingOtpActionRef.current = null;
      setOtpModalOpen(false);

      const prevToken = token;
      const existingAcc = savedAccounts.find((a) => a.mssv === res.user.mssv);
      const mergedUser: SguAuthUser = {
        ...res.user,
        lop: res.user.lop || existingAcc?.lop,
      };
      setToken(res.token);
      setUser(mergedUser);

      try {
        localStorage.removeItem('sgu_dkmh_student_class');
        localStorage.setItem('sgu_dkmh_token', res.token);
        localStorage.setItem('sgu_dkmh_user', JSON.stringify(mergedUser));
        // Save to saved accounts list
        const updated = [{ mssv: mergedUser.mssv, name: mergedUser.name, token: res.token, lop: mergedUser.lop }, ...savedAccounts.filter((a) => a.mssv !== mergedUser.mssv)];
        setSavedAccounts(updated);
        localStorage.setItem('sgu_dkmh_saved_accounts', JSON.stringify(updated));
      } catch {}

      // Lưu tài khoản + token vào .env và giữ mật khẩu trong bộ nhớ RAM máy chủ để tự động refresh khi 401
      await SguDkmhService.updateEnvAccount(mergedUser.mssv, loginPassword, res.token, mergedUser.name, mergedUser.lop);

      setAuthSessionState('valid');
      setAuthModalOpen(false);
      setShowLoginModal(false);
      setLoginPassword('');
      setToastMessage(`✅ Đăng nhập thành công: ${res.user.name} (${res.user.mssv})`);

      // Nếu token mới giống hệt token cũ thì chủ động gọi lại, còn nếu khác thì useEffect([token]) sẽ tự động chạy
      if (res.token === prevToken) {
        checkGateStatus(res.token);
        fetchEnrolledList(res.token);
        syncStudentProfile(res.token);
        syncAndApplyLiveCatalog(res.token).catch(() => {});
      }
    } catch (err: any) {
      setLoginError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDirectTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawToken = manualTokenInput
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!rawToken) {
      setLoginError('Vui lòng dán Bearer Token.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      SguDkmhService.resetSessionContext();
      liveIdMapByKeyRef.current = new Map();
      pendingOtpActionRef.current = null;
      setOtpModalOpen(false);
      const profile = await SguDkmhService.fetchStudentInfo(rawToken);
      if (!profile || (!profile.mssv && !profile.name)) {
        throw new Error('Bearer Token không hợp lệ hoặc đã hết hạn từ máy chủ SGU.');
      }

      stopSnipingSignalRef.current = true;
      sniperRunIdRef.current += 1;
      isSniperLoopRunningRef.current = false;
      activeSnipingMapRef.current = new Map();
      setActiveSnipingMap(new Map());
      setBatchResults([]);
      setCustomStudentClass('');

      const newUser: SguAuthUser = {
        name: profile.name || 'Sinh viên SGU',
        mssv: profile.mssv || loginMssv || 'SGU_USER',
        lop: profile.lop,
        khoa: profile.khoa,
      };

      setToken(rawToken);
      setUser(newUser);

      try {
        localStorage.removeItem('sgu_dkmh_student_class');
        localStorage.setItem('sgu_dkmh_token', rawToken);
        localStorage.setItem('sgu_dkmh_user', JSON.stringify(newUser));
        const updated = [
          { mssv: newUser.mssv, name: newUser.name, token: rawToken, lop: newUser.lop },
          ...savedAccounts.filter((a) => a.mssv !== newUser.mssv),
        ];
        setSavedAccounts(updated);
        localStorage.setItem('sgu_dkmh_saved_accounts', JSON.stringify(updated));
      } catch {}

      await SguDkmhService.updateEnvAccount(newUser.mssv, '', rawToken, newUser.name, newUser.lop);

      setAuthSessionState('valid');
      setAuthModalOpen(false);
      setShowLoginModal(false);
      setManualTokenInput('');
      setToastMessage(`✅ Đã nạp Bearer Token thành công: ${newUser.name} (${newUser.mssv})`);
      checkGateStatus(rawToken);
      fetchEnrolledList(rawToken);
      syncStudentProfile(rawToken);
      syncAndApplyLiveCatalog(rawToken).catch(() => {});
    } catch (err: any) {
      setLoginError(err.message || 'Không thể xác thực Bearer Token với máy chủ SGU.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    stopSnipingSignalRef.current = true;
    sniperRunIdRef.current += 1;
    isSniperLoopRunningRef.current = false;
    activeSnipingMapRef.current = new Map();
    liveIdMapByKeyRef.current = new Map();
    pendingOtpActionRef.current = null;
    setOtpModalOpen(false);
    setActiveSnipingMap(new Map());
    setBatchResults([]);
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
      if (enrolledSortCol === 'ngay_dang_ky') {
        const parseDate = (d?: string) => {
          if (!d) return 0;
          const match = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
          if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            let year = parseInt(match[3], 10);
            if (year < 100) year += 2000;
            const hour = match[4] ? parseInt(match[4], 10) : 0;
            const min = match[5] ? parseInt(match[5], 10) : 0;
            const sec = match[6] ? parseInt(match[6], 10) : 0;
            return new Date(year, month - 1, day, hour, min, sec).getTime();
          }
          const t = Date.parse(d);
          return Number.isNaN(t) ? 0 : t;
        };
        const timeA = parseDate(a.ngay_dang_ky);
        const timeB = parseDate(b.ngay_dang_ky);
        return enrolledSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      let strA = '';
      let strB = '';
      if (enrolledSortCol === 'ma_mon') { strA = a.ma_mon || ''; strB = b.ma_mon || ''; }
      else if (enrolledSortCol === 'ten_mon') { strA = a.ten_mon || ''; strB = b.ten_mon || ''; }
      else if (enrolledSortCol === 'nhom_to') { strA = a.nhom_to || ''; strB = b.nhom_to || ''; }
      else if (enrolledSortCol === 'lop') { strA = a.lop || ''; strB = b.lop || ''; }
      else if (enrolledSortCol === 'trang_thai_dang_ky') { strA = a.trang_thai_dang_ky || ''; strB = b.trang_thai_dang_ky || ''; }

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
                <option value={1}>Môn học mở theo lớp sinh viên {studentClass ? `- ${studentClass}` : ''}</option>
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
                  <option value={1}>Môn học mở theo lớp sinh viên {studentClass ? `- ${studentClass}` : ''}</option>
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
                          setSelectedSubjectCode('');
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
                    <option value="">-- Chọn khoa / đơn vị quản lý môn học --</option>
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
                      className="rounded size-3.5 cursor-pointer accent-blue-600 dark:accent-blue-500 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
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
              {isFilterLoading ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <Loader2 className="size-8 text-blue-600 animate-spin" />
                      <div className="font-bold text-sm text-foreground">
                        Đang kết nối máy chủ SGU để lọc môn học...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Hệ thống đang truy vấn dữ liệu từ cổng đào tạo theo điều kiện lọc của bạn, vui lòng đợi giây lát.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : displayCourses.length === 0 ? (
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
                    ) : filterType === 1 && !studentClass ? (
                      <div className="py-2 space-y-2">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          Chưa có thông tin lớp sinh viên
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vui lòng đăng nhập tài khoản sinh viên SGU hoặc bấm nút "Đổi lớp" để lọc các môn mở theo lớp của bạn.
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowLoginModal(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                          >
                            <LogIn className="size-3.5" />
                            <span>Đăng nhập</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleEditStudentClass}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold cursor-pointer"
                          >
                            <span>Nhập mã lớp thủ công</span>
                          </button>
                        </div>
                      </div>
                    ) : (filterType === 2 || filterType === 4 || filterType === 5) && !token ? (
                      <div className="py-2 space-y-2">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          Chưa đăng nhập tài khoản sinh viên SGU
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vui lòng đăng nhập để hệ thống tra cứu danh sách môn học theo chương trình đào tạo của bạn.
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLoginModal(true)}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <LogIn className="size-3.5" />
                          <span>Đăng nhập ngay</span>
                        </button>
                      </div>
                    ) : filterType === 5 ? (
                      <div className="py-2 space-y-1">
                        <div className="text-xs sm:text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                          🎉 Bạn không có môn học nào cần học lại (đã rớt)!
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          (Dữ liệu trả về từ máy chủ SGU theo hồ sơ sinh viên của bạn)
                        </div>
                      </div>
                    ) : filterType === 4 ? (
                      <div className="py-2 space-y-1">
                        <div className="text-xs sm:text-[13px] font-semibold text-foreground">
                          Không có môn học nào chưa học trong CTĐT kế hoạch.
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Bạn đã hoàn thành các môn trong CTĐT đợt này hoặc máy chủ SGU chưa mở dữ liệu.
                        </div>
                      </div>
                    ) : filterType === 2 ? (
                      <div className="py-2 space-y-1">
                        <div className="text-xs sm:text-[13px] font-semibold text-foreground">
                          Không tìm thấy môn học nào trong CTĐT kế hoạch đợt này.
                        </div>
                      </div>
                    ) : filterType === 10 && !selectedSubjectCode && !subjectSearchInput.trim() ? (
                      <div className="py-2 space-y-1">
                        <div className="text-xs sm:text-[13px] font-semibold text-foreground">
                          📚 Vui lòng chọn hoặc gõ tên/mã môn học ở ô bên trên để xem các nhóm lớp mở đăng ký.
                        </div>
                      </div>
                    ) : filterType === 3 && !selectedFaculty ? (
                      <div className="py-2 space-y-1">
                        <div className="text-xs sm:text-[13px] font-semibold text-foreground">
                          🏛️ Vui lòng chọn Khoa / Đơn vị quản lý ở ô bên trên để lọc danh sách môn học.
                        </div>
                      </div>
                    ) : filterType === 6 && !selectedClassText.trim() ? (
                      <div className="py-2 space-y-1">
                        <div className="text-xs sm:text-[13px] font-semibold text-foreground">
                          🏫 Vui lòng nhập mã lớp (VD: DCT1241, DTH1231) ở ô bên trên để lọc các môn mở cho lớp đó.
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
                paginatedCourses.map((c, idx) => {
                  const idToHoc = c.id_to_hoc || c.id;
                  const isSelected = Boolean(c.id && selectedCourseIds.has(c.id));
                  const isSubjectEnrolled = enrolledMaMonSet.has(c.ma_mon);
                  const isEnrolled = (idToHoc && enrolledIdToHocSet.has(idToHoc)) || (c.id && enrolledIdToHocSet.has(c.id)) || isSubjectEnrolled;
                  const isFull = (c.sl_cl !== undefined && c.sl_cl <= 0) || (c.sl_cp !== undefined && c.sl_dk !== undefined && c.sl_dk >= c.sl_cp);
                  const isBeingSubmitted = submittingCourseId === (c.id || idToHoc) || submittingCourseId === idToHoc;
                  const snipingItem = activeSnipingMap.get(idToHoc);
                  const snipingStatus = snipingItem && (!snipingItem.rowId || snipingItem.rowId === (c.id || idToHoc)) ? snipingItem : undefined;

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
                          className="rounded size-4 cursor-pointer disabled:opacity-40 accent-blue-600 dark:accent-blue-500 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
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

        {/* Thanh phân trang mượt mà (Pagination) chống lag tuyệt đối khi duyệt hàng ngàn môn */}
        {totalFilteredCourses > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-slate-50/70 dark:bg-slate-900/50 text-xs">
            <div className="text-muted-foreground">
              Hiển thị <span className="font-bold text-foreground">{pageSize > 0 ? `${Math.min(totalFilteredCourses, (currentPage - 1) * pageSize + 1)} - ${Math.min(totalFilteredCourses, currentPage * pageSize)}` : `tất cả ${totalFilteredCourses}`}</span> trong tổng số <span className="font-bold text-foreground">{totalFilteredCourses}</span> nhóm lớp
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px]">Mỗi trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded border border-border bg-card text-foreground font-semibold cursor-pointer shadow-2xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>Tất cả ({totalFilteredCourses})</option>
              </select>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 sm:px-2 sm:py-1 rounded border border-border bg-card disabled:opacity-40 hover:bg-muted cursor-pointer flex items-center gap-0.5"
                    title="Trang trước"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span className="hidden sm:inline">Trước</span>
                  </button>

                  <span className="px-2 font-mono font-bold text-foreground">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 sm:px-2 sm:py-1 rounded border border-border bg-card disabled:opacity-40 hover:bg-muted cursor-pointer flex items-center gap-0.5"
                    title="Trang sau"
                  >
                    <span className="hidden sm:inline">Sau</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'ngay_dang_ky' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleEnrolledSort('trang_thai_dang_ky')}
                  className="w-36 text-center p-2.5 font-bold uppercase text-[11px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none"
                  title="Sắp xếp theo Trạng thái đăng ký"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TRẠNG THÁI</span>
                    <span className="text-muted-foreground font-normal">{enrolledSortCol === 'trang_thai_dang_ky' ? (enrolledSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
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
                  const canDrop = c.enable_xoa !== false;
                  return (
                    <tr key={c.id_kqdk} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Nút hủy môn */}
                      <td className="text-center p-2">
                        <button
                          type="button"
                          disabled={isDropping || !canDrop}
                          onClick={() => setConfirmDropCourse(c)}
                          className={`p-1 rounded transition-colors ${
                            !canDrop
                              ? 'opacity-25 cursor-not-allowed text-muted-foreground'
                              : 'text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-40'
                          }`}
                          title={
                            !canDrop
                              ? c.dien_giai_enable_xoa || 'Môn học không được phép rút/hủy trong đợt này'
                              : 'Hủy đăng ký môn học này'
                          }
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
                          {c.trang_thai_dang_ky || 'Đã ghi nhận CSDL'}
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
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed m-0">
                    Tích chọn các môn bạn muốn đăng ký trong bảng danh sách phía trên (hoặc nạp nhanh từ phương án TKB đã xếp).
                  </p>
                  {(() => {
                    const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.id === activeTabId) || plans[0];
                    if (currentPlan && currentPlan.selectedIds.length > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterType(99);
                            preloadPlanCoursesIntoSelection(currentPlan.id);
                            setToastMessage(`⚡ Đã nạp ${currentPlan.selectedIds.length} môn từ [${currentPlan.name}] vào danh sách chờ đăng ký!`);
                          }}
                          className="w-full py-2 px-3 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Calendar className="size-3.5" />
                          <span>⚡ Nạp nhanh {currentPlan.selectedIds.length} môn từ [{currentPlan.name}]</span>
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-2">
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

              {selectedCount > 0 && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleStartGateAndSlotSniper}
                  className="w-full py-2 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  title="Bật Radar tự động bắn liên tục để chờ đúng 07:00 mở cổng hoặc canh người nhả slot"
                >
                  <Target className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span>🎯 Bật Radar Canh Mở Cổng / Canh Slot ({selectedCount} môn)</span>
                </button>
              )}
            </div>
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

            {/* Tab lựa chọn hình thức nạp tài khoản */}
            <div className="flex rounded-lg border border-border p-1 bg-muted/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setLoginTab('password'); setLoginError(null); }}
                className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
                  loginTab === 'password' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mã sinh viên & Mật khẩu
              </button>
              <button
                type="button"
                onClick={() => { setLoginTab('token'); setLoginError(null); }}
                className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
                  loginTab === 'token' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ⚡ Dán Bearer Token
              </button>
            </div>

            {loginTab === 'password' ? (
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
                    <div className="text-[11px] font-bold text-muted-foreground uppercase">Tài khoản đã lưu trên máy (Bấm để nạp):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {savedAccounts.map((acc) => (
                        <button
                          key={acc.mssv}
                          type="button"
                          onClick={() => {
                            setLoginMssv(acc.mssv);
                            setManualTokenInput(acc.token);
                            stopSnipingSignalRef.current = true;
                            sniperRunIdRef.current += 1;
                            isSniperLoopRunningRef.current = false;
                            activeSnipingMapRef.current = new Map();
                            setActiveSnipingMap(new Map());
                            setBatchResults([]);
                            setCustomStudentClass('');
                            setToken(acc.token);
                            setUser({ name: acc.name, mssv: acc.mssv, lop: acc.lop });
                            try {
                              localStorage.removeItem('sgu_dkmh_student_class');
                              localStorage.setItem('sgu_dkmh_token', acc.token);
                              localStorage.setItem('sgu_dkmh_user', JSON.stringify({ name: acc.name, mssv: acc.mssv, lop: acc.lop }));
                            } catch {}
                            SguDkmhService.updateEnvAccount(acc.mssv, '', acc.token, acc.name, acc.lop);
                            setAuthSessionState('valid');
                            setShowLoginModal(false);
                            setAuthModalOpen(false);
                            setToastMessage(`✅ Đã nạp tài khoản: ${acc.name} (${acc.mssv})`);
                            checkGateStatus(acc.token);
                            fetchEnrolledList(acc.token);
                            syncStudentProfile(acc.token);
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold border border-border bg-muted hover:bg-blue-500/10 hover:text-blue-600 transition-colors cursor-pointer"
                          title={`Bấm để chọn và nạp phiên của ${acc.name}`}
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
            ) : (
              <form onSubmit={handleDirectTokenSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Dán chuỗi Bearer Token (Sao chép từ F12 Network hoặc Console):
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Dán token Bearer (eyJhbGciOi...)"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    💡 Bạn có thể đăng nhập trên web dkmh.sgu.edu.vn, mở F12 &gt; Application hoặc Network để sao chép chuỗi Bearer Token dán vào đây.
                  </div>
                </div>

                {loginError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                    {loginError}
                  </div>
                )}

                {/* Danh sách nick đã lưu trên máy để chuyển đổi 1 click */}
                {savedAccounts.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase">Token tài khoản đã lưu:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {savedAccounts.map((acc) => (
                        <button
                          key={acc.mssv}
                          type="button"
                          onClick={() => {
                            setLoginMssv(acc.mssv);
                            setManualTokenInput(acc.token);
                            setToastMessage(`Đã nạp chuỗi token của ${acc.name}`);
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold border border-border bg-muted hover:bg-blue-500/10 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          Điền token: {acc.mssv}
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
                    {isLoggingIn ? 'Đang xác thực token...' : 'Lưu & Sử dụng Token'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6B. MODAL XÁC THỰC OTP EMAIL SGU (HTTP 412) */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Xác thực OTP Email SGU (412)</h3>
                  <p className="text-[11px] text-muted-foreground">Cổng ĐKMH yêu cầu xác nhận bảo mật 2 lớp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  pendingOtpActionRef.current = null;
                  setOtpModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {otpPromptMessage || 'Mã OTP gồm 6 chữ số đã được SGU gửi tới email sinh viên của bạn.'}
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  Mã OTP (6 chữ số)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="Nhập 6 chữ số OTP..."
                  value={otpCodeInput}
                  onChange={(e) => setOtpCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground font-mono text-center text-lg tracking-[0.4em] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {otpError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                  {otpError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 gap-2">
                <button
                  type="button"
                  disabled={isVerifyingOtp}
                  onClick={handleResendOtp}
                  className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
                >
                  Gửi lại OTP
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      pendingOtpActionRef.current = null;
                      setOtpModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpCodeInput.length !== 6}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isVerifyingOtp ? 'Đang xác thực...' : 'Xác nhận OTP'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL XUẤT / IN PHIẾU ĐĂNG KÝ (Print preview) */}
      {showPrintModal && (
        <div id="printable-dkmh-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0 print:m-0 print:bg-white print:fixed print:inset-0 print:z-[9999]">
          <div id="printable-dkmh-form" className="w-full max-w-2xl rounded-2xl border border-border bg-white text-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto print:max-w-none print:w-full print:border-none print:shadow-none print:p-8 print:max-h-none print:overflow-visible">
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

            <div className="flex justify-end gap-2 pt-4 border-t print:hidden">
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

                if (viewingTkbCourse.tkb_str) {
                  const parts = viewingTkbCourse.tkb_str.split(/<hr\s*\/?>/i).map((p) => p.trim()).filter(Boolean);
                  return (
                    <div className="space-y-1.5">
                      {parts.map((p, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-border bg-background font-medium">
                          {p.replace(/->/g, ' → ')}
                        </div>
                      ))}
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
