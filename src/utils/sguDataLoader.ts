import rawData from '../data/sguFullData.json';
import { ClassGroup, ScheduleSession, SguFullDataItem, SubjectSummary } from '../types/course';

export function parseDayOfWeek(thuStr?: string): number {
  if (!thuStr) return 0;
  const clean = thuStr.trim().toLowerCase();
  if (clean.includes('chưa xếp') || clean.includes('chua xep')) return 0;
  if (clean.includes('2')) return 2;
  if (clean.includes('3')) return 3;
  if (clean.includes('4')) return 4;
  if (clean.includes('5')) return 5;
  if (clean.includes('6')) return 6;
  if (clean.includes('7')) return 7;
  if (clean.includes('chủ nhật') || clean.includes('cn')) return 8;
  return 0;
}

export function parsePeriodString(periodStr?: string): { start: number; end: number; count: number } {
  if (!periodStr) return { start: 0, end: 0, count: 0 };
  const clean = periodStr.trim().toLowerCase();
  if (clean.includes('chưa xếp') || clean.includes('chua xep')) return { start: 0, end: 0, count: 0 };
  
  // Matches "tiết 2->5", "tiết 6->8", "tiết 1->10", etc.
  const match = periodStr.match(/(\d+)\s*(?:->|-)\s*(\d+)/);
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
  return { start: 0, end: 0, count: 0 };
}

export function loadAllCourses(): { courses: ClassGroup[]; subjects: SubjectSummary[] } {
  const items = rawData as SguFullDataItem[];
  const courses: ClassGroup[] = [];
  const subjectMap = new Map<string, SubjectSummary>();

  for (const item of items) {
    // Parse sessions and deduplicate by weekly schedule
    const uniqueSessionMap = new Map<string, ScheduleSession>();

    for (const t of item.tkb || []) {
      const thu = parseDayOfWeek(t.thu);
      const { start, end, count } = parsePeriodString(t.thoi_gian);
      const isUnscheduled = thu === 0 || start === 0;

      const session: ScheduleSession = {
        thu,
        thuStr: isUnscheduled ? 'Chưa xếp' : (t.thu || `Thứ ${thu}`),
        thoi_gian: isUnscheduled ? 'Chưa xếp' : (t.thoi_gian || ''),
        tietStart: start,
        tietEnd: end,
        soTiet: count,
        phong: t.phong || 'Chưa xếp',
        gv: t.giang_vien || 'Chưa phân công',
        dates: t.ngay || '',
        isUnscheduled,
      };

      const key = `${session.thuStr}_${session.thoi_gian}_${session.phong}_${session.gv}`;
      if (!uniqueSessionMap.has(key)) {
        uniqueSessionMap.set(key, session);
      }
    }

    const sessions = Array.from(uniqueSessionMap.values());
    const isUnscheduled = sessions.length === 0 || sessions.every((s) => s.isUnscheduled);

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
      parsedSessions: sessions.length > 0 ? sessions : [{
        thu: 0,
        thuStr: 'Chưa xếp',
        thoi_gian: 'Chưa xếp',
        tietStart: 0,
        tietEnd: 0,
        soTiet: 0,
        phong: 'Chưa xếp',
        gv: 'Chưa phân công',
        isUnscheduled: true,
      }],
      isUnscheduled,
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
