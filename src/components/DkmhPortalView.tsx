import React, { useState, useEffect, useCallback } from 'react';
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

  // Submission Queue
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enrolled Courses (From SGU Database)
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseItem[]>([]);
  const [totalEnrolledCredits, setTotalEnrolledCredits] = useState(0);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [droppingCourseId, setDroppingCourseId] = useState<string | null>(null);

  // Activity Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

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
    } catch (err: any) {
      console.warn('Auto-login from env failed:', err);
      setAuthError(err.message || 'Không thể đăng nhập tự động. Vui lòng thử đăng nhập thủ công.');
      addLog('warn', `Chưa thể nạp tài khoản tự động: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  }, [addLog, setToastMessage]);

  useEffect(() => {
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

  // 4. Fetch Enrolled Courses from SGU
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

  // 5. Load plan into queue
  const loadPlanToQueue = useCallback((planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

    const groups: ClassGroup[] = [];
    for (const gid of targetPlan.selectedIds) {
      const found = allCourses.find((c) => c.id === gid);
      if (found) groups.push(found);
    }

    const newQueue: QueueItem[] = groups.map((g) => ({
      group: g,
      status: 'pending',
    }));

    setQueue(newQueue);
    setSelectedPlanId(planId);
    addLog('info', `Đã nạp ${groups.length} môn từ phương án "${targetPlan.name}" vào hàng đợi.`);
  }, [plans, allCourses, addLog]);

  // Sync plan when selectedPlanId changes
  useEffect(() => {
    loadPlanToQueue(selectedPlanId);
  }, [selectedPlanId, loadPlanToQueue]);

  // 6. Submit Batch Registration
  const handleSubmitBatch = async () => {
    if (!token) {
      setToastMessage('Bạn cần xác thực tài khoản sinh viên trước khi đăng ký!');
      return;
    }
    if (queue.length === 0) {
      setToastMessage('Hàng đợi đăng ký đang trống! Hãy chọn phương án thời khóa biểu.');
      return;
    }

    const confirmSubmit = window.confirm(
      `Xác nhận nộp đăng ký đồng thời ${queue.length} môn học vào hệ thống Đào tạo SGU?`
    );
    if (!confirmSubmit) return;

    setIsSubmitting(true);
    addLog('info', `🚀 Bắt đầu gửi API đăng ký cho ${queue.length} môn học...`);

    // Set queue items to submitting
    setQueue((prev) =>
      prev.map((item) => ({ ...item, status: 'submitting', message: 'Đang gửi...' }))
    );

    try {
      const groupsToSubmit = queue.map((q) => q.group);
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
        setToastMessage(`Đăng ký thành công ${successCount}/${queue.length} môn!`);
      } else {
        setToastMessage(`Không môn nào được ghi nhận. Kiểm tra lại thông báo từ cổng SGU.`);
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
      setIsSubmitting(false);
    }
  };

  // 7. Drop Course
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

  const totalQueueCredits = queue.reduce((acc, q) => acc + (q.group.so_tc || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* 1. TOP HERO HUD: Account, Gateway Status & SGU Live Sync */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm relative overflow-hidden">
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
                <span>Phương thức: Direct Live API Client</span>
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
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mật khẩu trang đào tạo
                </label>
                <input
                  type="password"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  required
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

      {/* 2. MAIN WORKSPACE: Queue on Left, Real-Time Registered on Right */}
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
                  Nạp từ phương án đã sắp xếp sẵn bên tab Xếp Lịch Học
                </p>
              </div>

              {/* Plan Switcher Pills */}
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

            {/* Queue Summary Bar */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <div className="flex items-center gap-2">
                <BookOpen className="size-3.5 text-primary" />
                <span className="text-muted-foreground">Tổng nộp:</span>
                <span className="font-semibold text-foreground">{queue.length} môn</span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-foreground">{totalQueueCredits} tín chỉ</span>
              </div>

              {queue.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Trạng thái: Sẵn sàng nộp API
                </span>
              )}
            </div>

            {/* Queue Items Table / List */}
            {queue.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-border/80 rounded-xl">
                <BookOpen className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">
                  Chưa có môn học nào trong phương án này
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hãy quay lại tab <strong>"Xếp Lịch Học"</strong> để chọn môn và nhóm lớp vào phương án,
                  sau đó chuyển sang đây để nộp bằng API.
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

                        {/* Available slots */}
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

            {/* BIG ACTION: SUBMIT VIA SGU API */}
            <div className="pt-2">
              <button
                onClick={handleSubmitBatch}
                disabled={isSubmitting || queue.length === 0 || !token}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-emerald-500/20 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>ĐANG GỬI ĐỒNG THỜI TỚI CỔNG SGU...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4 text-amber-300 fill-amber-300" />
                    <span>NỘP ĐĂNG KÝ BẰNG API NGAY ({queue.length} MÔN)</span>
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                ⚡ Yêu cầu được gửi trực tiếp từ máy của bạn qua endpoint chuẩn của SGU, tránh nghẽn
                giao diện web trường.
              </p>
            </div>
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

            <div className="p-3 rounded-xl bg-background border border-border/60 max-h-40 overflow-y-auto font-mono text-[11px] space-y-1.5 select-text">
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
