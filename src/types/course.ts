export interface ScheduleSession {
  thu: number; // 2 -> 8 (8 is CN), 0 for Chưa xếp
  thuStr?: string; // "Thứ 2", "Thứ 3", etc.
  thoi_gian?: string; // "tiết 2->5"
  tietStart: number; // 1 -> 13, 0 for Chưa xếp
  tietEnd: number; // 1 -> 13, 0 for Chưa xếp
  soTiet?: number; // tietEnd - tiestStart + 1
  phong: string;
  gv: string;
  dates?: string;
  isUnscheduled?: boolean;
}

export interface ClassGroup {
  id: string; // id_to_hoc
  id_to_hoc: string;
  ma_mon: string;
  ten_mon: string;
  nhom_to: string; // "01", "02"
  to_hoc: string;
  so_tc: number;
  sl_cp: number; // Max capacity
  sl_cl: number; // Remaining slots
  tkb_raw: string;
  parsedSessions: ScheduleSession[];
  isUnscheduled?: boolean;
}

export interface SguFullDataItem {
  ma_mon: string;
  ten_mon: string;
  nhom_to: string;
  to: string;
  so_tc: string | number;
  tkb: Array<{
    thu: string;
    thoi_gian: string;
    phong: string;
    giang_vien: string;
    ngay: string;
  }>;
  id_to_hoc: string;
  sl_cp: number;
  sl_cl: number;
}

export interface SguApiRawClassGroup {
  id_to_hoc?: string;
  id?: string;
  ma_mon: string;
  ten_mon?: string;
  to_hoc?: string;
  nhom_to?: string;
  so_tc?: number | string;
  sl_cp?: number | string;
  sl_cl?: number | string;
  sl_dk?: number | string;
  tkb?: string;
}

export interface SguApiSubject {
  ma: string;
  ten: string;
}

export interface SubjectSummary {
  ma_mon: string;
  ten_mon: string;
  so_tc: number;
  groupCount: number;
}

export interface PlanVersion {
  id: string; // e.g. "plan-1"
  name: string; // e.g. "TKB_1"
  selectedIds: string[]; // array of group id_to_hoc
}

export interface ConflictInfo {
  classAId: string;
  classBId: string;
  classAName: string;
  classBName: string;
  day: number;
  dayStr: string;
  periods: number[];
}
