export interface SguAuthUser {
  name: string;
  mssv: string;
  lop?: string;
  khoa?: string;
}

export interface EnrolledCourseItem {
  id_kqdk: string;
  id_to_hoc: string;
  ma_mon: string;
  ten_mon: string;
  nhom_to: string;
  to_hoc?: string;
  so_tc: number;
  lop?: string;
  tkb?: any[];
  tkb_str?: string;
  enable_xoa?: boolean;
  dien_giai_enable_xoa?: string;
  hoc_phi_tam_tinh?: number;
  ngay_dang_ky?: string;
  ten_giang_vien?: string;
  trang_thai_dang_ky?: string;
}

export type SguErrorCategory =
  | 'TIEN_QUYET'      // Vi phạm môn tiên quyết / điều kiện
  | 'VUOT_TIN_CHI'    // Vượt quá số tín chỉ tối đa / dưới tối thiểu
  | 'HET_CHO'         // Lớp học phần đã hết chỗ (sl_cl <= 0)
  | 'TRUNG_LICH'      // Trùng thời khóa biểu / trùng tiết
  | 'NGOAI_GIO'       // Ngoài thời gian cho phép đăng ký (07:00 - 23:59)
  | 'DA_DANG_KY'      // Đã đăng ký môn học này
  | 'HOC_PHI'         // Nợ học phí
  | 'KHONG_DUNG_CTDT' // Không thuộc CTĐT / sai khóa
  | 'PHIEN_HET_HAN'   // Token hết hạn / 401
  | 'UNKNOWN_ERROR';  // Lỗi khác từ SGU

export interface SguParsedError {
  category: SguErrorCategory;
  badgeLabel: string;
  badgeColor: string;
  rawMessage: string;
  explanation: string;
  suggestion: string;
}

export interface RegistrationResultItem {
  id: string;
  ma_mon: string;
  ten_mon: string;
  nhom_to: string;
  so_tc: number;
  success: boolean;
  message: string;
  parsedError?: SguParsedError;
  raw?: any;
}

export interface RegisterCourseResult {
  success: boolean;
  message: string;
  parsedError?: SguParsedError;
  raw?: any;
  authExpired?: boolean;
  transient?: boolean;
  httpStatus?: number;
  newToken?: string;
}

/**
 * Phân tích và phân loại chính xác 100% câu thông báo phản hồi từ máy chủ SGU
 */
export function parseSguError(rawMessage: string): SguParsedError {
  const lower = (rawMessage || '').normalize('NFC').toLowerCase();

  // 0. Phiên đăng nhập hết hạn (401) — phải kiểm tra đầu tiên để không bị nhầm sang nhóm khác
  if (
    lower === 'expired' ||
    lower.includes('token expired') ||
    lower.includes('phiên đăng nhập') ||
    lower.includes('đăng nhập lại') ||
    lower.includes('unauthorized') ||
    lower.includes('(401)')
  ) {
    return {
      category: 'PHIEN_HET_HAN',
      badgeLabel: 'Hết phiên đăng nhập',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      rawMessage,
      explanation: 'Token đăng nhập SGU đã hết hạn hoặc không hợp lệ.',
      suggestion: 'Đăng nhập lại tài khoản sinh viên rồi bấm đăng ký lại.',
    };
  }

  // 1. Lỗi tiên quyết / môn điều kiện / chưa học
  if (
    lower.includes('tiên quyết') ||
    lower.includes('tien quyet') ||
    lower.includes('điều kiện') ||
    lower.includes('chưa học') ||
    lower.includes('chưa đạt') ||
    lower.includes('học trước') ||
    lower.includes('song hành')
  ) {
    return {
      category: 'TIEN_QUYET',
      badgeLabel: 'Vi phạm tiên quyết',
      badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      rawMessage,
      explanation: 'Sinh viên chưa đạt môn học tiên quyết hoặc chưa hoàn thành môn học điều kiện bắt buộc theo CTĐT.',
      suggestion: 'Cần tích lũy môn học tiên quyết trước khi đăng ký học phần này.',
    };
  }

  // 2. Lỗi hết chỗ / sĩ số đầy (Kiểm tra TRƯỚC lỗi vượt tín chỉ để câu "vượt quá sĩ số / số lượng của nhóm" không bị nhầm sang VUOT_TIN_CHI)
  if (
    lower.includes('hết chỗ') ||
    lower.includes('đủ số lượng') ||
    lower.includes('sĩ số') ||
    lower.includes('không còn chỗ') ||
    lower.includes('đã đầy') ||
    lower.includes('hết chỉ tiêu') ||
    lower.includes('đủ sinh viên') ||
    /vượt\s+quá\s+(số\s+lượng|sĩ\s+số|chỉ\s+tiêu)/.test(lower)
  ) {
    return {
      category: 'HET_CHO',
      badgeLabel: 'Lớp đã hết chỗ',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      rawMessage,
      explanation: 'Lớp học phần này đã đạt sĩ số tối đa cho phép (sl_cl = 0).',
      suggestion: 'Chọn nhóm lớp khác còn chỗ hoặc canh khi có sinh viên khác nhả môn.',
    };
  }

  // 3. Lỗi vượt số tín chỉ tối đa
  if (
    lower.includes('vượt quá') ||
    lower.includes('số tín chỉ') ||
    lower.includes('tín chỉ tối đa') ||
    lower.includes('vượt trần') ||
    lower.includes('tối thiểu')
  ) {
    return {
      category: 'VUOT_TIN_CHI',
      badgeLabel: 'Vượt quá tín chỉ',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      rawMessage,
      explanation: 'Tổng số tín chỉ đăng ký vượt quá giới hạn tối đa cho phép theo quy chế đào tạo SGU (25 TC / kỳ chính).',
      suggestion: 'Bỏ bớt môn học khác hoặc làm đơn xin đăng ký vượt chỉ tiêu gửi phòng đào tạo.',
    };
  }

  // 4. Lỗi trùng thời khóa biểu
  if (
    lower.includes('trùng') ||
    lower.includes('trung tkb') ||
    lower.includes('trùng tiết') ||
    lower.includes('trùng lịch') ||
    lower.includes('thời khóa biểu')
  ) {
    return {
      category: 'TRUNG_LICH',
      badgeLabel: 'Trùng lịch học',
      badgeColor: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      rawMessage,
      explanation: 'Thời khóa biểu của lớp này bị trùng thứ và tiết với môn học khác đã chọn/đã ghi nhận.',
      suggestion: 'Chọn nhóm lớp khác có khung giờ không bị trùng tiết.',
    };
  }

  // 5. Lỗi ngoài khung giờ đăng ký / hết hạn đăng ký
  if (
    lower.includes('ngoài thời gian') ||
    lower.includes('không được đăng ký') ||
    lower.includes('thời điểm hiện tại') ||
    lower.includes('chưa mở') ||
    lower.includes('hết thời gian') ||
    lower.includes('hết hạn đăng ký') ||
    lower.includes('đã kết thúc') ||
    lower.includes('đã đóng')
  ) {
    return {
      category: 'NGOAI_GIO',
      badgeLabel: 'Ngoài giờ đăng ký',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      rawMessage,
      explanation: 'Cổng đào tạo SGU chỉ mở đăng ký theo khung giờ quy định (07:00 - 23:59) hoặc theo đợt khóa sinh viên.',
      suggestion: 'Vui lòng quay lại trong khung giờ mở cổng chính thức (07:00 - 23:59).',
    };
  }

  // 6. Lỗi nợ học phí (kiểm tra TRƯỚC nhóm "đã đăng ký" để câu "đã bị khóa đăng ký do nợ học phí" không bị coi là thành công)
  if (lower.includes('học phí') || /(^|\s)nợ(\s|$|[.,:;])/.test(lower)) {
    return {
      category: 'HOC_PHI',
      badgeLabel: 'Khóa do học phí',
      badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
      rawMessage,
      explanation: 'Tài khoản chưa hoàn thành nghĩa vụ học phí kỳ trước nên bị tạm khóa chức năng đăng ký.',
      suggestion: 'Vui lòng hoàn tất học phí qua cổng thanh toán SGU.',
    };
  }

  // 7. Môn đã được đăng ký trước đó. Nhóm này được coi như THÀNH CÔNG nên khớp CHẶT:
  //    bắt buộc cụm "đã (được) đăng ký" và không có từ phủ định nào trong câu.
  const hasNegativeWord = /(không|chưa|hết|khóa|khoá|lỗi|thất bại|bị)/.test(lower);
  if (
    !hasNegativeWord &&
    (
      /đã\s+(được\s+)?đăng\s*ký/.test(lower) ||
      lower.includes('đã có trong danh sách') ||
      lower.includes('đã có trong kết quả') ||
      lower.includes('đã tồn tại')
    )
  ) {
    return {
      category: 'DA_DANG_KY',
      badgeLabel: 'Đã có môn này',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      rawMessage,
      explanation: 'Môn học này đã được ghi nhận thành công trên cổng đào tạo SGU.',
      suggestion: 'Không cần gửi lại yêu cầu đăng ký cho môn này.',
    };
  }

  // 8. Lỗi không đúng CTĐT / ngành
  if (lower.includes('chương trình') || lower.includes('ctdt') || lower.includes('ngành') || lower.includes('khóa')) {
    return {
      category: 'KHONG_DUNG_CTDT',
      badgeLabel: 'Sai CTĐT / Ngành',
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      rawMessage,
      explanation: 'Lớp học phần mở riêng cho chuyên ngành hoặc khóa học khác, không mở cho ngành của bạn.',
      suggestion: 'Chọn lớp học phần mở cho đúng chuyên ngành của bạn.',
    };
  }

  // 9. Lỗi mặc định khác từ SGU
  return {
    category: 'UNKNOWN_ERROR',
    badgeLabel: 'Lỗi từ SGU',
    badgeColor: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    rawMessage,
    explanation: rawMessage || 'Lỗi xử lý giao dịch đăng ký từ hệ thống đào tạo SGU.',
    suggestion: 'Kiểm tra lại trạng thái trên cổng SGU hoặc thử lại sau ít giây.',
  };
}

export type GateState = 'open' | 'closed' | 'unknown';
export type FetchFailureKind = 'network' | 'html' | 'http' | 'parse';

export interface FetchSafeResult<T> {
  ok: boolean;
  data?: T;
  kind?: FetchFailureKind;
  status?: number;
  errorMessage?: string;
}

/**
 * Fetch an API endpoint with comprehensive defensive checks and failure classification:
 * Classifies network drops, HTML redirect/error pages, HTTP statuses, and JSON parse errors.
 */
export async function fetchJsonSafely<T>(url: string, init?: RequestInit): Promise<FetchSafeResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: any) {
    return {
      ok: false,
      kind: 'network',
      errorMessage: 'Không kết nối được tới cổng SGU (lỗi mạng hoặc máy chủ chưa phản hồi). Thử lại sau 10 giây.',
    };
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      kind: 'html',
      status: res.status,
      errorMessage: `Máy chủ SGU phản hồi định dạng HTML (mã ${res.status}) - Cổng có thể đang bảo trì hoặc chuyển hướng đăng nhập.`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      kind: 'http',
      status: res.status,
      errorMessage: `Cổng đào tạo SGU phản hồi mã lỗi HTTP ${res.status}.`,
    };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (parseErr: any) {
    return {
      ok: false,
      kind: 'parse',
      errorMessage: 'Lỗi định dạng dữ liệu phản hồi từ SGU (không thể đọc JSON).',
    };
  }
}

export function isJsonAuthExpired(json: any): boolean {
  if (!json || typeof json !== 'object') return false;
  if (json.code === 401 || json.status === 401) return true;
  const msg = String(json.message || json.error || json?.data?.thong_bao_loi || '').trim().toLowerCase();
  return msg === 'expired' || msg === 'unauthorized' || msg.includes('token expired');
}

export class SguDkmhService {
  /**
   * Auto-login using local .env credentials
   */
  static async loginFromEnv(): Promise<{ token: string; user: SguAuthUser }> {
    const res = await fetch('/api-local/env-login');
    const data = await res.json();
    if (!data.success || !data.token) {
      throw new Error(data.error || 'Đăng nhập từ tài khoản .env thất bại');
    }
    return { token: data.token, user: data.user };
  }

  /**
   * Manual login using MSSV and password (with safe JSON parsing & transient retry)
   */
  static async login(username: string, password: string, attempt = 0): Promise<{ token: string; user: SguAuthUser }> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username.trim());
    params.append('password', password);

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'idpc': '0',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err: any) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
        return this.login(username, password, attempt + 1);
      }
      throw new Error('Không thể kết nối máy chủ đăng nhập SGU. Vui lòng thử lại.');
    }

    if ([502, 503, 504, 429].includes(res.status) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 700));
      return this.login(username, password, attempt + 1);
    }

    let data: any = null;
    try {
      const text = await res.text();
      data = JSON.parse(text);
    } catch {
      throw new Error(`Máy chủ đăng nhập SGU đang quá tải (HTTP ${res.status}). Vui lòng thử lại sau vài giây.`);
    }

    if (!data?.access_token) {
      const errMsg = data?.message || data?.error_description || data?.error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại tên đăng nhập và mật khẩu.';
      throw new Error(errMsg);
    }

    return {
      token: data.access_token,
      user: {
        name: data.name || data.userName,
        mssv: data.userName || username,
      },
    };
  }

  /**
   * Tự động lưu và cập nhật thông tin tài khoản + Token vào file .env cục bộ
   */
  static async updateEnvAccount(
    username?: string,
    password?: string,
    token?: string,
    name?: string,
    lop?: string
  ): Promise<boolean> {
    try {
      const res = await fetch('/api-local/update-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, token, name, lop }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Xóa sạch thông tin tài khoản và token khỏi file .env cục bộ khi đăng xuất
   */
  static async clearEnvAccount(): Promise<boolean> {
    try {
      const res = await fetch('/api-local/clear-env', {
        method: 'POST',
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Check if student registration period is currently open (3 states: open | closed | unknown)
   */
  static async checkRegistrationPeriod(
    token?: string | null,
    alreadyRefreshed = false
  ): Promise<{
    state: GateState;
    isOpen: boolean;
    message: string;
    kind?: FetchFailureKind;
    status?: number;
    newToken?: string;
  }> {
    if (!token) {
      return {
        state: 'unknown',
        isOpen: false,
        message: 'Chưa đăng nhập SGU',
        kind: 'http',
        status: 401,
      };
    }

    const result = await fetchJsonSafely<any>('/api/dkmh/w-thoigiansinhviendkmh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idpc': '0',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!result.ok || result.data === undefined) {
      const is401 = result.status === 401;
      if (is401 && !alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.checkRegistrationPeriod(fresh, true);
          return { ...retried, newToken: fresh };
        }
      }
      return {
        state: 'unknown',
        isOpen: false,
        message: is401
          ? 'Phiên đăng nhập SGU đã hết hạn'
          : (result.errorMessage || 'Không thể kết nối đến cổng SGU. Thử lại sau 10 giây.'),
        kind: result.kind,
        status: result.status,
      };
    }

    const rawText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    if (
      isJsonAuthExpired(result.data) ||
      rawText.toLowerCase() === '"expired"' ||
      rawText.toLowerCase() === 'expired'
    ) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.checkRegistrationPeriod(fresh, true);
          return { ...retried, newToken: fresh };
        }
      }
      return {
        state: 'unknown',
        isOpen: false,
        message: 'Phiên đăng nhập SGU đã hết hạn',
        kind: 'http',
        status: 401,
      };
    }
    const isOutside = rawText.includes('Ngoài thời gian') || rawText.includes('không được');
    const cleanMsg = rawText.replace(/^"|"$/g, '').trim();

    return {
      state: isOutside ? 'closed' : 'open',
      isOpen: !isOutside,
      message: isOutside ? cleanMsg : (cleanMsg || 'Cổng đăng ký đang MỞ (07:00 - 23:59)'),
    };
  }

  /**
   * Kiểm tra trực tiếp API môn tiên quyết và điều kiện học phần từ máy chủ SGU (/api/rms/w-locdsloaitienquyet)
   */
  static async checkPrerequisiteApi(token: string): Promise<{
    supported: boolean;
    conditionTypes: Array<{ gia_tri: number; mieu_ta: string }>;
    message: string;
  }> {
    try {
      const res = await fetch('/api/rms/w-locdsloaitienquyet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          supported: true,
          conditionTypes: data,
          message: `Hệ thống SGU hỗ trợ ${data.length} loại điều kiện: ${data.map(d => d.mieu_ta).join(', ')}`,
        };
      }
      return {
        supported: false,
        conditionTypes: [],
        message: typeof data === 'string' ? data : 'Cổng SGU phản hồi thông điệp ngoài giờ',
      };
    } catch (err: any) {
      return {
        supported: false,
        conditionTypes: [],
        message: err.message || 'Không thể kết nối API tiên quyết',
      };
    }
  }

  /**
   * Lấy thông tin sinh viên chính xác 100% từ CSDL SGU (/api/dkmh/w-locsinhvieninfo)
   */
  static async fetchStudentInfo(
    token: string,
    alreadyRefreshed = false
  ): Promise<{ lop?: string; khoa?: string; name?: string; mssv?: string; newToken?: string } | null> {
    if (!token) return null;
    try {
      const res = await fetch('/api/dkmh/w-locsinhvieninfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.status === 401 && !alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.fetchStudentInfo(fresh, true);
          return retried ? { ...retried, newToken: fresh } : null;
        }
      }
      if (!res.ok) return null;
      const json = await res.json();
      if (isJsonAuthExpired(json) && !alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.fetchStudentInfo(fresh, true);
          return retried ? { ...retried, newToken: fresh } : null;
        }
        return null;
      }
      const sv = json?.data;
      if (!sv) return null;
      return {
        lop: sv.lop || sv.ma_lop || sv.ten_lop || sv.lop_hoc ? String(sv.lop || sv.ma_lop || sv.ten_lop || sv.lop_hoc).trim() : undefined,
        khoa: sv.khoa || sv.ten_khoa ? String(sv.khoa || sv.ten_khoa).trim() : undefined,
        name: sv.ten_day_du || sv.ho_ten || sv.name ? String(sv.ten_day_du || sv.ho_ten || sv.name).trim() : undefined,
        mssv: sv.ma_sv || sv.mssv ? String(sv.ma_sv || sv.mssv).trim() : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get list of already enrolled courses directly from SGU database
   */
  static async getEnrolledCourses(
    token: string,
    alreadyRefreshed = false,
    attempt = 0
  ): Promise<{
    totalCredits: number;
    minCredits: number;
    courses: EnrolledCourseItem[];
    authExpired?: boolean;
    newToken?: string;
    failed?: boolean;
  }> {
    let res: Response;
    try {
      res = await fetch('/api/dkmh/w-locdskqdkmhsinhvien', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_CVHT: false }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.getEnrolledCourses(token, alreadyRefreshed, attempt + 1);
      }
      return { totalCredits: 0, minCredits: 0, courses: [], failed: true };
    }

    if (res.status === 401) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.getEnrolledCourses(fresh, true, attempt);
          return { ...retried, newToken: fresh };
        }
      }
      return { totalCredits: 0, minCredits: 0, courses: [], authExpired: true, failed: true };
    }

    if ([429, 500, 502, 503, 504].includes(res.status)) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.getEnrolledCourses(token, alreadyRefreshed, attempt + 1);
      }
      return { totalCredits: 0, minCredits: 0, courses: [], failed: true };
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.getEnrolledCourses(token, alreadyRefreshed, attempt + 1);
      }
      return { totalCredits: 0, minCredits: 0, courses: [], failed: true };
    }

    if (isJsonAuthExpired(json)) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.getEnrolledCourses(fresh, true, attempt);
          return { ...retried, newToken: fresh };
        }
      }
      return { totalCredits: 0, minCredits: 0, courses: [], authExpired: true, failed: true };
    }

    if (!json?.result || !json?.data) {
      return { totalCredits: 0, minCredits: 0, courses: [], failed: true };
    }

    const rawList = Array.isArray(json.data.ds_kqdkmh) ? json.data.ds_kqdkmh : [];
    const minCredits = Number(json.data.so_tin_chi_min) || 0;
    let totalCredits = 0;

    const courses: EnrolledCourseItem[] = rawList.map((item: any) => {
      const th = item?.to_hoc && typeof item.to_hoc === 'object' ? item.to_hoc : null;
      const credits = Number(item.so_tc ?? th?.so_tc ?? th?.so_tc_so) || 0;
      totalCredits += credits;
      const rawDsLop = Array.isArray(item.ds_lop) ? item.ds_lop : Array.isArray(th?.ds_lop) ? th.ds_lop : [];
      const lopRaw = (rawDsLop.length > 0 ? rawDsLop.join(', ') : '') || item.lop || th?.lop || '';
      const toRaw =
        typeof item.to === 'string' || typeof item.to === 'number'
          ? String(item.to)
          : typeof item.to_hoc === 'string' || typeof item.to_hoc === 'number'
          ? String(item.to_hoc)
          : typeof th?.to === 'string' || typeof th?.to === 'number'
          ? String(th.to)
          : '';
      const rawTkb = Array.isArray(item.tkb) ? item.tkb : Array.isArray(th?.tkb) ? th.tkb : undefined;
      const rawTkbStr =
        typeof item.tkb === 'string' && item.tkb.trim()
          ? item.tkb.trim()
          : typeof th?.tkb === 'string' && th.tkb.trim()
          ? th.tkb.trim()
          : undefined;
      return {
        id_kqdk: String(item.id_kqdk || th?.id_kqdk || item.id_to_hoc || th?.id_to_hoc || ''),
        id_to_hoc: String(item.id_to_hoc || th?.id_to_hoc || ''),
        ma_mon: String(item.ma_mon || item.ma || th?.ma_mon || th?.ma || '').normalize('NFC').trim(),
        ten_mon: String(item.ten_mon || item.ten || th?.ten_mon || th?.ten || '').normalize('NFC').trim(),
        nhom_to: String(item.nhom_to ?? th?.nhom_to ?? '').normalize('NFC').trim(),
        to_hoc: toRaw.normalize('NFC').trim() || undefined,
        so_tc: credits,
        lop: String(lopRaw).normalize('NFC').trim() || undefined,
        tkb: rawTkb,
        tkb_str: rawTkbStr,
        enable_xoa: item.enable_xoa !== false,
        dien_giai_enable_xoa: item.dien_giai_enable_xoa ? String(item.dien_giai_enable_xoa).trim() : undefined,
        hoc_phi_tam_tinh: Number(item.hoc_phi_tam_tinh ?? item.hoc_phi) || 0,
        ngay_dang_ky: item.ngay_dang_ky ? String(item.ngay_dang_ky).trim() : '',
        ten_giang_vien: String(item.ten_giang_vien || item.giang_vien || th?.ten_giang_vien || th?.giang_vien || '').normalize('NFC').trim(),
        trang_thai_dang_ky: String(item.trang_thai_dang_ky || item.trang_thai || th?.trang_thai_dang_ky || th?.trang_thai || 'Đã ghi nhận CSDL').normalize('NFC').trim(),
      };
    });

    return { totalCredits, minCredits, courses };
  }

  /**
   * Thử lấy token mới từ server cục bộ (chỉ thành công khi .env có SGU_PASSWORD).
   * Trả về null nếu không có token MỚI (khác token cũ) — tránh retry vô ích với chính token đã hết hạn.
   */
  static async tryRefreshToken(oldToken: string): Promise<string | null> {
    try {
      const refreshRes = await fetch('/api-local/env-login?force=1');
      if (!refreshRes.ok) return null;
      const data = await refreshRes.json();
      if (!data?.token || data.token === oldToken) return null;
      try {
        localStorage.setItem('sgu_dkmh_token', data.token);
        if (data.user) localStorage.setItem('sgu_dkmh_user', JSON.stringify(data.user));
        // Đồng bộ luôn token mới vào danh sách tài khoản đã lưu (sgu_dkmh_saved_accounts) để click chọn lại không bị nạp nhầm token cũ
        const rawSaved = localStorage.getItem('sgu_dkmh_saved_accounts');
        if (rawSaved) {
          const parsedSaved = JSON.parse(rawSaved);
          if (Array.isArray(parsedSaved)) {
            const targetMssv = data.user?.mssv;
            const updatedSaved = parsedSaved.map((acc: any) =>
              (targetMssv && acc.mssv === targetMssv) || acc.token === oldToken
                ? { ...acc, token: data.token, name: data.user?.name || acc.name, lop: data.user?.lop || acc.lop }
                : acc
            );
            localStorage.setItem('sgu_dkmh_saved_accounts', JSON.stringify(updatedSaved));
          }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sgu-token-updated', { detail: { token: data.token, user: data.user } }));
        }
      } catch {}
      return data.token as string;
    } catch {
      return null;
    }
  }

  /**
   * Gửi đăng ký 1 nhóm lớp (w-xulydkmhsinhvien).
   * - Lỗi mạng / timeout 8s / HTTP 429-502-503-504: tự thử lại tối đa 3 lần (backoff + jitter).
   *   Gửi lại POST là an toàn: nếu lần trước đã vào CSDL, SGU trả "đã đăng ký" → được tính là thành công.
   * - HTTP 401: thử làm mới token đúng 1 lần; thất bại → trả authExpired = true để UI dừng & yêu cầu đăng nhập.
   */
  static async registerSingleCourse(
    token: string,
    id_to_hoc: string,
    attempt = 0,
    alreadyRefreshed = false,
    maxRetries = 3
  ): Promise<RegisterCourseResult> {
    const MAX_TRANSIENT_RETRIES = maxRetries;
    const backoff = () =>
      new Promise((r) => setTimeout(r, (attempt + 1) * 500 + Math.floor(Math.random() * 250)));

    let res: Response;
    try {
      res = await fetch('/api/dkmh/w-xulydkmhsinhvien', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id_to_hoc, is_dk: true }),
        signal: AbortSignal.timeout(9000),
      });
    } catch (err: any) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await backoff();
        return this.registerSingleCourse(token, id_to_hoc, attempt + 1, alreadyRefreshed, maxRetries);
      }
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const message = isTimeout
        ? `Máy chủ SGU phản hồi quá chậm (>9s) sau ${attempt + 1} lần gửi.`
        : `Không kết nối được cổng SGU sau ${attempt + 1} lần gửi (${err?.message || 'lỗi mạng'}).`;
      return { success: false, message, parsedError: parseSguError(message), transient: true };
    }

    if (res.status === 401) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.registerSingleCourse(fresh, id_to_hoc, attempt, true, maxRetries);
          return { ...retried, newToken: retried.newToken || fresh };
        }
      }
      const message = 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.';
      return { success: false, message, parsedError: parseSguError(message), authExpired: true, httpStatus: 401 };
    }

    if ([429, 500, 502, 503, 504].includes(res.status)) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await backoff();
        return this.registerSingleCourse(token, id_to_hoc, attempt + 1, alreadyRefreshed, maxRetries);
      }
      const message = `Máy chủ SGU quá tải (HTTP ${res.status}) sau ${attempt + 1} lần gửi.`;
      return { success: false, message, parsedError: parseSguError(message), transient: true, httpStatus: res.status };
    }

    let text = '';
    try {
      text = await res.text();
    } catch {}

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await backoff();
        return this.registerSingleCourse(token, id_to_hoc, attempt + 1, alreadyRefreshed, maxRetries);
      }
      const message = `Máy chủ SGU phản hồi không hợp lệ (HTTP ${res.status}): ${text.slice(0, 100)}`;
      return { success: false, message, parsedError: parseSguError(message), transient: true, httpStatus: res.status };
    }

    // Xử lý trường hợp SGU trả về HTTP 200 OK nhưng body JSON báo { code: 401, message: "expired" }
    if (isJsonAuthExpired(json)) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.registerSingleCourse(fresh, id_to_hoc, attempt, true, maxRetries);
          return { ...retried, newToken: retried.newToken || fresh };
        }
      }
      const message = 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.';
      return { success: false, message, parsedError: parseSguError(message), authExpired: true, httpStatus: 401 };
    }

    const isThanhCong = json?.data?.is_thanh_cong;
    const isSuccess = isThanhCong === true || (json?.result === true && !json?.data?.thong_bao_loi && isThanhCong !== false);
    const message =
      json?.data?.thong_bao_loi ||
      json?.message ||
      (isSuccess ? 'Đăng ký thành công' : `Đăng ký thất bại (HTTP ${res.status})`);

    return {
      success: isSuccess,
      message,
      parsedError: isSuccess ? undefined : parseSguError(message),
      raw: json?.data,
      httpStatus: res.status,
    };
  }

  /**
   * Truy vấn trực tiếp danh sách nhóm tổ theo chế độ lọc của SGU (loai_dk = 2: Trong CTĐT, 4: Chưa học CTĐT, 5: Cần học lại)
   * Khi ngoài đợt hoặc SGU trả rỗng -> trả về tập rỗng; khi vào đợt mở cổng SGU trả dữ liệu -> khớp tự động với allCourses.
   */
  static async fetchFilteredCourseIdsByMode(
    token: string,
    loai_dk: number,
    alreadyRefreshed = false,
    attempt = 0
  ): Promise<{ idToHocs: Set<string>; maMons: Set<string>; authExpired?: boolean; newToken?: string }> {
    const empty = { idToHocs: new Set<string>(), maMons: new Set<string>() };
    if (!token) return empty;
    try {
      const res = await fetch('/api/dkmh/w-locdsnhomto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_CVHT: false,
          loai_dk,
          additional: {
            paging: { limit: 99999, page: 1 },
            ordering: [{ name: '', order_type: '' }],
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 401) {
        if (!alreadyRefreshed) {
          const fresh = await this.tryRefreshToken(token);
          if (fresh) {
            const retried = await this.fetchFilteredCourseIdsByMode(fresh, loai_dk, true, attempt);
            return { ...retried, newToken: fresh };
          }
        }
        return { ...empty, authExpired: true };
      }
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.fetchFilteredCourseIdsByMode(token, loai_dk, alreadyRefreshed, attempt + 1);
      }
      const json = await res.json();
      if (isJsonAuthExpired(json)) {
        if (!alreadyRefreshed) {
          const fresh = await this.tryRefreshToken(token);
          if (fresh) {
            const retried = await this.fetchFilteredCourseIdsByMode(fresh, loai_dk, true, attempt);
            return { ...retried, newToken: fresh };
          }
        }
        return { ...empty, authExpired: true };
      }
      const dsNhomTo = Array.isArray(json?.data?.ds_nhom_to) ? json.data.ds_nhom_to : [];
      const idToHocs = new Set<string>();
      const maMons = new Set<string>();
      for (const item of dsNhomTo) {
        if (item?.id_to_hoc) {
          idToHocs.add(String(item.id_to_hoc));
        }
        if (item?.ma_mon) {
          maMons.add(String(item.ma_mon).trim());
        }
      }
      return { idToHocs, maMons };
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.fetchFilteredCourseIdsByMode(token, loai_dk, alreadyRefreshed, attempt + 1);
      }
      return empty;
    }
  }

  /**
   * Drop / withdraw an enrolled course (hỗ trợ cả w-xulyrutmonhoc và fallback w-xulydkmhsinhvien is_dk: false)
   */
  static async dropCourse(
    token: string,
    id_kqdk: string,
    id_to_hoc?: string,
    alreadyRefreshed = false,
    attempt = 0
  ): Promise<{ success: boolean; message: string; authExpired?: boolean; newToken?: string }> {
    const targetIdToHoc = id_to_hoc || id_kqdk;
    let res: Response;
    try {
      res = await fetch('/api/dkmh/w-xulyrutmonhoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id_kqdk, id_to_hoc: targetIdToHoc }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err: any) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 600));
        return this.dropCourse(token, id_kqdk, id_to_hoc, alreadyRefreshed, attempt + 1);
      }
      return {
        success: false,
        message: `Không thể kết nối cổng SGU khi hủy môn (${err?.message || 'lỗi mạng'}).`,
      };
    }

    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 2) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 600));
      return this.dropCourse(token, id_kqdk, id_to_hoc, alreadyRefreshed, attempt + 1);
    }

    if (res.status === 401) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true);
          return { ...retried, newToken: fresh };
        }
      }
      return {
        success: false,
        message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
        authExpired: true,
      };
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {}

    if (isJsonAuthExpired(json)) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true);
          return { ...retried, newToken: fresh };
        }
      }
      return {
        success: false,
        message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
        authExpired: true,
      };
    }

    // Fallback sang /api/dkmh/w-xulydkmhsinhvien với is_dk: false nếu endpoint rút môn trả 404 hoặc không hỗ trợ
    if (res.status === 404 || (!json?.data?.is_thanh_cong && !json?.result && !json?.data?.thong_bao_loi && !json?.message && targetIdToHoc)) {
      try {
        const fbRes = await fetch('/api/dkmh/w-xulydkmhsinhvien', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idpc': '0',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ id_to_hoc: targetIdToHoc, is_dk: false }),
          signal: AbortSignal.timeout(15000),
        });
        if (fbRes.status === 401) {
          if (!alreadyRefreshed) {
            const fresh = await this.tryRefreshToken(token);
            if (fresh) {
              const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true);
              return { ...retried, newToken: fresh };
            }
          }
          return {
            success: false,
            message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
            authExpired: true,
          };
        }
        const fbJson = await fbRes.json().catch(() => null);
        if (isJsonAuthExpired(fbJson)) {
          if (!alreadyRefreshed) {
            const fresh = await this.tryRefreshToken(token);
            if (fresh) {
              const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true);
              return { ...retried, newToken: fresh };
            }
          }
          return {
            success: false,
            message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
            authExpired: true,
          };
        }
        if (fbJson) {
          json = fbJson;
        }
      } catch {}
    }

    if (!json) {
      return {
        success: false,
        message: `Máy chủ SGU phản hồi dữ liệu không hợp lệ (HTTP ${res.status}).`,
      };
    }

    const isThanhCong = json?.data?.is_thanh_cong;
    const success = isThanhCong === true || (isThanhCong === undefined && json?.result === true && !json?.data?.thong_bao_loi);
    const message =
      json?.data?.thong_bao_loi ||
      json?.message ||
      (success ? 'Đã hủy môn học thành công' : 'Hủy môn thất bại');
    return { success, message };
  }
}
