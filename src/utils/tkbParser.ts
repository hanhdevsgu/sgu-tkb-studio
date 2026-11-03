import { ScheduleSession } from '../types/course';

export function parseTkbString(rawTkb?: string): ScheduleSession[] {
  if (!rawTkb) return [];

  // Split by <hr>, <br>, or newlines
  const segments = rawTkb.split(/<hr\s*\/?>|<br\s*\/?>|\r?\n/i);
  const sessions: ScheduleSession[] = [];

  for (const segment of segments) {
    const cleanSegment = segment.trim();
    if (!cleanSegment) continue;

    const parts = cleanSegment.split(',').map(s => s.trim());
    let thu: number | null = null;
    let tiestStart: number | null = null;
    let tiestEnd: number | null = null;
    let phong = '';
    let gv = '';
    let dates = '';

    for (const p of parts) {
      // 1. Check Thu
      const thuMatch = p.match(/Thứ\s*(\d+|CN)/i);
      if (thuMatch) {
        thu = thuMatch[1].toUpperCase() === 'CN' ? 8 : parseInt(thuMatch[1], 10);
      }

      // 2. Check Tiet (e.g. tiết 3->5 or tiết 4)
      const tietMatch = p.match(/tiết\s*(\d+)(?:\s*(?:->|-)\s*(\d+))?/i);
      if (tietMatch) {
        tiestStart = parseInt(tietMatch[1], 10);
        tiestEnd = tietMatch[2] ? parseInt(tietMatch[2], 10) : tiestStart;
      }

      // 3. Check Phong (Room)
      if (/^Ph(?:\.|\s)/i.test(p)) {
        phong = p.replace(/^Ph(?:\.|\s*)\s*/i, '').trim();
      }

      // 4. Check Giang Vien (Lecturer)
      if (/^GV(?:\.|\s)/i.test(p)) {
        gv = p.replace(/^GV(?:\.|\s*)\s*/i, '').trim();
      }

      // 5. Date range
      if (p.includes('đến') || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(p)) {
        dates = p.trim();
      }
    }

    if (thu && tiestStart) {
      sessions.push({
        thu,
        tietStart: tiestStart,
        tietEnd: tiestEnd || tiestStart,
        phong,
        gv,
        dates
      });
    } else if (gv) {
      // Class without specific day/period yet
      sessions.push({
        thu: 0,
        tietStart: 0,
        tietEnd: 0,
        phong,
        gv,
        dates
      });
    }
  }

  return sessions;
}

export function formatDayName(thu: number): string {
  if (thu === 8) return 'Chủ Nhật';
  if (thu >= 2 && thu <= 7) return `Thứ ${thu}`;
  return 'Lịch đặc biệt';
}

