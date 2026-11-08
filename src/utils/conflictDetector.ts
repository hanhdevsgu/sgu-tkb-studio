import { ClassGroup, ConflictInfo } from '../types/course';

export function parseSguDateRange(datesStr?: string): { start: number; end: number } | null {
  if (!datesStr) return null;
  const match = datesStr.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(?:đến|-|->)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
  );
  if (match) {
    const d1 = parseInt(match[1], 10);
    const m1 = parseInt(match[2], 10);
    let y1 = parseInt(match[3], 10);
    if (y1 < 100) y1 += 2000;

    const d2 = parseInt(match[4], 10);
    const m2 = parseInt(match[5], 10);
    let y2 = parseInt(match[6], 10);
    if (y2 < 100) y2 += 2000;

    const start = Date.UTC(y1, m1 - 1, d1);
    const end = Date.UTC(y2, m2 - 1, d2);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      return { start: Math.min(start, end), end: Math.max(start, end) };
    }
  }

  const single = datesStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (single) {
    const d1 = parseInt(single[1], 10);
    const m1 = parseInt(single[2], 10);
    let y1 = parseInt(single[3], 10);
    if (y1 < 100) y1 += 2000;
    const ts = Date.UTC(y1, m1 - 1, d1);
    if (!Number.isNaN(ts)) {
      return { start: ts, end: ts };
    }
  }
  return null;
}

export function doDateRangesOverlap(datesA?: string, datesB?: string): boolean {
  const rangeA = parseSguDateRange(datesA);
  const rangeB = parseSguDateRange(datesB);
  // Nếu một trong hai buổi không ghi giới hạn ngày cụ thể -> coi như học xuyên suốt học kỳ
  if (!rangeA || !rangeB) return true;
  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
}

export function checkGroupConflict(
  candidate: ClassGroup,
  existingClasses: ClassGroup[]
): { hasConflict: boolean; conflictingClass?: ClassGroup; reason?: string } {
  for (const existing of existingClasses) {
    if (existing.id === candidate.id) continue;
    // If same course (ma_mon), it's not a schedule conflict (it will just replace group)
    if (existing.ma_mon === candidate.ma_mon) continue;

    for (const sessA of candidate.parsedSessions) {
      if (!sessA.thu || !sessA.tietStart) continue;

      for (const sessB of existing.parsedSessions) {
        if (!sessB.thu || !sessB.tietStart) continue;

        if (sessA.thu === sessB.thu) {
          const overlapStart = Math.max(sessA.tietStart, sessB.tietStart);
          const overlapEnd = Math.min(sessA.tietEnd, sessB.tietEnd);

          if (overlapStart <= overlapEnd && doDateRangesOverlap(sessA.dates, sessB.dates)) {
            return {
              hasConflict: true,
              conflictingClass: existing,
              reason: `Trùng với ${existing.ten_mon} (Thứ ${sessA.thu}, tiết ${overlapStart}->${overlapEnd})`,
            };
          }
        }
      }
    }
  }

  return { hasConflict: false };
}

export function detectConflicts(selectedClasses: ClassGroup[]): {
  conflicts: ConflictInfo[];
  conflictClassIds: Set<string>;
} {
  const conflicts: ConflictInfo[] = [];
  const conflictClassIds = new Set<string>();

  for (let i = 0; i < selectedClasses.length; i++) {
    const classA = selectedClasses[i];

    for (let j = i + 1; j < selectedClasses.length; j++) {
      const classB = selectedClasses[j];
      if (classA.ma_mon === classB.ma_mon) continue;

      for (const sessA of classA.parsedSessions) {
        if (!sessA.thu || !sessA.tietStart) continue;

        for (const sessB of classB.parsedSessions) {
          if (!sessB.thu || !sessB.tietStart) continue;

          if (sessA.thu === sessB.thu) {
            const overlapStart = Math.max(sessA.tietStart, sessB.tietStart);
            const overlapEnd = Math.min(sessA.tietEnd, sessB.tietEnd);

            if (overlapStart <= overlapEnd && doDateRangesOverlap(sessA.dates, sessB.dates)) {
              const overlappedPeriods: number[] = [];
              for (let p = overlapStart; p <= overlapEnd; p++) {
                overlappedPeriods.push(p);
              }

              conflicts.push({
                classAId: classA.id,
                classBId: classB.id,
                classAName: `${classA.ten_mon} (Nhóm ${classA.nhom_to}${classA.to_hoc ? ` - Tổ ${classA.to_hoc}` : ''})`,
                classBName: `${classB.ten_mon} (Nhóm ${classB.nhom_to}${classB.to_hoc ? ` - Tổ ${classB.to_hoc}` : ''})`,
                day: sessA.thu,
                dayStr: sessA.thuStr || `Thứ ${sessA.thu}`,
                periods: overlappedPeriods,
              });

              conflictClassIds.add(classA.id);
              conflictClassIds.add(classB.id);
            }
          }
        }
      }
    }
  }

  return { conflicts, conflictClassIds };
}
