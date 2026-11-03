import { ClassGroup, ConflictInfo } from '../types/course';

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

          if (overlapStart <= overlapEnd) {
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

      for (const sessA of classA.parsedSessions) {
        if (!sessA.thu || !sessA.tietStart) continue;

        for (const sessB of classB.parsedSessions) {
          if (!sessB.thu || !sessB.tietStart) continue;

          if (sessA.thu === sessB.thu) {
            const overlapStart = Math.max(sessA.tietStart, sessB.tietStart);
            const overlapEnd = Math.min(sessA.tietEnd, sessB.tietEnd);

            if (overlapStart <= overlapEnd) {
              const overlappedPeriods: number[] = [];
              for (let p = overlapStart; p <= overlapEnd; p++) {
                overlappedPeriods.push(p);
              }

              conflicts.push({
                classAId: classA.id,
                classBId: classB.id,
                classAName: `${classA.ten_mon} (Tổ ${classA.to_hoc})`,
                classBName: `${classB.ten_mon} (Tổ ${classB.to_hoc})`,
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
