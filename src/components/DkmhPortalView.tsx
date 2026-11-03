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
  Eye,
  EyeOff,
  Square,
  LogOut,
  ListChecks,
  ChevronUp
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup } from '../types/course';
import {
  SguDkmhService,
  SguAuthUser,
  EnrolledCourseItem,
  RegistrationResultItem
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
  const { plans, activeTabId, allCourses, setToastMessage } = useTimetableStore();

  // Authentication State (Direct Input form like Tools1s)
  const [mssvInput, setMssvInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SguAuthUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // SGU Portal Time Window State
  const [portalWindow, setPortalWindow] = useState<{
    isOpen: boolean;
    message: string;
    lastChecked: string;
  } | null>(null);
  const [isCheckingPortal, setIsCheckingPortal] = useState(false);

  // Submission Queue & Execution Control
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const stopRequestedRef = useRef(false);

  // Enrolled Courses (From SGU Database)
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseItem[]>([]);
  const [totalEnrolledCredits, setTotalEnrolledCredits] = useState(0);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [showEnrolledTable, setShowEnrolledTable] = useState(true);
  const [droppingCourseId, setDroppingCourseId] = useState<string | null>(null);

  // Activity Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasAutoFilledRef = useRef(false);

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

  // 1. Check if local .env exists to fill suggestion (WITHOUT auto-submitting)
  useEffect(() => {
    if (hasAutoFilledRef.current) return;
    hasAutoFilledRef.current = true;
    // Check if we can prefill the MSSV for convenience
    fetch('/api-local/env-login')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user?.mssv) {
          // Pre-populate MSSV input for easy typing if user wants
          setMssvInput(data.user.mssv);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Direct Login with MSSV & Password
  const handleDirectLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mssvInput.trim() || !passwordInput) {
      setToastMessage('Vui lòng nhập tài khoản (MSSV) và mật khẩu trang thongtindaotao!');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    addLog('info', `Đang đăng nhập sinh viên MSSV: ${mssvInput.trim()}...`);

    try {
      const auth = await SguDkmhService.login(mssvInput.trim(), passwordInput);
      setToken(auth.token);
      setUser(auth.user);
      setToastMessage(`Đăng nhập thành công: ${auth.user.name}`);
      addLog('success', `Đăng nhập thành công: ${auth.user.name} (${auth.user.mssv})`);

      // Immediately check portal status & fetch enrolled courses
      checkPortalStatus(auth.token);
      fetchEnrolled(auth.token);
    } catch (err: any) {
      setAuthError(err.message || 'Đăng nhập SGU thất bại. Vui lòng kiểm tra lại MSSV/Mật khẩu.');
      addLog('error', `Đăng nhập thất bại: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 3. Quick-fill from .env button (Optional convenience)
  const handleQuickLoginFromEnv = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    addLog('info', 'Đang nạp nhanh tài khoản cấu hình từ máy...');
    try {
      const auth = await SguDkmhService.loginFromEnv();
      setToken(auth.token);
      setUser(auth.user);
      setMssvInput(auth.user.mssv);
      setToastMessage(`Đã kết nối: ${auth.user.name}`);
      addLog('success', `Xác thực thành công sinh viên: ${auth.user.name} (${auth.user.mssv})`);

      checkPortalStatus(auth.token);
      fetchEnrolled(auth.token);
    } catch (err: any) {
      setAuthError(err.message || 'Không thể đăng nhập từ .env');
      addLog('error', `Lỗi nạp .env: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 4. Logout / Switch Account
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setPasswordInput('');
    setPortalWindow(null);
    setEnrolledCourses([]);
    setTotalEnrolledCredits(0);
    setQueue([]);
    addLog('info', 'Đã đăng xuất tài khoản. Bạn có thể nhập tài khoản khác.');
    setToastMessage('Đã thoát tài khoản');
  };

  // 5. Check Portal Registration Window
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

  // 6. Fetch Enrolled Courses from SGU
  const fetchEnrolled = async (authToken = token) => {
    if (!authToken) return;
    setIsLoadingEnrolled(true);
    try {
      const data = await SguDkmhService.getEnrolledCourses(authToken);
      setEnrolledCourses(data.courses);
      setTotalEnrolledCredits(data.totalCredits);
      loadPlanToQueue(selectedPlanId, data.courses);
      addLog('info', `Hệ thống SGU hiện ghi nhận: ${data.courses.length} môn (${data.totalCredits} tín chỉ).`);
    } catch (err: any) {
      addLog('error', `Không thể tải danh sách môn đã đăng ký: ${err.message}`);
    } finally {
      setIsLoadingEnrolled(false);
    }
  };

  // 7. Load plan into queue
  const loadPlanToQueue = useCallback(
    (planId: string, currentEnrolled: EnrolledCourseItem[] = enrolledCourses) => {
      if (isRunning) return;
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
      if (groups.length > 0) {
        addLog('info', `Đã nạp ${groups.length} môn từ phương án "${targetPlan.name}" vào hàng đợi.`);
      }
    },
    [plans, allCourses, enrolledCourses, isRunning, addLog]
  );

  useEffect(() => {
    if (token) {
      loadPlanToQueue(selectedPlanId);
    }
  }, [selectedPlanId, token, loadPlanToQueue]);

  // 8. Submit Registration (Batch Runner with Stop support)
  const handleSubmitBatch = async () => {
    if (!token) {
      setToastMessage('Vui lòng đăng nhập tài khoản trước khi nộp đăng ký!');
      return;
    }
    if (queue.length === 0) {
      setToastMessage('Hàng đợi đăng ký đang trống! Hãy chọn phương án thời khóa biểu.');
      return;
    }

    const pendingItems = queue.filter((q) => q.status !== 'success');
    if (pendingItems.length === 0) {
      setToastMessage('Tất cả môn trong phương án này đã được ghi nhận trên SGU!');
      return;
    }

    const confirmSubmit = window.confirm(
      `Xác nhận nộp đăng ký ${pendingItems.length} môn học trực tiếp vào hệ thống Đào tạo SGU?`
    );
    if (!confirmSubmit) return;

    setIsRunning(true);
    stopRequestedRef.current = false;
    addLog('info', `🚀 Bắt đầu gửi API đăng ký cho ${pendingItems.length} môn học...`);

    // Set pending queue items to submitting
    setQueue((prev) =>
      prev.map((item) =>
        item.status !== 'success'
          ? { ...item, status: 'submitting', message: 'Đang gửi...' }
          : item
      )
    );

    try {
      const groupsToSubmit = pendingItems.map((q) => q.group);
      const results: RegistrationResultItem[] = await SguDkmhService.submitBatchRegistration(
        token,
        groupsToSubmit
      );

      let successCount = 0;
      let failCount = 0;

      // Update queue with results
      setQueue((prev) =>
        prev.map((item) => {
          const res = results.find(
            (r) =>
              r.id === item.group.id ||
              r.id === item.group.id_to_hoc ||
              (r.ma_mon === item.group.ma_mon && r.nhom_to === item.group.nhom_to)
          );
          if (res) {
            if (res.success) {
              successCount++;
              addLog('success', `✅ [${res.ma_mon} - ${res.nhom_to}] ${res.ten_mon}: Thành công!`);
              return { ...item, status: 'success', message: res.message || 'Thành công' };
            } else {
              failCount++;
              addLog('error', `❌ [${res.ma_mon} - ${res.nhom_to}] ${res.ten_mon}: ${res.message}`);
              return { ...item, status: 'error', message: res.message || 'Thất bại' };
            }
          }
          return item;
        })
      );

      if (successCount > 0) {
        setToastMessage(`Đăng ký thành công ${successCount}/${pendingItems.length} môn!`);
      } else {
        setToastMessage(`Chưa đăng ký được môn nào. Xem nhật ký phản hồi từ SGU.`);
      }

      // Re-fetch enrolled courses from SGU
      await fetchEnrolled(token);
    } catch (err: any) {
      addLog('error', `Sự cố khi gửi đăng ký: ${err.message}`);
      setToastMessage(`Lỗi đăng ký: ${err.message}`);
      setQueue((prev) =>
        prev.map((item) =>
          item.status === 'submitting'
            ? { ...item, status: 'error', message: err.message }
            : item
        )
      );
    } finally {
      setIsRunning(false);
    }
  };

  // 9. Stop Registration
  const handleStop = () => {
    stopRequestedRef.current = true;
    setIsRunning(false);
    addLog('warn', '⏹️ Đã dừng tiến trình nộp đăng ký.');
    setToastMessage('Đã dừng tiến trình nộp');
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
        setToastMessage(`Đã hủy môn ${course.ten_mon}`);
        await fetchEnrolled(token);
      } else {
        addLog('error', `Hủy môn thất bại: ${res.message}`);
        setToastMessage(`Hủy môn thất bại: ${res.message}`);
      }
    } catch (err: any) {
      addLog('error', `Lỗi khi hủy môn: ${err.message}`);
    } finally {
      setDroppingCourseId(null);
    }
  };

  const pendingQueueCount = queue.filter((q) => q.status !== 'success').length;
  const allQueueDone = queue.length > 0 && pendingQueueCount === 0;
  const totalQueueCredits = queue.reduce((acc, q) => acc + (q.group.so_tc || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* =========================================================================
          SECTION 1: DIRECT LOGIN FORM (Tools1s style: Input right on screen)
         ========================================================================= */}
      {!user ? (
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-7 shadow-sm relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <KeyRound className="size-3.5" />
                <span>Đăng nhập Cổng Đào Tạo SGU Trực Tiếp</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Đăng Nhập Tài Khoản Sinh Viên
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Nhập tài khoản và mật khẩu trang{' '}
                <strong className="text-foreground">thongtindaotao.sgu.edu.vn</strong> để nộp đăng ký trực tiếp qua API.
              </p>
            </div>

            <form onSubmit={handleDirectLogin} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="usernameTheme1"
                  className="block text-xs font-semibold text-foreground"
                >
                  Tài khoản trang thongtindaotao.sgu.edu.vn (MSSV):
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <User className="size-4" />
                  </div>
                  <input
                    type="text"
                    id="usernameTheme1"
                    name="usernameTheme1"
                    value={mssvInput}
                    onChange={(e) => setMssvInput(e.target.value)}
                    placeholder="Ví dụ: 3124410007"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="passwordTheme1"
                  className="block text-xs font-semibold text-foreground"
                >
                  Mật khẩu trang thongtindaotao.sgu.edu.vn:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <KeyRound className="size-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="passwordTheme1"
                    name="passwordTheme1"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {authError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-wide text-white bg-primary hover:bg-primary/90 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Đang xác thực với SGU...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      <span>ĐĂNG NHẬP VÀO SGU</span>
                    </>
                  )}
                </button>

                {/* Quick Auto Fill from local .env if available */}
                <button
                  type="button"
                  onClick={handleQuickLoginFromEnv}
                  disabled={isAuthenticating}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl font-semibold text-xs border border-border/80 bg-muted/60 hover:bg-muted text-foreground transition-all cursor-pointer shrink-0"
                  title="Tự động nạp tài khoản lưu trong file .env trên máy"
                >
                  ⚡ Điền từ .env
                </button>
              </div>

              <p className="text-center text-[11px] text-muted-foreground pt-1">
                🔒 Thông tin được gửi trực tiếp từ máy của bạn tới máy chủ SGU để nhận mã xác thực Token.
                Tuyệt đối không lưu lại ở máy chủ bên thứ ba.
              </p>
            </form>
          </div>
        </div>
      ) : (
        /* =========================================================================
            LOGGED-IN HUD BANNER: Student profile, Portal Status & Switch Account
           ========================================================================= */
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Student Info */}
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <User className="size-5" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    {user.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="size-3.5" />
                    <span>Đã kết nối trực tiếp SGU</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    MSSV: <strong className="text-foreground font-mono font-medium">{user.mssv}</strong>
                  </span>
                  <span>•</span>
                  <span>Direct Live API</span>
                </div>
              </div>
            </div>

            {/* Portal Status Indicator & Logout button */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="px-3.5 py-1.5 rounded-xl bg-muted/60 border border-border/80 flex items-center gap-2.5 text-xs">
                <span className="flex size-2 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      portalWindow?.isOpen ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full size-2 ${
                      portalWindow?.isOpen ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  ></span>
                </span>
                <span className="font-medium text-foreground">
                  {portalWindow ? portalWindow.message : 'Đang kiểm tra cổng...'}
                </span>
                <button
                  onClick={() => checkPortalStatus()}
                  disabled={isCheckingPortal}
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                  title="Kiểm tra lại trạng thái cổng SGU"
                  type="button"
                >
                  <RefreshCw
                    className={`size-3 text-primary ${isCheckingPortal ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive text-xs font-medium transition-all cursor-pointer"
                type="button"
                title="Thoát tài khoản để đăng nhập tài khoản khác"
              >
                <LogOut className="size-3.5" />
                <span>Đổi tài khoản</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: ACTION CONTROLS & COURSE QUEUE (Tools1s style button cluster)
         ========================================================================= */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm space-y-5">
        {/* Header & Plan Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="size-4 text-emerald-500 fill-emerald-500" />
              <span>Hàng Đợi Đăng Ký Môn Học</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Chọn phương án đã xếp lịch để chuẩn bị nộp API • Tổng:{' '}
              <strong className="text-foreground">{queue.length} môn</strong> ({totalQueueCredits} tín chỉ)
            </p>
          </div>

          {/* Plan Selector Pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 overflow-x-auto">
            {plans.map((p) => {
              const isSelected = selectedPlanId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
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
        </div>

        {/* =========================================================================
            TOOL 3 MAIN ACTION BUTTONS: [SUBMIT] [STOP] [XEM KẾT QUẢ ĐĂNG KÝ]
           ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* 1. SUBMIT BUTTON (Primary) */}
          <button
            onClick={handleSubmitBatch}
            disabled={isRunning || queue.length === 0 || !token || allQueueDone}
            className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide text-white transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
              allQueueDone
                ? 'bg-emerald-700/80'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/20 active:scale-[0.99]'
            }`}
            type="button"
          >
            {isRunning ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                <span>ĐANG GỬI API TỚI SGU...</span>
              </>
            ) : allQueueDone ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-300" />
                <span>TẤT CẢ MÔN ĐÃ ĐĂNG KÝ THÀNH CÔNG</span>
              </>
            ) : (
              <>
                <Zap className="size-4 text-amber-300 fill-amber-300" />
                <span>SUBMIT ĐĂNG KÝ BẰNG API ({pendingQueueCount} MÔN)</span>
              </>
            )}
          </button>

          {/* 2. STOP BUTTON */}
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className="py-3.5 px-5 rounded-xl font-semibold text-xs border border-border/80 bg-card hover:bg-muted text-foreground transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
          >
            <Square className="size-3.5 text-rose-500 fill-rose-500" />
            <span>Stop</span>
          </button>

          {/* 3. VIEW ENROLLED RESULTS BUTTON */}
          <button
            onClick={() => {
              setShowEnrolledTable(true);
              if (token) fetchEnrolled();
            }}
            disabled={!token || isLoadingEnrolled}
            className="py-3.5 px-5 rounded-xl font-semibold text-xs border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
          >
            <ListChecks className="size-4 text-emerald-500" />
            <span>Xem kết quả đăng ký ({enrolledCourses.length})</span>
          </button>
        </div>

        {/* Queue Items Table */}
        {queue.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-border/80 rounded-xl">
            <BookOpen className="size-7 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              Hàng đợi trống — Chưa có môn nào trong phương án này
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Chuyển sang tab <strong>"Xếp Lịch Học"</strong> để chọn môn và nhóm lớp mong muốn,
              sau đó quay lại đây để Submit bằng API.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
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
                      <span className="text-muted-foreground font-medium">{group.so_tc} TC</span>
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

                  {/* Right Status Badge */}
                  <div className="shrink-0 text-right space-y-1">
                    {status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium text-[11px] border border-border/70">
                        <Clock className="size-3" />
                        <span>Chờ nộp</span>
                      </span>
                    )}
                    {status === 'submitting' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium text-[11px] border border-sky-500/20">
                        <RefreshCw className="size-3 animate-spin" />
                        <span>Đang nộp...</span>
                      </span>
                    )}
                    {status === 'success' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
                        <CheckCircle2 className="size-3" />
                        <span>{message || 'Thành công'}</span>
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

                    <div className="text-[10px] text-muted-foreground font-medium">
                      Còn{' '}
                      <strong className="text-emerald-500 tabular-nums">
                        {group.sl_cl ?? 85}
                      </strong>{' '}
                      chỗ
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 3: OFFICIAL ENROLLED COURSES FROM SGU (Tools1s show_table_kqdh)
         ========================================================================= */}
      {showEnrolledTable && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Danh sách môn học đã đăng ký trong hệ thống SGU</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Ghi nhận chính thức từ cơ sở dữ liệu đào tạo SGU • Tổng cộng:{' '}
                <strong className="text-foreground">{enrolledCourses.length} môn</strong> (
                <strong className="text-primary">{totalEnrolledCredits} tín chỉ</strong>)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchEnrolled()}
                disabled={isLoadingEnrolled || !token}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-border/70 bg-muted/60 hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50"
                type="button"
                title="Tải lại kết quả mới nhất từ trường"
              >
                <RefreshCw
                  className={`size-3 text-primary ${isLoadingEnrolled ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Làm mới</span>
              </button>

              <button
                onClick={() => setShowEnrolledTable(false)}
                className="p-1.5 rounded-xl border border-border/70 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Ẩn bảng này"
                type="button"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>
          </div>

          {enrolledCourses.length === 0 ? (
            <div className="py-8 text-center space-y-1.5 border border-dashed border-border/80 rounded-xl">
              <BookOpen className="size-6 mx-auto text-muted-foreground/50" />
              <p className="text-xs font-medium text-foreground">
                {token ? 'Chưa có môn nào được ghi nhận trong CSDL SGU' : 'Vui lòng đăng nhập để xem'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/60">
                  <tr>
                    <th className="py-2 px-3">Mã môn</th>
                    <th className="py-2 px-3">Tên môn học</th>
                    <th className="py-2 px-3 text-center">Tổ</th>
                    <th className="py-2 px-3 text-center">Số TC</th>
                    <th className="py-2 px-3">Giảng viên</th>
                    <th className="py-2 px-3 text-right">Học phí</th>
                    <th className="py-2 px-3 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {enrolledCourses.map((c) => (
                    <tr key={c.id_kqdk} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-foreground">{c.ma_mon}</td>
                      <td className="py-2 px-3 font-medium text-foreground">{c.ten_mon}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          {c.nhom_to}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold">{c.so_tc}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.ten_giang_vien || '---'}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {c.hoc_phi_tam_tinh ? `${c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ` : '---'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDropCourse(c)}
                          disabled={droppingCourseId === c.id_kqdk}
                          className="px-2 py-1 rounded-lg border border-border/70 hover:border-destructive/30 hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                          type="button"
                          title="Hủy môn này"
                        >
                          {droppingCourseId === c.id_kqdk ? (
                            <RefreshCw className="size-3 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                          <span>Hủy</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 4: REAL-TIME ACTIVITY LOG (Audit Trail console like Tools1s #kq)
         ========================================================================= */}
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
  );
};
