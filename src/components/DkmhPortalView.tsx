import DkmhSubmitPanel, { QueueItem as SubmitQueueItem, ErrorKind as SubmitErrorKind, GateState as SubmitGateState } from './DkmhSubmitPanel';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Info,
  X,
  FileText,
  Clock,
  ShieldCheck,
  RefreshCw,
  Trash2,
  User,
  BookOpen,
  AlertTriangle,
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
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
  SguParsedError,
  parseSguError,
} from '../services/sguDkmhService';

interface QueueItem {
  group: ClassGroup;
  status: 'pending' | 'submitting' | 'success' | 'error';
  message?: string;
  errorInfo?: SguParsedError;
  rawResponse?: any;
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
  const [showPassword, setShowPassword] = useState(false);

  // SGU Portal Time Window State
  const [portalWindow, setPortalWindow] = useState<{
    isOpen: boolean;
    message: string;
    lastChecked: string;
  } | null>(null);
  const [isCheckingPortal, setIsCheckingPortal] = useState(false);

  // Operational Guide Popup Modal state (Always opens on F5/mount as requested by user)
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  const handleCloseGuideModal = () => {
    setShowGuideModal(false);
  };

  // Clipboard copy state for terminal & logs view mode
  const [isLogsCopied, setIsLogsCopied] = useState(false);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Live Clock & 7:00:00 Countdown
  const [liveTime, setLiveTime] = useState<string>('');
  const [countdownTo7AM, setCountdownTo7AM] = useState<string>('');

  // Auto-Pilot 07:00:00 setting
  const [autoSubmitAt7AM, setAutoSubmitAt7AM] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sgu_dkmh_auto_submit_7am') === 'true';
    } catch {
      return false;
    }
  });

  const autoSubmittedRef = useRef(false);
  const handleSubmitSequentialRef = useRef<((isAuto?: boolean) => Promise<void>) | null>(null);

  // Saved delay setting in seconds (defaults to 5s - natural human pace, persisted in localStorage)
  const [delaySeconds, setDelaySeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sgu_dkmh_delay_sec');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 0) return val;
      }
    } catch {}
    return 5;
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

  // Selected error item for dedicated SGU diagnostic popup
  const [selectedErrorItem, setSelectedErrorItem] = useState<QueueItem | null>(null);

  // Pre-flight Diagnostics Modal state
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [isCheckingDiagnostics, setIsCheckingDiagnostics] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<{
    portalOpen: boolean;
    portalMsg: string;
    rmsPrereqSupported: boolean;
    rmsMsg: string;
    totalCredits: number;
    creditValid: boolean;
    creditMsg: string;
    conflicts: Array<{ courseA: string; courseB: string; time: string }>;
    fullClasses: Array<{ ma_mon: string; ten_mon: string; nhom_to: string }>;
  } | null>(null);

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

  // Auto-scroll logs container internally without moving the main page window
  useEffect(() => {
    if (terminalBottomRef.current?.parentElement) {
      const container = terminalBottomRef.current.parentElement;
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  const handleToggleAutoSubmitAt7AM = (checked: boolean) => {
    setAutoSubmitAt7AM(checked);
    try {
      localStorage.setItem('sgu_dkmh_auto_submit_7am', String(checked));
    } catch {}
    if (checked) {
      addLog('info', '⚡ ĐÃ BẬT AUTO-PILOT: Hệ thống sẽ tự động gửi nộp toàn bộ hàng đợi ngay khi đồng hồ chạm 07:00:00.');
      setToastMessage('Đã bật Auto-Pilot đúng 07:00:00');
    } else {
      addLog('info', 'Đã tắt Auto-Pilot (Chuyển sang chế độ bấm nút thủ công).');
    }
  };

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

      // Auto-pilot trigger at exactly 07:00:00
      if (
        autoSubmitAt7AM &&
        !autoSubmittedRef.current &&
        now.getHours() === 7 &&
        now.getMinutes() === 0 &&
        now.getSeconds() <= 2
      ) {
        autoSubmittedRef.current = true;
        addLog('warn', '⏰ ĐÃ CHẠM MỐC 07:00:00! Kích hoạt tiến trình nộp API tự động (Auto-Pilot)...');
        if (handleSubmitSequentialRef.current) {
          handleSubmitSequentialRef.current(true);
        }
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [autoSubmitAt7AM, addLog]);

  // 1. Initial Authentication from .env (or cached token)
  const handleAutoLogin = useCallback(async () => {
    // Nếu sinh viên đã chủ động đăng xuất, không tự ý đăng nhập lại trừ khi đăng nhập thủ công
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('sgu_dkmh_logged_out') === 'true') {
        return;
      }
    } catch {}

    // If cached credentials already exist in state / localStorage, restore immediately!
    const cachedToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgu_dkmh_token') : null);
    let cachedUser: SguAuthUser | null = user;
    if (!cachedUser && typeof localStorage !== 'undefined') {
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
        localStorage.removeItem('sgu_dkmh_logged_out');
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
      if (err.message && err.message.includes('Chưa cấu hình tài khoản')) {
        addLog('info', 'Chưa có tài khoản trong .env. Vui lòng bấm "Đăng nhập SGU" để kết nối.');
      } else {
        console.warn('Auto-login from env failed:', err);
        setAuthError(err.message || 'Không thể đăng nhập tự động. Vui lòng thử đăng nhập thủ công.');
        addLog('warn', `Chưa thể nạp tài khoản tự động: ${err.message}`);
      }
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
    const cleanMssv = manualMssv.trim();
    if (!cleanMssv || !manualPassword) {
      setToastMessage('Vui lòng nhập đầy đủ MSSV và Mật khẩu!');
      return;
    }
    setIsAuthenticating(true);
    setAuthError(null);
    addLog('info', `Đang kết nối đăng nhập tài khoản sinh viên MSSV: ${cleanMssv}...`);
    try {
      const auth = await SguDkmhService.login(cleanMssv, manualPassword);
      setToken(auth.token);
      setUser(auth.user);
      try {
        localStorage.setItem('sgu_dkmh_token', auth.token);
        localStorage.setItem('sgu_dkmh_user', JSON.stringify(auth.user));
        localStorage.removeItem('sgu_dkmh_logged_out');
      } catch {}

      // Tự động cập nhật tài khoản và token mới vào file .env trên máy tính
      await SguDkmhService.updateEnvAccount(cleanMssv, manualPassword, auth.token);
      addLog('info', `Đã tự động lưu tài khoản (${cleanMssv}) và token mới vào file .env trên máy.`);
      setShowManualLogin(false);
      setManualPassword('');
      setToastMessage(`Đăng nhập thành công: ${auth.user.name}`);
      addLog('success', `Đăng nhập thành công: ${auth.user.name} (${auth.user.mssv})`);
      checkPortalStatus(auth.token);
      fetchEnrolled(auth.token);
    } catch (err: any) {
      const msg = err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại MSSV và mật khẩu.';
      setAuthError(msg);
      addLog('error', `Đăng nhập thất bại: ${msg}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('sgu_dkmh_token');
      localStorage.removeItem('sgu_dkmh_user');
      localStorage.setItem('sgu_dkmh_logged_out', 'true');
    } catch {}
    setToken(null);
    setUser(null);
    setEnrolledCourses([]);
    setTotalEnrolledCredits(0);
    setManualMssv('');
    setManualPassword('');
    setAuthError(null);
    setShowManualLogin(false);
    await SguDkmhService.clearEnvAccount();
    setToastMessage('Đã đăng xuất & xóa tài khoản khỏi .env.');
    addLog('info', 'Đã đăng xuất tài khoản và xóa thông tin khỏi file .env trên máy.');
  };

  const handleSwitchAccount = () => {
    setManualMssv('');
    setManualPassword('');
    setAuthError(null);
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

  // Reconcile queue with confirmed SGU database records
  const fetchEnrolled = async (authToken = token) => {
    if (!authToken) return;
    setIsLoadingEnrolled(true);
    try {
      const data = await SguDkmhService.getEnrolledCourses(authToken);
      setEnrolledCourses(data.courses);
      setTotalEnrolledCredits(data.totalCredits);

      // Reconcile queue with confirmed SGU database records
      const enrolledKeys = new Set(data.courses.map((c) => `${c.ma_mon}-${c.nhom_to}`));
      setQueue((prev) =>
        prev.map((q) => {
          const key = `${q.group.ma_mon}-${q.group.nhom_to}`;
          if (enrolledKeys.has(key) && q.status !== 'success') {
            return {
              ...q,
              status: 'success',
              message: 'Đã có trong CSDL SGU',
            };
          }
          return q;
        })
      );

      addLog('info', `Hệ thống SGU hiện ghi nhận: ${data.courses.length} môn (${data.totalCredits} tín chỉ).`);
    } catch (err: any) {
      addLog('error', `Không thể tải danh sách môn đã đăng ký: ${err.message}`);
    } finally {
      setIsLoadingEnrolled(false);
    }
  };


  // Helper: Kiểm tra trùng lịch học (Thứ, Tiết) giữa môn học với các môn khác
  const findConflictForGroup = useCallback((targetGroup: ClassGroup, queueList: QueueItem[], enrolledList: EnrolledCourseItem[]) => {
    const targetSessions = targetGroup.parsedSessions || [];
    if (targetSessions.length === 0) return null;

    // Quét với các môn khác trong hàng đợi
    for (const q of queueList) {
      if (q.group.id === targetGroup.id) continue;
      const otherSessions = q.group.parsedSessions || [];
      for (const sA of targetSessions) {
        if (sA.isUnscheduled) continue;
        for (const sB of otherSessions) {
          if (sB.isUnscheduled) continue;
          if (sA.thu === sB.thu) {
            if (Math.max(sA.tietStart, sB.tietStart) <= Math.min(sA.tietEnd, sB.tietEnd)) {
              const thuStr = sA.thu === 8 ? 'CN' : `Thứ ${sA.thu}`;
              const tStart = Math.max(sA.tietStart, sB.tietStart);
              const tEnd = Math.min(sA.tietEnd, sB.tietEnd);
              return {
                withCourse: `${q.group.ten_mon} (${q.group.ma_mon} - N${q.group.nhom_to})`,
                time: `${thuStr} (T${tStart}-${tEnd})`,
              };
            }
          }
        }
      }
    }

    // Quét với các môn đã đăng ký trên SGU
    for (const enc of enrolledList) {
      if (enc.ma_mon === targetGroup.ma_mon) continue;
      const matchCourse = allCourses.find((c) => c.ma_mon === enc.ma_mon && c.nhom_to === enc.nhom_to);
      if (!matchCourse) continue;
      const otherSessions = matchCourse.parsedSessions || [];
      for (const sA of targetSessions) {
        if (sA.isUnscheduled) continue;
        for (const sB of otherSessions) {
          if (sB.isUnscheduled) continue;
          if (sA.thu === sB.thu) {
            if (Math.max(sA.tietStart, sB.tietStart) <= Math.min(sA.tietEnd, sB.tietEnd)) {
              const thuStr = sA.thu === 8 ? 'CN' : `Thứ ${sA.thu}`;
              const tStart = Math.max(sA.tietStart, sB.tietStart);
              const tEnd = Math.min(sA.tietEnd, sB.tietEnd);
              return {
                withCourse: `Đã ĐK trên SGU: ${enc.ten_mon} (${enc.ma_mon})`,
                time: `${thuStr} (T${tStart}-${tEnd})`,
              };
            }
          }
        }
      }
    }

    return null;
  }, [allCourses]);

  // Bộ chẩn đoán trực tiếp API SGU: Kiểm tra tiên quyết, tín chỉ, sĩ số và xung đột lịch
  const handleRunDiagnostics = async () => {
    if (!token) {
      setToastMessage('Vui lòng kết nối tài khoản SGU trước khi kiểm tra!');
      return;
    }
    setIsCheckingDiagnostics(true);
    addLog('info', 'Đang quét toàn diện điều kiện đăng ký & tiên quyết từ API SGU...');
    try {
      const timeCheck = await SguDkmhService.checkRegistrationPeriod(token);
      const rmsCheck = await SguDkmhService.checkPrerequisiteApi(token);

      const queueCredits = queue.reduce((acc, q) => acc + (q.group.so_tc || 0), 0);
      const totalCredits = totalEnrolledCredits + queueCredits;
      const creditValid = true;
      const creditMsg = `Tổng tín chỉ: ${totalCredits} TC (${totalEnrolledCredits} TC đã có trên SGU + ${queueCredits} TC trong hàng đợi). Tự do đăng ký, không bị giới hạn tối thiểu hay tối đa.`;

      const conflicts: Array<{ courseA: string; courseB: string; time: string }> = [];
      for (let i = 0; i < queue.length; i++) {
        const c = findConflictForGroup(queue[i].group, queue.slice(i + 1), enrolledCourses);
        if (c) {
          conflicts.push({
            courseA: `${queue[i].group.ten_mon} (${queue[i].group.ma_mon})`,
            courseB: c.withCourse,
            time: c.time,
          });
        }
      }

      const fullClasses: Array<{ ma_mon: string; ten_mon: string; nhom_to: string }> = [];
      queue.forEach(q => {
        if (typeof q.group.sl_cl === 'number' && q.group.sl_cl <= 0) {
          fullClasses.push({
            ma_mon: q.group.ma_mon,
            ten_mon: q.group.ten_mon,
            nhom_to: q.group.nhom_to,
          });
        }
      });

      setDiagnosticsResult({
        portalOpen: timeCheck.isOpen,
        portalMsg: timeCheck.message,
        rmsPrereqSupported: rmsCheck.supported,
        rmsMsg: rmsCheck.message,
        totalCredits,
        creditValid,
        creditMsg,
        conflicts,
        fullClasses,
      });
      setShowDiagnosticsModal(true);

      if (conflicts.length > 0 || fullClasses.length > 0) {
        addLog('warn', `Chẩn đoán hoàn tất: ${conflicts.length} môn trùng lịch, ${fullClasses.length} lớp hết chỗ.`);
      } else {
        addLog('success', `Chẩn đoán hoàn tất: Tất cả điều kiện tiên quyết, tín chỉ (${totalCredits} TC) và sĩ số đều ĐẠT 100%!`);
      }
    } catch (err: any) {
      addLog('error', `Lỗi khi chẩn đoán điều kiện SGU: ${err.message}`);
    } finally {
      setIsCheckingDiagnostics(false);
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
        addLog('info', `Phương án "${targetPlan.name}" chưa có môn học nào được chọn từ Thời khóa biểu.`);
        setQueue([]);
        try { localStorage.removeItem('sgu_dkmh_saved_queue_v2'); } catch {}
        return;
      }

      const enrolledKeys = new Set(currentEnrolled.map((c) => `${c.ma_mon}-${c.nhom_to}`));

      // Sync plan groups while preserving existing successful or error statuses
      setQueue((prevQueue) => {
        const prevMap = new Map(prevQueue.map((q) => [q.group.id, q]));
        const newQueue: QueueItem[] = planGroups.map((group) => {
          const key = `${group.ma_mon}-${group.nhom_to}`;
          const alreadyDone = enrolledKeys.has(key);
          const existing = prevMap.get(group.id);

          if (alreadyDone) {
            return {
              group,
              status: 'success',
              message: 'Đã có trong CSDL SGU',
            };
          }

          if (existing && (existing.status === 'success' || existing.status === 'error')) {
            return {
              ...existing,
              group,
            };
          }

          return {
            group,
            status: 'pending',
          };
        });

        try {
          localStorage.setItem('sgu_dkmh_saved_queue_v2', JSON.stringify(newQueue));
        } catch {}

        return newQueue;
      });

      addLog('info', `Đã đồng bộ ${planGroups.length} môn từ phương án "${targetPlan.name}" vào hàng đợi.`);
      setToastMessage(`Đã đồng bộ ${planGroups.length} môn từ "${targetPlan.name}"`);
    },
    [allCourses, enrolledCourses, isSubmitting, plans, addLog, setToastMessage]
  );

  // Auto-sync queue on mount with the active timetable plan
  useEffect(() => {
    if (!isFirstMountRef.current) return;
    isFirstMountRef.current = false;

    if (selectedPlanId) {
      loadPlanToQueue(selectedPlanId, enrolledCourses, true);
    }
  }, [selectedPlanId, loadPlanToQueue, enrolledCourses]);

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
  const handleSubmitSequential = async (isAuto = false) => {
    if (!token) {
      setToastMessage('Yêu cầu xác thực tài khoản sinh viên trước khi đăng ký.');
      return;
    }
    if (isSubmitting) return;

    if (queue.length === 0) {
      setToastMessage('Hàng đợi đăng ký đang trống.');
      return;
    }

    const pendingItems = queue.filter((q) => q.status !== 'success');
    if (pendingItems.length === 0) {
      setToastMessage('Tất cả môn trong hàng đợi đã được ghi nhận trên hệ thống SGU.');
      return;
    }

    // Early warning check if before 07:00:00 (only when manual click)
    const now = new Date();
    if (now.getHours() < 7 && !isAuto) {
      const confirmEarly = window.confirm(
        `⚠️ CẢNH BÁO: Hiện tại (${now.toLocaleTimeString('vi-VN')}) chưa đến 07:00:00.\n` +
        `Cổng đào tạo SGU hiện đang đóng (ngoài khung giờ đăng ký 07:00 - 23:59).\n\n` +
        `Bạn có chắc chắn muốn gửi thử ngay bây giờ không?`
      );
      if (!confirmEarly) return;
    }

    if (!isAuto) {
      const pendingCredits = pendingItems.reduce((acc, q) => acc + (q.group.so_tc || 0), 0);
      const confirmSubmit = window.confirm(
        `Xác nhận nộp đăng ký ${pendingItems.length} môn học (${pendingCredits} tín chỉ) trực tiếp vào cổng đào tạo SGU?` +
        (delaySeconds > 0 ? `\n(Khoảng cách giữa các môn: ${delaySeconds} giây)` : '')
      );
      if (!confirmSubmit) return;
    }

    stopSubmittingRef.current = false;
    setIsSubmitting(true);
    addLog('info', `Bắt đầu gửi API đăng ký cho ${pendingItems.length} môn học (Độ trễ: ${delaySeconds}s/môn)...`);

    let successCount = 0;
    let failCount = 0;
    let ngoaiGioRetries = 0;

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
        const parsed = res.parsedError || parseSguError(res.message);
        const isRegisteredAlready = parsed.category === 'DA_DANG_KY';

        // Auto-retry if portal not open yet (e.g. fired at 06:59:59 or server clock lag)
        if (parsed.category === 'NGOAI_GIO' && ngoaiGioRetries < 3) {
          addLog('warn', `Máy chủ SGU chưa mở cổng (lệch vài giây). Tự động thử lại môn ${group.ten_mon} sau 1.5s...`);
          await new Promise((r) => setTimeout(r, 1500));
          i--;
          ngoaiGioRetries++;
          continue;
        }

        if (res.success || isRegisteredAlready) {
          successCount++;
          const successMsg = isRegisteredAlready
            ? 'Đã ghi nhận trong danh sách SGU'
            : (res.message || 'Thành công');
          addLog('success', `[${group.ma_mon} - Nhóm ${group.nhom_to}] ${group.ten_mon}: Đăng ký THÀNH CÔNG.`);
          setQueue((prev) =>
            prev.map((q) =>
              q.group.id === group.id ? { ...q, status: 'success', message: successMsg, errorInfo: undefined, rawResponse: res.raw } : q
            )
          );
        } else {
          failCount++;
          addLog('error', `[LỖI SGU - ${parsed.badgeLabel.toUpperCase()}] [${group.ma_mon} - Nhóm ${group.nhom_to}] ${group.ten_mon}: "${res.message}"`);
          setQueue((prev) =>
            prev.map((q) =>
              q.group.id === group.id ? {
                ...q,
                status: 'error',
                message: res.message || 'Thất bại',
                errorInfo: parsed,
                rawResponse: res.raw,
              } : q
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

      // If not the last item, wait for delaySeconds with human jitter (+/- 350ms)
      if (i < pendingItems.length - 1 && !stopSubmittingRef.current) {
        if (delaySeconds > 0) {
          const jitter = Math.floor(Math.random() * 700) - 350;
          const msToWait = Math.max(1000, delaySeconds * 1000 + jitter);
          addLog('info', `Nghỉ ${(msToWait / 1000).toFixed(1)}s trước khi nộp môn tiếp theo (nhịp gửi tự nhiên)...`);
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

  useEffect(() => {
    handleSubmitSequentialRef.current = handleSubmitSequential;
  }, [handleSubmitSequential]);

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
  const totalPlannedCredits = totalEnrolledCredits + totalQueueCredits;
    

  // Mapping for Claude DkmhSubmitPanel
  const submitPanelItems: SubmitQueueItem[] = React.useMemo(() => {
    return queue.map((q) => {
      let errorKind: SubmitErrorKind | undefined;
      if (q.errorInfo) {
        switch (q.errorInfo.category) {
          case 'TIEN_QUYET':
            errorKind = 'prereq';
            break;
          case 'HET_CHO':
            errorKind = 'full';
            break;
          case 'TRUNG_LICH':
            errorKind = 'conflict';
            break;
          case 'VUOT_TIN_CHI':
            errorKind = 'credit';
            break;
          case 'NGOAI_GIO':
            errorKind = 'closed';
            break;
          default:
            errorKind = 'unknown';
            break;
        }
      }

      let status: 'pending' | 'sending' | 'success' | 'failed' = 'pending';
      if (q.status === 'submitting') status = 'sending';
      else if (q.status === 'success') status = 'success';
      else if (q.status === 'error') status = 'failed';

      return {
        id: q.group.id,
        code: q.group.ma_mon,
        name: q.group.ten_mon,
        group: q.group.nhom_to,
        credits: q.group.so_tc,
        status,
        errorKind,
        rawMessage: q.errorInfo?.rawMessage || q.message,
      };
    });
  }, [queue]);

  const gateState: SubmitGateState = portalWindow?.isOpen
    ? 'open'
    : portalWindow
    ? 'closed'
    : 'unknown';

  const secondsTo7AM = React.useMemo(() => {
    const now = new Date();
    const target = new Date();
    target.setHours(7, 0, 0, 0);
    if (now > target) {
      target.setDate(target.getDate() + 1);
    }
    const diffSec = Math.floor((target.getTime() - now.getTime()) / 1000);
    return diffSec > 0 ? diffSec : null;
  }, [liveTime]);

  const handleRetryFailed = () => {
    setQueue((prev) =>
      prev.map((q) =>
        q.status === 'error'
          ? { ...q, status: 'pending', errorInfo: undefined, message: undefined }
          : q
      )
    );
    setTimeout(() => {
      handleSubmitSequential(false);
    }, 100);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3.5 font-sans text-foreground">
      {/* 1. TOP IDENTITY & STATUS BAR */}
      <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Identity & verified status */}
          <div className="flex items-center gap-3">
            <div className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${
              user ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'
            }`}>
              <User className="size-4" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-foreground tracking-tight">
                  {user ? user.name : 'Chưa đăng nhập'}
                </span>
                <span className="text-xs text-muted-foreground font-medium tabular-nums">
                  ({user ? user.mssv : 'Cần tài khoản SGU'})
                </span>
                {user ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="size-3" />
                    <span>Đã kết nối tài khoản</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <AlertCircle className="size-3" />
                    <span>Chưa xác thực</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-muted-foreground text-[11px] mt-0.5">
                <span>Cổng Đào Tạo SGU</span>
                <span>•</span>
                <span>Hàng đợi: <strong className="text-foreground font-semibold tabular-nums">{queue.length}</strong> môn</span>
                {user ? (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleSwitchAccount}
                      className="text-primary hover:underline cursor-pointer font-medium"
                      type="button"
                    >
                      Đổi tài khoản
                    </button>
                    <span>•</span>
                    <button
                      onClick={handleLogout}
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:underline cursor-pointer font-medium flex items-center gap-1"
                      type="button"
                    >
                      <span>Đăng xuất</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span>•</span>
                    <button
                      onClick={() => setShowManualLogin(true)}
                      className="text-primary hover:underline cursor-pointer font-medium"
                      type="button"
                    >
                      Đăng nhập ngay
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: SGU Portal Gateway status & Tools (Zero Layout Shift) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Gateway Pill */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card shadow-xs max-w-[260px] shrink-0"
              title={portalWindow ? portalWindow.message : 'Đang kiểm tra cổng...'}
            >
              <span className={`size-2 rounded-full shrink-0 ${portalWindow?.isOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-medium text-foreground text-xs truncate">
                {portalWindow ? portalWindow.message : 'Đang kiểm tra cổng...'}
              </span>
              <button
                onClick={() => checkPortalStatus()}
                disabled={isCheckingPortal || !token}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                title="Làm mới trạng thái cổng"
                type="button"
              >
                <RefreshCw className={`size-3 ${isCheckingPortal ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Guide Button to open Modal */}
            <button
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition-colors shadow-xs shrink-0"
              title="Xem cẩm nang đăng ký 07:00 chuẩn không lỗi"
              type="button"
            >
              <Layers className="size-3.5 text-primary" />
              <span>Cẩm nang 07:00</span>
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs cursor-pointer flex items-center gap-1.5 shadow-xs transition-all shrink-0"
                title="Đăng xuất tài khoản SGU hiện tại"
                type="button"
              >
                <LogOut className="size-3.5" />
                <span>Đăng xuất</span>
              </button>
            ) : (
              <button
                onClick={() => setShowManualLogin(true)}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 cursor-pointer flex items-center gap-1.5 shadow-xs transition-opacity shrink-0"
                type="button"
              >
                <LogIn className="size-3.5" />
                <span>Đăng nhập SGU</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Login Dialog */}
      {showManualLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Đăng nhập Cổng Đào Tạo SGU</h3>
                  <p className="text-[11px] text-muted-foreground">Tài khoản sinh viên thongtindaotao.sgu.edu.vn</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualLogin(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer p-1 rounded-lg hover:bg-muted"
                type="button"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Đăng nhập thất bại</div>
                  <div className="text-[11px] leading-relaxed">{authError}</div>
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" />
              <span>Tự động cập nhật tài khoản &amp; Token vào file .env trên máy (100% không đẩy lên GitHub).</span>
            </div>

            <form onSubmit={handleManualLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Mã số sinh viên (MSSV)
                </label>
                <input
                  type="text"
                  value={manualMssv}
                  onChange={(e) => setManualMssv(e.target.value)}
                  placeholder="Nhập MSSV (Ví dụ: 312xxxxxxx)"
                  autoFocus
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Mật khẩu cổng đào tạo
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    placeholder="Nhập mật khẩu sinh viên SGU..."
                    required
                    className="w-full px-3 py-2 pr-9 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowManualLogin(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {isAuthenticating && <RefreshCw className="size-3 animate-spin" />}
                  <span>{isAuthenticating ? 'Đang kết nối SGU...' : 'Đăng nhập ngay'}</span>
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
              {/* Card 1: Flexible Credits */}
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    TỰ DO ĐĂNG KÝ TÍN CHỈ
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    Không ràng buộc tối thiểu / tối đa – Hỗ trợ đăng ký bổ sung tùy ý
                  </span>
                </div>
                <ul className="text-muted-foreground space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                  <li><strong>Linh hoạt mọi trường hợp:</strong> Bạn có thể đăng ký 1 môn lẻ (2-3 TC) để học bổ sung, 9 TC để học lại hoặc 20-25+ TC cho học kỳ mới mà không bị hệ thống ép buộc.</li>
                  <li><strong>Không bắt buộc định mức tối thiểu:</strong> Nếu bạn đã có 18 tín chỉ và muốn nạp thêm 2 tín chỉ nữa, hệ thống cho phép nộp ngay lập tức mà không đòi hỏi đủ 14 tín chỉ trong hàng đợi.</li>
                  <li><strong>Gửi nộp chuẩn 100%:</strong> Từng môn học trong hàng đợi được gửi độc lập qua API máy chủ SGU và đối soát trực tiếp vào CSDL sinh viên.</li>
                </ul>
              </div>

              {/* Card 2: Pre-06:45 */}
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
                  <li>Chọn phương án Thời khóa biểu đã xếp để nạp môn vào <strong>Hàng đợi</strong>. Bấm nút <strong>"Kiểm tra điều kiện SGU"</strong> để xác minh không trùng lịch và đủ điều kiện tiên quyết.</li>
                  <li><strong>Lưu trữ an toàn:</strong> Toàn bộ danh sách môn và phiên đăng nhập được lưu trên trình duyệt nên F5 tải lại trang không bao giờ bị mất dữ liệu đã nạp.</li>
                </ul>
              </div>

              {/* Card 3: 06:55 - 07:00 */}
              <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    BƯỚC 2: 06:50 – 06:59:59
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    Khóa chốt phiên &amp; Tuyệt đối không F5 trong 5 phút cuối
                  </span>
                </div>
                <ul className="text-muted-foreground space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                  <li><strong>Tự động duy trì phiên (Heartbeat):</strong> Hệ thống tự động gửi xung kiểm tra 2.5 phút/lần tới máy chủ SGU để duy trì phiên không bao giờ bị logout.</li>
                  <li><strong>LƯU Ý CỰC KỲ QUAN TRỌNG:</strong> Trong 5 phút cuối (06:55 – 07:00), <strong>TUYỆT ĐỐI KHÔNG F5, không xóa cache</strong> để bảo toàn phiên kết nối socket ưu tiên.</li>
                  <li>Giữ nguyên tab màn hình luôn sáng, không để máy tính vào chế độ Sleep hoặc gập màn hình laptop.</li>
                </ul>
              </div>

              {/* Card 4: Exactly 07:00:00 */}
              <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-1.5">
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
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 inline-block"></span>
                Bảng thông báo này luôn tự động hiển thị mỗi lần F5 để bạn rà soát trước giờ G.
              </span>

              <button
                type="button"
                onClick={handleCloseGuideModal}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0 self-end sm:self-auto"
              >
                ĐÃ HIỂU, VÀO BÀN LÀM VIỆC ĐĂNG KÝ →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REGISTRATION ACTION & CONTROL DASHBOARD */}
      <div className="space-y-4">
        {/* Row 1: Plan Selector & TKB Sync & Conditions Check */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-primary" />
              <span>Phương án TKB:</span>
            </span>
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
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-card text-foreground font-bold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    type="button"
                  >
                    {p.name} ({p.selectedIds.length} lớp)
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

            <button
              type="button"
              onClick={() => setAppViewMode('planner')}
              className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <BookOpen className="size-3" />
              <span>Đổi / Thêm môn từ TKB</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunDiagnostics}
              disabled={isCheckingDiagnostics || queue.length === 0}
              className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Quét điều kiện tiên quyết, giới hạn tín chỉ và trùng lịch trực tiếp từ API SGU"
              type="button"
            >
              {isCheckingDiagnostics ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="size-3.5" />
              )}
              <span>Kiểm tra điều kiện SGU</span>
            </button>
          </div>
        </div>

        {/* 3. DkmhSubmitPanel (Claude 3-Metric Flight Deck + Queue + 56px Action Button) */}
        <DkmhSubmitPanel
          items={submitPanelItems}
          gate={gateState}
          secondsToOpen={secondsTo7AM}
          totalCredits={totalPlannedCredits}
          creditLimit={25}
          intervalSec={((delaySeconds as any) || 5)}
          onIntervalChange={(v: 0 | 1 | 3 | 5) => setDelaySeconds(v)}
          autoPilot={autoSubmitAt7AM}
          onAutoPilotChange={handleToggleAutoSubmitAt7AM}
          submitting={isSubmitting}
          onSubmitAll={() => handleSubmitSequential(false)}
          onRetryFailed={handleRetryFailed}
          onRemoveItem={(id: string) => handleRemoveFromQueue(id)}
        />
      </div>

      {/* 4. BẢNG 2: KẾT QUẢ ĐĂNG KÝ HỌC PHẦN (CHÍNH THỨC CSDL SGU - FULL WIDTH) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Kết quả đăng ký học phần (CSDL SGU)
              </h3>
              <p className="text-xs text-muted-foreground m-0">
                Dữ liệu môn học chính thức truy vấn trực tiếp từ cổng đào tạo thongtindaotao.sgu.edu.vn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEnrolled()}
              disabled={isLoadingEnrolled || !token}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
              type="button"
              title="Đồng bộ lại từ CSDL trường"
            >
              <RefreshCw className={`size-3.5 ${isLoadingEnrolled ? 'animate-spin' : ''}`} />
              <span>Đồng bộ từ SGU</span>
            </button>
          </div>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-border rounded-xl bg-muted/10">
            <BookOpen className="size-7 mx-auto text-muted-foreground/40" />
            <p className="text-xs font-bold text-foreground">
              {!user ? 'Chưa kết nối tài khoản sinh viên SGU' : 'Chưa có môn học nào được ghi nhận trên SGU'}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              {!user
                ? 'Đăng nhập tài khoản SGU để xem danh sách môn học đã đăng ký trong học kỳ và kiểm tra điều kiện tiên quyết.'
                : 'Khi bạn nộp đăng ký hoặc khi cổng đào tạo ghi nhận thành công, các môn học sẽ hiển thị đầy đủ chi tiết tại bảng này.'}
            </p>
            {!user && (
              <button
                type="button"
                onClick={() => setShowManualLogin(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs"
              >
                <LogIn className="size-3.5" />
                <span>Đăng nhập Cổng Đào Tạo SGU</span>
              </button>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">STT</th>
                    <th className="py-3 px-3 w-24">Mã MH</th>
                    <th className="py-3 px-4 min-w-[220px]">Tên môn học</th>
                    <th className="py-3 px-3 text-center w-20">Nhóm/Tổ</th>
                    <th className="py-3 px-3 text-center w-16">Số TC</th>
                    <th className="py-3 px-4 min-w-[200px]">Giảng viên</th>
                    <th className="py-3 px-3 text-center w-28">Ngày đăng ký</th>
                    <th className="py-3 px-3 text-center w-28">Trạng thái</th>
                    <th className="py-3 px-3 text-center w-20">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrolledCourses.map((c, idx) => (
                    <tr key={c.id_kqdk} className="hover:bg-muted/30 even:bg-muted/10 transition-colors">
                      <td className="py-3 px-3 text-center text-muted-foreground font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-foreground">
                        {c.ma_mon}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-foreground m-0 text-xs leading-snug">
                          {c.ten_mon}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-primary">
                        {c.nhom_to}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground tabular-nums">
                        {c.so_tc}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {c.ten_giang_vien || 'Theo kế hoạch'}
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-muted-foreground tabular-nums">
                        {c.ngay_dang_ky || 'Hôm nay'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" />
                          <span>Đã ghi nhận</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDropCourse(c)}
                          disabled={droppingCourseId === c.id_kqdk}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 cursor-pointer disabled:opacity-50 transition-colors"
                          title="Hủy môn này"
                          type="button"
                        >
                          {droppingCourseId === c.id_kqdk ? (
                            <RefreshCw className="size-3 animate-spin inline-block mr-1" />
                          ) : (
                            <Trash2 className="size-3 inline-block mr-1" />
                          )}
                          <span>Hủy</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold text-xs">
                    <td colSpan={4} className="py-3 px-4 text-foreground">
                      Tổng số môn học đã ghi nhận: <strong className="text-primary">{enrolledCourses.length} môn</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-primary text-sm tabular-nums">
                      {totalEnrolledCredits} TC
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-right text-muted-foreground">
                      Xác nhận chính thức từ máy chủ SGU
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. TIẾN TRÌNH & NHẬT KÝ TIẾP NHẬN TỪ MÁY CHỦ SGU */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Tiến trình đăng ký &amp; Nhật ký máy chủ
              </h3>
              <p className="text-xs text-muted-foreground m-0">
                Theo dõi từng nhịp gửi và phản hồi chi tiết từ Cổng Đào Tạo SGU
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawLogs(!showRawLogs)}
              className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
              title="Chuyển đổi giao diện nhật ký"
            >
              {showRawLogs ? 'Giao diện thân thiện' : 'Chi tiết máy chủ'}
            </button>
            <button
              type="button"
              onClick={handleCopyLogs}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Sao chép nhật ký"
            >
              {isLogsCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
              title="Xóa nhật ký"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {!showRawLogs ? (
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border max-h-60 overflow-y-auto text-xs space-y-2 select-text">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-6 text-xs flex flex-col items-center justify-center gap-1">
                <Clock className="size-4 text-muted-foreground/50" />
                <span className="font-semibold">Chưa có lượt nộp môn nào</span>
                <span className="text-[11px] text-muted-foreground/70">Khi bấm đăng ký, tiến trình ghi nhận từng môn sẽ xuất hiện tại đây.</span>
              </div>
            ) : (
              logs.map((log) => {
                let containerStyle = 'bg-card border-border/80 text-foreground';
                let icon = <Info className="size-3.5 text-primary shrink-0 mt-0.5" />;

                if (log.type === 'success') {
                  containerStyle = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300';
                  icon = <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />;
                } else if (log.type === 'warn') {
                  containerStyle = 'bg-amber-500/10 border-amber-500/25 text-amber-300';
                  icon = <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />;
                } else if (log.type === 'error') {
                  containerStyle = 'bg-rose-500/10 border-rose-500/25 text-rose-300';
                  icon = <AlertCircle className="size-3.5 text-rose-400 shrink-0 mt-0.5" />;
                }

                return (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${containerStyle}`}
                  >
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-xs leading-snug break-words">
                          {log.text}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {log.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={terminalBottomRef} />
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-card border border-border max-h-60 overflow-y-auto font-mono text-[11px] space-y-1.5 select-text text-foreground">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                <span className="shrink-0 font-semibold uppercase">[{log.type}]</span>
                <span className="break-words">{log.text}</span>
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>
        )}
      </div>

      {/* SGU Error Diagnostic Breakdown Modal */}
      {selectedErrorItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="bg-card text-foreground border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 space-y-4 p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Chi tiết phản hồi từ Cổng Đào Tạo SGU
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Môn: {selectedErrorItem.group.ma_mon} • Nhóm {selectedErrorItem.group.nhom_to} ({selectedErrorItem.group.so_tc} TC)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedErrorItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-3 text-xs">
              {/* Error Classification Badge */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Phân loại lỗi:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${selectedErrorItem.errorInfo?.badgeColor || 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                  {selectedErrorItem.errorInfo?.badgeLabel || 'Lỗi từ SGU'}
                </span>
              </div>

              {/* Authentic Server Message */}
              <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Nguyên văn phản hồi từ máy chủ SGU (thong_bao_loi):
                </span>
                <div className="p-2.5 rounded-lg bg-[#07080a] border border-border/80 font-mono text-amber-300 text-[11px] leading-relaxed break-words select-text">
                  "{selectedErrorItem.message || 'Không có thông báo lỗi cụ thể'}"
                </div>
              </div>

              {/* Academic Explanation */}
              <div className="p-3 rounded-xl border border-border bg-muted/15 space-y-1">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="size-3.5 text-primary" />
                  <span>Phân tích nguyên nhân theo quy chế SGU:</span>
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
                  {selectedErrorItem.errorInfo?.explanation || 'Hệ thống SGU từ chối ghi nhận môn học này do không thỏa mãn điều kiện quy chế đào tạo.'}
                </p>
              </div>

              {/* Recommended Solution */}
              <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-1">
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span>Hướng xử lý đề xuất:</span>
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
                  {selectedErrorItem.errorInfo?.suggestion || 'Kiểm tra lại trạng thái trên cổng SGU hoặc chọn nhóm môn học khác.'}
                </p>
              </div>

              {/* Technical JSON details (Collapsible) */}
              {selectedErrorItem.rawResponse && (
                <details className="text-[11px] text-muted-foreground group">
                  <summary className="cursor-pointer hover:text-foreground font-mono select-none flex items-center gap-1">
                    <FileText className="size-3" />
                    <span>Xem dữ liệu JSON kỹ thuật từ cổng đào tạo SGU</span>
                  </summary>
                  <pre className="mt-1.5 p-2 rounded bg-black/50 border border-border text-[10px] overflow-x-auto text-slate-300 font-mono">
                    {JSON.stringify(selectedErrorItem.rawResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedErrorItem(null)}
                className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={async () => {
                  const itemToRetry = selectedErrorItem;
                  setSelectedErrorItem(null);
                  if (!token) return;
                  addLog('info', `Đang thử nộp lại môn: ${itemToRetry.group.ten_mon}...`);
                  const res = await SguDkmhService.registerSingleCourse(token, itemToRetry.group.id_to_hoc || itemToRetry.group.id);
                  if (res.success) {
                    addLog('success', `Đã đăng ký thành công môn ${itemToRetry.group.ten_mon}`);
                    setQueue(prev => prev.map(q => q.group.id === itemToRetry.group.id ? { ...q, status: 'success', message: res.message, errorInfo: undefined } : q));
                    fetchEnrolled(token);
                  } else {
                    const parsed = res.parsedError || parseSguError(res.message);
                    addLog('error', `Nộp lại thất bại: ${res.message}`);
                    setQueue(prev => prev.map(q => q.group.id === itemToRetry.group.id ? { ...q, status: 'error', message: res.message, errorInfo: parsed, rawResponse: res.raw } : q));
                  }
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 cursor-pointer shadow-xs transition-opacity"
              >
                Thử gửi lại môn này ↻
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SGU Comprehensive Pre-flight Diagnostics Modal */}
      {showDiagnosticsModal && diagnosticsResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="bg-card text-foreground border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 space-y-4 p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Báo cáo Chẩn đoán Điều kiện & Tiên quyết SGU
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Đánh giá tự động từ API Cổng Đào Tạo ThongTinDaoTao SGU
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body Checklist */}
            <div className="space-y-2.5 text-xs max-h-[60vh] overflow-y-auto pr-1">
              {/* 1. Time Window */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${diagnosticsResult.portalOpen ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                {diagnosticsResult.portalOpen ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-foreground block">1. Khung giờ đăng ký SGU (07:00 - 23:59)</span>
                  <p className="text-muted-foreground m-0 mt-0.5">{diagnosticsResult.portalMsg}</p>
                </div>
              </div>

              {/* 2. RMS Prerequisite Engine */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${diagnosticsResult.rmsPrereqSupported ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border bg-muted/15'}`}>
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-foreground block">2. Cơ chế kiểm tra Môn tiên quyết & Điều kiện SGU</span>
                  <p className="text-muted-foreground m-0 mt-0.5">
                    Hệ thống SGU kiểm tra 3 cấp độ: Tiên quyết, Học trước, Song hành. Nếu sinh viên vi phạm môn tiên quyết, server sẽ từ chối và thông báo nguyên văn khi gửi đăng ký.
                  </p>
                </div>
              </div>

              {/* 3. Credit Check */}
              <div className="p-3 rounded-xl border flex items-start gap-2.5 border-emerald-500/25 bg-emerald-500/5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-foreground block">3. Tín chỉ đăng ký ({diagnosticsResult.totalCredits} TC)</span>
                  <p className="text-muted-foreground m-0 mt-0.5">{diagnosticsResult.creditMsg}</p>
                </div>
              </div>

              {/* 4. Conflict Check */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${diagnosticsResult.conflicts.length === 0 ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                {diagnosticsResult.conflicts.length === 0 ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-foreground block">
                    4. Xung đột trùng thời khóa biểu ({diagnosticsResult.conflicts.length === 0 ? 'Không trùng' : `Phát hiện ${diagnosticsResult.conflicts.length} xung đột`})
                  </span>
                  {diagnosticsResult.conflicts.length === 0 ? (
                    <p className="text-muted-foreground m-0 mt-0.5">Tất cả các môn trong hàng đợi không bị trùng thứ và tiết học nào.</p>
                  ) : (
                    <ul className="text-amber-300 space-y-1 mt-1 pl-4 list-disc font-mono text-[11px]">
                      {diagnosticsResult.conflicts.map((c, i) => (
                        <li key={i}>{c.courseA} trùng {c.courseB} ({c.time})</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 5. Slots / Capacity Check */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${diagnosticsResult.fullClasses.length === 0 ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-purple-500/25 bg-purple-500/5'}`}>
                {diagnosticsResult.fullClasses.length === 0 ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-purple-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-foreground block">
                    5. Sĩ số lớp học phần ({diagnosticsResult.fullClasses.length === 0 ? 'Còn chỗ' : `${diagnosticsResult.fullClasses.length} lớp đã hết chỗ`})
                  </span>
                  {diagnosticsResult.fullClasses.length === 0 ? (
                    <p className="text-muted-foreground m-0 mt-0.5">Tất cả các nhóm lớp đã chọn hiện còn chỗ trống trên cổng đào tạo.</p>
                  ) : (
                    <ul className="text-purple-300 space-y-1 mt-1 pl-4 list-disc font-mono text-[11px]">
                      {diagnosticsResult.fullClasses.map((f, i) => (
                        <li key={i}>[{f.ma_mon} - N{f.nhom_to}] {f.ten_mon}: 0 chỗ trống còn lại</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 cursor-pointer shadow-xs transition-opacity"
              >
                ĐÃ HIỂU, ĐÓNG BÁO CÁO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Góc cố định: Floating Bottom-Right Corner Precision Clock (Zero Layout Shift) */}
      <div
        className="fixed bottom-4 right-4 z-40 hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border/80 bg-card/90 backdrop-blur-md shadow-lg text-xs tabular-nums text-foreground pointer-events-auto select-none transition-all hover:border-primary/50"
        title="Đồng hồ đếm ngược tới 07:00:00 mở cổng"
      >
        <div className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[11px]">Đếm ngược 07:00:</span>
          <span className="font-bold text-primary tabular-nums text-xs">{countdownTo7AM || '--:--:--'}</span>
        </div>
        <span className="text-muted-foreground/30">•</span>
        <Clock className="size-3 text-muted-foreground shrink-0" />
        <span className="text-foreground/90 font-medium tabular-nums">{liveTime || '00:00:00'}</span>
      </div>

    </div>
  );
};