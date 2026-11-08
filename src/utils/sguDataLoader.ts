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

export function cleanVietnameseSubjectTitle(s?: string): string {
  if (!s) return '';
  return s.normalize('NFC').trim();
}

export function loadAllCourses(customItems?: SguFullDataItem[]): { courses: ClassGroup[]; subjects: SubjectSummary[] } {
  const items = (customItems || rawData) as SguFullDataItem[];
  const courses: ClassGroup[] = [];
  const subjectMap = new Map<string, SubjectSummary>();

  for (const item of items) {
    const cleanTenMon = cleanVietnameseSubjectTitle(item.ten_mon);
    const cleanMaMon = (item.ma_mon || '').normalize('NFC').trim();
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

    const slCp = Number(item.sl_cp) || 0;
    const slCl = Number(item.sl_cl) || 0;
    const slDk = item.sl_dk != null ? Number(item.sl_dk) : Math.max(0, slCp - slCl);
    const lop = item.lop || (Array.isArray(item.ds_lop) && item.ds_lop.length > 0 ? item.ds_lop.join(', ') : '');
    const dsLop = Array.isArray(item.ds_lop) ? item.ds_lop : (item.lop ? [item.lop] : []);
    const dsKhoa = Array.isArray(item.ds_khoa) ? item.ds_khoa : [];

    const group: ClassGroup = {
      id: item.id_to_hoc,
      id_to_hoc: item.id_to_hoc,
      ma_mon: cleanMaMon,
      ten_mon: cleanTenMon,
      nhom_to: item.nhom_to || '01',
      to_hoc: item.to || '',
      to: item.to || '',
      so_tc: Number(item.so_tc) || 0,
      sl_cp: slCp,
      sl_cl: slCl,
      sl_dk: slDk,
      lop,
      ds_lop: dsLop,
      ds_khoa: dsKhoa,
      tkb_raw: item.tkb ? JSON.stringify(item.tkb) : '',
      tkb: item.tkb || [],
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

    if (!subjectMap.has(cleanMaMon)) {
      subjectMap.set(cleanMaMon, {
        ma_mon: cleanMaMon,
        ten_mon: cleanTenMon,
        so_tc: Number(item.so_tc) || 0,
        groupCount: 0,
        groupNumbers: [],
        targetClasses: [],
        departments: [],
        totalCapacity: 0,
        totalRemaining: 0,
        totalRegistered: 0,
      });
    }
    const sSummary = subjectMap.get(cleanMaMon)!;
    sSummary.groupCount++;
    if (item.nhom_to && !sSummary.groupNumbers?.includes(item.nhom_to)) {
      sSummary.groupNumbers?.push(item.nhom_to);
    }
    for (const l of dsLop) {
      if (l && !sSummary.targetClasses?.includes(l)) {
        sSummary.targetClasses?.push(l);
      }
    }
    for (const k of dsKhoa) {
      if (k && !sSummary.departments?.includes(k)) {
        sSummary.departments?.push(k);
      }
    }
    sSummary.totalCapacity = (sSummary.totalCapacity || 0) + slCp;
    sSummary.totalRemaining = (sSummary.totalRemaining || 0) + slCl;
    sSummary.totalRegistered = (sSummary.totalRegistered || 0) + slDk;
  }

  // Calculate hasSameNameVariant and scope
  const titleCounts = new Map<string, number>();
  for (const s of subjectMap.values()) {
    const key = s.ten_mon.trim().toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }

  for (const s of subjectMap.values()) {
    const key = s.ten_mon.trim().toLowerCase();
    s.hasSameNameVariant = (titleCounts.get(key) || 0) > 1;

    // Scope heuristic
    const isGeneral =
      /triết học|kinh tế chính trị|chủ nghĩa xã hội|tư tưởng hồ chí minh|lịch sử đảng|pháp luật đại cương|tin học đại cương|tiếng anh|giáo dục thể chất|cầu lông|bóng rổ|bóng bàn|bóng đá|bóng chuyền|võ |điền kinh|tiếng pháp|tiếng trung|tiếng nga|kỹ năng giao tiếp/i.test(
        s.ten_mon
      ) ||
      (s.departments && s.departments.some((d) => /cơ bản|toàn trường|đại cương/i.test(d)));

    s.scope = isGeneral ? 'general' : 'major';
  }

  const subjects = Array.from(subjectMap.values()).sort((a, b) =>
    a.ten_mon.localeCompare(b.ten_mon)
  );

  return { courses, subjects };
}

export async function fetchLiveSguData(): Promise<{ courses: ClassGroup[]; subjects: SubjectSummary[]; meta?: any } | null> {
  try {
    const timestamp = Date.now();
    const [metaRes, dataRes] = await Promise.all([
      fetch(`/data/sguMeta.json?t=${timestamp}`),
      fetch(`/data/sguFullData.json?t=${timestamp}`)
    ]);

    if (!metaRes.ok || !dataRes.ok) return null;
    const meta = await metaRes.json();
    const items = await dataRes.json();
    const { courses, subjects } = loadAllCourses(items);
    return { courses, subjects, meta };
  } catch (err) {
    return null;
  }
}
