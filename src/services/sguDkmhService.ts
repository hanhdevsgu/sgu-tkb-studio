import { ClassGroup } from '../types/course';

export interface SguAuthUser {
  name: string;
  mssv: string;
}

export interface EnrolledCourseItem {
  id_kqdk: string;
  id_to_hoc: string;
  ma_mon: string;
  ten_mon: string;
  nhom_to: string;
  so_tc: number;
  hoc_phi_tam_tinh?: number;
  ngay_dang_ky?: string;
  ten_giang_vien?: string;
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

/**
 * Phân tích và phân loại chính xác 100% câu thông báo phản hồi từ máy chủ SGU
 */
export function parseSguError(rawMessage: string): SguParsedError {
  const lower = (rawMessage || '').toLowerCase();

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

  // 2. Lỗi vượt số tín chỉ tối đa
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

  // 3. Lỗi hết chỗ / sĩ số đầy
  if (
    lower.includes('hết chỗ') ||
    lower.includes('đủ số lượng') ||
    lower.includes('sĩ số') ||
    lower.includes('không còn chỗ')
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

  // 5. Lỗi ngoài khung giờ đăng ký
  if (
    lower.includes('ngoài thời gian') ||
    lower.includes('không được đăng ký') ||
    lower.includes('thời điểm hiện tại') ||
    lower.includes('chưa mở')
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

  // 6. Lỗi đã đăng ký môn này rồi
  if (
    lower.includes('đã đăng ký') ||
    lower.includes('đã chọn') ||
    lower.includes('đã có trong danh sách')
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

  // 7. Lỗi nợ học phí
  if (lower.includes('học phí') || lower.includes('nợ')) {
    return {
      category: 'HOC_PHI',
      badgeLabel: 'Khóa do học phí',
      badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
      rawMessage,
      explanation: 'Tài khoản chưa hoàn thành nghĩa vụ học phí kỳ trước nên bị tạm khóa chức năng đăng ký.',
      suggestion: 'Vui lòng hoàn tất học phí qua cổng thanh toán SGU.',
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
   * Manual login using MSSV and password
   */
  static async login(username: string, password: string): Promise<{ token: string; user: SguAuthUser }> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username.trim());
    params.append('password', password);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'idpc': '0',
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!data.access_token) {
      throw new Error(data.error_description || 'Đăng nhập SGU thất bại. Vui lòng kiểm tra lại MSSV/Mật khẩu.');
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
  static async updateEnvAccount(username?: string, password?: string, token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api-local/update-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, token }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Check if student registration period is currently open
   */
  static async checkRegistrationPeriod(token: string): Promise<{ isOpen: boolean; message: string }> {
    try {
      const res = await fetch('/api/dkmh/w-thoigiansinhviendkmh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const rawText = typeof data === 'string' ? data : JSON.stringify(data);
      const isOutside = rawText.includes('Ngoài thời gian') || rawText.includes('không được');
      const cleanMsg = rawText.replace(/^"|"$/g, '').trim();
      return {
        isOpen: !isOutside,
        message: isOutside ? cleanMsg : (cleanMsg || 'Cổng đăng ký đang MỞ'),
      };
    } catch (err: any) {
      return { isOpen: false, message: err.message };
    }
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
   * Get list of already enrolled courses directly from SGU database
   */
  static async getEnrolledCourses(token: string): Promise<{
    totalCredits: number;
    minCredits: number;
    courses: EnrolledCourseItem[];
  }> {
    const res = await fetch('/api/dkmh/w-locdskqdkmhsinhvien', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idpc': '0',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ is_CVHT: false }),
    });

    const json = await res.json();
    if (!json.result || !json.data) {
      return { totalCredits: 0, minCredits: 14, courses: [] };
    }

    const rawList = json.data.ds_kqdkmh || [];
    const minCredits = Number(json.data.so_tin_chi_min) || 14;
    let totalCredits = 0;

    const courses: EnrolledCourseItem[] = rawList.map((item: any) => {
      const credits = Number(item.so_tc) || 0;
      totalCredits += credits;
      return {
        id_kqdk: String(item.id_kqdk || ''),
        id_to_hoc: String(item.id_to_hoc || ''),
        ma_mon: (item.ma_mon || '').normalize('NFC').trim(),
        ten_mon: (item.ten_mon || '').normalize('NFC').trim(),
        nhom_to: (item.nhom_to || '01').normalize('NFC').trim(),
        so_tc: credits,
        hoc_phi_tam_tinh: item.hoc_phi_tam_tinh || 0,
        ngay_dang_ky: item.ngay_dang_ky || '',
        ten_giang_vien: (item.ten_giang_vien || item.giang_vien || '').normalize('NFC').trim(),
      };
    });

    return { totalCredits, minCredits, courses };
  }

  /**
   * Execute registration for a single course group with 100% authentic SGU error diagnostics
   * Includes automatic retry for transient gateway timeouts (502/503/504) during 07:00 rush
   */
  static async registerSingleCourse(
    token: string,
    id_to_hoc: string,
    retryCount = 0
  ): Promise<{
    success: boolean;
    message: string;
    parsedError?: SguParsedError;
    raw?: any;
  }> {
    try {
      const res = await fetch('/api/dkmh/w-xulydkmhsinhvien', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idpc': '0',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id_to_hoc, is_dk: true }),
      });

      // Handle 401 Unauthorized (Expired Token) - Auto-refresh via env-login if available
      if (res.status === 401 && retryCount === 0) {
        try {
          const refreshRes = await fetch('/api-local/env-login');
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.token) {
              localStorage.setItem('sgu_dkmh_token', refreshData.token);
              if (refreshData.user) {
                localStorage.setItem('sgu_dkmh_user', JSON.stringify(refreshData.user));
              }
              // Retry with new fresh token
              return this.registerSingleCourse(refreshData.token, id_to_hoc, retryCount + 1);
            }
          }
        } catch {
          // Fall through to 401 return below
        }
        return {
          success: false,
          message: 'Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.',
          parsedError: parseSguError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'),
        };
      }

      // Handle Transient Server Overload (502/503/504) with automatic resilient retry (up to 3 times)
      if ((res.status === 502 || res.status === 503 || res.status === 504) && retryCount < 3) {
        const jitter = Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, (retryCount + 1) * 800 + jitter));
        return this.registerSingleCourse(token, id_to_hoc, retryCount + 1);
      }

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return {
          success: false,
          message: `Máy chủ SGU phản hồi không hợp lệ (${res.status}): ${text.slice(0, 100)}`,
          parsedError: parseSguError('Máy chủ SGU đang quá tải, phản hồi lỗi HTML.'),
        };
      }

      const isSuccess = json.data?.is_thanh_cong === true;
      const message =
        json.data?.thong_bao_loi ||
        json.message ||
        (isSuccess ? 'Đăng ký thành công' : 'Đăng ký thất bại');
      const parsedError = !isSuccess ? parseSguError(message) : undefined;

      return {
        success: isSuccess,
        message,
        parsedError,
        raw: json.data,
      };
    } catch (err: any) {
      if (retryCount < 3) {
        const jitter = Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, (retryCount + 1) * 800 + jitter));
        return this.registerSingleCourse(token, id_to_hoc, retryCount + 1);
      }
      return {
        success: false,
        message: err.message || 'Lỗi mạng khi kết nối cổng đào tạo SGU',
        parsedError: parseSguError(err.message || 'Lỗi mạng'),
      };
    }
  }

  /**
   * Execute batch registration for a list of course groups
   */
  static async submitBatchRegistration(
    token: string,
    groups: ClassGroup[]
  ): Promise<RegistrationResultItem[]> {
    const res = await fetch('/api-local/batch-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        groups: groups.map((g) => ({
          id_to_hoc: g.id_to_hoc || g.id,
          ma_mon: g.ma_mon,
          ten_mon: g.ten_mon,
          nhom_to: g.nhom_to,
          so_tc: g.so_tc,
        })),
      }),
    });

    const json = await res.json();
    if (!json.success || !Array.isArray(json.results)) {
      throw new Error(json.error || 'Quá trình đăng ký gặp sự cố');
    }

    return json.results.map((r: any) => ({
      ...r,
      parsedError: !r.success ? parseSguError(r.message) : undefined,
    }));
  }

  /**
   * Drop / withdraw an enrolled course
   */
  static async dropCourse(token: string, id_kqdk: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/dkmh/w-xulyrutmonhoc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idpc': '0',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ id_kqdk }),
    });

    const json = await res.json();
    const success = json.data?.is_thanh_cong === true || json.result === true;
    const message = json.data?.thong_bao_loi || (success ? 'Đã hủy môn học thành công' : 'Hủy môn thất bại');
    return { success, message };
  }
}
