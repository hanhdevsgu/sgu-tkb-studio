import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StopCircle, Eye, EyeOff, RefreshCw, BookOpen } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { ClassGroup } from '../types/course';
import {
  SguDkmhService,
  SguAuthUser,
  EnrolledCourseItem,
  RegistrationResultItem
} from '../services/sguDkmhService';

interface SelectedCourseItem {
  id: string; // group id
  group: ClassGroup;
  checked: boolean;
  status: 'idle' | 'submitting' | 'success' | 'error';
  message?: string;
}

export const DkmhPortalView: React.FC = () => {
  const { plans, activeTabId, allCourses, allSubjects, setToastMessage } = useTimetableStore();

  // Authentication
  const [role, setRole] = useState('svcq');
  const [username, setUsername] = useState('3124410007');
  const [password, setPassword] = useState('');
  const [vipCode, setVipCode] = useState('SUPER-PRO-UNLIMITED');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SguAuthUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Portal status & Result block
  const [portalMessage, setPortalMessage] = useState('Ngoài thời gian cho phép đăng ký(07:00 - 23:59)');
  const [requestCount, setRequestCount] = useState(0);
  const [resultNumber, setResultNumber] = useState(1);
  const [statusBadge, setStatusBadge] = useState('Lấy Danh sách nhóm tổ thành công..');

  // Input Mode: "filter" (Chọn từng môn) vs "quick" (Nhập nhanh MãMH|Nhóm|Tổ)
  const [inputMode, setInputMode] = useState<'filter' | 'quick'>('filter');
  const [quickInputText, setQuickInputText] = useState('');

  // Plan sync selector
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeTabId);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourseItem[]>([]);

  // Subject dropdown filter (when browsing courses)
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);

  // Live Enrolled Courses from SGU
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseItem[]>([]);
  const [showEnrolledBox, setShowEnrolledBox] = useState(false);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [droppingId, setDroppingId] = useState<string | null>(null);

  // 1. Initial Auto-load credentials from .env if available
  useEffect(() => {
    fetch('/api-local/env-login')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.token && data.user) {
          setToken(data.token);
          setUser(data.user);
          setUsername(data.user.mssv);
          checkPortalStatus(data.token);
          fetchEnrolledCourses(data.token);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Check Portal Status
  const checkPortalStatus = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await SguDkmhService.checkRegistrationPeriod(authToken);
      setPortalMessage(res.message);
    } catch (e: any) {
      setPortalMessage(e.message || 'Lỗi kiểm tra cổng');
    }
  };

  // 3. Fetch Enrolled Courses
  const fetchEnrolledCourses = async (authToken = token) => {
    if (!authToken) return;
    setIsLoadingEnrolled(true);
    try {
      const data = await SguDkmhService.getEnrolledCourses(authToken);
      setEnrolledCourses(data.courses);
    } catch (e) {
      console.warn('Enrolled fetch error:', e);
    } finally {
      setIsLoadingEnrolled(false);
    }
  };

  // 4. Load Plan into Selected Courses Table
  const loadPlanToTable = useCallback(
    (planId: string) => {
      const targetPlan = plans.find((p) => p.id === planId);
      if (!targetPlan) return;

      const items: SelectedCourseItem[] = [];
      for (const gid of targetPlan.selectedIds) {
        const found = allCourses.find((c) => c.id === gid);
        if (found) {
          items.push({
            id: found.id,
            group: found,
            checked: true,
            status: 'idle',
          });
        }
      }
      setSelectedCourses(items);
    },
    [plans, allCourses]
  );

  useEffect(() => {
    if (token) {
      loadPlanToTable(selectedPlanId);
    }
  }, [selectedPlanId, token, loadPlanToTable]);

  // 5. Login Handler
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      alert('INFO: Vui lòng nhập đầy đủ thông tin tài khoản và mật khẩu!');
      return;
    }

    setIsLoggingIn(true);
    setStatusBadge('Đang đăng nhập vào cổng đào tạo SGU...');

    try {
      const auth = await SguDkmhService.login(username.trim(), password);
      setToken(auth.token);
      setUser(auth.user);
      setStatusBadge('Đăng nhập thành công, nạp danh sách nhóm tổ...');
      setToastMessage(`Đăng nhập thành công: ${auth.user.name}`);
      setResultNumber((n) => n + 1);
      checkPortalStatus(auth.token);
      fetchEnrolledCourses(auth.token);
    } catch (err: any) {
      alert(`Đăng nhập thất bại: ${err.message}`);
      setStatusBadge(`Lỗi: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 6. Add course group from catalog to selected table
  const handleAddCourse = (group: ClassGroup) => {
    if (selectedCourses.some((item) => item.group.id === group.id)) {
      alert('Môn học / Nhóm này đã có trong danh sách chọn!');
      return;
    }
    setSelectedCourses((prev) => [
      ...prev,
      {
        id: group.id,
        group,
        checked: true,
        status: 'idle',
      },
    ]);
  };

  // Remove a course from table
  const handleRemoveCourse = (groupId: string) => {
    setSelectedCourses((prev) => prev.filter((item) => item.group.id !== groupId));
  };

  // Toggle checkbox
  const handleToggleCheck = (groupId: string) => {
    setSelectedCourses((prev) =>
      prev.map((item) => (item.group.id === groupId ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleToggleCheckAll = (checked: boolean) => {
    setSelectedCourses((prev) => prev.map((item) => ({ ...item, checked })));
  };

  // 7. Parse Quick Input text: e.g. "841108|01\n815087|02"
  const handleParseQuickInput = () => {
    if (!quickInputText.trim()) {
      alert('Vui lòng nhập danh sách môn học theo định dạng: MãMH|Nhóm|Tổ');
      return;
    }

    const lines = quickInputText.split('\n');
    let addedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split(/[|\s,]+/);
      const maMon = parts[0];
      const nhomTo = parts[1] || '01';

      const found = allCourses.find(
        (c) =>
          c.ma_mon.toLowerCase() === maMon.toLowerCase() &&
          (nhomTo ? c.nhom_to.replace(/^0+/, '') === nhomTo.replace(/^0+/, '') : true)
      );

      if (found && !selectedCourses.some((item) => item.group.id === found.id)) {
        selectedCourses.push({
          id: found.id,
          group: found,
          checked: true,
          status: 'idle',
        });
        addedCount++;
      }
    }

    setSelectedCourses([...selectedCourses]);
    alert(`Đã nhận diện và thêm ${addedCount} môn học vào bảng đăng ký!`);
  };

  // 8. SUBMIT ACTION (Exact Tools1s #ok)
  const handleOkSubmit = async () => {
    if (!token) {
      alert('Vui lòng đăng nhập tài khoản trước khi Submit!');
      return;
    }

    const toSubmit = selectedCourses.filter((item) => item.checked && item.status !== 'success');
    if (toSubmit.length === 0) {
      alert('Vui lòng chọn ít nhất 1 môn học để Submit!');
      return;
    }

    setIsRunning(true);
    stopRef.current = false;
    setRequestCount((c) => c + toSubmit.length);
    setStatusBadge(`Đang nộp đồng thời ${toSubmit.length} môn học vào SGU...`);

    // Set rows to submitting
    setSelectedCourses((prev) =>
      prev.map((item) =>
        item.checked && item.status !== 'success'
          ? { ...item, status: 'submitting', message: 'Đang gửi...' }
          : item
      )
    );

    try {
      const groups = toSubmit.map((item) => item.group);
      const results: RegistrationResultItem[] = await SguDkmhService.submitBatchRegistration(
        token,
        groups
      );

      let successCount = 0;
      let failCount = 0;

      setSelectedCourses((prev) =>
        prev.map((row) => {
          const res = results.find(
            (r) =>
              r.id === row.group.id ||
              r.id === row.group.id_to_hoc ||
              (r.ma_mon === row.group.ma_mon && r.nhom_to === row.group.nhom_to)
          );
          if (res) {
            if (res.success) {
              successCount++;
              return { ...row, status: 'success', message: res.message || 'Thành công', checked: false };
            } else {
              failCount++;
              return { ...row, status: 'error', message: res.message || 'Thất bại' };
            }
          }
          return row;
        })
      );

      setResultNumber((n) => n + 1);
      const summaryMsg = `Hoàn tất! Thành công: ${successCount} môn, Thất bại: ${failCount} môn.`;
      setStatusBadge(summaryMsg);
      setToastMessage(summaryMsg);

      await fetchEnrolledCourses(token);
    } catch (err: any) {
      setStatusBadge(`Lỗi nộp môn: ${err.message}`);
      setToastMessage(`Lỗi: ${err.message}`);
      setSelectedCourses((prev) =>
        prev.map((row) =>
          row.status === 'submitting'
            ? { ...row, status: 'error', message: err.message }
            : row
        )
      );
    } finally {
      setIsRunning(false);
    }
  };

  // 9. STOP ACTION (Tools1s #stop)
  const handleStop = () => {
    stopRef.current = true;
    setIsRunning(false);
    setStatusBadge('⏹️ Đã dừng tiến trình nộp đăng ký.');
    setToastMessage('Đã dừng tiến trình');
  };

  // 10. DROP COURSE
  const handleDropCourse = async (course: EnrolledCourseItem) => {
    if (!token) return;
    const ok = window.confirm(
      `Bạn có chắc chắn muốn HỦY đăng ký môn:\n"${course.ten_mon}" (${course.ma_mon} - Nhóm ${course.nhom_to})?`
    );
    if (!ok) return;

    setDroppingId(course.id_kqdk);
    setStatusBadge(`Đang hủy môn: ${course.ten_mon}...`);
    try {
      const res = await SguDkmhService.dropCourse(token, course.id_kqdk);
      if (res.success) {
        setStatusBadge(`Đã hủy môn: ${course.ten_mon}`);
        setToastMessage(`Đã hủy môn ${course.ten_mon}`);
        await fetchEnrolledCourses(token);
      } else {
        setStatusBadge(`Hủy thất bại: ${res.message}`);
        setToastMessage(`Hủy thất bại: ${res.message}`);
      }
    } catch (err: any) {
      setStatusBadge(`Lỗi hủy môn: ${err.message}`);
    } finally {
      setDroppingId(null);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setPassword('');
    setSelectedCourses([]);
    setEnrolledCourses([]);
    setStatusBadge('Đã đăng xuất. Vui lòng nhập tài khoản.');
  };

  // Filter available courses for catalog picker
  const filteredCatalogCourses = allCourses.filter((c) => {
    if (selectedSubjectCode && c.ma_mon !== selectedSubjectCode) return false;
    return true;
  });

  const checkedCount = selectedCourses.filter((item) => item.checked).length;

  return (
    <div className="w-full bg-[#ecf0f5] text-[#333333] min-h-screen py-4 px-2 sm:px-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-3">
        {/* =========================================================================
            EXACT TOOLS1S NOTICES AT THE TOP
           ========================================================================= */}
        <div
          className="p-2.5 sm:p-3 rounded text-xs sm:text-sm font-normal"
          style={{
            backgroundColor: '#ffeb99',
            color: '#7a3e00',
            border: '1px solid #ffcc66',
          }}
        >
          <span>
            <b>Thông Báo:</b> Công cụ hỗ trợ sinh viên Đại học Sài Gòn (SGU) đăng ký học phần trực tiếp
            bằng Live API Client, bỏ qua giao diện web trường khi cổng mở để không bị nghẽn mạng!
          </span>
        </div>

        <div
          className="p-2.5 rounded text-xs sm:text-sm font-medium"
          style={{
            backgroundColor: '#dff0d8',
            color: '#3c763d',
            border: '1px solid #d6e9c6',
          }}
        >
          <span>ℹ Sau khi đăng nhập, bạn sẽ thấy bảng điều khiển đăng ký môn học dễ dàng!</span>
        </div>

        {/* =========================================================================
            EXACT TOOLS1S MAIN CONTAINER: .box.box-primary
           ========================================================================= */}
        <div
          className="bg-white border border-[#d2d6de] rounded shadow-sm overflow-hidden"
          style={{ borderTop: '3px solid #3c8dbc' }}
        >
          {/* Box Header */}
          <div className="px-4 py-3 border-b border-[#f4f4f4] flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#00a65a] m-0 flex items-center gap-2">
              <span>Tool đăng kí học phần SGU - Trường Đại học Sài Gòn</span>
              <BookOpen className="size-5 text-[#3c8dbc] inline-block" />
            </h1>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs px-2.5 py-1 rounded bg-[#f4f4f4] border border-[#d2d6de] hover:bg-gray-200 text-gray-700 cursor-pointer"
              >
                Đổi tài khoản
              </button>
            )}
          </div>

          {/* Box Body */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* =====================================================================
                SECTION A: LOGIN FORM (If not logged in)
               ===================================================================== */}
            {!user ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 max-w-2xl mx-auto py-2 text-sm">
                {/* Role Dropdown */}
                <div className="form-group space-y-1">
                  <label htmlFor="ChonTypeLogin" className="font-bold text-gray-700 block text-xs">
                    Chọn vai trò đăng nhập:{' '}
                  </label>
                  <select
                    id="ChonTypeLogin"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d2d6de] rounded bg-white text-gray-800 text-sm focus:outline-none focus:border-[#3c8dbc]"
                  >
                    <option value="svcq">Sinh viên (Hệ chính qui)</option>
                    <option value="svdttx">Sinh viên (Đào tạo từ xa và Vừa làm vừa học)</option>
                    <option value="hvsdh">Học viên Sau Đại học</option>
                  </select>
                </div>

                {/* Username */}
                <div className="form-group space-y-1">
                  <label htmlFor="usernameTheme1" className="font-bold text-gray-700 block text-xs">
                    Tài khoản trang thongtindaotao.sgu.edu.vn:{' '}
                  </label>
                  <input
                    type="text"
                    id="usernameTheme1"
                    name="usernameTheme1"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tài khoản (MSSV)"
                    className="w-full px-3 py-2 border border-[#d2d6de] rounded bg-white text-gray-800 text-sm focus:outline-none focus:border-[#3c8dbc]"
                    required
                  />
                </div>

                {/* Password */}
                <div className="form-group space-y-1">
                  <label htmlFor="passwordTheme1" className="font-bold text-gray-700 block text-xs">
                    Mật khẩu trang thongtindaotao.sgu.edu.vn:{' '}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="passwordTheme1"
                      name="passwordTheme1"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu"
                      className="w-full px-3 py-2 border border-[#d2d6de] rounded bg-white text-gray-800 text-sm focus:outline-none focus:border-[#3c8dbc]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* VIP CODE (Tools1s signature field) */}
                <div className="form-group space-y-1">
                  <label htmlFor="vip_code" className="font-bold text-gray-700 block text-xs">
                    Nhập VIP CODE <span className="text-red-600">loại SUPER-PRO</span>:{' '}
                    <span className="text-green-600">(Đã kích hoạt bản quyền Vĩnh viễn Miễn phí)</span>
                  </label>
                  <input
                    type="text"
                    id="vip_code"
                    name="vip_code"
                    value={vipCode}
                    onChange={(e) => setVipCode(e.target.value)}
                    placeholder="Nhập VIP CODE để sử dụng"
                    className="w-full px-3 py-2 border border-[#d2d6de] rounded bg-white text-gray-800 text-sm font-mono text-green-700 font-bold focus:outline-none focus:border-[#3c8dbc]"
                  />
                </div>

                {/* Auto fill from env button */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="px-6 py-2 rounded text-white font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: '#605ca8', borderColor: '#545096' }}
                  >
                    {isLoggingIn ? 'Đang đăng nhập...' : 'Submit'}
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
                            checkPortalStatus(data.token);
                            fetchEnrolledCourses(data.token);
                            setToastMessage(`Đã kết nối tài khoản: ${data.user.name}`);
                          }
                        });
                    }}
                    className="px-3 py-2 rounded border border-[#d2d6de] text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                  >
                    ⚡ Nạp tài khoản từ .env
                  </button>
                </div>
              </form>
            ) : (
              /* =====================================================================
                  SECTION B: POST-LOGIN INTERFACE (Exact Tools1s Video workflow)
                 ===================================================================== */
              <div className="space-y-4">
                {/* 1. Tools1s Student Info Callout: #html_show_info_dkmh */}
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
                      <strong>Sinh viên:</strong> <span className="font-bold text-[#000080]">{user.name}</span> (
                      <span className="font-mono">{user.mssv}</span>) &nbsp;|&nbsp;{' '}
                      <strong>Học kỳ:</strong> Học kỳ 1 (2026 - 2027)
                    </div>
                    <div className="font-bold text-amber-800">
                      Cổng đào tạo: <span className="underline">{portalMessage}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Mode Selector: Radio (Video at 7:30 / 10:00) */}
                <div className="space-y-2 pt-1 border-t border-gray-200">
                  <label className="font-bold text-sm text-gray-800 block">
                    Chọn các môn học mà bạn muốn đăng ký:
                  </label>

                  <div className="space-y-1.5 text-xs text-gray-700 pl-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="chon_mode"
                        checked={inputMode === 'filter'}
                        onChange={() => setInputMode('filter')}
                        className="cursor-pointer"
                      />
                      <span>Chọn từng Môn học theo các kiểu lọc dữ liệu (hoặc nạp từ Thời khóa biểu Studio)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="chon_mode"
                        checked={inputMode === 'quick'}
                        onChange={() => setInputMode('quick')}
                        className="cursor-pointer"
                      />
                      <span>Nhập nhanh Danh sách Môn học (MãMH|Nhóm|Tổ|Lớp)</span>
                    </label>
                  </div>
                </div>

                {/* 3. Filter Controls: Dropdown / Quick Input box */}
                {inputMode === 'quick' ? (
                  /* Quick Input Textarea (Video at 10:00) */
                  <div className="p-3 border border-[#d2d6de] rounded bg-[#fafafa] space-y-2 text-xs">
                    <p className="text-gray-600 m-0">
                      - Nhập nhanh danh sách Môn học sẽ giúp bạn tiết kiệm rất nhiều thời gian so với chọn từng Môn học theo từng điều kiện lọc.
                    </p>
                    <p className="text-gray-600 m-0">
                      - Định dạng dữ liệu môn học khi nhập nhanh: <strong>MãMH|Nhóm|Tổ|Lớp</strong>. Ví dụ: <span className="bg-yellow-200 px-1 py-0.5 font-mono font-bold text-red-600">841108|01</span> hoặc <span className="bg-yellow-200 px-1 py-0.5 font-mono font-bold text-red-600">815087|02|01</span> (Mỗi môn 1 dòng).
                    </p>
                    <textarea
                      rows={4}
                      value={quickInputText}
                      onChange={(e) => setQuickInputText(e.target.value)}
                      placeholder="841108|01&#10;815087|02"
                      className="w-full p-2.5 font-mono text-xs border border-[#d2d6de] rounded bg-white text-gray-800 focus:outline-none focus:border-[#3c8dbc]"
                    />
                    <button
                      type="button"
                      onClick={handleParseQuickInput}
                      className="px-4 py-1.5 rounded text-white font-bold text-xs bg-[#3c8dbc] hover:bg-[#367fa9] cursor-pointer"
                    >
                      Xác nhận thêm danh sách môn
                    </button>
                  </div>
                ) : (
                  /* Filter Dropdown & Studio Plan Sync (Video at 7:30) */
                  <div className="p-3 border border-[#d2d6de] rounded bg-[#fafafa] space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-gray-700 block mb-1">
                          Nạp nhanh từ Phương án Thời khóa biểu:
                        </label>
                        <div className="flex items-center gap-1">
                          {plans.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedPlanId(p.id)}
                              className={`px-3 py-1.5 rounded font-bold text-xs cursor-pointer border ${
                                selectedPlanId === p.id
                                  ? 'bg-[#3c8dbc] text-white border-[#367fa9]'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {p.name} ({p.selectedIds.length})
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-gray-700 block mb-1">
                          Tìm & Thêm môn trực tiếp từ danh mục SGU:
                        </label>
                        <select
                          value={selectedSubjectCode}
                          onChange={(e) => setSelectedSubjectCode(e.target.value)}
                          className="w-full p-1.5 border border-[#d2d6de] rounded bg-white text-xs text-gray-800"
                        >
                          <option value="">-- Chọn môn học để hiển thị danh sách lớp mở --</option>
                          {allSubjects.map((s) => (
                            <option key={s.ma_mon} value={s.ma_mon}>
                              {s.ma_mon} - {s.ten_mon} ({s.so_tc} TC)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Available class groups for selected subject with Cyan [Thêm] button */}
                    {selectedSubjectCode && (
                      <div className="border border-blue-200 rounded p-2 bg-blue-50/50 space-y-1.5">
                        <span className="font-bold text-blue-900 block">Các nhóm lớp mở của môn này:</span>
                        <div className="max-h-36 overflow-y-auto divide-y divide-blue-100">
                          {filteredCatalogCourses.map((grp) => (
                            <div key={grp.id} className="py-1 flex items-center justify-between gap-2 text-xs">
                              <div>
                                <strong>Nhóm {grp.nhom_to}</strong> • {grp.so_tc} TC • Còn{' '}
                                <span className="font-bold text-green-700">{grp.sl_cl ?? 85}</span> chỗ •{' '}
                                <span className="text-gray-500">
                                  {grp.parsedSessions.map((s) => `${s.thuStr} T${s.tietStart}-${s.tietEnd}`).join(', ')}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddCourse(grp)}
                                className="px-2.5 py-0.5 rounded text-white font-bold text-[11px] bg-[#00c0ef] hover:bg-[#00acd6] cursor-pointer"
                              >
                                + Thêm
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Exact Tools1s Data Table (Video at 15:00) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-bold text-gray-800">
                      Các môn học đã chọn để đăng ký: ({selectedCourses.length} môn)
                    </span>
                    <span>
                      Đã tích chọn: <strong className="text-blue-600 font-bold">{checkedCount}</strong> / {selectedCourses.length} môn
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-[#d2d6de] rounded bg-white">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#f4f4f4] text-gray-700 border-b border-[#d2d6de] font-bold">
                        <tr>
                          <th className="py-2 px-2 text-center w-16">Thao tác</th>
                          <th className="py-2 px-2 text-center w-10">
                            <input
                              type="checkbox"
                              checked={selectedCourses.length > 0 && selectedCourses.every((r) => r.checked)}
                              onChange={(e) => handleToggleCheckAll(e.target.checked)}
                              className="cursor-pointer"
                              title="Chọn tất cả"
                            />
                          </th>
                          <th className="py-2 px-2.5 w-20">Mã MH ⇅</th>
                          <th className="py-2 px-2.5">Tên môn học ⇅</th>
                          <th className="py-2 px-2 text-center w-14">Nhóm ⇅</th>
                          <th className="py-2 px-2 text-center w-12">Tổ ⇅</th>
                          <th className="py-2 px-2 text-center w-14">Số TC ⇅</th>
                          <th className="py-2 px-2.5 text-center w-24">Còn lại ⇅</th>
                          <th className="py-2 px-2.5">Thời khóa biểu ⇅</th>
                          <th className="py-2 px-2.5 text-center w-24">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f4f4f4]">
                        {selectedCourses.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-6 text-center text-gray-500 italic">
                              Chưa có môn nào trong bảng. Hãy chọn phương án hoặc tìm môn bên trên để nạp vào.
                            </td>
                          </tr>
                        ) : (
                          selectedCourses.map((item) => {
                            const { group, checked, status, message } = item;
                            return (
                              <tr key={group.id} className="hover:bg-[#f9f9f9]">
                                {/* Red [Xóa] button (Tools1s Video at 15:00) */}
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCourse(group.id)}
                                    className="px-2 py-0.5 rounded text-white font-bold text-[11px] bg-[#dd4b39] hover:bg-[#d73925] cursor-pointer"
                                    title="Xóa môn này khỏi bảng"
                                  >
                                    Xóa
                                  </button>
                                </td>

                                {/* Checkbox */}
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleCheck(group.id)}
                                    className="cursor-pointer"
                                  />
                                </td>

                                {/* Mã MH highlighted yellow like Tools1s video */}
                                <td className="py-2 px-2.5 font-mono font-bold">
                                  <mark className="bg-yellow-200 px-1 py-0.2 rounded text-gray-900">
                                    {group.ma_mon}
                                  </mark>
                                </td>

                                <td className="py-2 px-2.5 font-medium text-gray-800">{group.ten_mon}</td>
                                <td className="py-2 px-2 text-center font-bold text-blue-700">{group.nhom_to}</td>
                                <td className="py-2 px-2 text-center text-gray-500">--</td>
                                <td className="py-2 px-2 text-center">{group.so_tc}</td>

                                {/* Còn lại highlighted red/green */}
                                <td className="py-2 px-2.5 text-center font-bold text-green-700">
                                  {group.sl_cl ?? 85} / {group.sl_cp ?? 85}
                                </td>

                                <td className="py-2 px-2.5 text-gray-600">
                                  {group.parsedSessions && group.parsedSessions.length > 0
                                    ? group.parsedSessions
                                        .map((s) => `${s.thuStr} T${s.tietStart}-${s.tietEnd}`)
                                        .join(' | ')
                                    : group.tkb_raw || 'Chưa có lịch'}
                                </td>

                                <td className="py-2 px-2.5 text-center">
                                  {status === 'idle' && (
                                    <span className="px-1.5 py-0.2 rounded text-[11px] bg-gray-100 text-gray-600 border border-gray-300">
                                      Chờ
                                    </span>
                                  )}
                                  {status === 'submitting' && (
                                    <span className="px-1.5 py-0.2 rounded text-[11px] bg-blue-100 text-blue-700 border border-blue-300 animate-pulse font-bold">
                                      Đang gửi...
                                    </span>
                                  )}
                                  {status === 'success' && (
                                    <span className="px-1.5 py-0.2 rounded text-[11px] bg-green-100 text-green-800 border border-green-300 font-bold">
                                      ✓ Thành công
                                    </span>
                                  )}
                                  {status === 'error' && (
                                    <span
                                      className="px-1.5 py-0.2 rounded text-[11px] bg-red-100 text-red-700 border border-red-300 font-bold truncate max-w-[80px] inline-block"
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

                  {/* Datatables pagination summary (Video at 5:00) */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span>Hiển thị 1 đến {selectedCourses.length} của {selectedCourses.length} mục</span>
                    <div className="flex items-center gap-1">
                      <button type="button" className="px-2 py-0.5 border border-gray-300 rounded bg-white text-gray-600 disabled:opacity-50">Lùi</button>
                      <span className="px-2 py-0.5 bg-[#3c8dbc] text-white font-bold rounded">1</span>
                      <button type="button" className="px-2 py-0.5 border border-gray-300 rounded bg-white text-gray-600 disabled:opacity-50">Tiến</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              EXACT TOOLS1S FOOTER: .box-footer
              [Submit] (Orange/Amber)  [Stop] (Blue)  [Xem kết quả đăng ký] (Green on right)
             ========================================================================= */}
          <div className="px-4 py-3 bg-[#fbfbfb] border-t border-[#f4f4f4] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* 1. SUBMIT BUTTON (Orange/Amber in video at 5:00) */}
                <button
                  type="button"
                  id="ok"
                  onClick={handleOkSubmit}
                  disabled={isRunning || !user || checkedCount === 0}
                  className="px-6 py-2 rounded text-white font-bold text-sm shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  style={{ backgroundColor: '#f39c12', borderColor: '#e08e0b' }}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Đang nộp...</span>
                    </>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>

                {/* 2. STOP BUTTON (Blue in video) */}
                <button
                  type="button"
                  id="stop"
                  onClick={handleStop}
                  disabled={!isRunning}
                  className="px-5 py-2 rounded text-white font-bold text-sm shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: '#3c8dbc', borderColor: '#367fa9' }}
                >
                  <StopCircle className="size-4" />
                  <span>Stop</span>
                </button>
              </div>

              {/* 3. XEM KẾT QUẢ ĐĂNG KÝ (Green right-aligned in video) */}
              <button
                type="button"
                id="check_kqdk"
                onClick={() => {
                  setShowEnrolledBox(true);
                  if (token) fetchEnrolledCourses();
                }}
                disabled={!token || isLoadingEnrolled}
                className="px-5 py-2 rounded text-white font-bold text-sm shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: '#00a65a', borderColor: '#008d4c' }}
              >
                {isLoadingEnrolled ? 'Đang tải...' : 'Xem kết quả đăng ký'}
              </button>
            </div>

            {/* =====================================================================
                EXACT TOOLS1S RESULT CENTER BLOCK: (Video at 5:00)
                - Result X -
                ↓↓
                Tên của bạn: ...
                MSSV: ...
                [Số lượng requests: ...]
                [Lấy Danh sách nhóm tổ thành công..]
               ===================================================================== */}
            <div className="text-center py-3 space-y-1">
              <div className="text-blue-700 font-bold text-base tracking-wide">
                - Result {resultNumber} -
              </div>
              <div className="text-blue-700 font-bold text-sm">↓↓</div>

              {user && (
                <div className="space-y-0.5 text-xs sm:text-sm">
                  <div>
                    Tên của bạn: <strong className="text-red-600 font-bold">{user.name}</strong>
                  </div>
                  <div>
                    MSSV: <strong className="text-blue-800 font-bold">{user.mssv}</strong>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col items-center gap-1.5">
                <span
                  className="px-4 py-1 rounded text-white font-bold text-xs"
                  style={{ backgroundColor: '#337ab7' }}
                >
                  Số lượng requests: {requestCount}
                </span>

                <span
                  className="px-4 py-1 rounded text-white font-bold text-xs"
                  style={{ backgroundColor: '#5bc0de' }}
                >
                  {statusBadge}
                </span>
              </div>
            </div>

            {/* =====================================================================
                EXACT TOOLS1S ENROLLED TABLE CONTAINER: #show_div_kqdh
                (border: 2px solid DarkTurquoise; border-radius: 5px;)
               ===================================================================== */}
            {user && showEnrolledBox && (
              <div id="show_div_kqdh" className="space-y-2 pt-2">
                <hr className="border-gray-300" />

                <div className="flex items-center justify-between">
                  <label className="text-base font-bold text-gray-800 m-0">
                    Danh sách môn học đã đăng ký: <i className="text-green-700 font-bold">{enrolledCourses.length} môn</i>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowEnrolledBox(false)}
                    className="px-2.5 py-1 text-xs rounded text-white font-semibold cursor-pointer"
                    style={{ backgroundColor: '#00c0ef', borderColor: '#00acd6' }}
                  >
                    Ẩn bảng này
                  </button>
                </div>

                <div
                  id="show_table_kqdh"
                  className="overflow-x-auto bg-white"
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
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#f9f9f9] border-b border-gray-300 font-bold text-gray-700">
                        <tr>
                          <th className="p-2 border border-gray-200 text-center w-10">STT</th>
                          <th className="p-2 border border-gray-200 w-24">Mã môn</th>
                          <th className="p-2 border border-gray-200">Tên môn học</th>
                          <th className="p-2 border border-gray-200 text-center w-14">Nhóm/Tổ</th>
                          <th className="p-2 border border-gray-200 text-center w-14">Số TC</th>
                          <th className="p-2 border border-gray-200">Giảng viên</th>
                          <th className="p-2 border border-gray-200 text-right w-28">Học phí</th>
                          <th className="p-2 border border-gray-200 text-center w-16">Hủy môn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {enrolledCourses.map((c, i) => (
                          <tr key={c.id_kqdk} className="hover:bg-gray-50">
                            <td className="p-2 border border-gray-200 text-center">{i + 1}</td>
                            <td className="p-2 border border-gray-200 font-mono font-bold">{c.ma_mon}</td>
                            <td className="p-2 border border-gray-200 font-medium">{c.ten_mon}</td>
                            <td className="p-2 border border-gray-200 text-center font-bold text-blue-700">{c.nhom_to}</td>
                            <td className="p-2 border border-gray-200 text-center">{c.so_tc}</td>
                            <td className="p-2 border border-gray-200 text-gray-600">{c.ten_giang_vien || '---'}</td>
                            <td className="p-2 border border-gray-200 text-right font-mono">
                              {c.hoc_phi_tam_tinh ? `${c.hoc_phi_tam_tinh.toLocaleString('vi-VN')} đ` : '---'}
                            </td>
                            <td className="p-2 border border-gray-200 text-center">
                              <button
                                type="button"
                                onClick={() => handleDropCourse(c)}
                                disabled={droppingId === c.id_kqdk}
                                className="px-2 py-0.5 rounded text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50"
                              >
                                {droppingId === c.id_kqdk ? '...' : 'Hủy'}
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
          </div>
        </div>
      </div>
    </div>
  );
};
