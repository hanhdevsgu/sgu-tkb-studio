// Runs assertions against the REAL source modules (bundled by esbuild), not re-implemented copies.
import assert from 'node:assert';
import { loadAllCourses, parsePeriodString } from '../src/utils/sguDataLoader';
import { checkGroupConflict, detectConflicts, doDateRangesOverlap } from '../src/utils/conflictDetector';
import { parseTkbString } from '../src/utils/tkbParser';
import { SguDkmhService, isJsonAuthExpired, parseSguError } from '../src/services/sguDkmhService';

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

(async () => {
  try {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        result: true,
        data: {
          ds_nhom_to: [],
          ds_mon_hoc: [
            { ma: '801022', ten: 'Đại số đại cương' },
            { ma: '801024', ten: 'Lý luận dạy học môn toán' },
          ],
        },
      }),
    })) as any;

    const emptyFilterRes = await SguDkmhService.fetchFilteredCourseIdsByMode('dummy-token', 5);
    assert.strictEqual(emptyFilterRes.idToHocs.size, 0, 'idToHocs must be empty when ds_nhom_to is empty');
    assert.strictEqual(emptyFilterRes.maMons.size, 0, 'maMons must NOT leak ds_mon_hoc dictionary when ds_nhom_to is empty');

    globalThis.fetch = (async () => ({
      status: 502,
      ok: false,
      json: async () => { throw new Error('Bad Gateway HTML'); },
    })) as any;
    const failedEnrolledRes = await SguDkmhService.getEnrolledCourses('dummy-token', true, 2);
    assert.strictEqual(failedEnrolledRes.failed, true, 'getEnrolledCourses must set failed=true on 502 so UI does not wipe enrolledCourses');

    globalThis.fetch = origFetch;
    console.log('  PASS fetchFilteredCourseIdsByMode never leaks ds_mon_hoc & getEnrolledCourses flags failed=true on 502');

    // Dual-gateway failover & notallowed- classification & concurrent tryRefreshToken deduplication
    assert.strictEqual(isJsonAuthExpired({ result: false, code: 401, message: 'notallowed-' }), true);
    assert.strictEqual(parseSguError('notallowed-').category, 'PHIEN_HET_HAN');

    const calledUrls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calledUrls.push(url);
      if (url.startsWith('/api/')) {
        return { status: 502, ok: false, text: async () => '502 Bad Gateway' };
      }
      return { status: 200, ok: true, text: async () => JSON.stringify({ result: true, data: { is_thanh_cong: true } }) };
    }) as any;

    const failoverRes = await SguDkmhService.registerSingleCourse('tok123', 'id_test_1', 0, true, 1);
    assert.strictEqual(failoverRes.success, true, 'registerSingleCourse must succeed via /api-mirror when /api returns 502');
    assert.deepStrictEqual(calledUrls, ['/api/dkmh/w-xulydkmhsinhvien', '/api-mirror/dkmh/w-xulydkmhsinhvien']);

    let refreshFetches = 0;
    globalThis.fetch = (async () => {
      refreshFetches++;
      await new Promise((r) => setTimeout(r, 30));
      return {
        ok: true,
        status: 200,
        json: async () => ({ token: 'fresh_tok_999', user: { name: 'SV', mssv: '123' } }),
      };
    }) as any;
    const [r1, r2, r3, r4] = await Promise.all([
      SguDkmhService.tryRefreshToken('old_tok'),
      SguDkmhService.tryRefreshToken('old_tok'),
      SguDkmhService.tryRefreshToken('old_tok'),
      SguDkmhService.tryRefreshToken('old_tok'),
    ]);
    assert.strictEqual(refreshFetches, 1, 'concurrent tryRefreshToken calls must share 1 in-flight request');
    assert.deepStrictEqual([r1, r2, r3, r4], ['fresh_tok_999', 'fresh_tok_999', 'fresh_tok_999', 'fresh_tok_999']);

    globalThis.fetch = origFetch;
    console.log('  PASS dual-gateway failover (/api -> /api-mirror), notallowed- 401 detection & tryRefreshToken deduplication');

    // Official SGU filter payload, id_rs / sv_nganh session tracking, dropCourse is_checked:false, and HTTP 412 OTP flow
    SguDkmhService.resetSessionContext();
    let capturedInfoPayload: any = null;
    const regPayloads: any[] = [];
    const callTrace: string[] = [];

    globalThis.fetch = (async (url: string, init?: any) => {
      const bodyObj = init?.body ? JSON.parse(init.body) : null;
      callTrace.push(url);
      if (url.includes('/dkmh/w-locsinhvieninfo')) {
        capturedInfoPayload = bodyObj;
        return {
          status: 200,
          ok: true,
          json: async () => ({ code: 200, data: { ma_sv: '3124410007', ten_day_du: 'SV Test', lop: 'DCT1241', nganh: 2 } }),
        };
      }
      if (url.includes('/dkmh/w-locdsnhomto')) {
        return {
          status: 200,
          ok: true,
          text: async () =>
            JSON.stringify({
              code: 200,
              id_rs: 'rs-session-001',
              data: {
                ds_nhom_to: [{ id_to_hoc: 'live_id_841110_01', ma_mon: '841110', nhom_to: '01', to: '' }],
              },
            }),
        };
      }
      if (url.includes('/dkmh/w-xulydkmhsinhvien')) {
        regPayloads.push(bodyObj);
        return {
          status: 200,
          ok: true,
          text: async () =>
            JSON.stringify({
              result: true,
              data: {
                id_rs: bodyObj?.filter?.is_checked ? 'rs-session-002' : 'rs-session-003',
                is_thanh_cong: true,
                thong_bao_tien_quyet: bodyObj?.filter?.is_checked ? 'Cần lưu ý môn tiên quyết' : '',
              },
            }),
        };
      }
      return { status: 404, ok: false, json: async () => null, text: async () => '' };
    }) as any;

    const svInfo = await SguDkmhService.fetchStudentInfo('tok-sgu', true);
    assert.deepStrictEqual(capturedInfoPayload, {});
    assert.strictEqual(svInfo?.nganh, 2);

    const catalogSync = await SguDkmhService.syncSessionCatalogAndIdRs('tok-sgu', true);
    assert.strictEqual(catalogSync.idRs, 'rs-session-001');
    assert.strictEqual(catalogSync.idMapByKey.get('841110|01|'), 'live_id_841110_01');

    const regRes = await SguDkmhService.registerSingleCourse('tok-sgu', 'live_id_841110_01', 0, true, 1);
    assert.strictEqual(regRes.success, true);
    assert.strictEqual(regRes.warningMessage, 'Cần lưu ý môn tiên quyết');
    assert.deepStrictEqual(regPayloads[0], {
      filter: {
        id_to_hoc: 'live_id_841110_01',
        is_checked: true,
        sv_nganh: 2,
        id_rs: 'rs-session-001',
      },
    });
    assert.strictEqual(SguDkmhService.getSessionContext().id_rs, 'rs-session-002');

    const dropRes = await SguDkmhService.dropCourse('tok-sgu', 'kqdk_1', 'live_id_841110_01', true);
    assert.strictEqual(dropRes.success, true);
    assert.deepStrictEqual(regPayloads[1], {
      filter: {
        id_to_hoc: 'live_id_841110_01',
        is_checked: false,
        sv_nganh: 2,
        id_rs: 'rs-session-002',
      },
    });
    assert.strictEqual(SguDkmhService.getSessionContext().id_rs, 'rs-session-003');

    // Test HTTP 412 -> /otp/setup code 499 auto-verified retry + manual OTP prompt
    let attempt412 = 0;
    globalThis.fetch = (async (url: string) => {
      if (url.includes('/dkmh/w-xulydkmhsinhvien')) {
        attempt412++;
        if (attempt412 === 1) {
          return { status: 412, ok: false, text: async () => '' };
        }
        return { status: 200, ok: true, text: async () => JSON.stringify({ data: { is_thanh_cong: true } }) };
      }
      if (url.includes('/otp/setup')) {
        return { status: 200, ok: true, text: async () => JSON.stringify({ code: 499 }) };
      }
      return { status: 200, ok: true, text: async () => JSON.stringify({ code: 200 }) };
    }) as any;

    const autoOtpRes = await SguDkmhService.registerSingleCourse('tok-sgu', 'live_id_841110_01', 0, true, 1);
    assert.strictEqual(autoOtpRes.success, true, 'HTTP 412 with /otp/setup code 499 must auto-retry registration');
    assert.strictEqual(attempt412, 2);

    globalThis.fetch = (async (url: string) => {
      if (url.includes('/dkmh/w-xulydkmhsinhvien')) {
        return { status: 412, ok: false, text: async () => '' };
      }
      if (url.includes('/otp/setup')) {
        return { status: 200, ok: true, text: async () => JSON.stringify({ code: 200, message: 'OTP sent' }) };
      }
      if (url.includes('/otp/validate/654321')) {
        return { status: 200, ok: true, text: async () => JSON.stringify({ code: 200 }) };
      }
      return { status: 400, ok: false, text: async () => '{}' };
    }) as any;

    const manualOtpReq = await SguDkmhService.registerSingleCourse('tok-sgu', 'live_id_841110_01', 0, true, 1);
    assert.strictEqual(manualOtpReq.success, false);
    assert.strictEqual(manualOtpReq.requiresOtp, true);
    assert.strictEqual(manualOtpReq.httpStatus, 412);

    const validateRes = await SguDkmhService.validateOtp('tok-sgu', '654321', true);
    assert.strictEqual(validateRes.ok, true);

    SguDkmhService.resetSessionContext();
    globalThis.fetch = origFetch;
    console.log('  PASS SGU official filter payload ({filter:{id_to_hoc,is_checked,sv_nganh,id_rs}}), drop is_checked:false, and HTTP 412 OTP flows');

    // Test K24 boolean flag filtering (is_ctdt / is_chctdt / is_rot) & w-kiemtrathoigiandkmhsinhvien fallback & /api-mirror sync failover
    let seenModePayloads: any[] = [];
    const mixedCatalog = [
      { id_to_hoc: 'k24_ctdt_1', ma_mon: '841110', nhom_to: '01', to: '', is_ctdt: true, is_chctdt: false, is_rot: false },
      { id_to_hoc: 'k24_chctdt_2', ma_mon: '841403', nhom_to: '02', to: '', is_ctdt: false, is_chctdt: true, is_rot: false },
      { id_to_hoc: 'k24_outside_3', ma_mon: '841999', nhom_to: '01', to: '', is_ctdt: false, is_chctdt: false, is_rot: false },
    ];
    globalThis.fetch = (async (_url: string, init?: any) => {
      if (init?.body) seenModePayloads.push(JSON.parse(init.body));
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            id_rs: 'rs-k24-live',
            data: {
              ds_nhom_to: mixedCatalog,
              ds_mon_hoc: [{ ma: '841110', ten: 'AI' }, { ma: '841403', ten: 'Mobile' }],
            },
          }),
      };
    }) as any;

    const ctdtRes = await SguDkmhService.fetchFilteredCourseIdsByMode('tok-k24', 2, true);
    assert.deepStrictEqual(Array.from(ctdtRes.idToHocs), ['k24_ctdt_1'], 'Mode 2 must keep only is_ctdt/is_ctdtng2 items');
    assert.strictEqual(seenModePayloads[0]?.loai_dk, undefined, 'w-locdsnhomto payload should match official dkmh.sgu.edu.vn without invalid loai_dk');

    const chctdtRes = await SguDkmhService.fetchFilteredCourseIdsByMode('tok-k24', 4, true);
    assert.deepStrictEqual(Array.from(chctdtRes.idToHocs), ['k24_chctdt_2'], 'Mode 4 must filter by is_chctdt/is_chctdtng2');

    const rotRes = await SguDkmhService.fetchFilteredCourseIdsByMode('tok-k24', 5, true);
    assert.strictEqual(rotRes.idToHocs.size, 0, 'Mode 5 must return 0 courses when all items have is_rot=false');

    const gateTrace: string[] = [];
    const jsonHeaders = { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) };
    globalThis.fetch = (async (url: string) => {
      gateTrace.push(url);
      if (url === '/api/dkmh/w-thoigiansinhviendkmh') {
        return { status: 404, ok: false, headers: jsonHeaders, text: async () => 'Not Found' };
      }
      if (url === '/api/dkmh/w-kiemtrathoigiandkmhsinhvien') {
        return { status: 502, ok: false, headers: jsonHeaders, text: async () => '502' };
      }
      if (url === '/api-mirror/dkmh/w-kiemtrathoigiandkmhsinhvien') {
        return { status: 200, ok: true, headers: jsonHeaders, json: async () => ({ result: true, data: { trong_thoi_gian_dang_ky: true } }) };
      }
      return { status: 500, ok: false, headers: jsonHeaders, text: async () => 'err' };
    }) as any;

    const fbGate = await SguDkmhService.checkRegistrationPeriod('tok-k24', true);
    assert.strictEqual(fbGate.isOpen, true);
    assert.strictEqual(fbGate.state, 'open');
    assert.deepStrictEqual(gateTrace, [
      '/api/dkmh/w-thoigiansinhviendkmh',
      '/api/dkmh/w-kiemtrathoigiandkmhsinhvien',
      '/api-mirror/dkmh/w-kiemtrathoigiandkmhsinhvien',
    ]);

    const syncFailoverUrls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      syncFailoverUrls.push(url);
      if (url.startsWith('/api/')) return { status: 502, ok: false, text: async () => '502' };
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ id_rs: 'rs-mirror-007', data: { ds_nhom_to: mixedCatalog, ds_mon_hoc: [] } }),
      };
    }) as any;
    const mirrorSync = await SguDkmhService.syncSessionCatalogAndIdRs('tok-k24', true);
    assert.strictEqual(mirrorSync.ok, true);
    assert.strictEqual(mirrorSync.idRs, 'rs-mirror-007');
    assert.strictEqual(mirrorSync.dsNhomTo?.length, 3);
    assert.deepStrictEqual(syncFailoverUrls, ['/api/dkmh/w-locdsnhomto', '/api-mirror/dkmh/w-locdsnhomto']);

    SguDkmhService.resetSessionContext();
    globalThis.fetch = origFetch;
    console.log('  PASS K24 boolean CTĐT/CHCTĐT/retake filter, w-kiemtrathoigiandkmhsinhvien failover, and sync mirror failover');
  } catch (e: any) {
    fail++;
    console.log('  FAIL fetchFilteredCourseIdsByMode regression check\n     ', e.message);
  }

  console.log(fail === 0 ? '\nALL REAL-SOURCE CHECKS PASSED' : `\n${fail} REAL-SOURCE CHECK(S) FAILED`);
  process.exit(fail ? 1 : 0);
})();

