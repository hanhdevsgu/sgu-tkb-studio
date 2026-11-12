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
  requiresOtp?: boolean;
  otpNoEmail?: boolean;
  warningMessage?: string;
  retryable?: boolean;
  isChoose?: boolean;
}

/**
 * Phân tích và phân loại chính xác 100% câu thông báo phản hồi từ máy chủ SGU
 */
export function parseSguError(rawMessage: string): SguParsedError {
  const lower = (rawMessage || '').normalize('NFC').toLowerCase();

  // 0. Phiên đăng nhập hết hạn (401) — phải kiểm tra đầu tiên để không bị nhầm sang nhóm khác
  if (
    lower === 'expired' ||
    lower.startsWith('notallowed') ||
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

  // 7. Môn đã được đăng ký trước đó. Nhóm này xác định học phần đã có trong CSDL SGU (thành công).
  // Chú ý: SGU thường trả về câu như "Môn học này đã được đăng ký, không thể đăng ký lại" hoặc "Học phần đã có trong kết quả đăng ký".
  // Cần tránh nhầm với câu phủ định hoàn toàn như "Sinh viên không được đăng ký" hoặc "Chưa được đăng ký".
  const isExplicitlyNegated =
    /(không|chưa)\s+(được\s+|thể\s+)?đăng\s*ký\s+môn/.test(lower) ||
    /(sinh\s+viên\s+)?(không|chưa)\s+được\s+đăng\s*ký/.test(lower) ||
    /chưa\s+(từng\s+)?đăng\s*ký/.test(lower);
  if (
    !isExplicitlyNegated &&
    (
      /đã\s+(được\s+)?đăng\s*ký/.test(lower) ||
      lower.includes('đã có trong danh sách') ||
      lower.includes('đã có trong kết quả') ||
      lower.includes('đã tồn tại trong kết quả') ||
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

  const contentType =
    typeof res.headers?.get === 'function'
      ? (res.headers.get('content-type') || '').toLowerCase()
      : 'application/json';
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
  return msg === 'expired' || msg === 'unauthorized' || msg.startsWith('notallowed') || msg.includes('token expired');
}

export class SguDkmhService {
  private static inFlightRefresh: { oldToken: string; promise: Promise<string | null> } | null = null;
  private static currentIdRs: string = '';
  private static currentSvNganh: number = 1;

  /**
   * Đọc text và parse JSON an toàn cho mọi Response (hỗ trợ cả Fetch thật lẫn mock test).
   */
  private static async parseResponseJsonSafely(res: Response): Promise<{ text: string; json: any }> {
    let text = '';
    if (typeof res.text === 'function') {
      try {
        text = await res.text();
      } catch {}
    }
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {}
    } else if (typeof res.json === 'function') {
      try {
        json = await res.json();
      } catch {}
    }
    return { text, json };
  }

  static getSessionContext(): { id_rs: string; sv_nganh: number } {
    if (!this.currentIdRs && typeof window !== 'undefined') {
      try {
        this.currentIdRs = sessionStorage.getItem('sgu_dkmh_id_rs') || localStorage.getItem('sgu_dkmh_id_rs') || '';
      } catch {}
    }
    if (this.currentSvNganh === 1 && typeof window !== 'undefined') {
      try {
        const storedNganh = sessionStorage.getItem('sgu_dkmh_sv_nganh') || localStorage.getItem('sgu_dkmh_sv_nganh');
        const parsed = storedNganh ? Number(storedNganh) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) this.currentSvNganh = parsed;
      } catch {}
    }
    return {
      id_rs: this.currentIdRs || '',
      sv_nganh: Number.isFinite(this.currentSvNganh) && this.currentSvNganh > 0 ? this.currentSvNganh : 1,
    };
  }

  static setIdRs(idRs?: string | null): void {
    if (typeof idRs !== 'string') return;
    const trimmed = idRs.trim();
    if (!trimmed) return;
    this.currentIdRs = trimmed;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('sgu_dkmh_id_rs', trimmed);
        localStorage.setItem('sgu_dkmh_id_rs', trimmed);
      } catch {}
    }
  }

  static setSvNganh(nganh?: number | string | null): void {
    const parsed = nganh !== undefined && nganh !== null ? Number(nganh) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.currentSvNganh = parsed;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('sgu_dkmh_sv_nganh', String(parsed));
        localStorage.setItem('sgu_dkmh_sv_nganh', String(parsed));
      } catch {}
    }
  }

  static resetSessionContext(): void {
    this.currentIdRs = '';
    this.currentSvNganh = 1;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('sgu_dkmh_id_rs');
        sessionStorage.removeItem('sgu_dkmh_sv_nganh');
        localStorage.removeItem('sgu_dkmh_id_rs');
        localStorage.removeItem('sgu_dkmh_sv_nganh');
      } catch {}
    }
  }

  /**
   * Chuẩn payload ĐKMH chính thức của cổng SGU (dkmh.sgu.edu.vn/course-registration & thongtindaotao.sgu.edu.vn):
   * Mọi thao tác đăng ký / hủy môn gửi lên dkmh/w-xulydkmhsinhvien bắt buộc bọc trong
   * `{ filter: { id_to_hoc, is_checked, sv_nganh, id_rs } }`.
   */
  static buildDkmhActionPayload(
    id_to_hoc: string,
    is_checked: boolean
  ): { filter: { id_to_hoc: string; is_checked: boolean; sv_nganh: number; id_rs: string } } {
    const ctx = this.getSessionContext();
    return {
      filter: {
        id_to_hoc: String(id_to_hoc),
        is_checked,
        sv_nganh: ctx.sv_nganh,
        id_rs: ctx.id_rs,
      },
    };
  }

  /**
   * Gửi yêu cầu khởi tạo OTP khi SGU trả HTTP 412 (xác thực 2 lớp khi có nghi vấn).
   * Theo logic chính thức của dkmh.sgu.edu.vn: code === 499 nghĩa là tự động vượt qua xác thực phiên.
   */
  static async setupOtp(
    token: string,
    alreadyRefreshed = false
  ): Promise<{
    ok: boolean;
    autoVerified?: boolean;
    noEmail?: boolean;
    message?: string;
    authExpired?: boolean;
    refreshedToken?: string;
  }> {
    try {
      const res = await fetch(this.apiUrl('/otp/setup', 0), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(9000),
      });
      const { json } = await this.parseResponseJsonSafely(res);

      if (res.status === 401 || isJsonAuthExpired(json)) {
        if (!alreadyRefreshed) {
          const fresh = await this.tryRefreshToken(token);
          if (fresh) {
            const retried = await this.setupOtp(fresh, true);
            return { ...retried, refreshedToken: retried.refreshedToken || fresh };
          }
        }
        return {
          ok: false,
          authExpired: true,
          message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
        };
      }

      if (json?.code === 499) {
        return { ok: true, autoVerified: true };
      }
      if (json?.code === 401 && json?.message === 'No Email') {
        return {
          ok: false,
          noEmail: true,
          message: 'Tài khoản SGU chưa được thiết lập email để nhận mã OTP. Vui lòng kiểm tra trên cổng SGU.',
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          message: json?.message || `Không thể gửi mã OTP (HTTP ${res.status}).`,
        };
      }
      return {
        ok: true,
        autoVerified: false,
        message: json?.message || 'Mã OTP 6 chữ số đã được gửi tới email sinh viên SGU của bạn.',
      };
    } catch {
      return {
        ok: false,
        message: 'Không thể kết nối đến dịch vụ gửi mã OTP của SGU.',
      };
    }
  }

  /**
   * Xác thực mã OTP 6 chữ số qua /api/otp/validate/{otp}
   */
  static async validateOtp(
    token: string,
    otp: string,
    alreadyRefreshed = false
  ): Promise<{
    ok: boolean;
    message?: string;
    authExpired?: boolean;
    refreshedToken?: string;
  }> {
    const cleanOtp = (otp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      return { ok: false, message: 'Vui lòng nhập đủ 6 chữ số OTP.' };
    }
    try {
      const res = await fetch(this.apiUrl(`/otp/validate/${encodeURIComponent(cleanOtp)}`, 0), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(9000),
      });
      const { json } = await this.parseResponseJsonSafely(res);

      if (res.status === 401 || isJsonAuthExpired(json)) {
        if (!alreadyRefreshed) {
          const fresh = await this.tryRefreshToken(token);
          if (fresh) {
            const retried = await this.validateOtp(fresh, cleanOtp, true);
            return { ...retried, refreshedToken: retried.refreshedToken || fresh };
          }
        }
        return {
          ok: false,
          authExpired: true,
          message: 'Phiên đăng nhập SGU đã hết hạn (401).',
        };
      }

      if (json?.code === 200) {
        return { ok: true, message: json?.message || 'Xác thực OTP thành công.' };
      }
      return {
        ok: false,
        message: json?.message || 'Mã OTP không chính xác hoặc đã hết hiệu lực.',
      };
    } catch {
      return {
        ok: false,
        message: 'Không thể kết nối máy chủ để xác thực OTP.',
      };
    }
  }

  /**
   * Gọi w-locdsnhomto chuẩn cổng SGU để lấy id_rs phiên ĐKMH + danh mục lớp sống mới nhất (sl_cl, id_to_hoc, nhóm K24).
   * Tự động failover sang /api-mirror nếu cổng chính quá tải/lỗi mạng.
   */
  static async syncSessionCatalogAndIdRs(
    token: string,
    alreadyRefreshed = false,
    attempt = 0
  ): Promise<{
    ok: boolean;
    idRs: string;
    isOpen?: boolean;
    idMapByKey: Map<string, string>;
    idSet: Set<string>;
    dsNhomTo?: any[];
    dsMonHoc?: any[];
    authExpired?: boolean;
    refreshedToken?: string;
  }> {
    const empty = { ok: false, idRs: this.getSessionContext().id_rs, idMapByKey: new Map<string, string>(), idSet: new Set<string>() };
    if (!token) return empty;
    try {
      const res = await fetch(this.apiUrl('/dkmh/w-locdsnhomto', attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_CVHT: false,
          additional: {
            paging: { limit: 99999, page: 1 },
            ordering: [{ name: '', order_type: '' }],
          },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 1) {
        await new Promise((r) => setTimeout(r, 300));
        return this.syncSessionCatalogAndIdRs(token, alreadyRefreshed, attempt + 1);
      }
      const { json } = await this.parseResponseJsonSafely(res);

      if (res.status === 401 || isJsonAuthExpired(json)) {
        if (!alreadyRefreshed) {
          const fresh = await this.tryRefreshToken(token);
          if (fresh) {
            const retried = await this.syncSessionCatalogAndIdRs(fresh, true, 0);
            return { ...retried, refreshedToken: retried.refreshedToken || fresh };
          }
        }
        return { ...empty, authExpired: true };
      }

      if (!json && attempt < 1) {
        await new Promise((r) => setTimeout(r, 300));
        return this.syncSessionCatalogAndIdRs(token, alreadyRefreshed, attempt + 1);
      }

      const rootData = json?.data || json;
      const serverIdRs = json?.id_rs || rootData?.id_rs || '';
      if (serverIdRs) {
        this.setIdRs(String(serverIdRs));
      }
      const dsNhomTo: any[] = Array.isArray(rootData?.ds_nhom_to) ? rootData.ds_nhom_to : [];
      const dsMonHoc: any[] = Array.isArray(rootData?.ds_mon_hoc) ? rootData.ds_mon_hoc : [];
      const idMapByKey = new Map<string, string>();
      const idSet = new Set<string>();
      for (const item of dsNhomTo) {
        const id = String(item?.id_to_hoc || '');
        if (!id) continue;
        idSet.add(id);
        const maMon = String(item?.ma_mon || '').trim();
        const nhom = String(item?.nhom_to || '').trim();
        const to = String(item?.to || '').trim();
        if (maMon && nhom) {
          idMapByKey.set(`${maMon}|${nhom}|${to}`, id);
          if (!idMapByKey.has(`${maMon}|${nhom}`)) {
            idMapByKey.set(`${maMon}|${nhom}`, id);
          }
        }
      }
      return {
        ok: Boolean(res.ok && json && (json.code === 200 || json.result === true || rootData)),
        idRs: this.getSessionContext().id_rs,
        isOpen: typeof rootData?.trong_thoi_gian_dang_ky === 'boolean' ? rootData.trong_thoi_gian_dang_ky : undefined,
        idMapByKey,
        idSet,
        dsNhomTo,
        dsMonHoc,
      };
    } catch {
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 300));
        return this.syncSessionCatalogAndIdRs(token, alreadyRefreshed, attempt + 1);
      }
      return empty;
    }
  }

  /**
   * Dual-gateway route: primary uses /api (dkmh.sgu.edu.vn); odd retry attempts fail over to /api-mirror (thongtindaotao.sgu.edu.vn)
   */
  private static apiUrl(path: string, attempt = 0): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const prefix = attempt % 2 === 1 ? '/api-mirror' : '/api';
    return `${prefix}${cleanPath}`;
  }

  /**
   * Auto-login using local .env credentials
   */
  static async loginFromEnv(): Promise<{ token: string; user: SguAuthUser }> {
    this.resetSessionContext();
    const res = await fetch('/api-local/env-login');
    const data = await res.json();
    if (!data.success || !data.token) {
      throw new Error(data.error || 'Đăng nhập từ tài khoản .env thất bại');
    }
    return { token: data.token, user: data.user };
  }

  /**
   * Manual login using MSSV and password (with safe JSON parsing & dual-gateway retry)
   */
  static async login(username: string, password: string, attempt = 0): Promise<{ token: string; user: SguAuthUser }> {
    if (attempt === 0) {
      this.resetSessionContext();
    }
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username.trim());
    params.append('password', password);

    let res: Response;
    try {
      res = await fetch(this.apiUrl('/auth/login', attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'idpc': '0',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(12000),
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
    this.resetSessionContext();
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
   * Hỗ trợ failover sang /api-mirror và dự phòng w-kiemtrathoigiandkmhsinhvien (chuẩn portal mới dkmh.sgu.edu.vn).
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

    const reqInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idpc': '0',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    };

    let result = await fetchJsonSafely<any>(this.apiUrl('/dkmh/w-thoigiansinhviendkmh', 0), reqInit);
    if (!result.ok && result.status !== 401 && result.status !== 404) {
      result = await fetchJsonSafely<any>(this.apiUrl('/dkmh/w-thoigiansinhviendkmh', 1), reqInit);
    }

    // Nếu w-thoigiansinhviendkmh trả 404 (hoặc bị đổi endpoint), thử w-kiemtrathoigiandkmhsinhvien
    if (!result.ok && result.status === 404) {
      let fb = await fetchJsonSafely<any>(this.apiUrl('/dkmh/w-kiemtrathoigiandkmhsinhvien', 0), reqInit);
      if (!fb.ok && fb.status !== 401) {
        fb = await fetchJsonSafely<any>(this.apiUrl('/dkmh/w-kiemtrathoigiandkmhsinhvien', 1), reqInit);
      }
      if (fb.ok && fb.data !== undefined) {
        result = fb;
      }
    }

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

    const boolFlag = result.data?.data?.trong_thoi_gian_dang_ky;
    if (typeof boolFlag === 'boolean') {
      const serverMsg = String(
        result.data?.data?.thong_bao || result.data?.data?.message || result.data?.message || ''
      ).trim();
      return {
        state: boolFlag ? 'open' : 'closed',
        isOpen: boolFlag,
        message: boolFlag
          ? (serverMsg || 'Cổng đăng ký đang MỞ (07:00 - 23:59)')
          : (serverMsg || 'Ngoài thời gian đăng ký môn học'),
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
   * Tự động failover sang /api-mirror nếu cổng chính quá tải.
   */
  static async fetchStudentInfo(
    token: string,
    alreadyRefreshed = false,
    attempt = 0
  ): Promise<{ lop?: string; khoa?: string; name?: string; mssv?: string; nganh?: number; newToken?: string } | null> {
    if (!token) return null;
    try {
      const res = await fetch(this.apiUrl('/dkmh/w-locsinhvieninfo', attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 && !alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.fetchStudentInfo(fresh, true, 0);
          return retried ? { ...retried, newToken: fresh } : null;
        }
      }
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 1) {
        await new Promise((r) => setTimeout(r, 300));
        return this.fetchStudentInfo(token, alreadyRefreshed, attempt + 1);
      }
      if (!res.ok) return null;
      const json = await res.json();
      if (isJsonAuthExpired(json) && !alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.fetchStudentInfo(fresh, true, 0);
          return retried ? { ...retried, newToken: fresh } : null;
        }
        return null;
      }
      const sv = json?.data;
      if (!sv) return null;
      if (sv.nganh !== undefined && sv.nganh !== null) {
        this.setSvNganh(sv.nganh);
      } else if (sv.sv_nganh !== undefined && sv.sv_nganh !== null) {
        this.setSvNganh(sv.sv_nganh);
      }
      const parsedNganh = Number(sv.nganh ?? sv.sv_nganh);
      return {
        lop: sv.lop || sv.ma_lop || sv.ten_lop || sv.lop_hoc ? String(sv.lop || sv.ma_lop || sv.ten_lop || sv.lop_hoc).trim() : undefined,
        khoa: sv.khoa || sv.ten_khoa ? String(sv.khoa || sv.ten_khoa).trim() : undefined,
        name: sv.ten_day_du || sv.ho_ten || sv.name ? String(sv.ten_day_du || sv.ho_ten || sv.name).trim() : undefined,
        mssv: sv.ma_sv || sv.mssv ? String(sv.ma_sv || sv.mssv).trim() : undefined,
        nganh: Number.isFinite(parsedNganh) && parsedNganh > 0 ? parsedNganh : undefined,
      };
    } catch {
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 300));
        return this.fetchStudentInfo(token, alreadyRefreshed, attempt + 1);
      }
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
      res = await fetch(this.apiUrl('/dkmh/w-locdskqdkmhsinhvien', attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_CVHT: false }),
        signal: AbortSignal.timeout(12000),
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
   * Thử lấy token mới từ server cục bộ (chỉ thành công khi .env / RAM có SGU_PASSWORD).
   * Dùng singleton lock chống gửi trùng nhiều request refresh cùng lúc khi đồng loạt 401.
   */
  static async tryRefreshToken(oldToken: string): Promise<string | null> {
    if (this.inFlightRefresh && this.inFlightRefresh.oldToken === oldToken) {
      return this.inFlightRefresh.promise;
    }

    const promise = (async () => {
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
      } finally {
        if (this.inFlightRefresh?.oldToken === oldToken) {
          this.inFlightRefresh = null;
        }
      }
    })();

    this.inFlightRefresh = { oldToken, promise };
    return promise;
  }

  /**
   * Gửi đăng ký 1 nhóm lớp (w-xulydkmhsinhvien) theo đúng contract cổng dkmh.sgu.edu.vn:
   * - Body: { filter: { id_to_hoc, is_checked: true, sv_nganh, id_rs } }
   * - Lỗi mạng / timeout 9s / HTTP 429-500-502-503-504: tự thử lại tối đa 3 lần (backoff + jitter)
   *   và tự động chuyển đổi luân phiên sang cổng dự phòng thongtindaotao.sgu.edu.vn ở các lần retry lẻ.
   *   Gửi lại POST là an toàn: nếu lần trước đã vào CSDL, SGU trả "đã đăng ký" → được tính là thành công.
   * - HTTP 412: Tự động kích hoạt /api/otp/setup (vượt qua nếu SGU trả code 499, hoặc yêu cầu nhập OTP email nếu cần).
   * - HTTP 401: thử làm mới token đúng 1 lần; thất bại → trả authExpired = true để UI dừng & yêu cầu đăng nhập.
   */
  static async registerSingleCourse(
    token: string,
    id_to_hoc: string,
    attempt = 0,
    alreadyRefreshed = false,
    maxRetries = 3,
    otpAttempted = false
  ): Promise<RegisterCourseResult> {
    const MAX_TRANSIENT_RETRIES = maxRetries;
    const backoff = () =>
      new Promise((r) => setTimeout(r, (attempt + 1) * 450 + Math.floor(Math.random() * 200)));

    let res: Response;
    try {
      res = await fetch(this.apiUrl('/dkmh/w-xulydkmhsinhvien', attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(this.buildDkmhActionPayload(id_to_hoc, true)),
        signal: AbortSignal.timeout(9000),
      });
    } catch (err: any) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await backoff();
        return this.registerSingleCourse(token, id_to_hoc, attempt + 1, alreadyRefreshed, maxRetries, otpAttempted);
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
          const retried = await this.registerSingleCourse(fresh, id_to_hoc, attempt, true, maxRetries, otpAttempted);
          return { ...retried, newToken: retried.newToken || fresh };
        }
      }
      const message = 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.';
      return { success: false, message, parsedError: parseSguError(message), authExpired: true, httpStatus: 401 };
    }

    if (res.status === 412) {
      if (otpAttempted) {
        const message = 'SGU yêu cầu xác thực OTP email để tiếp tục đăng ký.';
        return { success: false, message, parsedError: parseSguError(message), requiresOtp: true, httpStatus: 412 };
      }
      const otpRes = await this.setupOtp(token, alreadyRefreshed);
      const activeToken = otpRes.refreshedToken || token;
      const nextRefreshed = alreadyRefreshed || Boolean(otpRes.refreshedToken);
      if (otpRes.authExpired) {
        const message = otpRes.message || 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.';
        return { success: false, message, parsedError: parseSguError(message), authExpired: true, httpStatus: 401 };
      }
      if (otpRes.autoVerified) {
        const retried = await this.registerSingleCourse(activeToken, id_to_hoc, attempt, nextRefreshed, maxRetries, true);
        return { ...retried, newToken: retried.newToken || otpRes.refreshedToken };
      }
      if (otpRes.noEmail) {
        const message = otpRes.message || 'Tài khoản SGU chưa thiết lập email OTP.';
        return { success: false, message, parsedError: parseSguError(message), otpNoEmail: true, httpStatus: 412, newToken: otpRes.refreshedToken };
      }
      const message = otpRes.message || 'SGU yêu cầu nhập mã OTP 6 chữ số đã gửi về email sinh viên.';
      return { success: false, message, parsedError: parseSguError(message), requiresOtp: true, httpStatus: 412, newToken: otpRes.refreshedToken };
    }

    const { text, json } = await this.parseResponseJsonSafely(res);

    if ([429, 500, 502, 503, 504].includes(res.status)) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await backoff();
        return this.registerSingleCourse(token, id_to_hoc, attempt + 1, alreadyRefreshed, maxRetries, otpAttempted);
      }
      const backendDetail =
        json?.data?.thong_bao_loi ||
        json?.ExceptionMessage ||
        json?.validated_message ||
        (json?.message && json.message !== 'An error has occurred.' ? json.message : '');
      const message = backendDetail
        ? `Máy chủ SGU phản hồi lỗi (HTTP ${res.status}) sau ${attempt + 1} lần gửi: ${backendDetail}`
        : `Máy chủ SGU quá tải (HTTP ${res.status}) sau ${attempt + 1} lần gửi.`;
      return { success: false, message, parsedError: parseSguError(message), transient: true, httpStatus: res.status };
    }

    if (!json) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await backoff();
        return this.registerSingleCourse(token, id_to_hoc, attempt + 1, alreadyRefreshed, maxRetries, otpAttempted);
      }
      const message = `Máy chủ SGU phản hồi không hợp lệ (HTTP ${res.status}): ${text.slice(0, 100)}`;
      return { success: false, message, parsedError: parseSguError(message), transient: true, httpStatus: res.status };
    }

    // Xử lý trường hợp SGU trả về HTTP 200 OK nhưng body JSON báo { code: 401, message: "expired" }
    if (isJsonAuthExpired(json)) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.registerSingleCourse(fresh, id_to_hoc, attempt, true, maxRetries, otpAttempted);
          return { ...retried, newToken: retried.newToken || fresh };
        }
      }
      const message = 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.';
      return { success: false, message, parsedError: parseSguError(message), authExpired: true, httpStatus: 401 };
    }

    if (json?.code === 412 && !otpAttempted) {
      const otpRes = await this.setupOtp(token, alreadyRefreshed);
      const activeToken = otpRes.refreshedToken || token;
      const nextRefreshed = alreadyRefreshed || Boolean(otpRes.refreshedToken);
      if (otpRes.authExpired) {
        const message = otpRes.message || 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.';
        return { success: false, message, parsedError: parseSguError(message), authExpired: true, httpStatus: 401 };
      }
      if (otpRes.autoVerified) {
        const retried = await this.registerSingleCourse(activeToken, id_to_hoc, attempt, nextRefreshed, maxRetries, true);
        return { ...retried, newToken: retried.newToken || otpRes.refreshedToken };
      }
      if (otpRes.noEmail) {
        const message = otpRes.message || 'Tài khoản SGU chưa thiết lập email OTP.';
        return { success: false, message, parsedError: parseSguError(message), otpNoEmail: true, httpStatus: 412, newToken: otpRes.refreshedToken };
      }
      const message = otpRes.message || 'SGU yêu cầu nhập mã OTP 6 chữ số đã gửi về email sinh viên.';
      return { success: false, message, parsedError: parseSguError(message), requiresOtp: true, httpStatus: 412, newToken: otpRes.refreshedToken };
    }

    const nextIdRs = json?.data?.id_rs ?? json?.id_rs;
    if (nextIdRs) {
      this.setIdRs(String(nextIdRs));
    }

    const isThanhCong = json?.data?.is_thanh_cong;
    const isSuccess = isThanhCong === true || (json?.result === true && !json?.data?.thong_bao_loi && isThanhCong !== false);
    const message =
      json?.data?.thong_bao_loi ||
      json?.validated_message ||
      json?.message ||
      (isSuccess ? 'Đăng ký thành công' : `Đăng ký thất bại (HTTP ${res.status})`);
    const warningMessage =
      isSuccess && json?.data?.thong_bao_tien_quyet ? String(json.data.thong_bao_tien_quyet).trim() : undefined;

    return {
      success: isSuccess,
      message,
      parsedError: isSuccess ? undefined : parseSguError(message),
      raw: json?.data,
      httpStatus: res.status,
      warningMessage,
      isChoose: json?.data?.is_choose === true,
    };
  }

  /**
   * Lọc nhóm tổ theo chế độ CTĐT của SGU khớp 100% logic web dkmh.sgu.edu.vn:
   * - UI filterMode = 2 (Trong CTĐT kế hoạch) -> item.is_ctdt || item.is_ctdtng2
   * - UI filterMode = 4 (Chưa học CTĐT - SGU internal 6) -> item.is_chctdt || item.is_chctdtng2
   * - UI filterMode = 5 (Cần học lại - SGU internal 1) -> item.is_rot
   * Nếu server/mock không trả về cờ boolean, giữ nguyên tương thích tập server-filtered.
   */
  static async fetchFilteredCourseIdsByMode(
    token: string,
    filterMode: number,
    alreadyRefreshed = false,
    attempt = 0
  ): Promise<{
    idToHocs: Set<string>;
    maMons: Set<string>;
    dsNhomTo?: any[];
    dsMonHoc?: any[];
    authExpired?: boolean;
    newToken?: string;
  }> {
    const empty = { idToHocs: new Set<string>(), maMons: new Set<string>() };
    if (!token) return empty;
    try {
      const res = await fetch(this.apiUrl('/dkmh/w-locdsnhomto', attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_CVHT: false,
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
            const retried = await this.fetchFilteredCourseIdsByMode(fresh, filterMode, true, attempt);
            return { ...retried, newToken: fresh };
          }
        }
        return { ...empty, authExpired: true };
      }
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.fetchFilteredCourseIdsByMode(token, filterMode, alreadyRefreshed, attempt + 1);
      }
      const { json } = await this.parseResponseJsonSafely(res);
      if (!json) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
          return this.fetchFilteredCourseIdsByMode(token, filterMode, alreadyRefreshed, attempt + 1);
        }
        return empty;
      }
      if (isJsonAuthExpired(json)) {
        if (!alreadyRefreshed) {
          const fresh = await this.tryRefreshToken(token);
          if (fresh) {
            const retried = await this.fetchFilteredCourseIdsByMode(fresh, filterMode, true, attempt);
            return { ...retried, newToken: fresh };
          }
        }
        return { ...empty, authExpired: true };
      }
      const nextIdRs = json?.id_rs || json?.data?.id_rs;
      if (nextIdRs) {
        this.setIdRs(String(nextIdRs));
      }
      const dsNhomTo: any[] = Array.isArray(json?.data?.ds_nhom_to) ? json.data.ds_nhom_to : [];
      const dsMonHoc: any[] = Array.isArray(json?.data?.ds_mon_hoc) ? json.data.ds_mon_hoc : [];
      const hasBooleanModeFlags = dsNhomTo.some(
        (item) =>
          item &&
          typeof item === 'object' &&
          ('is_ctdt' in item ||
            'is_ctdtng2' in item ||
            'is_chctdt' in item ||
            'is_chctdtng2' in item ||
            'is_rot' in item)
      );

      const matchesMode = (item: any): boolean => {
        if (!hasBooleanModeFlags) return true;
        if (filterMode === 2) return Boolean(item?.is_ctdt || item?.is_ctdtng2);
        if (filterMode === 4) return Boolean(item?.is_chctdt || item?.is_chctdtng2);
        if (filterMode === 5) return Boolean(item?.is_rot);
        return true;
      };

      const idToHocs = new Set<string>();
      const maMons = new Set<string>();
      for (const item of dsNhomTo) {
        if (!matchesMode(item)) continue;
        if (item?.id_to_hoc) {
          idToHocs.add(String(item.id_to_hoc));
        }
        if (item?.ma_mon) {
          maMons.add(String(item.ma_mon).trim());
        }
      }
      return { idToHocs, maMons, dsNhomTo, dsMonHoc };
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        return this.fetchFilteredCourseIdsByMode(token, filterMode, alreadyRefreshed, attempt + 1);
      }
      return empty;
    }
  }

  /**
   * Drop / withdraw an enrolled course (ưu tiên w-xulydkmhsinhvien với filter.is_checked: false chuẩn cổng dkmh.sgu.edu.vn; fallback w-xulyrutmonhoc cho rút môn sau đợt)
   */
  static async dropCourse(
    token: string,
    id_kqdk: string,
    id_to_hoc?: string,
    alreadyRefreshed = false,
    attempt = 0,
    otpAttempted = false
  ): Promise<{ success: boolean; message: string; authExpired?: boolean; newToken?: string; requiresOtp?: boolean; otpNoEmail?: boolean }> {
    const targetIdToHoc = id_to_hoc || id_kqdk;
    let res: Response;
    const usePrimaryDkmhEndpoint = Boolean(targetIdToHoc);
    const primaryPath = usePrimaryDkmhEndpoint ? '/dkmh/w-xulydkmhsinhvien' : '/dkmh/w-xulyrutmonhoc';
    const primaryBody = usePrimaryDkmhEndpoint
      ? this.buildDkmhActionPayload(targetIdToHoc, false)
      : { id_kqdk, id_to_hoc: targetIdToHoc };

    try {
      res = await fetch(this.apiUrl(primaryPath, attempt), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(primaryBody),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err: any) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 600));
        return this.dropCourse(token, id_kqdk, id_to_hoc, alreadyRefreshed, attempt + 1, otpAttempted);
      }
      return {
        success: false,
        message: `Không thể kết nối cổng SGU khi hủy môn (${err?.message || 'lỗi mạng'}).`,
      };
    }

    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 2) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 600));
      return this.dropCourse(token, id_kqdk, id_to_hoc, alreadyRefreshed, attempt + 1, otpAttempted);
    }

    if (res.status === 401) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true, attempt, otpAttempted);
          return { ...retried, newToken: retried.newToken || fresh };
        }
      }
      return {
        success: false,
        message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
        authExpired: true,
      };
    }

    if (res.status === 412) {
      if (otpAttempted) {
        return {
          success: false,
          message: 'SGU yêu cầu xác thực OTP email để tiếp tục hủy môn.',
          requiresOtp: true,
        };
      }
      const otpRes = await this.setupOtp(token, alreadyRefreshed);
      const activeToken = otpRes.refreshedToken || token;
      const nextRefreshed = alreadyRefreshed || Boolean(otpRes.refreshedToken);
      if (otpRes.authExpired) {
        return {
          success: false,
          message: otpRes.message || 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
          authExpired: true,
        };
      }
      if (otpRes.autoVerified) {
        const retried = await this.dropCourse(activeToken, id_kqdk, id_to_hoc, nextRefreshed, attempt, true);
        return { ...retried, newToken: retried.newToken || otpRes.refreshedToken };
      }
      if (otpRes.noEmail) {
        return {
          success: false,
          message: otpRes.message || 'Tài khoản SGU chưa thiết lập email OTP.',
          otpNoEmail: true,
          newToken: otpRes.refreshedToken,
        };
      }
      return {
        success: false,
        message: otpRes.message || 'SGU yêu cầu nhập mã OTP 6 chữ số đã gửi về email sinh viên.',
        requiresOtp: true,
        newToken: otpRes.refreshedToken,
      };
    }

    const { json: parsedPrimaryJson } = await this.parseResponseJsonSafely(res);
    let json: any = parsedPrimaryJson;

    if (isJsonAuthExpired(json)) {
      if (!alreadyRefreshed) {
        const fresh = await this.tryRefreshToken(token);
        if (fresh) {
          const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true, attempt, otpAttempted);
          return { ...retried, newToken: retried.newToken || fresh };
        }
      }
      return {
        success: false,
        message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
        authExpired: true,
      };
    }

    if (json?.code === 412 && !otpAttempted) {
      const otpRes = await this.setupOtp(token, alreadyRefreshed);
      const activeToken = otpRes.refreshedToken || token;
      const nextRefreshed = alreadyRefreshed || Boolean(otpRes.refreshedToken);
      if (otpRes.autoVerified) {
        const retried = await this.dropCourse(activeToken, id_kqdk, id_to_hoc, nextRefreshed, attempt, true);
        return { ...retried, newToken: retried.newToken || otpRes.refreshedToken };
      }
      return {
        success: false,
        message: otpRes.message || 'SGU yêu cầu xác thực OTP email để tiếp tục hủy môn.',
        requiresOtp: !otpRes.noEmail,
        otpNoEmail: otpRes.noEmail,
        newToken: otpRes.refreshedToken,
      };
    }

    // Fallback sang /api/dkmh/w-xulyrutmonhoc chỉ khi w-xulydkmhsinhvien trả 404 hoặc không hỗ trợ
    if (usePrimaryDkmhEndpoint && res.status === 404 && id_kqdk) {
      try {
        const fbRes = await fetch(this.apiUrl('/dkmh/w-xulyrutmonhoc', attempt), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idpc': '0',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ id_kqdk, id_to_hoc: targetIdToHoc }),
          signal: AbortSignal.timeout(15000),
        });
        if (fbRes.status === 401) {
          if (!alreadyRefreshed) {
            const fresh = await this.tryRefreshToken(token);
            if (fresh) {
              const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true, attempt, otpAttempted);
              return { ...retried, newToken: retried.newToken || fresh };
            }
          }
          return {
            success: false,
            message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
            authExpired: true,
          };
        }
        const { json: fbJson } = await this.parseResponseJsonSafely(fbRes);
        if (isJsonAuthExpired(fbJson)) {
          if (!alreadyRefreshed) {
            const fresh = await this.tryRefreshToken(token);
            if (fresh) {
              const retried = await this.dropCourse(fresh, id_kqdk, id_to_hoc, true, attempt, otpAttempted);
              return { ...retried, newToken: retried.newToken || fresh };
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

    const nextIdRs = json?.data?.id_rs ?? json?.id_rs;
    if (nextIdRs) {
      this.setIdRs(String(nextIdRs));
    }

    const isThanhCong = json?.data?.is_thanh_cong;
    const success = isThanhCong === true || (isThanhCong === undefined && json?.result === true && !json?.data?.thong_bao_loi);
    const message =
      json?.data?.thong_bao_loi ||
      json?.validated_message ||
      json?.message ||
      (success ? 'Đã hủy môn học thành công' : 'Hủy môn thất bại');
    return { success, message };
  }
}
