import rawData from '../data/sguFullData.json';
import { ClassGroup, ScheduleSession, SguFullDataItem, SubjectSummary } from '../types/course';

export function parseDayOfWeek(thuStr?: string): number {
  if (!thuStr) return 2;
  const clean = thuStr.trim().toLowerCase();
  if (clean.includes('2')) return 2;
  if (clean.includes('3')) return 3;
  if (clean.includes('4')) return 4;
  if (clean.includes('5')) return 5;
  if (clean.includes('6')) return 6;
  if (clean.includes('7')) return 7;
  if (clean.includes('chủ nhật') || clean.includes('cn')) return 8;
  return 2;
}

export function parsePeriodString(periodStr?: string): { start: number; end: number; count: number } {
  if (!periodStr) return { start: 1, end: 1, count: 1 };
  // Matches "tiết 2->5", "tiết 6->8", "tiết 1->10", etc.
  const match = periodStr.match(/(\d+)\s*->\s*(\d+)/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    return { start, end, count: Math.max(1, end - start + 1) };
  }
  const single = periodStr.match(/(\d+)/);
  if (single) {
    const val = parseInt(single[1], 10);
    return { start: val, end: val, count: 1 };
  }
  return { start: 1, end: 1, count: 1 };
}

export function loadAllCourses(): { courses: ClassGroup[]; subjects: SubjectSummary[] } {
  const items = rawData as SguFullDataItem[];
  const courses: ClassGroup[] = [];
  const subjectMap = new Map<string, SubjectSummary>();

  for (const item of items) {
    const sessions: ScheduleSession[] = (item.tkb || []).map((t) => {
      const thu = parseDayOfWeek(t.thu);
      const { start, end, count } = parsePeriodString(t.thoi_gian);
      return {
        thu,
        thuStr: t.thu || `Thứ ${thu}`,
        thoi_gian: t.thoi_gian || '',
        tietStart: start,
        tietEnd: end,
        soTiet: count,
        phong: t.phong || 'Chưa xếp',
        gv: t.giang_vien || 'Chưa phân công',
        dates: t.ngay || '',
      };
    });

    const group: ClassGroup = {
      id: item.id_to_hoc,
      id_to_hoc: item.id_to_hoc,
      ma_mon: item.ma_mon,
      ten_mon: item.ten_mon,
      nhom_to: item.nhom_to || '01',
      to_hoc: item.nhom_to || '01',
      so_tc: Number(item.so_tc) || 0,
      sl_cp: Number(item.sl_cp) || 0,
      sl_cl: Number(item.sl_cl) || 0,
      tkb_raw: item.tkb ? JSON.stringify(item.tkb) : '',
      parsedSessions: sessions,
    };

    courses.push(group);

    if (!subjectMap.has(item.ma_mon)) {
      subjectMap.set(item.ma_mon, {
        ma_mon: item.ma_mon,
        ten_mon: item.ten_mon,
        so_tc: Number(item.so_tc) || 0,
        groupCount: 0,
      });
    }
    subjectMap.get(item.ma_mon)!.groupCount++;
  }

  const subjects = Array.from(subjectMap.values()).sort((a, b) =>
    a.ten_mon.localeCompare(b.ten_mon)
  );

  return { courses, subjects };
}
