import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CheckCircle2,
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
  // 1: Theo kế hoạch học tập / CTĐT, 10: Theo môn học, 3: Theo khoa, 99: Nạp từ TKB đã xếp
  const [filterType, setFilterType] = useState<number>(99);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);

  // Column search keywords for Table 1 (DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ)
  const [searchMaMon, setSearchMaMon] = useState('');
  const [searchTenMon, setSearchTenMon] = useState('');
  const [searchNhom, setSearchNhom] = useState('');
  const [searchLop, setSearchLop] = useState('');

  // 5. SELECTION & SUBMISSION QUEUE
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingCourseId, setSubmittingCourseId] = useState<string | null>(null);

  // Delay settings: 0 (siêu tốc), 1s, 3s, 5s
  const [delaySeconds, setDelaySeconds] = useState<number>(0);

  // 6. AUTO-SNIPER & NON-BLOCKING BACKGROUND RADAR (Tranh giành slot không chặn)
  const [autoSnipeEnabled, setAutoSnipeEnabled] = useState(true);
  const [activeSnipingMap, setActiveSnipingMap] = useState<Map<string, SnipingStatusItem>>(new Map());
  const stopSnipingSignalRef = useRef(false);

  // 7. PRINT PREVIEW MODAL
  const [showPrintModal, setShowPrintModal] = useState(false);

  /* -------------------------------------------------------------
   * INITIAL CHECKS & LOADERS
   * ------------------------------------------------------------- */
  const checkGateStatus = useCallback(async (authToken?: string | null) => {
    if (!authToken) {
      setPortalOpen(false);
      setPortalMessage('Chưa đăng nhập SGU');
      return;
    }
    try {
      const res = await SguDkmhService.checkRegistrationPeriod(authToken);
      setPortalOpen(res.isOpen);
      setPortalMessage(res.message);
    } catch {
      setPortalOpen(true);
      setPortalMessage('Trong thời gian đăng ký');
    }
  }, []);

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

  // Pre-load selected items from current active timetable plan
  useEffect(() => {
    const currentPlan = plans.find((p) => p.id === selectedPlanId);
    if (currentPlan && currentPlan.selectedIds.length > 0) {
      setSelectedCourseIds(new Set(currentPlan.selectedIds));
    }
  }, [selectedPlanId, plans]);

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
    if (filterType === 99) {
      // Nạp từ phương án TKB đã xếp
      const currentPlan = plans.find((p) => p.id === selectedPlanId);
      if (currentPlan && currentPlan.selectedIds.length > 0) {
        const idSet = new Set(currentPlan.selectedIds);
        list = allCourses.filter((c) => idSet.has(c.id) || idSet.has(c.id_to_hoc));
      }
    } else if (filterType === 10 && selectedSubjectCode) {
      // Theo môn học
      list = allCourses.filter((c) => c.ma_mon === selectedSubjectCode);
    } else if (filterType === 3 && selectedFaculty) {
      // Theo khoa
      list = allCourses.filter((c) => c.ds_khoa?.includes(selectedFaculty));
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

    return list;
  }, [
    allCourses,
    filterType,
    selectedPlanId,
    plans,
    selectedSubjectCode,
    selectedFaculty,
    searchMaMon,
    searchTenMon,
    searchNhom,
    searchLop,
  ]);

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
    try {
      localStorage.removeItem('sgu_dkmh_token');
      localStorage.removeItem('sgu_dkmh_user');
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
      {/* 1. TOP HEADER BANNER: ĐĂNG KÝ MÔN HỌC & TRẠNG THÁI KHUNG GIỜ */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-950/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-blue-900 dark:text-blue-200 uppercase m-0">
              ĐĂNG KÝ MÔN HỌC
            </h1>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    portalOpen
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : isAuthNotice
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 active:scale-[0.98]'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
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
                      ? 'Trong thời gian đăng ký'
                      : isAuthNotice
                      ? `${portalMessage} • Bấm để đăng nhập`
                      : portalMessage}
                  </span>
                </button>
              );
            })()}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 m-0">
            Học kỳ 1 - Năm học 2026-2027 • Cổng đào tạo Đại học Sài Gòn (dkmh.sgu.edu.vn)
          </p>
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

      {/* 2. KHỐI 1: ĐIỀU KIỆN LỌC (Chuẩn SGU Mantine UI Card) */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-950/70 bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-indigo-50/80 dark:bg-slate-900/90 border-b border-indigo-200/80 dark:border-indigo-950/80 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 m-0 flex items-center gap-1.5">
            <Filter className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>ĐIỀU KIỆN LỌC</span>
          </h2>
          {filterType === 99 && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              ⚡ Đang nạp danh sách từ phương án TKB đã xếp [{plans.find((p) => p.id === selectedPlanId)?.name || 'TKB_1'}]
            </span>
          )}
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Dropdown 1: Tiêu chí lọc */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tiêu chí tra cứu:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={99}>⚡ Nạp từ Thời khóa biểu đã xếp ({plans.find((p) => p.id === selectedPlanId)?.name || 'TKB'})</option>
              <option value={10}>Theo môn học</option>
              <option value={3}>Theo khoa / đơn vị</option>
              <option value={1}>Tất cả môn học mở kỳ này</option>
            </select>
          </div>

          {/* Dropdown 2: Bộ chọn chi tiết tương ứng */}
          {filterType === 99 ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Chọn phương án TKB nạp vào:</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.selectedIds.length} môn đã xếp)
                  </option>
                ))}
              </select>
            </div>
          ) : filterType === 10 ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Chọn môn học cần lọc:</label>
              <select
                value={selectedSubjectCode}
                onChange={(e) => setSelectedSubjectCode(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Tất cả môn học --</option>
                {allSubjects.map((s) => (
                  <option key={s.ma_mon} value={s.ma_mon}>
                    {s.ten_mon} ({s.ma_mon})
                  </option>
                ))}
              </select>
            </div>
          ) : filterType === 3 ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Chọn khoa / đơn vị:</label>
              <select
                value={selectedFaculty}
                onChange={(e) => setSelectedFaculty(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Tất cả các khoa --</option>
                {faculties.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Quick Submit options */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1 flex flex-col justify-end">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSnipeEnabled}
                  onChange={(e) => setAutoSnipeEnabled(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 size-4"
                />
                <span>🎯 Tự động canh giành slot khi lớp hết chỗ</span>
              </label>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <span>Nhịp:</span>
                <div className="inline-flex rounded border border-border overflow-hidden bg-card text-foreground">
                  {([0, 1, 3] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDelaySeconds(s)}
                      className={`px-2 py-0.5 text-[11px] font-mono cursor-pointer ${
                        delaySeconds === s ? 'bg-blue-600 text-white font-bold' : 'hover:bg-muted'
                      }`}
                    >
                      {s === 0 ? '⚡ 0s' : `${s}s`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KHỐI 2: DANH SÁCH MÔN HỌC MỞ ĐĂNG KÝ (Table 1 chuẩn SGU) */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-950/70 bg-card overflow-hidden shadow-xs space-y-0">
        {/* Table 1 Header Toolbar */}
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
            {/* NÚT HÀNH ĐỘNG ĐĂNG KÝ CHÍNH */}
            <button
              type="button"
              disabled={isSubmitting || selectedCourseIds.size === 0}
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
                  <span>Đăng ký {selectedCourseIds.size} môn đã chọn</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bảng dữ liệu môn học mở đăng ký */}
        <div className="overflow-x-auto max-h-[520px] scrollbar-thin">
          <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
              {/* Cột chính */}
              <tr>
                <th className="w-12 text-center p-2 font-bold uppercase text-[11px]">
                  <input
                    type="checkbox"
                    checked={displayCourses.length > 0 && selectedCourseIds.size === displayCourses.length}
                    onChange={toggleSelectAllDisplay}
                    className="rounded size-4 cursor-pointer"
                    title="Chọn tất cả"
                  />
                </th>
                <th className="w-24 p-2 font-bold uppercase text-[11px]">Mã MH</th>
                <th className="p-2 font-bold uppercase text-[11px]">Tên môn học</th>
                <th className="w-16 text-center p-2 font-bold uppercase text-[11px]">Nhóm</th>
                <th className="w-14 text-center p-2 font-bold uppercase text-[11px]">Tổ</th>
                <th className="w-16 text-center p-2 font-bold uppercase text-[11px]">Số TC</th>
                <th className="w-28 p-2 font-bold uppercase text-[11px]">Lớp</th>
                <th className="w-20 text-center p-2 font-bold uppercase text-[11px]">Sĩ số</th>
                <th className="w-20 text-center p-2 font-bold uppercase text-[11px]">Còn lại</th>
                <th className="p-2 font-bold uppercase text-[11px]">Thời khóa biểu</th>
                <th className="w-40 text-center p-2 font-bold uppercase text-[11px]">Thao tác</th>
              </tr>
              {/* Dòng bộ lọc tìm kiếm nhanh theo cột */}
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-t border-border/50 text-[11px]">
                <th className="p-1 text-center">
                  <Search className="size-3 text-muted-foreground mx-auto" />
                </th>
                <th className="p-1">
                  <input
                    type="text"
                    placeholder="Lọc mã..."
                    value={searchMaMon}
                    onChange={(e) => setSearchMaMon(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-xs rounded border border-border bg-card text-foreground"
                  />
                </th>
                <th className="p-1">
                  <input
                    type="text"
                    placeholder="Lọc tên môn học..."
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
                <th className="p-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {displayCourses.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy lớp học phần nào phù hợp với điều kiện tra cứu.
                  </td>
                </tr>
              ) : (
                displayCourses.map((c) => {
                  const idToHoc = c.id_to_hoc || c.id;
                  const isSelected = selectedCourseIds.has(c.id || c.id_to_hoc);
                  const isEnrolled = enrolledCourses.some((e) => e.ma_mon === c.ma_mon && e.nhom_to === c.nhom_to);
                  const isFull = (c.sl_cl !== undefined && c.sl_cl <= 0) || (c.sl_cp !== undefined && c.sl_dk !== undefined && c.sl_dk >= c.sl_cp);
                  const isBeingSubmitted = submittingCourseId === idToHoc;
                  const snipingStatus = activeSnipingMap.get(idToHoc);

                  return (
                    <tr
                      key={idToHoc}
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
                      {/* Checkbox chọn */}
                      <td className="text-center p-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isEnrolled || isBeingSubmitted}
                          onChange={() => toggleSelectCourse(c.id || c.id_to_hoc)}
                          className="rounded size-4 cursor-pointer disabled:opacity-40"
                        />
                      </td>

                      {/* Mã môn */}
                      <td className="p-2 font-mono font-bold text-blue-700 dark:text-blue-300">
                        {c.ma_mon}
                      </td>

                      {/* Tên môn */}
                      <td className="p-2 font-semibold text-foreground">
                        {c.ten_mon}
                      </td>

                      {/* Nhóm */}
                      <td className="text-center p-2 font-mono font-bold">{c.nhom_to || '01'}</td>

                      {/* Tổ */}
                      <td className="text-center p-2 font-mono">{c.to_hoc || ''}</td>

                      {/* Số TC */}
                      <td className="text-center p-2 font-mono font-bold">{c.so_tc || 3}</td>

                      {/* Lớp */}
                      <td className="p-2 text-muted-foreground truncate max-w-[140px]" title={c.lop || c.ds_lop?.join(', ')}>
                        {c.lop || c.ds_lop?.join(', ') || 'Đại trà'}
                      </td>

                      {/* Sĩ số cho phép */}
                      <td className="text-center p-2 font-mono">{c.sl_cp || 80}</td>

                      {/* Còn lại */}
                      <td className="text-center p-2 font-mono font-bold">
                        {isFull ? (
                          <span className="text-rose-600 dark:text-rose-400">Hết chỗ</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">{c.sl_cl ?? 1}</span>
                        )}
                      </td>

                      {/* TKB */}
                      <td className="p-2 text-slate-600 dark:text-slate-300 leading-tight">
                        {c.parsedSessions && c.parsedSessions.length > 0 ? (
                          <div className="space-y-0.5">
                            {c.parsedSessions.map((s, idx) => (
                              <div key={idx} className="text-[11px]">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{s.thuStr}</span> ({s.thoi_gian}) • {s.phong} • {s.gv}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Chưa xếp lịch</span>
                        )}
                      </td>

                      {/* Trạng thái & Nút Đăng ký */}
                      <td className="text-center p-2">
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            <CheckCircle2 className="size-3.5" />
                            Đã đăng ký
                          </span>
                        ) : isBeingSubmitted ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 font-bold text-[11px]">
                            <RefreshCw className="size-3.5 animate-spin" />
                            Đang gửi...
                          </span>
                        ) : snipingStatus ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] animate-pulse">
                              <Target className="size-3 animate-spin" />
                              Đang tranh slot (Lần #{snipingStatus.attempts})
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{snipingStatus.lastChecked}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleRegisterBatch([c])}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                              isFull
                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                            }`}
                          >
                            {isFull ? 'Canh slot' : 'Đăng ký'}
                          </button>
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
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <LogIn className="size-5" />
                <h3 className="text-base font-bold text-foreground m-0">Đăng nhập tài khoản sinh viên SGU</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="text-muted-foreground hover:text-foreground p-1"
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
                          setShowLoginModal(false);
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
                  onClick={() => setShowLoginModal(false)}
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
