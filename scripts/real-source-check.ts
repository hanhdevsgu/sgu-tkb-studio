// Runs assertions against the REAL source modules (bundled by esbuild), not re-implemented copies.
import assert from 'node:assert';
import { loadAllCourses, parsePeriodString } from '../src/utils/sguDataLoader';
import { checkGroupConflict, detectConflicts, doDateRangesOverlap } from '../src/utils/conflictDetector';
import { parseTkbString } from '../src/utils/tkbParser';

let fail = 0;
const t = (name: string, fn: () => void) => {
  try { fn(); console.log('  PASS', name); } catch (e: any) { fail++; console.log('  FAIL', name, '\n     ', e.message); }
};

const { courses, subjects } = loadAllCourses();
console.log(`Loaded ${courses.length} groups / ${subjects.length} subjects from real data`);

t('every row id is unique', () => {
  const ids = new Set<string>();
  const dup: string[] = [];
  for (const c of courses) { if (ids.has(c.id)) dup.push(c.id); ids.add(c.id); }
  assert.strictEqual(dup.length, 0, `duplicates: ${dup.slice(0, 5).join(', ')}`);
});

t('scheduled sessions only on Thứ 2..7', () => {
  const bad = courses.flatMap(c => c.parsedSessions.filter(s => !s.isUnscheduled && (s.thu < 2 || s.thu > 7)).map(() => c.id));
  assert.strictEqual(bad.length, 0, `bad: ${bad.slice(0, 5)}`);
});

t('tietStart <= tietEnd and within 1..13 (grid rows)', () => {
  const bad = courses.flatMap(c => c.parsedSessions
    .filter(s => !s.isUnscheduled && (s.tietStart < 1 || s.tietEnd > 13 || s.tietStart > s.tietEnd))
    .map(s => `${c.ma_mon}/${c.nhom_to}: ${s.thoi_gian}`));
  assert.strictEqual(bad.length, 0, `bad: ${bad.slice(0, 5).join(' | ')}`);
});

t('no NaN in seat counts', () => {
  const bad = courses.filter(c => Number.isNaN(c.sl_cp) || Number.isNaN(c.sl_cl) || (c.sl_dk !== undefined && Number.isNaN(c.sl_dk)));
  assert.strictEqual(bad.length, 0);
});

t('so_tc is a finite number', () => {
  const bad = courses.filter(c => !Number.isFinite(c.so_tc));
  assert.strictEqual(bad.length, 0);
});

t('parsePeriodString variants', () => {
  assert.deepStrictEqual(parsePeriodString('tiết 3->5'), { start: 3, end: 5, count: 3 });
  assert.deepStrictEqual(parsePeriodString('tiết 3 đến 5'), { start: 3, end: 5, count: 3 });
  assert.deepStrictEqual(parsePeriodString('tiết 10-12'), { start: 10, end: 12, count: 3 });
});

t('date ranges: disjoint months do not overlap; single date inside range overlaps', () => {
  assert.strictEqual(doDateRangesOverlap('05/01/27 đến 19/01/27', '16/02/27 đến 23/02/27'), false);
  assert.strictEqual(doDateRangesOverlap('15/02/27', '01/02/27 đến 28/02/27'), true);
});

t('checkGroupConflict agrees with detectConflicts on real data sample', () => {
  const sample = courses.filter(c => !c.isUnscheduled).slice(0, 400);
  let mismatches = 0;
  for (let i = 0; i < sample.length; i += 7) {
    for (let j = i + 1; j < Math.min(sample.length, i + 40); j++) {
      const a = sample[i], b = sample[j];
      if (a.ma_mon === b.ma_mon) continue;
      const one = checkGroupConflict(a, [b]).hasConflict;
      const two = detectConflicts([a, b]).conflicts.length > 0;
      if (one !== two) mismatches++;
    }
  }
  assert.strictEqual(mismatches, 0, `mismatches: ${mismatches}`);
});

t('parseTkbString splits multi-session strings', () => {
  const s = parseTkbString('Thứ 2, tiết 1->3, Ph C.A101, GV A, 05/01/27 đến 19/01/27<hr>Thứ 4, tiết 4->6, Ph C.A102, GV B, 06/01/27 đến 20/01/27');
  assert.strictEqual(s.filter(x => !x.isUnscheduled).length, 2);
  assert.deepStrictEqual(s.map(x => x.thu), [2, 4]);
});

console.log(fail === 0 ? '\nALL REAL-SOURCE CHECKS PASSED' : `\n${fail} REAL-SOURCE CHECK(S) FAILED`);
process.exit(fail ? 1 : 0);
