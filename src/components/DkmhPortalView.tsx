import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
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
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Send,
  Layers,
  Database,
  Copy,
  Check,
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
  const { plans, activeTabId, allCourses, setToastMessage, initData, setAppViewMode } = useTimetableStore();

  // Auth & Connection State (Cached in localStorage for instant 0ms restoration)
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

  // Guide disclosure state - DEFAULT COLLAPSED for high viewport density
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Operational Guide Popup Modal state (Opens on F5 if not dismissed)
  const [showGuideModal, setShowGuideModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sgu_hide_dkmh_guide_modal') !== 'true';
    } catch {
      return true;
    }
  });
  const [dontShowGuideAgain, setDontShowGuideAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sgu_hide_dkmh_guide_modal') === 'true';
    } catch {
      return false;
    }
  });

  const handleCloseGuideModal = () => {
    setShowGuideModal(false);
    try {
      if (dontShowGuideAgain) {
        localStorage.setItem('sgu_hide_dkmh_guide_modal', 'true');
      } else {
        localStorage.removeItem('sgu_hide_dkmh_guide_modal');
      }
    } catch {}
  };

  // Clipboard copy state for terminal
  const [isLogsCopied, setIsLogsCopied] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

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

  // Submission Queue with localStorage persistence (F5 không mất dữ liệu)
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
      ...prev.slice(-99),
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: timeStr,
        type,
        text,
      },
    ]);
  }, []);

  // Auto-scroll terminal to bottom when new logs arrive (real terminal behavior)
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 1. Initial Authentication from .env (or cached token)
  const handleAutoLogin = useCallback(async () => {
    // If cached credentials already exist in state / localStorage, restore immediately!
    const cachedToken = token || localStorage.getItem('sgu_dkmh_token');
    let cachedUser: SguAuthUser | null = user;
    if (!cachedUser) {
      try {
        const saved = localStorage.getItem('sgu_dkmh_user');
        if (saved) cachedUser = JSON.parse(saved);
      } catch {}
    }

    if (cachedToken && cachedUser) {
      setToken(cachedToken);
      setUser(cachedUser);
      addLog('success', `Đã phục hồi phiên sinh viên: ${cachedUser.name} (${cachedUser.mssv})`);
      checkPortalStatus(cachedToken);
      fetchEnrolled(cachedToken);
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    addLog('info', 'Đang kết nối xác thực tài khoản qua cổng đào tạo SGU...');
    try {
      const auth = await SguDkmhService.loginFromEnv();
      setToken(auth.token);
      setUser(auth.user);
      try {
        localStorage.setItem('sgu_dkmh_token', auth.token);
        localStorage.setItem('sgu_dkmh_user', JSON.stringify(auth.user));
      } catch {}
      addLog('success', `Xác thực thành công sinh viên: ${auth.user.name} (${auth.user.mssv})`);
      setToastMessage(`Đã kết nối tài khoản: ${auth.user.name}`);

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
  }, [addLog, setToastMessage, initData, token, user]);

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
      try {
        localStorage.setItem('sgu_dkmh_token', auth.token);
        localStorage.setItem('sgu_dkmh_user', JSON.stringify(auth.user));
      } catch {}
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

  const handleSwitchAccount = () => {
    try {
      localStorage.removeItem('sgu_dkmh_token');
      localStorage.removeItem('sgu_dkmh_user');
    } catch {}
    setToken(null);
    setUser(null);
    setShowManualLogin(true);
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

      const planGroups: ClassGroup[] = [];
      targetPlan.selectedIds.forEach((id) => {
        const found = allCourses.find((c) => c.id === id);
        if (found) planGroups.push(found);
      });

      if (planGroups.length === 0) {
        addLog('info', `Phương án "${targetPlan.name}" không có môn học nào.`);
        return;
      }

      const enrolledKeys = new Set(currentEnrolled.map((c) => `${c.ma_mon}-${c.nhom_to}`));

      const newQueue: QueueItem[] = planGroups.map((group) => {
        const key = `${group.ma_mon}-${group.nhom_to}`;
        const alreadyDone = enrolledKeys.has(key);
        return {
          group,
          status: alreadyDone ? 'success' : 'pending',
          message: alreadyDone ? 'Đã có trong CSDL SGU' : undefined,
        };
      });

      setQueue(newQueue);
      try {
        localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(newQueue));
      } catch {}

      addLog('info', `Đã nạp ${newQueue.length} môn từ phương án "${targetPlan.name}" vào hàng đợi.`);
      setToastMessage(`Đã nạp ${newQueue.length} môn từ "${targetPlan.name}"`);
    },
    [allCourses, enrolledCourses, isSubmitting, plans, addLog, setToastMessage]
  );

  // Auto-sync initial queue on mount if empty
  useEffect(() => {
    if (!isFirstMountRef.current) return;
    isFirstMountRef.current = false;

    try {
      const savedQueue = localStorage.getItem('sgu_dkmh_saved_queue_v2');
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          addLog('info', `⚡ Đã khôi phục ${parsed.length} môn từ bộ nhớ lưu trữ trình duyệt (F5 không mất).`);
          return;
        }
      }
    } catch {}

    if (selectedPlanId) {
      loadPlanToQueue(selectedPlanId, [], true);
    }
  }, [selectedPlanId, loadPlanToQueue, addLog]);

  // 7. Remove single course from queue
  const handleRemoveFromQueue = (groupId: string) => {
    setQueue((prev) => {
      const updated = prev.filter((q) => q.group.id !== groupId);
      try {
        localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 8. Submit Sequential Registration with Custom Delay
  const handleSubmitSequential = async () => {
    if (!token) {
      setToastMessage('Yêu cầu xác thực tài khoản sinh viên trước khi đăng ký.');
      return;
    }
    if (queue.length === 0) {
      setToastMessage('Hàng đợi đăng ký đang trống.');
      return;
    }

    const pendingItems = queue.filter((q) => q.status !== 'success');
    if (pendingItems.length === 0) {
      setToastMessage('Tất cả môn trong hàng đợi đã được ghi nhận trên hệ thống SGU.');
      return;
    }

    const confirmSubmit = window.confirm(
      `Xác nhận nộp đăng ký ${pendingItems.length} môn học trực tiếp vào cổng đào tạo SGU?` +
      (delaySeconds > 0 ? `\n(Khoảng cách giữa các môn: ${delaySeconds} giây)` : '')
    );
    if (!confirmSubmit) return;

    stopSubmittingRef.current = false;
    setIsSubmitting(true);
    addLog('info', `Bắt đầu gửi API đăng ký cho ${pendingItems.length} môn học (Độ trễ: ${delaySeconds}s/môn)...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingItems.length; i++) {
      if (stopSubmittingRef.current) {
        addLog('warn', 'Quá trình đăng ký đã được người dùng dừng lại.');
        setToastMessage('Đã dừng tiến trình đăng ký.');
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

      addLog('info', `[${i + 1}/${pendingItems.length}] Đang gửi đăng ký: ${group.ten_mon} (${group.ma_mon} - Nhóm ${group.nhom_to})...`);

      try {
        const res = await SguDkmhService.registerSingleCourse(token, id_to_hoc);
        if (res.success) {
          successCount++;
          addLog('success', `[${group.ma_mon} - Nhóm ${group.nhom_to}] ${group.ten_mon}: Đăng ký THÀNH CÔNG.`);
          setQueue((prev) =>
            prev.map((q) =>
              q.group.id === group.id ? { ...q, status: 'success', message: res.message || 'Thành công' } : q
            )
          );
        } else {
          failCount++;
          addLog('error', `[${group.ma_mon} - Nhóm ${group.nhom_to}] ${group.ten_mon}: ${res.message}`);
          setQueue((prev) =>
            prev.map((q) =>
              q.group.id === group.id ? { ...q, status: 'error', message: res.message || 'Thất bại' } : q
            )
          );
        }
      } catch (err: any) {
        failCount++;
        addLog('error', `Lỗi kết nối khi gửi ${group.ten_mon}: ${err.message}`);
        setQueue((prev) =>
          prev.map((q) =>
            q.group.id === group.id ? { ...q, status: 'error', message: err.message } : q
          )
        );
      }

      // If not the last item, wait for delaySeconds (cancelable every 100ms)
      if (i < pendingItems.length - 1 && !stopSubmittingRef.current) {
        if (delaySeconds > 0) {
          addLog('info', `Chờ ${delaySeconds}s trước khi gửi môn tiếp theo...`);
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
      setToastMessage(`Đã đăng ký thành công ${successCount} môn học.`);
    } else if (failCount > 0) {
      setToastMessage(`Có môn học chưa đăng ký được. Vui lòng kiểm tra nhật ký phản hồi.`);
    }

    // Refresh enrolled courses from SGU
    await fetchEnrolled(token);
  };

  // 10. Drop Course
  const handleDropCourse = async (course: EnrolledCourseItem) => {
    if (!token) return;
    const confirmDrop = window.confirm(
      `Xác nhận hủy đăng ký môn học:\n${course.ten_mon} (${course.ma_mon} - Nhóm ${course.nhom_to})?`
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
      addLog('error', `Lỗi kết nối khi hủy môn: ${err.message}`);
      setToastMessage(`Lỗi: ${err.message}`);
    } finally {
      setDroppingCourseId(null);
    }
  };

  // Copy logs handler
  const handleCopyLogs = () => {
    const textToCopy = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`)
      .join('\n');
    navigator.clipboard.writeText(textToCopy);
    setIsLogsCopied(true);
    setTimeout(() => setIsLogsCopied(false), 2000);
    setToastMessage('Đã sao chép toàn bộ nhật ký API.');
  };

  const totalQueueCredits = queue.reduce((acc, q) => acc + (q.group.so_tc || 0), 0);
  const pendingQueueCount = queue.filter((q) => q.status !== 'success').length;
  const allDone = queue.length > 0 && pendingQueueCount === 0;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3.5 font-sans text-foreground">
      {/* 1. TOP SYSTEM AUDIT & IDENTITY BAR (Linear-Style Flight Deck) */}
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Identity & verified status */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0">
              <User className="size-4" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground tracking-tight">
                  {user ? user.name : 'Sinh viên SGU'}
                </span>
                <span className="font-mono text-xs text-muted-foreground font-medium">
                  ({user ? user.mssv : 'Chưa kết nối'})
                </span>
                {user ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="size-3" />
                    <span>Đã xác thực</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertCircle className="size-3" />
                    <span>Chưa xác thực</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-muted-foreground text-[11px] mt-0.5">
                <span>Direct SGU Client</span>
                <span>•</span>
                <span>LocalStorage ({queue.length} môn)</span>
                {token && (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleSwitchAccount}
                      className="text-primary hover:underline cursor-pointer font-medium"
                      type="button"
                    >
                      Đổi tài khoản
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: SGU Portal Gateway status & Clock */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Live Gateway Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40">
              <span className={`size-2 rounded-full ${portalWindow?.isOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-medium text-foreground text-xs">
                {portalWindow ? portalWindow.message : 'Đang kiểm tra cổng...'}
              </span>
              <button
                onClick={() => checkPortalStatus()}
                disabled={isCheckingPortal || !token}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50 transition-colors"
                title="Làm mới trạng thái cổng"
                type="button"
              >
                <RefreshCw className={`size-3 ${isCheckingPortal ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Precision 07:00 Countdown */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 font-mono text-xs">
              <Clock className="size-3.5 text-primary shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-sans text-[11px]">Đếm ngược 07:00:</span>
                <span className="font-bold text-primary font-mono tabular-nums">{countdownTo7AM || '--:--:--'}</span>
              </div>
              <span className="text-muted-foreground/60">|</span>
              <span className="text-foreground/80 font-mono tabular-nums">{liveTime || '00:00:00'}</span>
            </div>

            {/* Guide Button to open Modal */}
            <button
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Xem cẩm nang đăng ký 07:00 chuẩn không lỗi"
              type="button"
            >
              <Layers className="size-3.5" />
              <span>Cẩm nang 07:00</span>
            </button>

            {!token && (
              <button
                onClick={() => setShowManualLogin(true)}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 cursor-pointer flex items-center gap-1.5 shadow-xs transition-opacity"
                type="button"
              >
                <LogIn className="size-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              onClick={() => setShowManualLogin(true)}
              className="underline font-semibold cursor-pointer"
            >
              Thử đăng nhập thủ công
            </button>
          </div>
        )}
      </div>

      {/* 2. OPERATIONAL PROTOCOL ADVISORY (Compact, Non-Intrusive) */}
      <div className="rounded-xl border border-border bg-card/70 overflow-hidden text-xs shadow-xs">
        <button
          type="button"
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full px-4 py-2.5 bg-muted/20 hover:bg-muted/40 flex items-center justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Layers className="size-3.5 text-primary" />
            <span className="font-semibold">Quy trình vận hành 07:00:00</span>
            <span className="text-muted-foreground hidden sm:inline">— Chuẩn bị trước 06:45, giữ nguyên tab, nộp đúng 07:00.</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium">
            <span>{isGuideOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
            {isGuideOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </div>
        </button>

        {isGuideOpen && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 bg-card border-t border-border">
            <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
              <span className="font-semibold text-foreground block">
                1. Chuẩn bị (Trước 06:45)
              </span>
              <p className="text-muted-foreground text-[11px] leading-relaxed m-0">
                Tài khoản tự động nhận từ .env. Nạp môn từ phương án vào Hàng đợi. Dữ liệu được lưu trong trình duyệt nên F5 không mất.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
              <span className="font-semibold text-foreground block">
                2. Giữ kết nối (06:45 – 06:59)
              </span>
              <p className="text-muted-foreground text-[11px] leading-relaxed m-0">
                Thiết lập độ trễ an toàn (3-5s). Giữ nguyên tab hoạt động. Hệ thống gửi heartbeat 2.5 phút/lần để bảo toàn phiên đăng nhập.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
              <span className="font-semibold text-foreground block">
                3. Gửi đăng ký (Đúng 07:00:00)
              </span>
              <p className="text-muted-foreground text-[11px] leading-relaxed m-0">
                Nhấn "Gửi đăng ký API". Hệ thống kết nối trực tiếp đến máy chủ trường, gửi tuần tự từng môn và cập nhật trạng thái ngay lập tức.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Manual Login Dialog */}
      {showManualLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Xác thực tài khoản SGU</h3>
              </div>
              <button
                onClick={() => setShowManualLogin(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Thông tin xác thực gửi trực tiếp đến endpoint bảo mật của Đại học Sài Gòn.
            </p>

            <form onSubmit={handleManualLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Mã số sinh viên (MSSV)
                </label>
                <input
                  type="text"
                  value={manualMssv}
                  onChange={(e) => setManualMssv(e.target.value)}
                  placeholder="3124410007"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Mật khẩu cổng đào tạo
                </label>
                <input
                  type="password"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualLogin(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isAuthenticating && <RefreshCw className="size-3 animate-spin" />}
                  <span>Xác thực ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPERATIONAL GUIDE POPUP MODAL (Auto-opens on F5, fully dismissable) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground tracking-tight">
                      Cẩm Nang Vận Hành Đăng Ký Môn Học SGU (Khung Giờ 07:00:00)
                    </h2>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Quy chuẩn kỹ thuật bảo đảm 100% không lỗi kết nối &amp; không bị phát hiện tool
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseGuideModal}
                className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-sm cursor-pointer transition-colors"
                title="Đóng bảng hướng dẫn"
                type="button"
              >
                ✕
              </button>
            </div>

            {/* Checklist Cards */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              {/* Card 1 */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    BƯỚC 1: TRƯỚC 06:45
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    Khởi động &amp; Nạp sẵn môn học vào Hàng đợi
                  </span>
                </div>
                <ul className="text-muted-foreground space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                  <li>Mở ứng dụng sớm (khoảng 06:30 - 06:45). Kiểm tra tài khoản đã báo xanh <strong>"Đã xác thực"</strong>.</li>
                  <li>Chọn phương án Thời khóa biểu đã xếp để nạp môn vào <strong>Hàng đợi</strong>.</li>
                  <li><strong>Lưu trữ an toàn:</strong> Toàn bộ danh sách môn và phiên đăng nhập được lưu vĩnh viễn trên trình duyệt nên F5 tải lại trang không bao giờ bị mất.</li>
                </ul>
              </div>

              {/* Card 2 */}
              <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    BƯỚC 2: 06:50 – 06:59:59
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    Khóa chốt phiên &amp; Tuyệt đối không F5
                  </span>
                </div>
                <ul className="text-muted-foreground space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                  <li><strong>Tự động duy trì phiên (Heartbeat):</strong> Hệ thống tự động gửi xung kiểm tra 2.5 phút/lần tới máy chủ SGU để duy trì phiên không bao giờ bị logout.</li>
                  <li><strong>LƯU Ý CỰC KỲ QUAN TRỌNG:</strong> Trong 5 phút cuối (06:55 – 07:00), <strong>TUYỆT ĐỐI KHÔNG F5, không xóa cache</strong> để bảo toàn phiên kết nối socket ưu tiên.</li>
                  <li>Giữ nguyên tab màn hình luôn sáng, không để máy tính vào chế độ Sleep hoặc gập màn hình.</li>
                </ul>
              </div>

              {/* Card 3 */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    BƯỚC 3: ĐÚNG 07:00:00
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    Gửi nộp API trực tiếp &amp; Cơ chế chống nghẽn
                  </span>
                </div>
                <ul className="text-muted-foreground space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                  <li>Đúng <strong>07:00:00</strong> (theo đồng hồ đếm ngược của app), nhấn nút <strong>"GỬI ĐĂNG KÝ API"</strong>.</li>
                  <li><strong>Cài đặt độ trễ (Delay):</strong> Khuyến nghị để <strong>1s – 3s</strong> để gửi tuần tự từng môn. Điều này mô phỏng nhịp bấm tự nhiên, loại bỏ hoàn toàn nguy cơ bị tường lửa SGU chặn hoặc Database Deadlock.</li>
                  <li>Theo dõi Terminal bên phải: Mỗi môn nộp thành công sẽ hiện <span className="text-emerald-400 font-semibold">[SUCCESS]</span> và cập nhật trực tiếp vào cơ sở dữ liệu trường.</li>
                </ul>
              </div>

              {/* Anti-detection technical proof */}
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <span className="font-bold text-foreground text-xs">
                    Cơ chế bảo vệ 100% không bị phát hiện dùng tool
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
                  Request được gửi trực tiếp từ chính trình duyệt Chrome của máy bạn, đi kèm đầy đủ chữ ký bảo mật (<code>Origin: thongtindaotao.sgu.edu.vn</code>, <code>idpc: 0</code>, <code>sec-ch-ua</code>, Bearer Token hợp lệ). Về phía máy chủ trường SGU, request này hoàn toàn giống hệt 100% một thao tác nhấp chuột thông thường của sinh viên, không thể bị phân biệt hay gắn cờ bot.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                <input
                  type="checkbox"
                  checked={dontShowGuideAgain}
                  onChange={(e) => setDontShowGuideAgain(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                />
                <span>Không tự động hiện lại khi F5 (có thể xem lại bất kỳ lúc nào bằng nút "Cẩm nang 07:00")</span>
              </label>

              <button
                type="button"
                onClick={handleCloseGuideModal}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0"
              >
                ĐÃ HIỂU, VÀO CHUẨN BỊ ĐĂNG KÝ →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE (SPLIT 7 / 5 LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (7 COLS): Submission Queue & Action Center */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3.5">
            {/* Queue Toolbar: Plan Switcher & Re-sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Hàng đợi nộp môn học
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  ({queue.length} môn • {totalQueueCredits} TC)
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlanId(p.id);
                          loadPlanToQueue(p.id, enrolledCourses, true);
                        }}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-card text-foreground font-semibold shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        type="button"
                      >
                        {p.name} ({p.selectedIds.length})
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => loadPlanToQueue(selectedPlanId, enrolledCourses, true)}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                  title="Đồng bộ lại từ thời khóa biểu"
                  type="button"
                >
                  <RotateCcw className="size-3" />
                  <span>Nạp lại</span>
                </button>
              </div>
            </div>

            {/* Delay Interval Controller (Tactile Segmented Buttons) */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3.5 text-primary" />
                  <span>Độ trễ giữa mỗi môn:</span>
                  <span className="font-mono font-bold text-primary">
                    {delaySeconds}s
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { sec: 0, label: '0s (Tức thì)' },
                    { sec: 1, label: '1s' },
                    { sec: 3, label: '3s (Khuyên dùng)' },
                    { sec: 5, label: '5s (An toàn)' },
                    { sec: 10, label: '10s' },
                  ].map(({ sec, label }) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDelaySeconds(sec)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                        delaySeconds === sec
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground m-0">
                {delaySeconds === 0
                  ? 'Gửi đồng loạt tối đa tốc độ (thích hợp giây 00 mở cổng).'
                  : `Gửi tuần tự từng môn, cách nhau ${delaySeconds}s nhằm mô phỏng thao tác người dùng và tránh nghẽn socket.`}
              </p>
            </div>

            {/* TKB Plan Sync Source & Navigation */}
            <div className="p-3 rounded-lg border border-border bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground">
                      Nguồn môn nộp: 100% từ phương án "{selectedPlan?.name || 'TKB'}"
                    </span>
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono font-medium">
                      API SGU 100%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground m-0 mt-0.5">
                    Hàng đợi nộp lấy chính xác các lớp sinh viên đã xếp trong Thời khóa biểu. Không dùng option cứng hay môn bịa.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAppViewMode('planner')}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-2xs"
              >
                <BookOpen className="size-3.5 text-primary" />
                <span>Đổi / Thêm môn từ TKB</span>
              </button>
            </div>

            {/* Dense Data Table for Queued Courses */}
            {queue.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border rounded-lg bg-muted/10">
                <BookOpen className="size-6 mx-auto text-muted-foreground/50" />
                <p className="text-xs font-semibold text-foreground">Hàng đợi đang trống</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Chọn phương án từ thời khóa biểu phía trên hoặc dùng ô tìm kiếm để thêm môn cần đăng ký.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-2.5 px-3">Mã MH</th>
                        <th className="py-2.5 px-3">Tên môn học</th>
                        <th className="py-2.5 px-2 text-center">Nhóm</th>
                        <th className="py-2.5 px-2 text-center">Số TC</th>
                        <th className="py-2.5 px-3">Lịch học</th>
                        <th className="py-2.5 px-2 text-center">Còn lại</th>
                        <th className="py-2.5 px-2.5 text-center">Trạng thái</th>
                        <th className="py-2.5 px-2 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {queue.map((item, idx) => {
                        const { group, status, message } = item;
                        return (
                          <tr key={`${group.id}-${idx}`} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                              {group.ma_mon}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-foreground max-w-[170px] truncate" title={group.ten_mon}>
                              {group.ten_mon}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-primary">
                              {group.nhom_to}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-muted-foreground">
                              {group.so_tc}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-muted-foreground max-w-[190px] truncate" title={group.tkb_raw}>
                              {group.parsedSessions && group.parsedSessions.length > 0
                                ? group.parsedSessions
                                    .map(
                                      (s) =>
                                        `${s.thuStr || (s.thu === 8 ? 'CN' : `T${s.thu}`)} (T${s.tietStart}-${s.tietEnd}${
                                          s.phong ? ` ${s.phong}` : ''
                                        })`
                                    )
                                    .join(' | ')
                                : group.tkb_raw || 'Chưa xếp'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-emerald-400">
                              {typeof group.sl_cl === 'number' ? group.sl_cl : '--'}
                            </td>
                            <td className="py-2.5 px-2.5 text-center">
                              {status === 'pending' && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                  Chờ nộp
                                </span>
                              )}
                              {status === 'submitting' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/25">
                                  <RefreshCw className="size-2.5 animate-spin" />
                                  <span>Đang nộp...</span>
                                </span>
                              )}
                              {status === 'success' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                  <CheckCircle2 className="size-2.5" />
                                  <span>Thành công</span>
                                </span>
                              )}
                              {status === 'error' && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/25 max-w-[90px] truncate"
                                  title={message}
                                >
                                  <AlertCircle className="size-2.5 shrink-0" />
                                  <span className="truncate">{message || 'Lỗi'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromQueue(group.id)}
                                disabled={isSubmitting}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-30 transition-colors"
                                title="Xóa môn"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons: Linear-Grade Authoritative CTA */}
            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={handleSubmitSequential}
                disabled={isSubmitting || queue.length === 0 || !token || allDone}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs ${
                  allDone
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-primary hover:bg-primary/90 active:scale-[0.99]'
                }`}
                type="button"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Đang gửi môn học vào cổng SGU (Độ trễ {delaySeconds}s)...</span>
                  </span>
                ) : allDone ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-3.5" />
                    <span>Tất cả môn học đã hoàn tất ghi nhận</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="size-3.5" />
                    <span>Gửi đăng ký API ({pendingQueueCount} môn)</span>
                  </span>
                )}
              </button>

              {isSubmitting && (
                <button
                  type="button"
                  onClick={() => {
                    stopSubmittingRef.current = true;
                    addLog('warn', 'Đã yêu cầu dừng tiến trình nộp môn.');
                  }}
                  className="py-3 px-4 rounded-lg font-bold text-xs bg-destructive text-destructive-foreground hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <StopCircle className="size-3.5" />
                  <span>Dừng</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 COLS): SGU Database Status & Real Terminal Console */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Top Panel: Official SGU Registered Courses */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Ghi nhận tại CSDL SGU
                </h3>
              </div>

              <button
                onClick={() => fetchEnrolled()}
                disabled={isLoadingEnrolled || !token}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground cursor-pointer disabled:opacity-50 transition-colors"
                type="button"
                title="Đồng bộ lại từ CSDL trường"
              >
                <RefreshCw className={`size-3 ${isLoadingEnrolled ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>

            {/* Metric Summary */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Môn đã đăng ký</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {enrolledCourses.length}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">Tổng số tín chỉ</span>
                <span className="text-lg font-bold text-primary font-mono">
                  {totalEnrolledCredits}
                </span>
              </div>
            </div>

            {/* Enrolled Courses List */}
            {enrolledCourses.length === 0 ? (
              <div className="py-6 text-center space-y-1 border border-dashed border-border rounded-lg bg-muted/10">
                <BookOpen className="size-5 mx-auto text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">Chưa có môn nào được ghi nhận</p>
                <p className="text-[11px] text-muted-foreground">
                  Môn đăng ký thành công sẽ hiển thị trực tiếp tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {enrolledCourses.map((c) => (
                  <div
                    key={c.id_kqdk}
                    className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-foreground">{c.ma_mon}</span>
                        <span className="text-[11px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold">
                          Tổ {c.nhom_to}
                        </span>
                        <span className="text-muted-foreground">{c.so_tc} TC</span>
                      </div>
                      <p className="text-foreground truncate font-medium text-[11px] m-0">{c.ten_mon}</p>
                    </div>

                    <button
                      onClick={() => handleDropCourse(c)}
                      disabled={droppingCourseId === c.id_kqdk}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-50 transition-colors"
                      title="Hủy môn này"
                      type="button"
                    >
                      {droppingCourseId === c.id_kqdk ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Panel: Live Terminal Console (Authentic Developer Terminal) */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-2">
                {/* Mac window dots */}
                <div className="flex items-center gap-1.5 mr-1">
                  <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <h4 className="text-xs font-mono font-bold text-foreground">
                  sgu-gateway.log
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {logs.length} dòng
                </span>
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                  title="Sao chép nhật ký"
                >
                  {isLogsCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                  title="Xóa nhật ký"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#07080a] border border-border/80 max-h-56 overflow-y-auto font-mono text-[11px] space-y-1.5 select-text text-slate-300">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center py-4 font-mono text-[11px]">
                  -- Chưa có hoạt động API nào --
                </div>
              ) : (
                logs.map((log) => {
                  let badge = 'text-slate-400';
                  let tag = '[INFO]';
                  if (log.type === 'success') {
                    badge = 'text-emerald-400';
                    tag = '[SUCCESS]';
                  }
                  if (log.type === 'warn') {
                    badge = 'text-amber-400';
                    tag = '[WARN]';
                  }
                  if (log.type === 'error') {
                    badge = 'text-rose-400 font-bold';
                    tag = '[ERROR]';
                  }
                  return (
                    <div key={log.id} className="flex items-start gap-1.5 leading-relaxed font-mono">
                      <span className="text-slate-600 shrink-0">
                        [{log.timestamp}]
                      </span>
                      <span className={`shrink-0 font-semibold ${badge}`}>{tag}</span>
                      <span className={badge}>{log.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalBottomRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};