import { ClassGroup, SguApiRawClassGroup, SguApiSubject } from '../types/course';
import { parseTkbString } from '../utils/tkbParser';

// Sample real SGU classes scanned from API for instant offline preview
export const SGU_SAMPLE_DATA: { ds_nhom_to: SguApiRawClassGroup[]; ds_mon_hoc: SguApiSubject[] } = {
  ds_nhom_to: [
    { id_to_hoc: "to_801022_01", ma_mon: "801022", to_hoc: "01", so_tc: 3, sl_cp: 50, sl_cl: 40, tkb: "Thứ 2,tiết 3->5,Ph 1.C202,GV Chế Thị Kim Phụng,04/01/27 đến 10/01/27<hr>Thứ 4,tiết 3->5,Ph 1.A202,GV Chế Thị Kim Phụng,16/02/27 đến 13/04/27" },
    { id_to_hoc: "to_801024_01", ma_mon: "801024", to_hoc: "01", so_tc: 3, sl_cp: 45, sl_cl: 39, tkb: "Thứ 4,tiết 4->5,Ph 1.C203,GV Phạm Sỹ Nam,06/01/27 đến 10/01/27<hr>Thứ 4,tiết 4->5,Ph 1.C202,GV Phạm Sỹ Nam,18/02/27 đến 25/03/27" },
    { id_to_hoc: "to_801028_01", ma_mon: "801028", to_hoc: "01", so_tc: 3, sl_cp: 60, sl_cl: 55, tkb: "Thứ 2,tiết 3->5,Ph C.A201,GV Phan Trung Hiếu,12/04/27 đến 10/05/27<hr>Thứ 5,tiết 3->5,Ph C.A301,GV Phan Trung Hiếu,15/04/27 đến 13/05/27" },
    { id_to_hoc: "to_801042_01", ma_mon: "801042", to_hoc: "01", so_tc: 2, sl_cp: 50, sl_cl: 45, tkb: "Thứ 2,tiết 6->8,Ph C.E401,GV Nguyễn Thị Thanh Lan,04/01/27 đến 10/01/27<hr>Thứ 2,tiết 6->8,Ph C.E401,GV Nguyễn Thị Thanh Lan,15/02/27 đến 29/03/27" },
    { id_to_hoc: "to_801047_01", ma_mon: "801047", to_hoc: "01", so_tc: 3, sl_cp: 50, sl_cl: 45, tkb: "Thứ 5,tiết 6->8,Ph C.E401,GV Phạm Hoàng Quân,07/01/27 đến 14/01/27<hr>Thứ 5,tiết 6->8,Ph C.E401,GV Phạm Hoàng Quân,19/02/27 đến 16/04/27" },
    { id_to_hoc: "to_801078_01", ma_mon: "801078", to_hoc: "01", so_tc: 3, sl_cp: 60, sl_cl: 55, tkb: "Thứ 2,tiết 6->8,Ph C.E103,GV Phan Trung Hiếu,29/03/27 đến 26/04/27<hr>Thứ 4,tiết 6->8,Ph C.A201,GV Phan Trung Hiếu,31/03/27 đến 28/04/27" },
    { id_to_hoc: "to_801083_01", ma_mon: "801083", to_hoc: "01", so_tc: 2, sl_cp: 40, sl_cl: 35, tkb: "Thứ 2,tiết 4->5,Ph C.E401,GV Nguyễn Thị Thanh Lan,11/01/27 đến 15/01/27<hr>Thứ 3,tiết 4->5,Ph C.B006,GV Nguyễn Thị Thanh Lan,16/02/27 đến 23/03/27" },
    { id_to_hoc: "to_801145_01", ma_mon: "801145", to_hoc: "01", so_tc: 3, sl_cp: 70, sl_cl: 68, tkb: "Thứ 2,tiết 3->5,Ph C.E304,GV Phan Trung Hiếu,04/01/27 đến 10/01/27<hr>Thứ 4,tiết 3->5,Ph C.E304,GV Phan Trung Hiếu,18/02/27 đến 25/03/27" },
    { id_to_hoc: "to_801407_01", ma_mon: "801407", to_hoc: "01", so_tc: 3, sl_cp: 40, sl_cl: 35, tkb: "Thứ 4,tiết 6->8,Ph C.A210,GV Lê Minh Tuấn,06/01/27 đến 10/01/27<hr>Thứ 4,tiết 6->8,Ph C.A210,GV Lê Minh Tuấn,17/02/27 đến 31/03/27" },
    { id_to_hoc: "to_802023_01", ma_mon: "802023", to_hoc: "01", so_tc: 3, sl_cp: 40, sl_cl: 9, tkb: "Thứ 2,tiết 8->10,Ph C.E504,GV Lương Văn Tùng,04/01/27 đến 10/01/27<hr>Thứ 5,tiết 8->10,Ph C.E501,GV Lương Văn Tùng,19/02/27 đến 26/02/27" },
    { id_to_hoc: "to_802092_01", ma_mon: "802092", to_hoc: "01", so_tc: 3, sl_cp: 40, sl_cl: 10, tkb: "Thứ 4,tiết 6->8,Ph C.E606,GV Lương Văn Tùng,13/01/27 đến 15/01/27<hr>Thứ 5,tiết 6->8,Ph C.E504,GV Lương Văn Tùng,19/02/27 đến 02/04/27" },
    { id_to_hoc: "to_802402_01", ma_mon: "802402", to_hoc: "01", so_tc: 4, sl_cp: 40, sl_cl: 10, tkb: "Thứ 2,tiết 6->10,Ph C.A407,GV Lê Minh Thanh Châu,11/01/27 đến 15/01/27<hr>Thứ 2,tiết 6->10,Ph C.A407,GV Lê Minh Thanh Châu,15/02/27 đến 05/04/27" },
    { id_to_hoc: "to_803303_01", ma_mon: "803303", to_hoc: "01", so_tc: 3, sl_cp: 35, sl_cl: 7, tkb: "Thứ 2,tiết 8->10,Ph C.A108,GV Nguyễn Hữu Duy Khang,04/01/27 đến 10/01/27<hr>Thứ 4,tiết 8->10,Ph C.B110,GV Nguyễn Hữu Duy Khang,04/03/27 đến 15/04/27" },
    { id_to_hoc: "to_803401_01", ma_mon: "803401", to_hoc: "01", so_tc: 3, sl_cp: 40, sl_cl: 10, tkb: "Thứ 2,tiết 3->5,Ph C.E606,GV Nguyễn Hữu Thọ,04/01/27 đến 10/01/27<hr>Thứ 4,tiết 3->5,Ph C.A111,GV Nguyễn Hữu Thọ,18/02/27 đến 25/02/27" },
    { id_to_hoc: "to_806413_01", ma_mon: "806413", to_hoc: "01", so_tc: 3, sl_cp: 50, sl_cl: 45, tkb: "Thứ 2,tiết 1->3,Ph C.E504,GV Nguyễn Văn Thắng,05/04/27 đến 10/05/27<hr>Thứ 4,tiết 1->3,Ph C.E606,GV Nguyễn Văn Thắng,08/04/27 đến 13/05/27" },
    { id_to_hoc: "to_806502_01", ma_mon: "806502", to_hoc: "01", so_tc: 3, sl_cp: 40, sl_cl: 30, tkb: "Thứ 2,tiết 1->3,Ph C.E501,GV Nguyễn Văn Thắng,04/01/27 đến 10/01/27<hr>Thứ 4,tiết 1->3,Ph C.B006,GV Nguyễn Văn Thắng,18/02/27 đến 01/04/27" },
    { id_to_hoc: "to_809316_01", ma_mon: "809316", to_hoc: "01", so_tc: 2, sl_cp: 55, sl_cl: 50, tkb: "Thứ 3,tiết 9->10,Ph C.A410,GV Lê Đình Khanh,05/01/27 đến 10/01/27<hr>Thứ 4,tiết 9->10,Ph C.B103,GV Lê Đình Khanh,31/03/27 đến 07/04/27" }
  ],
  ds_mon_hoc: [
    { ma: "801022", ten: "Toán Cao Cấp A1" },
    { ma: "801024", ten: "Giải Tích 1" },
    { ma: "801028", ten: "Đại Số Tuyến Tính" },
    { ma: "801042", ten: "Xác Suất Thống Kê" },
    { ma: "801047", ten: "Toán Rời Rạc" },
    { ma: "801078", ten: "Phương Pháp Tính" },
    { ma: "801083", ten: "Toán Ứng Dụng Trong CNTT" },
    { ma: "801145", ten: "Giải Tích Hàm" },
    { ma: "801407", ten: "Cấu Trúc Rời Rạc" },
    { ma: "802023", ten: "Lập Trình Cơ Bản C/C++" },
    { ma: "802092", ten: "Kỹ Thuật Lập Trình" },
    { ma: "802402", ten: "Lập Trình Hướng Đối Tượng (OOP)" },
    { ma: "803303", ten: "Cơ Sở Dữ Liệu" },
    { ma: "803401", ten: "Hệ Quản Trị Cơ Sở Dữ Liệu" },
    { ma: "806413", ten: "Mạng Máy Tính" },
    { ma: "806502", ten: "Kiến Trúc Máy Tính" },
    { ma: "809316", ten: "Pháp Luật Đại Cương" }
  ]
};

export function transformSguResponse(
  rawClasses: SguApiRawClassGroup[],
  subjects: SguApiSubject[]
): ClassGroup[] {
  const mapName: Record<string, string> = {};
  subjects.forEach(s => {
    mapName[s.ma] = s.ten;
  });

  return rawClasses.map((item, idx) => {
    const maMon = item.ma_mon;
    const tenMon = mapName[maMon] || item.ten_mon || `Môn ${maMon}`;
    const nhomTo = String(item.nhom_to ?? item.to_hoc ?? '');
    const toHoc = String((item as any).to ?? '');
    const id = item.id_to_hoc || item.id || `course_${idx}`;
    const soTc = Number(item.so_tc ?? (item as any).so_tc_so ?? 0) || 0;
    const slCp = item.sl_cp !== undefined && item.sl_cp !== null && !Number.isNaN(Number(item.sl_cp)) ? Number(item.sl_cp) : 0;
    const slCl = item.sl_cl !== undefined && item.sl_cl !== null && !Number.isNaN(Number(item.sl_cl)) ? Number(item.sl_cl) : 0;
    const slDk = item.sl_dk !== undefined && item.sl_dk !== null && !Number.isNaN(Number(item.sl_dk)) ? Number(item.sl_dk) : undefined;

    return {
      id,
      id_to_hoc: id,
      ma_mon: maMon,
      ten_mon: tenMon,
      to_hoc: toHoc,
      to: toHoc,
      nhom_to: nhomTo,
      so_tc: soTc,
      sl_cp: slCp,
      sl_cl: slCl,
      sl_dk: slDk,
      tkb_raw: item.tkb || '',
      parsedSessions: parseTkbString(item.tkb)
    };
  });
}

export async function fetchSguCourseList(token?: string): Promise<{
  classes: ClassGroup[];
  isRealtime: boolean;
  message?: string;
}> {
  // If no token, return sample data
  if (!token) {
    return {
      classes: transformSguResponse(SGU_SAMPLE_DATA.ds_nhom_to, SGU_SAMPLE_DATA.ds_mon_hoc),
      isRealtime: false,
      message: 'Đang xem dữ liệu mẫu (Offline Mode). Nhập Token SGU để xem dữ liệu tài khoản của bạn.'
    };
  }

  try {
    const res = await fetch('/api/dkmh/w-locdsnhomto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idpc': '0',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        is_CVHT: false,
        additional: {
          paging: { limit: 99999, page: 1 },
          ordering: [{ name: '', order_type: '' }]
        }
      })
    });

    const json = await res.json();
    if ((json.code === 200 || json.result === true || json.data?.ds_nhom_to) && json.data) {
      const classes = transformSguResponse(
        json.data.ds_nhom_to || [],
        json.data.ds_mon_hoc || []
      );
      return {
        classes,
        isRealtime: true,
        message: `Đã đồng bộ thành công ${classes.length} lớp học phần từ server SGU!`
      };
    } else {
      throw new Error(json.message || 'Server SGU từ chối phiên đăng nhập.');
    }
  } catch (err: unknown) {
    console.warn('API fetch failed, falling back to sample data:', err);
    return {
      classes: transformSguResponse(SGU_SAMPLE_DATA.ds_nhom_to, SGU_SAMPLE_DATA.ds_mon_hoc),
      isRealtime: false,
      message: err instanceof Error ? err.message : 'Lỗi kết nối server SGU, sử dụng dữ liệu mẫu.'
    };
  }
}

