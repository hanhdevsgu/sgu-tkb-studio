import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StopCircle,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup } from '../types/course';
import {
  SguDkmhService,
  SguAuthUser,
  EnrolledCourseItem,
  RegistrationResultItem
} from '../services/sguDkmhService';

interface CourseRowItem {
  group: ClassGroup;
  selected: boolean;
  status: 'pending' | 'submitting' | 'success' | 'error';
  message?: string;
}

export const DkmhPortalView: React.FC = () => {
  const { plans, activeTabId, allCourses, setToastMessage } = useTimetableStore();

  // Authentication
  const [username, setUsername] = useState('3124410007');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SguAuthUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Portal Status
  const [portalStatus, setPortalStatus] = useState<string>('Đang kiểm tra cổng đào tạo...');
  const [isPortalOpen, setIsPortalOpen] = useState(false);

  // Course Rows & Selection
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [courseRows, setCourseRows] = useState<CourseRowItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);

  // Live Enrolled Courses from SGU
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseItem[]>([]);
  const [showEnrolledTable, setShowEnrolledTable] = useState(true);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [droppingCourseId, setDroppingCourseId] = useState<string | null>(null);

  // Center #kq status (Tools1s signature)
  const [kqText, setKqText] = useState<string>('Sẵn sàng nộp môn học vào SGU.');

  // 1. Initial Load: Check for stored / .env user for convenience
  useEffect(() => {
    fetch('/api-local/env-login')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.token && data.user) {
          // If env has credentials, we can auto-fill and auto-connect
          setToken(data.token);
          setUser(data.user);
          setUsername(data.user.mssv);
          setLoginMsg({ type: 'success', text: `Đã kết nối: ${data.user.name} (${data.user.mssv})` });
          checkPortal(data.token);
          fetchEnrolled(data.token);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Direct Login Handler
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setLoginMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu trang thongtindaotao!' });
      return;
    }

    setIsLoggingIn(true);
    setLoginMsg({ type: 'info', text: 'Đang đăng nhập vào cổng đào tạo SGU...' });
    setKqText('Đang đăng nhập vào cổng SGU...');

    try {
      const auth = await SguDkmhService.login(username.trim(), password);
      setToken(auth.token);
      setUser(auth.user);
      setLoginMsg({ type: 'success', text: `Đăng nhập thành công: ${auth.user.name} (${auth.user.mssv})` });
      setKqText(`Đăng nhập thành công: ${auth.user.name} (${auth.user.mssv})`);
      setToastMessage(`Đăng nhập thành công: ${auth.user.name}`);
      checkPortal(auth.token);
      fetchEnrolled(auth.token);
    } catch (err: any) {
      setLoginMsg({ type: 'error', text: err.message || 'Đăng nhập SGU thất bại!' });
      setKqText(`Lỗi: ${err.message || 'Đăng nhập thất bại'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 3. Check Portal Status
  const checkPortal = async (authToken = token) => {
    if (!authToken) return;
    try {
      const status = await SguDkmhService.checkRegistrationPeriod(authToken);
      setIsPortalOpen(status.isOpen);
      setPortalStatus(status.message);
    } catch (err: any) {
      setPortalStatus(`Lỗi kiểm tra cổng: ${err.message}`);
    }
  };

  // 4. Fetch Enrolled Courses
  const fetchEnrolled = async (authToken = token) => {
    if (!authToken) return;
    setIsLoadingEnrolled(true);
    try {
      const data = await SguDkmhService.getEnrolledCourses(authToken);
      setEnrolledCourses(data.courses);
      syncQueueWithEnrolled(data.courses);
    } catch (err: any) {
      console.warn('fetchEnrolled error:', err);
    } finally {
      setIsLoadingEnrolled(false);
    }
  };

  // 5. Populate Course Rows from Selected Plan
  const syncQueueWithEnrolled = useCallback(
    (currentEnrolled: EnrolledCourseItem[]) => {
      const targetPlan = plans.find((p) => p.id === selectedPlanId);
      if (!targetPlan) return;

      const groups: ClassGroup[] = [];
      for (const gid of targetPlan.selectedIds) {
        const found = allCourses.find((c) => c.id === gid);
        if (found) groups.push(found);
      }

      const rows: CourseRowItem[] = groups.map((g) => {
        const isEnrolled = currentEnrolled.some(
          (e) => e.id_to_hoc === g.id_to_hoc || (e.ma_mon === g.ma_mon && e.nhom_to === g.nhom_to)
        );
        return {
          group: g,
          selected: !isEnrolled, // pre-select those not yet enrolled
          status: isEnrolled ? 'success' : 'pending',
          message: isEnrolled ? 'Đã có trong CSDL SGU' : undefined,
        };
      });

      setCourseRows(rows);
    },
    [plans, allCourses, selectedPlanId]
  );

  useEffect(() => {
    syncQueueWithEnrolled(enrolledCourses);
  }, [selectedPlanId, enrolledCourses, syncQueueWithEnrolled]);

  // Toggle selection checkbox for a course
  const toggleRowSelect = (groupId: string) => {
    setCourseRows((prev) =>
      prev.map((r) => (r.group.id === groupId ? { ...r, selected: !r.selected } : r))
    );
  };

  // Toggle all checkboxes
  const toggleSelectAll = (checked: boolean) => {
    setCourseRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  // 6. SUBMIT ACTION (Tools1s #ok button)
  const handleOkSubmit = async () => {
    if (!token) {
      alert('Vui lòng đăng nhập tài khoản trước khi Submit!');
      return;
    }

    const toSubmit = courseRows.filter((r) => r.selected && r.status !== 'success');
    if (toSubmit.length === 0) {
      alert('Vui lòng chọn ít nhất 1 môn học chưa đăng ký để Submit!');
      return;
    }

    setIsRunning(true);
    stopRef.current = false;
    setKqText(`Bắt đầu Submit ${toSubmit.length} môn học vào hệ thống SGU...`);

    // Set rows to submitting
    setCourseRows((prev) =>
      prev.map((r) =>
        r.selected && r.status !== 'success'
          ? { ...r, status: 'submitting', message: 'Đang gửi...' }
          : r
      )
    );

    try {
      const groupsToSubmit = toSubmit.map((r) => r.group);
      const results: RegistrationResultItem[] = await SguDkmhService.submitBatchRegistration(
        token,
        groupsToSubmit
      );

      let successCount = 0;
      let failCount = 0;

      setCourseRows((prev) =>
        prev.map((r) => {
          const res = results.find(
            (item) =>
              item.id === r.group.id ||
              item.id === r.group.id_to_hoc ||
              (item.ma_mon === r.group.ma_mon && item.nhom_to === r.group.nhom_to)
          );
          if (res) {
            if (res.success) {
              successCount++;
              return { ...r, status: 'success', message: res.message || 'Thành công', selected: false };
            } else {
              failCount++;
              return { ...r, status: 'error', message: res.message || 'Thất bại' };
            }
          }
          return r;
        })
      );

      const summary = `Submit xong! Thành công: ${successCount} môn, Thất bại: ${failCount} môn.`;
      setKqText(summary);
      setToastMessage(summary);

      // Refresh enrolled list from SGU
      await fetchEnrolled(token);
    } catch (err: any) {
      setKqText(`Lỗi khi nộp: ${err.message}`);
      setToastMessage(`Lỗi: ${err.message}`);
      setCourseRows((prev) =>
        prev.map((r) =>
          r.status === 'submitting'
            ? { ...r, status: 'error', message: err.message }
            : r
        )
      );
    } finally {
      setIsRunning(false);
    }
  };

  // 7. STOP ACTION (Tools1s #stop button)
  const handleStop = () => {
    stopRef.current = true;
    setIsRunning(false);
    setKqText('⏹️ Đã dừng tiến trình Submit.');
    setToastMessage('Đã dừng tiến trình');
  };

  // 8. DROP COURSE
  const handleDropCourse = async (course: EnrolledCourseItem) => {
    if (!token) return;
    const confirmDrop = window.confirm(
      `Bạn có chắc chắn muốn HỦY đăng ký môn:\n"${course.ten_mon}" (${course.ma_mon} - Nhóm ${course.nhom_to})?`
    );
    if (!confirmDrop) return;

    setDroppingCourseId(course.id_kqdk);
    setKqText(`Đang hủy môn: ${course.ten_mon}...`);
    try {
      const res = await SguDkmhService.dropCourse(token, course.id_kqdk);
      if (res.success) {
        setKqText(`✅ Đã hủy thành công môn: ${course.ten_mon}`);
        setToastMessage(`Đã hủy môn ${course.ten_mon}`);
        await fetchEnrolled(token);
      } else {
        setKqText(`❌ Hủy môn thất bại: ${res.message}`);
        setToastMessage(`Hủy thất bại: ${res.message}`);
      }
    } catch (err: any) {
      setKqText(`Lỗi hủy môn: ${err.message}`);
    } finally {
      setDroppingCourseId(null);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setPassword('');
    setCourseRows([]);
    setEnrolledCourses([]);
    setLoginMsg(null);
    setKqText('Đã đăng xuất. Vui lòng nhập tài khoản.');
  };

  const selectedCount = courseRows.filter((r) => r.selected).length;

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* =========================================================================
          TOOLS1S EXACT ADMINLTE CARD CONTAINER: .box.box-primary
         ========================================================================= */}
      <div
        className="bg-white dark:bg-[#1e282c] border border-gray-300 dark:border-gray-700 rounded shadow-md overflow-hidden text-gray-800 dark:text-gray-100"
        style={{ borderTop: '3px solid #3c8dbc' }}
      >
        {/* Box Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-[#00a65a] m-0">
            Tool đăng kí học phần SGU - Trường Đại học Sài Gòn
          </h1>

          {user && (
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-1 cursor-pointer"
              title="Đổi tài khoản đăng nhập"
              type="button"
            >
              <LogOut className="size-3" />
              <span>Đổi tài khoản</span>
            </button>
          )}
        </div>

        {/* Box Body */}
        <div className="p-4 sm:p-5 space-y-4 text-sm">
          {/* =========================================================================
              STUDENT INFO CALLOUT (#html_show_info_dkmh) - Tools1s Post-Login style
             ========================================================================= */}
          {user ? (
            <div
              className="p-3 rounded border text-xs sm:text-sm space-y-1"
              style={{
                backgroundColor: '#d9edf7',
                borderColor: '#bce8f1',
                color: '#31708f',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>Domain:</strong> thongtindaotao.sgu.edu.vn &nbsp;|&nbsp;{' '}
                  <strong>Sinh viên:</strong> <span className="font-bold text-blue-900">{user.name}</span> (
                  <span className="font-mono">{user.mssv}</span>) &nbsp;|&nbsp;{' '}
                  <strong>Học kỳ:</strong> HK1 (2026 - 2027)
                </div>
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className={`inline-block size-2 rounded-full ${isPortalOpen ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                  <span>{portalStatus}</span>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
                LOGIN FORM (When not logged in)
               ========================================================================= */
            <form onSubmit={handleLogin} className="space-y-3.5 max-w-xl mx-auto py-2">
              <div className="space-y-1">
                <label htmlFor="usernameTheme1" className="block font-bold text-gray-700 dark:text-gray-200 text-xs sm:text-sm">
                  Tài khoản trang thongtindaotao.sgu.edu.vn:{' '}
                </label>
                <input
                  type="text"
                  id="usernameTheme1"
                  name="usernameTheme1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#3c8dbc]"
                  placeholder="Nhập tài khoản"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="passwordTheme1" className="block font-bold text-gray-700 dark:text-gray-200 text-xs sm:text-sm">
                  Mật khẩu trang thongtindaotao.sgu.edu.vn:{' '}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="passwordTheme1"
                    name="passwordTheme1"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#3c8dbc]"
                    placeholder="Nhập mật khẩu"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {loginMsg && (
                <div
                  className={`p-2.5 rounded text-xs border ${
                    loginMsg.type === 'error'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : loginMsg.type === 'success'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {loginMsg.text}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2 rounded text-white font-bold text-xs uppercase transition-colors cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: '#605ca8', borderColor: '#545096' }}
                >
                  {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetch('/api-local/env-login')
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success && data.token) {
                          setToken(data.token);
                          setUser(data.user);
                          setUsername(data.user.mssv);
                          setLoginMsg({ type: 'success', text: `Đã kết nối tài khoản: ${data.user.name}` });
                          checkPortal(data.token);
                          fetchEnrolled(data.token);
                        }
                      });
                  }}
                  className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  ⚡ Điền nhanh từ .env
                </button>
              </div>
            </form>
          )}

          {/* =========================================================================
              PLAN SELECTOR / SYNC WITH STUDIO
             ========================================================================= */}
          {user && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-gray-700 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700 dark:text-gray-300">Chọn phương án TKB:</span>
                <div className="inline-flex rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-0.5">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`px-3 py-1 text-xs rounded transition-all cursor-pointer font-medium ${
                        selectedPlanId === p.id
                          ? 'bg-[#3c8dbc] text-white font-bold shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                      }`}
                      type="button"
                    >
                      {p.name} ({p.selectedIds.length})
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-gray-500 dark:text-gray-400">
                Đã chọn: <strong className="text-blue-600 dark:text-blue-400 font-bold">{selectedCount}</strong> / {courseRows.length} môn
              </div>
            </div>
          )}

          {/* =========================================================================
              COURSE SELECTION TABLE (Tools1s Post-Login Data Table)
             ========================================================================= */}
          {user && (
            <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#f4f4f4] dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={courseRows.length > 0 && courseRows.every((r) => r.selected)}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="cursor-pointer size-3.5"
                        title="Chọn tất cả"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-20">Mã môn</th>
                    <th className="py-2.5 px-3">Tên môn học</th>
                    <th className="py-2.5 px-3 text-center w-16">Nhóm/Tổ</th>
                    <th className="py-2.5 px-3 text-center w-14">Số TC</th>
                    <th className="py-2.5 px-3 text-center w-24">Còn lại</th>
                    <th className="py-2.5 px-3">Thời khóa biểu</th>
                    <th className="py-2.5 px-3 text-center w-28">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {courseRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500 italic">
                        Phương án này chưa có môn học nào. Hãy qua tab "Xếp Lịch Học" để chọn môn trước.
                      </td>
                    </tr>
                  ) : (
                    courseRows.map((row) => {
                      const { group, selected, status, message } = row;
                      return (
                        <tr
                          key={group.id}
                          className={`hover:bg-blue-50/50 dark:hover:bg-gray-800/80 transition-colors ${
                            selected ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRowSelect(group.id)}
                              disabled={status === 'success' || isRunning}
                              className="cursor-pointer size-3.5"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono font-bold">{group.ma_mon}</td>
                          <td className="py-2 px-3 font-semibold">{group.ten_mon}</td>
                          <td className="py-2 px-3 text-center font-bold text-blue-600">{group.nhom_to}</td>
                          <td className="py-2 px-3 text-center">{group.so_tc}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="font-bold text-green-600">{group.sl_cl ?? 85}</span> / {group.sl_cp ?? 85}
                          </td>
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                            {group.parsedSessions && group.parsedSessions.length > 0
                              ? group.parsedSessions
                                  .map(
                                    (s) =>
                                      `${s.thuStr || (s.thu === 8 ? 'CN' : `Thứ ${s.thu}`)} (T${s.tietStart}-${s.tietEnd}${
                                        s.phong ? ` • ${s.phong}` : ''
                                      })`
                                  )
                                  .join(' | ')
                              : group.tkb_raw || 'Chưa xếp'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {status === 'pending' && (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
                                Chờ
                              </span>
                            )}
                            {status === 'submitting' && (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-sky-100 text-sky-700 border border-sky-300 animate-pulse font-bold">
                                Đang nộp...
                              </span>
                            )}
                            {status === 'success' && (
                              <span
                                className="px-2 py-0.5 rounded text-[11px] bg-green-100 text-green-700 border border-green-300 font-bold"
                                title={message}
                              >
                                ✓ Thành công
                              </span>
                            )}
                            {status === 'error' && (
                              <span
                                className="px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-700 border border-red-300 font-bold truncate max-w-[100px] inline-block"
                                title={message}
                              >
                                ✕ {message || 'Lỗi'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =========================================================================
            EXACT TOOLS1S FOOTER: .box-footer with Submit (btn-tim), Stop (btn-primary), Xem kết quả (btn-success)
           ========================================================================= */}
        <div className="px-4 py-4 bg-gray-50 dark:bg-[#222d32] border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* BUTTON 1: SUBMIT (Exact Tools1s .btn-tim) */}
              <button
                type="button"
                id="ok"
                name="ok"
                onClick={handleOkSubmit}
                disabled={isRunning || !user || selectedCount === 0}
                className="px-6 py-2.5 rounded text-white font-bold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                style={{
                  backgroundColor: '#605ca8',
                  borderColor: '#545096',
                  color: '#ffffff',
                }}
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit ({selectedCount} môn)</span>
                )}
              </button>

              {/* BUTTON 2: STOP (Exact Tools1s .btn-primary) */}
              <button
                type="button"
                id="stop"
                name="stop"
                onClick={handleStop}
                disabled={!isRunning}
                className="px-5 py-2.5 rounded text-white font-bold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                style={{
                  backgroundColor: '#3c8dbc',
                  borderColor: '#367fa9',
                  color: '#ffffff',
                }}
              >
                <StopCircle className="size-4" />
                <span>Stop</span>
              </button>
            </div>

            {/* BUTTON 3: XEM KẾT QUẢ ĐĂNG KÝ (Exact Tools1s .btn-success right-aligned) */}
            <button
              type="button"
              id="check_kqdk"
              name="check_kqdk"
              onClick={() => {
                setShowEnrolledTable(true);
                if (token) fetchEnrolled();
              }}
              disabled={!token || isLoadingEnrolled}
              className="px-5 py-2.5 rounded text-white font-bold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ml-auto"
              style={{
                backgroundColor: '#00a65a',
                borderColor: '#008d4c',
                color: '#ffffff',
              }}
            >
              {isLoadingEnrolled ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <span>Xem kết quả đăng ký ({enrolledCourses.length})</span>
              )}
            </button>
          </div>

          {/* =========================================================================
              EXACT TOOLS1S ENROLLED TABLE CONTAINER: #show_div_kqdh
              (border: 2px solid DarkTurquoise; border-radius: 5px)
             ========================================================================= */}
          {user && showEnrolledTable && (
            <div id="show_div_kqdh" className="space-y-2 pt-2">
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="flex items-center justify-between">
                <label className="text-base font-bold text-gray-800 dark:text-gray-100 m-0">
                  Danh sách môn học đã đăng ký: <i id="slMonTrongKqdk" className="text-green-600 font-bold">{enrolledCourses.length} môn</i>
                </label>

                {/* Tools1s Toggle Buttons: Button_ShowHide_KQDK0 & Button_ShowHide_KQDK1 */}
                <button
                  type="button"
                  onClick={() => setShowEnrolledTable(false)}
                  className="px-2.5 py-1 text-xs rounded text-white font-semibold cursor-pointer"
                  style={{ backgroundColor: '#00c0ef', borderColor: '#00acd6' }}
                >
                  Ẩn bảng này
                </button>
              </div>

              {/* Exact DarkTurquoise box */}
              <div
                id="show_table_kqdh"
                className="overflow-x-auto bg-white dark:bg-gray-800"
                style={{
                  padding: '4px',
                  border: '2px solid DarkTurquoise',
                  borderRadius: '5px',
                  display: 'block',
                }}
              >
                {enrolledCourses.length === 0 ? (
                  <div className="py-4 text-center text-xs text-gray-500 italic">
                    Chưa có môn nào được ghi nhận trong cơ sở dữ liệu SGU.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse" id="table_data_kqdh">
                    <thead className="bg-[#f9f9f9] dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200">
                      <tr>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 text-center w-12">STT</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 w-24">Mã môn</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700">Tên môn học</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 text-center w-16">Nhóm/Tổ</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 text-center w-14">Số TC</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700">Giảng viên</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 text-right w-28">Học phí</th>
                        <th className="p-2 border border-gray-200 dark:border-gray-700 text-center w-20">Hủy môn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {enrolledCourses.map((c, i) => (
                        <tr key={c.id_kqdk} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">{i + 1}</td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 font-mono font-bold">{c.ma_mon}</td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 font-medium">{c.ten_mon}</td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 text-center font-bold text-blue-600">{c.nhom_to}</td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">{c.so_tc}</td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">{c.ten_giang_vien || '---'}</td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 text-right font-mono">
                            {c.hoc_phi_tam_tinh ? `${c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ` : '---'}
                          </td>
                          <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">
                            <button
                              type="button"
                              onClick={() => handleDropCourse(c)}
                              disabled={droppingCourseId === c.id_kqdk}
                              className="px-2 py-0.5 rounded text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50"
                              title="Hủy môn này"
                            >
                              {droppingCourseId === c.id_kqdk ? '...' : 'Hủy'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              EXACT TOOLS1S STATUS DISPLAY: <center><b id="kq"></b></center>
             ========================================================================= */}
          <div className="text-center pt-2">
            <b id="kq" className="text-sm font-bold text-purple-700 dark:text-purple-300">
              {kqText}
            </b>
          </div>
        </div>
      </div>
    </div>
  );
};
