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
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup } from '../types/course';
import {
  SguDkmhService,
  SguAuthUser,
  EnrolledCourseItem,
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
  const [savedAccounts, setSavedAccounts] = useState<Array<{ mssv: string; name: string; token: string }>>(() => {
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

  const studentClass = useMemo(() => {
    if ((user as any)?.lop) return String((user as any).lop).trim();
    if (user?.mssv?.startsWith('312441')) return 'DCT1241';
    return 'DCT1241';
  }, [user]);

  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedClassText, setSelectedClassText] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortOrder('asc');
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

  // 6. AUTO-SNIPER & NON-BLOCKING BACKGROUND RADAR (Mặc định luôn tự động tranh giành slot khi môn hết chỗ)
  const autoSnipeEnabled = true;
  const delaySeconds = 0; // Siêu tốc tối ưu kèm micro-jitter 120ms - 250ms chuẩn người thật
  const [activeSnipingMap, setActiveSnipingMap] = useState<Map<string, SnipingStatusItem>>(new Map());
  const stopSnipingSignalRef = useRef(false);

  // 7. PRINT PREVIEW MODAL
  const [showPrintModal, setShowPrintModal] = useState(false);

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
      const ok = await syncCatalogData(false);
      if (token) {
        await fetchEnrolledList(token);
        await checkGateStatus(token);
      }
      if (ok) {
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
      if (res && Array.isArray(res.courses)) {
        setEnrolledCourses(res.courses);
      }
    } catch (e: any) {
      console.warn('Could not fetch enrolled list:', e.message);
    } finally {
      setIsLoadingEnrolled(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      checkGateStatus(token);
      fetchEnrolledList(token);
    } else {
      setPortalOpen(false);
      setPortalMessage('Chưa đăng nhập SGU');
    }
  }, [token, checkGateStatus, fetchEnrolledList]);

  // Pre-load selected items from current active timetable plan when using filterType 99 (Chỉ hiện môn trong TKB và tự động tick sẵn)
  useEffect(() => {
    if (filterType === 99) {
      const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.id === activeTabId) || plans[0];
      if (currentPlan && currentPlan.selectedIds.length > 0) {
        const idSet = new Set(currentPlan.selectedIds);
        const planCourses = allCourses.filter((c) => idSet.has(c.id) || idSet.has(c.id_to_hoc));
        const toSelect = new Set<string>();
        planCourses.forEach((c) => {
          if (c.id) toSelect.add(c.id);
          if (c.id_to_hoc) toSelect.add(c.id_to_hoc);
        });
        setSelectedCourseIds(toSelect);
      } else {
        setSelectedCourseIds(new Set());
      }
    }
  }, [selectedPlanId, filterType, plans, allCourses, activeTabId]);

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
    } else if (filterType === 2) {
      // 2. Môn trong chương trình đào tạo kế hoạch (Ngành CNTT / DCT)
      list = allCourses.filter((c) => {
        const isCndt = c.ma_mon.startsWith('841');
        const isKhoaCndt = c.ds_khoa?.some((k) => k.toLowerCase().includes('công nghệ thông tin'));
        return isCndt || isKhoaCndt;
      });
    } else if (filterType === 4) {
      // 4. Môn chưa học trong CTĐT kế hoạch
      const enrolledMaMonSet = new Set(enrolledCourses.map((c) => c.ma_mon));
      list = allCourses.filter((c) => {
        const isCndt = c.ma_mon.startsWith('841');
        const isKhoaCndt = c.ds_khoa?.some((k) => k.toLowerCase().includes('công nghệ thông tin'));
        return (isCndt || isKhoaCndt) && !enrolledMaMonSet.has(c.ma_mon);
      });
    } else if (filterType === 5) {
      // 5. Môn sinh viên cần học lại (đã rớt)
      list = [];
    } else if (filterType === 10 && selectedSubjectCode) {
      // 10. Theo môn học
      list = allCourses.filter((c) => c.ma_mon === selectedSubjectCode);
    } else if (filterType === 3 && selectedFaculty) {
      // 3. Theo khoa
      list = allCourses.filter((c) => c.ds_khoa?.includes(selectedFaculty));
    } else if (filterType === 6 && selectedClassText.trim()) {
      // 6. Theo lớp
      const q = selectedClassText.trim().toLowerCase();
      list = allCourses.filter((c) => (c.lop || c.ds_lop?.join(', ') || '').toLowerCase().includes(q));
    } else if (filterType === 99) {
      // 99. Nạp từ phương án TKB đã xếp (CHỈ hiển thị những môn đã xếp trong phương án)
      const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.id === activeTabId) || plans[0];
      if (currentPlan && currentPlan.selectedIds.length > 0) {
        const idSet = new Set(currentPlan.selectedIds);
        list = allCourses.filter((c) => idSet.has(c.id) || idSet.has(c.id_to_hoc));
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
      list = list.filter((c) => (c.lop || c.ds_lop?.join(', ') || '').toLowerCase().includes(q));
    }

    // Column sorting
    if (sortColumn) {
      list = [...list].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        if (sortColumn === 'ma_mon') { valA = a.ma_mon; valB = b.ma_mon; }
        else if (sortColumn === 'ten_mon') { valA = a.ten_mon; valB = b.ten_mon; }
        else if (sortColumn === 'nhom_to') { valA = a.nhom_to || ''; valB = b.nhom_to || ''; }
        else if (sortColumn === 'so_tc') { valA = Number(a.so_tc) || 0; valB = Number(b.so_tc) || 0; }
        else if (sortColumn === 'lop') { valA = a.lop || ''; valB = b.lop || ''; }
        else if (sortColumn === 'sl_cp') { valA = a.sl_cp || 0; valB = b.sl_cp || 0; }
        else if (sortColumn === 'sl_cl') { valA = a.sl_cl || 0; valB = b.sl_cl || 0; }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [
    allCourses,
    filterType,
    studentClass,
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
  ]);

  // Số lượng môn học đang được chọn hợp lệ trong danh sách đang hiển thị
  const checkedCountInDisplay = useMemo(() => {
    return displayCourses.filter((c) => selectedCourseIds.has(c.id || c.id_to_hoc)).length;
  }, [displayCourses, selectedCourseIds]);

  /* -------------------------------------------------------------
   * SELECTION HANDLERS
   * ------------------------------------------------------------- */
  const toggleSelectCourse = (id: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllDisplay = () => {
    if (selectedCourseIds.size >= displayCourses.length) {
      setSelectedCourseIds(new Set());
    } else {
      setSelectedCourseIds(new Set(displayCourses.map((c) => c.id || c.id_to_hoc)));
    }
  };

  /* -------------------------------------------------------------
   * NON-BLOCKING CONCURRENT REGISTRATION & AUTO-SNIPER CORE
   * ------------------------------------------------------------- */
  // Vòng lặp bắn radar ngầm cho các môn hết chỗ
  const runBackgroundSniperLoop = useCallback(async () => {
    while (!stopSnipingSignalRef.current) {
      let currentMap: Map<string, SnipingStatusItem> = new Map();
      setActiveSnipingMap((prev) => {
        currentMap = new Map(prev);
        return prev;
      });

      if (currentMap.size === 0) break;

      const activeToken = token;
      if (!activeToken) break;

      const entries = Array.from(currentMap.entries());
      for (const [idToHoc, item] of entries) {
        if (stopSnipingSignalRef.current) break;

        try {
          const res = await SguDkmhService.registerSingleCourse(activeToken, idToHoc);
          const parsed = res.parsedError || parseSguError(res.message);

          if (res.success || parsed.category === 'DA_DANG_KY') {
            // CHIẾM SLOT THÀNH CÔNG!
            playSniperSuccessSound();
            setToastMessage(`🎉 CHIẾM SLOT THÀNH CÔNG: ${item.courseName} (Nhóm ${item.group})!`);

            // Xóa khỏi radar
            setActiveSnipingMap((prev) => {
              const next = new Map(prev);
              next.delete(idToHoc);
              return next;
            });

            // Cập nhật CSDL đã đăng ký
            fetchEnrolledList(activeToken);
          } else {
            // Vẫn chưa có người nhả chỗ -> Cập nhật số lần thử
            setActiveSnipingMap((prev) => {
              const next = new Map(prev);
              const cur = next.get(idToHoc);
              if (cur) {
                next.set(idToHoc, {
                  ...cur,
                  attempts: cur.attempts + 1,
                  lastChecked: new Date().toLocaleTimeString('vi-VN'),
                  lastMessage: res.message || 'Lớp đã hết chỗ',
                });
              }
              return next;
            });
          }
        } catch {}

        // Nghỉ vi bước giữa các môn đang săn
        await new Promise((r) => setTimeout(r, 600));
      }

      // Nghỉ chu kỳ an toàn giữa các vòng radar: 3.5s - 4.5s có jitter ngẫu nhiên
      if (!stopSnipingSignalRef.current) {
        const cycleDelay = 3500 + Math.floor(Math.random() * 800);
        await new Promise((r) => setTimeout(r, cycleDelay));
      }
    }
  }, [token, fetchEnrolledList, setToastMessage]);

  const stopAllSniping = () => {
    stopSnipingSignalRef.current = true;
    setActiveSnipingMap(new Map());
    setToastMessage('🛑 Đã dừng toàn bộ radar tranh giành slot.');
  };

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

    const targetList = coursesToRegister || displayCourses.filter((c) => selectedCourseIds.has(c.id || c.id_to_hoc));
    if (targetList.length === 0) {
      setToastMessage('Vui lòng tích chọn ít nhất 1 môn học để đăng ký.');
      return;
    }

    setIsSubmitting(true);
    stopSnipingSignalRef.current = false;
    setToastMessage(`⚡ Bắt đầu gửi đăng ký ${targetList.length} môn học...`);

    let successCount = 0;
    const fullSlotCourses: ClassGroup[] = [];

    // VÒNG QUÉT ĐỒNG THỜI TOÀN BỘ CÁC MÔN (KHÔNG BỊ BLOCK KHI GẶP LỚP HẾT CHỖ)
    for (let i = 0; i < targetList.length; i++) {
      const course = targetList[i];
      const idToHoc = course.id_to_hoc || course.id;

      setSubmittingCourseId(idToHoc);

      try {
        const res = await SguDkmhService.registerSingleCourse(token, idToHoc);
        const parsed = res.parsedError || parseSguError(res.message);
        const isRegistered = res.success || parsed.category === 'DA_DANG_KY';

        if (isRegistered) {
          successCount++;
          playSniperSuccessSound();
          setToastMessage(`✅ Đăng ký thành công: ${course.ten_mon} (Nhóm ${course.nhom_to})`);
        } else {
          const isFull =
            parsed.category === 'HET_CHO' ||
            (course.sl_cl !== undefined && course.sl_cl <= 0) ||
            /hết chỗ|sĩ số|không còn chỗ|đủ số lượng|full/i.test(res.message || '');

          if (isFull && autoSnipeEnabled) {
            // MÔN NÀY BỊ FULL CHỖ:
            // 1. Kích hoạt radar tranh slot ngay tại dòng môn học này
            fullSlotCourses.push(course);
            setActiveSnipingMap((prev) => {
              const next = new Map(prev);
              next.set(idToHoc, {
                id: idToHoc,
                courseCode: course.ma_mon,
                courseName: course.ten_mon,
                group: course.nhom_to,
                credits: course.so_tc || 3,
                attempts: 1,
                lastChecked: new Date().toLocaleTimeString('vi-VN'),
                lastMessage: res.message || 'Lớp hết chỗ. Đang canh người nhả lớp...',
              });
              return next;
            });

            setToastMessage(`🎯 [${course.ten_mon}] hết chỗ -> Tự động kích hoạt radar tranh slot. Đang gửi tiếp các môn còn lại!`);
            // 2. KHÔNG DỪNG LẠI! TIẾP TỤC VÒNG LẶP SANG MÔN TIẾP THEO (MÔN 5, MÔN 6...)!
          } else {
            setToastMessage(`⚠️ [${course.ten_mon}]: ${res.message || 'Không thể đăng ký'}`);
          }
        }
      } catch (err: any) {
        setToastMessage(`❌ Lỗi kết nối khi gửi ${course.ten_mon}: ${err.message}`);
      }

      // Nghỉ vi bước siêu ngắn (100ms - 200ms) để server xử lý tự nhiên mượt mà
      if (i < targetList.length - 1) {
        const waitMs = delaySeconds > 0 ? delaySeconds * 1000 : 120;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    setSubmittingCourseId(null);
    setIsSubmitting(false);

    // Đồng bộ lại CSDL SGU sau lượt gửi đầu
    await fetchEnrolledList(token);

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
      const res = await SguDkmhService.dropCourse(token, course.id_kqdk);
      if (res.success) {
        setToastMessage(`✅ Đã hủy đăng ký thành công môn: ${course.ten_mon}`);
        fetchEnrolledList(token);
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

      // Update .env dynamically
      await SguDkmhService.updateEnvAccount(res.user.mssv, '', res.token, res.user.name);

      setAuthSessionState('valid');
      setAuthModalOpen(false);
      setShowLoginModal(false);
      setLoginPassword('');
      setToastMessage(`✅ Đăng nhập thành công: ${res.user.name} (${res.user.mssv})`);

      checkGateStatus(res.token);
      fetchEnrolledList(res.token);
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
                <button
                  type="button"
                  onClick={() => {
                    if (!portalOpen || isAuthNotice) {
                      setShowLoginModal(true);
                    }
                  }}
                  title={portalOpen ? 'Cổng đăng ký đang mở' : 'Bấm để đăng nhập'}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    portalOpen
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isAuthNotice
                      ? 'text-amber-600 dark:text-amber-400 hover:underline'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      portalOpen
                        ? 'bg-emerald-500 animate-pulse'
                        : isAuthNotice
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {portalOpen
                      ? 'TRONG THỜI GIAN ĐĂNG KÝ'
                      : isAuthNotice
                      ? `${portalMessage} • BẤM ĐỂ ĐĂNG NHẬP`
                      : portalMessage.toUpperCase()}
                  </span>
                </button>
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
        {/* Table 1 Header Toolbar - 100% SGU Image 10 */}
        <div className="px-4 py-3 bg-blue-50/80 dark:bg-slate-900/90 border-b border-blue-200/80 dark:border-blue-950/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 m-0">
              DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600/10 text-blue-700 dark:text-blue-300">
              {displayCourses.length} lớp học phần
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Làm mới chuẩn SGU Image 10 */}
            <button
              type="button"
              onClick={handleRefreshLiveCatalog}
              disabled={isRefreshingCatalog}
              className="h-9 px-3.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Làm mới danh sách môn học và sĩ số từ cổng SGU"
            >
              <RefreshCw className={`size-3.5 ${isRefreshingCatalog ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {/* NÚT HÀNH ĐỘNG ĐĂNG KÝ CHÍNH */}
            <button
              type="button"
              disabled={isSubmitting || checkedCountInDisplay === 0}
              onClick={() => handleRegisterBatch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Đang gửi đăng ký...</span>
                </>
              ) : (
                <>
                  <Check className="size-4" strokeWidth={3} />
                  <span>Đăng ký {checkedCountInDisplay} môn đã chọn</span>
                </>
              )}
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
                      checked={displayCourses.length > 0 && selectedCourseIds.size === displayCourses.length}
                      onChange={toggleSelectAllDisplay}
                      className="rounded size-3.5 cursor-pointer"
                      title="Chọn tất cả lớp đang hiển thị"
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
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    {filterType === 99 ? (
                      <div className="py-4 space-y-1">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          Phương án [{plans.find((p) => p.id === selectedPlanId)?.name || 'này'}] chưa có môn học nào được xếp.
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Bạn hãy bấm vào nút <span className="font-semibold text-blue-600 dark:text-blue-400">"Chuyển sang Xếp lịch"</span> ở góc trên để chọn lớp vào phương án này nhé!
                        </div>
                      </div>
                    ) : filterType === 5 ? (
                      'Sinh viên không có môn học nào cần học lại.'
                    ) : (
                      'Không tìm thấy lớp học phần nào phù hợp với điều kiện tra cứu.'
                    )}
                  </td>
                </tr>
              ) : (
                displayCourses.map((c, idx) => {
                  const idToHoc = c.id_to_hoc || c.id;
                  const isSelected = selectedCourseIds.has(c.id || c.id_to_hoc);
                  const isEnrolled = enrolledCourses.some((e) => e.ma_mon === c.ma_mon && e.nhom_to === c.nhom_to);
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
                          disabled={isEnrolled || isBeingSubmitted}
                          onChange={() => toggleSelectCourse(c.id || c.id_to_hoc)}
                          className="rounded size-4 cursor-pointer disabled:opacity-40"
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
                      <td className="text-center p-2 font-mono font-bold">{c.nhom_to || '01'}</td>

                      {/* 5. Tổ */}
                      <td className="text-center p-2 font-mono">{c.to_hoc || c.to || '-'}</td>

                      {/* 6. Số TC */}
                      <td className="text-center p-2 font-mono font-bold">{c.so_tc || 3}</td>

                      {/* 7. Lớp */}
                      <td className="p-2 text-muted-foreground truncate max-w-[140px]" title={c.lop || c.ds_lop?.join(', ')}>
                        {c.lop || c.ds_lop?.join(', ') || studentClass}
                      </td>

                      {/* 8. SỐ LƯỢNG */}
                      <td className="text-center p-2 font-mono">{c.sl_cp || 90}</td>

                      {/* 9. CÒN LẠI */}
                      <td className="text-center p-2 font-mono font-bold">
                        {isFull ? (
                          <span className="text-rose-600 dark:text-rose-400">0</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">{c.sl_cl ?? c.sl_cp ?? 90}</span>
                        )}
                      </td>

                      {/* 10. THỜI KHÓA BIỂU - 100% SGU Image 10 */}
                      <td className="p-2 text-slate-700 dark:text-slate-300 leading-snug">
                        {Array.isArray((c as any).tkb) && (c as any).tkb.length > 0 ? (
                          <div className="space-y-0.5 text-[11px]">
                            {(c as any).tkb.map((t: any, idx: number) => {
                              const parts = [
                                t.thu,
                                t.thoi_gian?.replace('->', ' → '),
                                t.phong,
                                t.giang_vien,
                                t.ngay,
                              ].filter(Boolean);
                              return <div key={idx}>{parts.join(', ')}</div>;
                            })}
                          </div>
                        ) : c.parsedSessions && c.parsedSessions.length > 0 ? (
                          <div className="space-y-0.5 text-[11px]">
                            {c.parsedSessions.map((s, idx) => {
                              const timeStr = s.thoi_gian?.replace('->', ' → ') || (s.tietStart && s.tietEnd ? `tiết ${s.tietStart} → ${s.tietEnd}` : '');
                              return (
                                <div key={idx}>
                                  {[s.thuStr, timeStr, s.phong, s.gv, s.dates].filter(Boolean).join(', ')}
                                </div>
                              );
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
            <span className="px-3 py-1 rounded-md text-xs font-black bg-teal-600 text-white shadow-xs">
              Đã đăng ký: {enrolledCourses.length} môn ({totalEnrolledCredits} TC)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoadingEnrolled || !token}
              onClick={() => fetchEnrolledList(token || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-200 text-xs font-bold hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoadingEnrolled ? 'animate-spin' : ''}`} />
              <span>Làm mới CSDL SGU</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              disabled={enrolledCourses.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white dark:bg-slate-900 text-foreground text-xs font-semibold hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="size-3.5 text-blue-600" />
              <span>Xuất / In phiếu đăng ký</span>
            </button>
          </div>
        </div>

        {/* Bảng kết quả đã đăng ký chính thức */}
        <div className="overflow-x-auto max-h-[360px] scrollbar-thin">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
              <tr>
                <th className="w-12 text-center p-2.5 font-bold uppercase text-[11px]">Xoá</th>
                <th className="w-24 p-2.5 font-bold uppercase text-[11px]">Mã MH</th>
                <th className="p-2.5 font-bold uppercase text-[11px]">Tên môn học</th>
                <th className="w-20 text-center p-2.5 font-bold uppercase text-[11px]">Nhóm tổ</th>
                <th className="w-16 text-center p-2.5 font-bold uppercase text-[11px]">Số TC</th>
                <th className="w-28 text-right p-2.5 font-bold uppercase text-[11px]">HP tạm tính</th>
                <th className="w-36 p-2.5 font-bold uppercase text-[11px]">Ngày đăng ký</th>
                <th className="w-36 text-center p-2.5 font-bold uppercase text-[11px]">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {enrolledCourses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Chưa có môn học nào được đăng ký trong học kỳ này trên hệ thống SGU.
                  </td>
                </tr>
              ) : (
                enrolledCourses.map((c) => {
                  const isDropping = droppingId === c.id_kqdk;
                  return (
                    <tr key={c.id_kqdk} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Nút hủy môn */}
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

                      {/* Mã môn */}
                      <td className="p-2 font-mono font-bold text-teal-700 dark:text-teal-300">{c.ma_mon}</td>

                      {/* Tên môn */}
                      <td className="p-2 font-semibold text-foreground">{c.ten_mon}</td>

                      {/* Nhóm tổ */}
                      <td className="text-center p-2 font-mono font-bold">{c.nhom_to}</td>

                      {/* Số TC */}
                      <td className="text-center p-2 font-mono font-bold">{c.so_tc}</td>

                      {/* Học phí */}
                      <td className="text-right p-2 font-mono text-muted-foreground">
                        {c.hoc_phi_tam_tinh ? `${c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ` : '—'}
                      </td>

                      {/* Ngày đăng ký */}
                      <td className="p-2 text-muted-foreground text-[11px] font-mono">
                        {c.ngay_dang_ky ? new Date(c.ngay_dang_ky).toLocaleDateString('vi-VN') : 'Mới ghi nhận'}
                      </td>

                      {/* Trạng thái CSDL */}
                      <td className="text-center p-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-800 dark:text-teal-200 text-[11px] font-bold">
                          <Check className="size-3" strokeWidth={3} />
                          Đã ghi nhận CSDL
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
                          setUser({ name: acc.name, mssv: acc.mssv });
                          try {
                            localStorage.setItem('sgu_dkmh_token', acc.token);
                            localStorage.setItem('sgu_dkmh_user', JSON.stringify({ name: acc.name, mssv: acc.mssv }));
                          } catch {}
                          setAuthSessionState('valid');
                          setShowLoginModal(false);
                          setAuthModalOpen(false);
                          setToastMessage(`Đã chuyển sang tài khoản: ${acc.name}`);
                          fetchEnrolledList(acc.token);
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
              <p className="text-xs text-slate-500">Học kỳ 1 - Năm học 2026-2027</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-2">
              <div>Họ tên: <span className="font-bold">{user?.name || 'Nguyễn Hoàng Anh'}</span></div>
              <div>Mã SV: <span className="font-bold">{user?.mssv || '3124410007'}</span></div>
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
                {enrolledCourses.map((c, i) => (
                  <tr key={c.id_kqdk}>
                    <td className="p-2 text-center border-r border-slate-200">{i + 1}</td>
                    <td className="p-2 font-mono font-bold border-r border-slate-200">{c.ma_mon}</td>
                    <td className="p-2 border-r border-slate-200">{c.ten_mon}</td>
                    <td className="p-2 text-center border-r border-slate-200">{c.nhom_to}</td>
                    <td className="p-2 text-center border-r border-slate-200">{c.so_tc}</td>
                    <td className="p-2 text-right">{c.hoc_phi_tam_tinh ? `${c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ` : '—'}</td>
                  </tr>
                ))}
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
    </div>
  );
};

export default DkmhPortalView;
