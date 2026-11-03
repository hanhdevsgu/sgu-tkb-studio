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

export interface RegistrationResultItem {
  id: string;
  ma_mon: string;
  ten_mon: string;
  nhom_to: string;
  so_tc: number;
  success: boolean;
  message: string;
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
   * Get list of already enrolled courses directly from SGU database
   */
  static async getEnrolledCourses(token: string): Promise<{ totalCredits: number; courses: EnrolledCourseItem[] }> {
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
      return { totalCredits: 0, courses: [] };
    }

    const rawList = json.data.ds_kqdkmh || [];
    let totalCredits = 0;

    const courses: EnrolledCourseItem[] = rawList.map((item: any) => {
      const credits = Number(item.so_tc) || 0;
      totalCredits += credits;
      return {
        id_kqdk: String(item.id_kqdk || ''),
        id_to_hoc: String(item.id_to_hoc || ''),
        ma_mon: item.ma_mon || '',
        ten_mon: item.ten_mon || '',
        nhom_to: item.nhom_to || '01',
        so_tc: credits,
        hoc_phi_tam_tinh: item.hoc_phi_tam_tinh || 0,
        ngay_dang_ky: item.ngay_dang_ky || '',
        ten_giang_vien: item.ten_giang_vien || item.giang_vien || '',
      };
    });

    return { totalCredits, courses };
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

    return json.results;
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

