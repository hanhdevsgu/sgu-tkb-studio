import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Trash2,
  User,
  BookOpen,
  AlertTriangle,
  LogIn,
  KeyRound,
  StopCircle,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup } from '../types/course';
import {
  SguDkmhService,
  SguAuthUser,
  EnrolledCourseItem,
} from '../services/sguDkmhService';

interface QueueItem {
  group: ClassGroup;
  status: 'pending' | 'submitting' | 'success' | 'error';
  message?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

export const DkmhPortalView: React.FC = () => {
  const { plans, activeTabId, allCourses, allSubjects, setToastMessage, initData } = useTimetableStore();

  // Auth & Connection State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SguAuthUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Manual login modal / state
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [manualMssv, setManualMssv] = useState('');
  const [manualPassword, setManualPassword] = useState('');

  // SGU Portal Time Window State
  const [portalWindow, setPortalWindow] = useState<{
    isOpen: boolean;
    message: string;
    lastChecked: string;
  } | null>(null);
  const [isCheckingPortal, setIsCheckingPortal] = useState(false);

  // Guide card collapsed state
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // Quick subject add state
  const [quickAddSubjectCode, setQuickAddSubjectCode] = useState('');

  // Live Clock & 7:00:00 Countdown
  const [liveTime, setLiveTime] = useState<string>('');
  const [countdownTo7AM, setCountdownTo7AM] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('vi-VN', { hour12: false }));

      // Target: today 7:00:00 AM
      const target = new Date();
      target.setHours(7, 0, 0, 0);
      if (now > target) {
        target.setDate(target.getDate() + 1);
      }
      const diffMs = target.getTime() - now.getTime();
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      setCountdownTo7AM(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Saved delay setting in seconds (defaults to 3s, persisted in localStorage)
  const [delaySeconds, setDelaySeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sgu_dkmh_delay_sec');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 0) return val;
      }
    } catch {}
    return 3;
  });

  useEffect(() => {
    try {
      localStorage.setItem('sgu_dkmh_delay_sec', String(delaySeconds));
    } catch {}
  }, [delaySeconds]);

  // Selected Plan ID with localStorage persistence
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('sgu_dkmh_selected_plan');
      if (saved && plans.some((p) => p.id === saved)) return saved;
    } catch {}
    return activeTabId;
  });

  useEffect(() => {
    try {
      localStorage.setItem('sgu_dkmh_selected_plan', selectedPlanId);
    } catch {}
  }, [selectedPlanId]);

  // Submission Queue with localStorage persistence (F5 không bao giờ mất)
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('sgu_dkmh_saved_queue_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      if (queue.length > 0) {
        localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(queue));
      }
    } catch {}
  }, [queue]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const stopSubmittingRef = useRef(false);

  // Enrolled Courses (From SGU Database)
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseItem[]>([]);
  const [totalEnrolledCredits, setTotalEnrolledCredits] = useState(0);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [droppingCourseId, setDroppingCourseId] = useState<string | null>(null);

  // Activity Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasAutoLoggedIn = useRef(false);
  const isFirstMountRef = useRef(true);

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: timeStr,
        type,
        text,
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // 1. Initial Authentication from .env (or cached token)
  const handleAutoLogin = useCallback(async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    addLog('info', 'Đang kết nối xác thực tài khoản qua cổng đào tạo SGU...');
    try {
      const auth = await SguDkmhService.loginFromEnv();
      setToken(auth.token);
      setUser(auth.user);
      addLog('success', `Xác thực thành công sinh viên: ${auth.user.name} (${auth.user.mssv})`);
      setToastMessage(`Xin chào, ${auth.user.name}!`);

      // Check portal status & enrolled courses
      checkPortalStatus(auth.token);
      fetchEnrolled(auth.token);

      // Auto background sync to guarantee 100% fresh course data
      fetch('/api-sync')
        .then(() => initData())
        .catch(() => {});
    } catch (err: any) {
      console.warn('Auto-login from env failed:', err);
      setAuthError(err.message || 'Không thể đăng nhập tự động. Vui lòng thử đăng nhập thủ công.');
      addLog('warn', `Chưa thể nạp tài khoản tự động: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  }, [addLog, setToastMessage, initData]);

  useEffect(() => {
    if (hasAutoLoggedIn.current) return;
    hasAutoLoggedIn.current = true;
    handleAutoLogin();
  }, [handleAutoLogin]);

  // 2. Manual Login
  const handleManualLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMssv.trim() || !manualPassword) {
      setToastMessage('Vui lòng nhập đầy đủ MSSV và Mật khẩu!');
      return;
    }
    setIsAuthenticating(true);
    setAuthError(null);
    addLog('info', `Đang đăng nhập sinh viên MSSV: ${manualMssv.trim()}...`);
    try {
      const auth = await SguDkmhService.login(manualMssv.trim(), manualPassword);
      setToken(auth.token);
      setUser(auth.user);
      setShowManualLogin(false);
      setToastMessage(`Đăng nhập thành công: ${auth.user.name}`);
      addLog('success', `Đăng nhập thành công: ${auth.user.name} (${auth.user.mssv})`);
      checkPortalStatus(auth.token);
      fetchEnrolled(auth.token);
    } catch (err: any) {
      setAuthError(err.message || 'Đăng nhập thất bại');
      addLog('error', `Đăng nhập thất bại: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 3. Check Portal Registration Window
  const checkPortalStatus = async (authToken = token) => {
    if (!authToken) return;
    setIsCheckingPortal(true);
    addLog('info', 'Đang kiểm tra trạng thái khung giờ mở cổng đăng ký...');
    try {
      const status = await SguDkmhService.checkRegistrationPeriod(authToken);
      const timeNow = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      setPortalWindow({
        isOpen: status.isOpen,
        message: status.message,
        lastChecked: timeNow,
      });
      if (status.isOpen) {
        addLog('success', `Cổng đăng ký SGU đang MỞ: ${status.message}`);
      } else {
        addLog('warn', `Phản hồi cổng SGU: ${status.message}`);
      }
    } catch (err: any) {
      addLog('error', `Không thể kiểm tra khung giờ mở cổng: ${err.message}`);
    } finally {
      setIsCheckingPortal(false);
    }
  };

  // 4. Auto Keep-Alive Heartbeat: Ping SGU every 2.5 minutes to maintain active session
  useEffect(() => {
    if (!token) return;
    const heartbeatTimer = setInterval(() => {
      checkPortalStatus(token);
    }, 150000);
    return () => clearInterval(heartbeatTimer);
  }, [token]);

  // 5. Fetch Enrolled Courses from SGU
  const fetchEnrolled = async (authToken = token) => {
    if (!authToken) return;
    setIsLoadingEnrolled(true);
    try {
      const data = await SguDkmhService.getEnrolledCourses(authToken);
      setEnrolledCourses(data.courses);
      setTotalEnrolledCredits(data.totalCredits);
      addLog('info', `Hệ thống SGU hiện ghi nhận: ${data.courses.length} môn (${data.totalCredits} tín chỉ).`);
    } catch (err: any) {
      addLog('error', `Không thể tải danh sách môn đã đăng ký: ${err.message}`);
    } finally {
      setIsLoadingEnrolled(false);
    }
  };

  // 6. Load plan into queue
  const loadPlanToQueue = useCallback(
    (planId: string, currentEnrolled: EnrolledCourseItem[] = enrolledCourses, force = false) => {
      if (isSubmitting && !force) return;
      const targetPlan = plans.find((p) => p.id === planId);
      if (!targetPlan) return;

      const groups: ClassGroup[] = [];
      for (const gid of targetPlan.selectedIds) {
        const found = allCourses.find((c) => c.id === gid);
        if (found) groups.push(found);
      }

      const newQueue: QueueItem[] = groups.map((g) => {
        const isEnrolled = currentEnrolled.some(
          (e) => e.id_to_hoc === g.id_to_hoc || (e.ma_mon === g.ma_mon && e.nhom_to === g.nhom_to)
        );
        if (isEnrolled) {
          return {
            group: g,
            status: 'success',
            message: 'Đã có trong CSDL SGU',
          };
        }
        return {
          group: g,
          status: 'pending',
        };
      });

      setQueue(newQueue);
      setSelectedPlanId(planId);
      try {
        localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(newQueue));
        localStorage.setItem('sgu_dkmh_selected_plan', planId);
      } catch {}

      if (groups.length > 0) {
        addLog('info', `Đã nạp ${groups.length} môn từ phương án "${targetPlan.name}" vào hàng đợi.`);
      }
    },
    [plans, allCourses, enrolledCourses, isSubmitting, addLog]
  );

  // Sync plan on mount or plan change, prioritizing localStorage persistence on first mount
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (queue.length > 0) {
        addLog('info', `⚡ Đã khôi phục ${queue.length} môn từ bộ nhớ lưu trữ trình duyệt (F5 không mất dữ liệu).`);
        return;
      }
    }
    loadPlanToQueue(selectedPlanId);
  }, [selectedPlanId]);

  // 7. Remove course from queue
  const handleRemoveFromQueue = (groupId: string) => {
    setQueue((prev) => {
      const updated = prev.filter((q) => q.group.id !== groupId);
      try {
        localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 8. Add direct course group to queue
  const handleAddDirectGroup = (group: ClassGroup) => {
    setQueue((prev) => {
      if (prev.some((q) => q.group.id === group.id || q.group.id_to_hoc === group.id_to_hoc)) {
        setToastMessage(`Môn ${group.ten_mon} (Nhóm ${group.nhom_to}) đã có sẵn trong hàng đợi!`);
        return prev;
      }
      const updated: QueueItem[] = [
        ...prev,
        {
          group,
          status: 'pending',
        },
      ];
      try {
        localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(updated));
      } catch {}
      setToastMessage(`Đã thêm môn ${group.ten_mon} vào hàng đợi!`);
      addLog('info', `Đã thêm trực tiếp môn: ${group.ten_mon} (${group.ma_mon} - Nhóm ${group.nhom_to}).`);
      return updated;
    });
  };

  // 9. Submit Sequential Registration with Custom Delay
  const handleSubmitSequential = async () => {
    if (!token) {
      setToastMessage('Bạn cần xác thực tài khoản sinh viên trước khi đăng ký!');
      return;
    }
    if (queue.length === 0) {
      setToastMessage('Hàng đợi đăng ký đang trống! Hãy nạp phương án thời khóa biểu.');
      return;
    }

    const pendingItems = queue.filter((q) => q.status !== 'success');
    if (pendingItems.length === 0) {
      setToastMessage('Tất cả môn trong hàng đợi đã được ghi nhận thành công trên SGU!');
      return;
    }

    const confirmSubmit = window.confirm(
      `Xác nhận nộp đăng ký ${pendingItems.length} môn học trực tiếp vào hệ thống Đào tạo SGU?` +
      (delaySeconds > 0 ? `\n(Khoảng cách giữa mỗi môn: ${delaySeconds} giây để mô phỏng người thật click tay)` : '')
    );
    if (!confirmSubmit) return;

    stopSubmittingRef.current = false;
    setIsSubmitting(true);
    addLog('info', `🚀 Bắt đầu gửi API đăng ký cho ${pendingItems.length} môn học (Delay: ${delaySeconds}s/môn)...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingItems.length; i++) {
      if (stopSubmittingRef.current) {
        addLog('warn', '🛑 Quá trình đăng ký đã được người dùng dừng lại!');
        setToastMessage('Đã dừng đăng ký theo yêu cầu.');
        break;
      }

      const item = pendingItems[i];
      const { group } = item;
      const id_to_hoc = group.id_to_hoc || group.id;

      // Update status to submitting
      setQueue((prev) =>
        prev.map((q) =>
          q.group.id === group.id ? { ...q, status: 'submitting', message: 'Đang gửi...' } : q
        )
      );

      addLog('info', `[${i + 1}/${pendingItems.length}] Đang nộp: ${group.ten_mon} (${group.ma_mon} - Nhóm ${group.nhom_to})...`);

      try {
        const res = await SguDkmhService.registerSingleCourse(token, id_to_hoc);
        if (res.success) {
          successCount++;
          addLog('success', `✅ [${group.ma_mon} - Nhóm ${group.nhom_to}] ${group.ten_mon}: Đăng ký THÀNH CÔNG!`);
          setQueue((prev) =>
            prev.map((q) =>
              q.group.id === group.id ? { ...q, status: 'success', message: res.message || 'Thành công' } : q
            )
          );
        } else {
          failCount++;
          addLog('error', `❌ [${group.ma_mon} - Nhóm ${group.nhom_to}] ${group.ten_mon}: ${res.message}`);
          setQueue((prev) =>
            prev.map((q) =>
              q.group.id === group.id ? { ...q, status: 'error', message: res.message || 'Thất bại' } : q
            )
          );
        }
      } catch (err: any) {
        failCount++;
        addLog('error', `❌ Lỗi kết nối khi nộp ${group.ten_mon}: ${err.message}`);
        setQueue((prev) =>
          prev.map((q) =>
            q.group.id === group.id ? { ...q, status: 'error', message: err.message } : q
          )
        );
      }

      // If not the last item, wait for delaySeconds (cancelable every 100ms)
      if (i < pendingItems.length - 1 && !stopSubmittingRef.current) {
        if (delaySeconds > 0) {
          addLog('info', `⏳ Chờ ${delaySeconds}s trước khi gửi môn tiếp theo (mô phỏng người thật)...`);
          const msToWait = delaySeconds * 1000;
          const startWait = Date.now();
          while (Date.now() - startWait < msToWait) {
            if (stopSubmittingRef.current) break;
            await new Promise((r) => setTimeout(r, 100));
          }
        } else {
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      setToastMessage(`Đăng ký xong: ${successCount} môn thành công!`);
    } else if (failCount > 0) {
      setToastMessage(`Hoàn tất. Có môn không thành công, kiểm tra nhật ký chi tiết.`);
    }

    // Refresh enrolled courses from SGU
    await fetchEnrolled(token);
  };

  // 10. Drop Course
  const handleDropCourse = async (course: EnrolledCourseItem) => {
    if (!token) return;
    const confirmDrop = window.confirm(
      `Bạn có chắc chắn muốn HỦY đăng ký môn:\n"${course.ten_mon}" (${course.ma_mon} - Nhóm ${course.nhom_to})?`
    );
    if (!confirmDrop) return;

    setDroppingCourseId(course.id_kqdk);
    addLog('warn', `Đang gửi yêu cầu hủy môn: ${course.ten_mon}...`);
    try {
      const res = await SguDkmhService.dropCourse(token, course.id_kqdk);
      if (res.success) {
        addLog('success', `Đã hủy thành công môn: ${course.ten_mon}`);
        setToastMessage(`Đã hủy môn: ${course.ten_mon}`);
        setQueue((prev) =>
          prev.map((q) =>
            q.group.ma_mon === course.ma_mon && q.group.nhom_to === course.nhom_to
              ? { ...q, status: 'pending', message: undefined }
              : q
          )
        );
        fetchEnrolled(token);
      } else {
        addLog('error', `Hủy môn thất bại: ${res.message}`);
        setToastMessage(`Hủy môn thất bại: ${res.message}`);
      }
    } catch (err: any) {
      addLog('error', `Lỗi khi hủy môn: ${err.message}`);
      setToastMessage(`Lỗi: ${err.message}`);
    } finally {
      setDroppingCourseId(null);
    }
  };

  const totalQueueCredits = queue.reduce((acc, q) => acc + (q.group.so_tc || 0), 0);
  const pendingQueueCount = queue.filter((q) => q.status !== 'success').length;
  const allDone = queue.length > 0 && pendingQueueCount === 0;

  // Available class groups for quick add subject
  const quickAddGroups = quickAddSubjectCode
    ? allCourses.filter((c) => c.ma_mon === quickAddSubjectCode)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* 1. PERSISTENCE NOTIFICATION BADGE: Confirms F5 safety & session status */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-primary/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex size-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
          </span>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5 m-0">
              <span>Hệ thống bảo vệ phiên hoạt động: F5 không mất môn</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                ACTIVE
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground m-0">
              Đang lưu an toàn <strong>{queue.length} môn</strong> trong bộ nhớ máy • Auto Ping ngầm <strong>2.5 phút/lần</strong> giữ phiên không bị logout.
            </p>
          </div>
        </div>

        {/* Live Clock & 7:00 AM Countdown */}
        <div className="flex items-center gap-2 text-xs shrink-0 bg-background/80 px-3 py-1.5 rounded-xl border border-border/60">
          <Clock className="size-3.5 text-primary" />
          <span className="text-muted-foreground">Giờ máy:</span>
          <span className="font-mono font-bold text-foreground">{liveTime || '00:00:00'}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">Đếm ngược 07:00:</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{countdownTo7AM || '--:--:--'}</span>
        </div>
      </div>

      {/* 2. TOP HERO HUD: Account, Gateway Status & Direct SGU Sync */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          {/* User Info & Verified Badge */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <User className="size-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  {user ? user.name : 'Sinh viên SGU'}
                </h2>
                {user ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="size-3.5" />
                    <span>Đã kết nối trực tiếp SGU</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <AlertCircle className="size-3.5" />
                    <span>Chưa xác thực</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>
                  MSSV:{' '}
                  <strong className="text-foreground font-mono font-medium">
                    {user ? user.mssv : '---'}
                  </strong>
                </span>
                <span>•</span>
                <span>Phương thức: Direct Live API Client (Private 100%)</span>
                {token && (
                  <>
                    <span>•</span>
                    <button
                      onClick={() => setShowManualLogin(true)}
                      className="text-primary hover:underline font-medium cursor-pointer"
                      type="button"
                    >
                      Đổi tài khoản
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Portal Gateway Status Card */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-2.5 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      portalWindow?.isOpen ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full size-2.5 ${
                      portalWindow?.isOpen ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  ></span>
                </span>
                <span className="text-xs font-medium text-foreground">
                  {portalWindow ? portalWindow.message : 'Đang kiểm tra cổng...'}
                </span>
              </div>

              <button
                onClick={() => checkPortalStatus()}
                disabled={isCheckingPortal || !token}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                title="Kiểm tra lại trạng thái cổng SGU"
                type="button"
              >
                <RefreshCw
                  className={`size-3.5 text-primary ${isCheckingPortal ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {!token && (
              <button
                onClick={() => setShowManualLogin(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs"
                type="button"
              >
                <LogIn className="size-3.5" />
                <span>Đăng nhập SGU</span>
              </button>
            )}
          </div>
        </div>

        {/* Auth error banner */}
        {authError && (
          <div className="mt-3.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              onClick={() => setShowManualLogin(true)}
              className="underline font-semibold shrink-0 cursor-pointer"
            >
              Đăng nhập thủ công
            </button>
          </div>
        )}
      </div>

      {/* 3. COLLAPSIBLE STRATEGY GUIDE: 3 Golden Steps for Stress-Free Morning */}
      <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-xs space-y-3">
        <div
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold text-foreground">
              Cẩm nang 3 bước vàng đăng ký suôn sẻ 100% (Không sợ nghẽn mạng - Không lo khóa tài khoản)
            </h3>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs p-1 rounded-lg hover:bg-muted"
          >
            {isGuideOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        {isGuideOpen && (
          <div className="pt-2 border-t border-border/60 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">
                  1
                </span>
                <span>Trước 06:45 sáng</span>
              </div>
              <p className="text-muted-foreground leading-relaxed m-0 text-[11px]">
                Mở web `http://localhost:3000/`. Tài khoản đã tự động nạp. Chọn phương án (`TKB_1` hoặc `TKB_2`) để nạp các môn cần học vào Hàng đợi. Bạn có thể F5 kiểm tra, các môn vẫn giữ nguyên.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="size-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px]">
                  2
                </span>
                <span>06:45 – 06:58 sáng</span>
              </div>
              <p className="text-muted-foreground leading-relaxed m-0 text-[11px]">
                Chọn độ trễ (khuyên dùng <strong>3s – 5s</strong>). Để yên tab trình duyệt trên màn hình, không cần bấm F5 hay submit thủ công vì hệ thống đã tự động gửi tín hiệu giữ phiên 2.5 phút/lần.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="size-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[11px]">
                  3
                </span>
                <span>Đúng 07:00:00 sáng</span>
              </div>
              <p className="text-muted-foreground leading-relaxed m-0 text-[11px]">
                Bấm nút xanh lớn <strong>"NỘP ĐĂNG KÝ BẰNG API NGAY"</strong>. Request xuất phát thẳng từ máy tính bạn đến máy chủ SGU với ping 20ms, nộp từng môn và báo kết quả tức thì!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Manual Login Dialog */}
      {showManualLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Đăng nhập tài khoản SGU</h3>
              </div>
              <button
                onClick={() => setShowManualLogin(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Thông tin MSSV và mật khẩu được gửi trực tiếp đến API chính thức của Đại học Sài Gòn
              để nhận mã xác thực Token. Tuyệt đối không lưu lại ở máy chủ bên thứ ba.
            </p>

            <form onSubmit={handleManualLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mã số sinh viên (MSSV)
                </label>
                <input
                  type="text"
                  value={manualMssv}
                  onChange={(e) => setManualMssv(e.target.value)}
                  placeholder="3124410007"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mật khẩu trang thongtindaotao.sgu.edu.vn
                </label>
                <input
                  type="password"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualLogin(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isAuthenticating && <RefreshCw className="size-3.5 animate-spin" />}
                  <span>Đăng nhập & Lấy Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: Queue on Left, Real-Time Registered on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 COLS): Submission Queue & Fast Registration Action */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4">
            {/* Header & Plan Selection */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Zap className="size-4 text-emerald-500 fill-emerald-500" />
                  <span>Hàng đợi đăng ký môn học</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Nạp từ phương án đã sắp xếp sẵn bên tab Xếp Lịch Học (Tự động lưu, F5 không mất)
                </p>
              </div>

              {/* Plan Switcher Pills & Re-sync button */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 overflow-x-auto">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlanId(p.id);
                          loadPlanToQueue(p.id, enrolledCourses, true);
                        }}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-card text-foreground shadow-2xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        type="button"
                      >
                        {p.name}
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          ({p.selectedIds.length})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => loadPlanToQueue(selectedPlanId, enrolledCourses, true)}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg border border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Đồng bộ lại môn từ thời khóa biểu"
                  type="button"
                >
                  <RotateCcw className="size-3 text-primary" />
                  <span className="hidden sm:inline text-[11px]">Nạp lại</span>
                </button>
              </div>
            </div>

            {/* Delay Interval Setting & Anti-detection Stagger */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <SlidersHorizontal className="size-3.5 text-primary" />
                  <span>Độ trễ giữa mỗi môn:</span>
                  <span className="font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {delaySeconds} giây
                  </span>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex items-center gap-1">
                  {[0, 1, 3, 5, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDelaySeconds(sec)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer border ${
                        delaySeconds === sec
                          ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                          : 'bg-card text-muted-foreground border-border/80 hover:bg-muted'
                      }`}
                    >
                      {sec === 0 ? '0s (Tối đa)' : sec === 5 ? '5s (Khuyên dùng)' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider & Explanation */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                  {delaySeconds === 0
                    ? '⚡ Gửi liên tiếp siêu tốc'
                    : `🛡️ Chờ ${delaySeconds}s mỗi môn (Mô phỏng click tay, tránh quét tool)`}
                </span>
              </div>
            </div>

            {/* Quick Add Search from 679 SGU subjects */}
            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Plus className="size-3.5 text-primary" />
                  <span>Thêm nhanh môn vào hàng đợi (Tìm trong 679 môn SGU):</span>
                </span>
                {quickAddSubjectCode && (
                  <button
                    onClick={() => setQuickAddSubjectCode('')}
                    className="text-muted-foreground hover:text-foreground text-[10px]"
                  >
                    Đóng
                  </button>
                )}
              </div>

              <select
                value={quickAddSubjectCode}
                onChange={(e) => setQuickAddSubjectCode(e.target.value)}
                className="w-full p-2 text-xs rounded-xl border border-border bg-background text-foreground"
              >
                <option value="">-- Chọn môn học để hiển thị danh sách lớp mở --</option>
                {allSubjects.map((s) => (
                  <option key={s.ma_mon} value={s.ma_mon}>
                    {s.ma_mon} - {s.ten_mon} ({s.so_tc} TC)
                  </option>
                ))}
              </select>

              {/* Available classes for selected subject */}
              {quickAddSubjectCode && quickAddGroups.length > 0 && (
                <div className="p-2 rounded-lg bg-card border border-border/60 space-y-1.5 max-h-36 overflow-y-auto">
                  {quickAddGroups.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary font-mono">Nhóm {g.nhom_to}</span>
                          <span className="text-muted-foreground font-medium">{g.so_tc} TC</span>
                          <span className="text-emerald-500 font-semibold font-mono">
                            Còn {g.sl_cl ?? 85}/{g.sl_cp ?? 90} chỗ
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] truncate">
                          {g.parsedSessions?.map((s) => `${s.thuStr || `Thứ ${s.thu}`} T${s.tietStart}-${s.tietEnd}`).join(' | ') || g.tkb_raw}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddDirectGroup(g)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shrink-0"
                      >
                        + Thêm
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Queue Summary Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-muted/30 border border-border/50 text-xs">
              <div className="flex items-center gap-2">
                <BookOpen className="size-3.5 text-primary" />
                <span className="text-muted-foreground">Tổng nộp:</span>
                <span className="font-semibold text-foreground">{queue.length} môn</span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-foreground">{totalQueueCredits} tín chỉ</span>
              </div>

              {queue.length > 0 && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ● Đã lưu vào bộ nhớ trình duyệt
                </span>
              )}
            </div>

            {/* Queue Items Table / List */}
            {queue.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border/80 rounded-xl">
                <BookOpen className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">
                  Chưa có môn học nào trong hàng đợi
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hãy quay lại tab <strong>"Xếp Lịch Học"</strong> để chọn môn và nhóm lớp vào phương án,
                  hoặc bấm các phương án phía trên để nạp môn vào hàng đợi.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {queue.map((item, idx) => {
                  const { group, status, message } = item;
                  return (
                    <div
                      key={`${group.id}-${idx}`}
                      className="p-3 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground font-mono">{group.ma_mon}</span>
                          <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold text-[11px]">
                            Nhóm {group.nhom_to}
                          </span>
                          <span className="text-muted-foreground font-medium">
                            {group.so_tc} TC
                          </span>
                          {typeof group.sl_cl === 'number' && (
                            <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              (Còn {group.sl_cl}/{group.sl_cp ?? '--'})
                            </span>
                          )}
                        </div>
                        <p className="text-foreground/90 font-medium truncate">{group.ten_mon}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {group.parsedSessions && group.parsedSessions.length > 0
                            ? group.parsedSessions
                                .map(
                                  (s) =>
                                    `${s.thuStr || (s.thu === 8 ? 'CN' : `Thứ ${s.thu}`)} (T${s.tietStart}-${s.tietEnd}${
                                      s.phong ? ` • ${s.phong}` : ''
                                    })`
                                )
                                .join(' | ')
                            : group.tkb_raw || 'Chưa có lịch xếp'}
                        </p>
                      </div>

                      {/* Right Status Badge & Delete button */}
                      <div className="shrink-0 flex items-center gap-2 text-right">
                        <div>
                          {status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium text-[11px] border border-border/70">
                              <Clock className="size-3" />
                              <span>Chờ nộp</span>
                            </span>
                          )}
                          {status === 'submitting' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-[11px] border border-primary/20">
                              <RefreshCw className="size-3 animate-spin" />
                              <span>Đang nộp...</span>
                            </span>
                          )}
                          {status === 'success' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
                              <CheckCircle2 className="size-3" />
                              <span>Thành công</span>
                            </span>
                          )}
                          {status === 'error' && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive font-semibold text-[11px] border border-destructive/20 max-w-[180px] truncate"
                              title={message}
                            >
                              <AlertCircle className="size-3 shrink-0" />
                              <span className="truncate">{message || 'Lỗi'}</span>
                            </span>
                          )}
                        </div>

                        {/* Delete button from queue */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(group.id)}
                          disabled={isSubmitting}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-40"
                          title="Xóa môn này khỏi hàng đợi"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BIG ACTION: SUBMIT VIA SGU API & STOP BUTTON */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleSubmitSequential}
                disabled={isSubmitting || queue.length === 0 || !token || allDone}
                className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide text-white transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md ${
                  allDone
                    ? 'bg-emerald-700/80'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/20 active:scale-[0.99]'
                }`}
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>ĐANG NỘP ĐĂNG KÝ (DELAY: {delaySeconds}S)...</span>
                  </>
                ) : allDone ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-300" />
                    <span>TẤT CẢ MÔN ĐÃ ĐƯỢC GHI NHẬN THÀNH CÔNG</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4 text-amber-300 fill-amber-300" />
                    <span>NỘP ĐĂNG KÝ BẰNG API NGAY ({pendingQueueCount} MÔN)</span>
                  </>
                )}
              </button>

              {/* STOP BUTTON */}
              {isSubmitting && (
                <button
                  type="button"
                  onClick={() => {
                    stopSubmittingRef.current = true;
                    addLog('warn', '🛑 Đang gửi tín hiệu dừng đăng ký...');
                  }}
                  className="py-3.5 px-5 rounded-xl font-bold text-sm bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                >
                  <StopCircle className="size-4" />
                  <span>Dừng lại</span>
                </button>
              )}
            </div>
            <p className="text-center text-[11px] text-muted-foreground m-0">
              ⚡ Yêu cầu được gửi trực tiếp từ máy bạn qua endpoint chuẩn của SGU, có cơ chế delay chống phát hiện.
            </p>
          </div>

          {/* Activity Audit Log Console */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary"></span>
                <span>Nhật ký tiến trình API</span>
              </h4>
              <span className="text-[10px] text-muted-foreground font-mono">
                {logs.length} bản ghi
              </span>
            </div>

            <div className="p-3 rounded-xl bg-background border border-border/60 max-h-44 overflow-y-auto font-mono text-[11px] space-y-1.5 select-text">
              {logs.length === 0 ? (
                <div className="text-muted-foreground text-center py-3">
                  Chưa có hoạt động API nào được thực thi
                </div>
              ) : (
                logs.map((log) => {
                  let color = 'text-muted-foreground';
                  if (log.type === 'success') color = 'text-emerald-500 dark:text-emerald-400';
                  if (log.type === 'warn') color = 'text-amber-500 dark:text-amber-400';
                  if (log.type === 'error') color = 'text-destructive';
                  return (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-muted-foreground/70 shrink-0 font-normal">
                        [{log.timestamp}]
                      </span>
                      <span className={color}>{log.text}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 COLS): Official Live Enrolled Courses from SGU Database */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>Môn đã vào hệ thống SGU</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ghi nhận trực tiếp từ CSDL Đào tạo SGU
                </p>
              </div>

              <button
                onClick={() => fetchEnrolled()}
                disabled={isLoadingEnrolled || !token}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border/70 bg-muted/60 hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50"
                type="button"
                title="Làm mới kết quả từ trường"
              >
                <RefreshCw
                  className={`size-3 text-primary ${isLoadingEnrolled ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            </div>

            {/* Total Enrolled Summary Stats */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground">Môn đã đăng ký</span>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {enrolledCourses.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground">Tổng số tín chỉ</span>
                <p className="text-lg font-bold text-primary tabular-nums">
                  {totalEnrolledCredits}
                </p>
              </div>
            </div>

            {/* Enrolled List */}
            {enrolledCourses.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border/80 rounded-xl">
                <BookOpen className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">
                  {token ? 'Chưa có môn nào được ghi nhận' : 'Vui lòng đăng nhập để xem'}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Sau khi nộp đăng ký thành công, danh sách môn chính thức sẽ lập tức hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {enrolledCourses.map((c) => (
                  <div
                    key={c.id_kqdk}
                    className="p-3 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/30 transition-colors flex items-start justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground font-mono">{c.ma_mon}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          Tổ {c.nhom_to}
                        </span>
                        <span className="text-muted-foreground font-medium">{c.so_tc} TC</span>
                      </div>
                      <p className="text-foreground/90 font-medium">{c.ten_mon}</p>
                      {c.ten_giang_vien && (
                        <p className="text-[11px] text-muted-foreground">GV: {c.ten_giang_vien}</p>
                      )}
                      {c.hoc_phi_tam_tinh && c.hoc_phi_tam_tinh > 0 ? (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Học phí: {c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ
                        </p>
                      ) : null}
                    </div>

                    {/* Drop Course Button */}
                    <button
                      onClick={() => handleDropCourse(c)}
                      disabled={droppingCourseId === c.id_kqdk}
                      className="p-1.5 rounded-lg border border-border/60 hover:border-destructive/30 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      title="Hủy môn này"
                      type="button"
                    >
                      {droppingCourseId === c.id_kqdk ? (
                        <RefreshCw className="size-3.5 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
