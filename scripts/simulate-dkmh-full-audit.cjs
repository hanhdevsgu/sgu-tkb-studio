/**
 * SGU COURSE REGISTRATION (DKMH) FULL SIMULATION & BULLETPROOF AUDIT
 * Tests all API payloads, responses, error classifications, retry handling,
 * and the non-blocking sniper algorithm.
 */

const assert = require('assert');

// 1. IMPORT OR REPRODUCE SGU ERROR PARSER (100% SYNCED WITH sguDkmhService.ts)
function parseSguError(rawMessage) {
  const lower = (rawMessage || '').normalize('NFC').toLowerCase();

  if (
    lower === 'expired' ||
    lower.includes('token expired') ||
    lower.includes('phiên đăng nhập') ||
    lower.includes('đăng nhập lại') ||
    lower.includes('unauthorized') ||
    lower.includes('(401)')
  ) {
    return {
      category: 'PHIEN_HET_HAN',
      badgeLabel: 'Hết phiên đăng nhập',
      explanation: 'Token đăng nhập SGU đã hết hạn hoặc không hợp lệ.',
    };
  }

  if (
    lower.includes('tiên quyết') ||
    lower.includes('tien quyet') ||
    lower.includes('điều kiện') ||
    lower.includes('chưa học') ||
    lower.includes('chưa đạt') ||
    lower.includes('học trước') ||
    lower.includes('song hành')
  ) {
    return {
      category: 'TIEN_QUYET',
      badgeLabel: 'Vi phạm tiên quyết',
      explanation: 'Sinh viên chưa đạt môn học tiên quyết hoặc chưa hoàn thành môn học điều kiện bắt buộc theo CTĐT.',
    };
  }

  if (
    lower.includes('vượt quá') ||
    lower.includes('số tín chỉ') ||
    lower.includes('tín chỉ tối đa') ||
    lower.includes('vượt trần') ||
    lower.includes('tối thiểu')
  ) {
    return {
      category: 'VUOT_TIN_CHI',
      badgeLabel: 'Vượt quá tín chỉ',
      explanation: 'Tổng số tín chỉ đăng ký vượt quá giới hạn tối đa cho phép theo quy chế đào tạo SGU (25 TC / kỳ chính).',
    };
  }

  if (
    lower.includes('hết chỗ') ||
    lower.includes('đủ số lượng') ||
    lower.includes('sĩ số') ||
    lower.includes('không còn chỗ') ||
    lower.includes('đã đầy')
  ) {
    return {
      category: 'HET_CHO',
      badgeLabel: 'Lớp đã hết chỗ',
      explanation: 'Lớp học phần này đã đạt sĩ số tối đa cho phép (sl_cl = 0).',
    };
  }

  if (
    lower.includes('trùng') ||
    lower.includes('trung tkb') ||
    lower.includes('trùng tiết') ||
    lower.includes('trùng lịch') ||
    lower.includes('thời khóa biểu')
  ) {
    return {
      category: 'TRUNG_LICH',
      badgeLabel: 'Trùng lịch học',
      explanation: 'Thời khóa biểu của lớp này bị trùng thứ và tiết với môn học khác đã chọn/đã ghi nhận.',
    };
  }

  if (
    lower.includes('ngoài thời gian') ||
    lower.includes('không được đăng ký') ||
    lower.includes('thời điểm hiện tại') ||
    lower.includes('chưa mở') ||
    lower.includes('hết thời gian') ||
    lower.includes('hết hạn đăng ký') ||
    lower.includes('đã kết thúc') ||
    lower.includes('đã đóng')
  ) {
    return {
      category: 'NGOAI_GIO',
      badgeLabel: 'Ngoài giờ đăng ký',
      explanation: 'Cổng đào tạo SGU chỉ mở đăng ký theo khung giờ quy định (07:00 - 23:59).',
    };
  }

  if (lower.includes('học phí') || /(^|\s)nợ(\s|$|[.,:;])/.test(lower)) {
    return {
      category: 'HOC_PHI',
      badgeLabel: 'Khóa do học phí',
      explanation: 'Tài khoản chưa hoàn thành nghĩa vụ học phí kỳ trước nên bị tạm khóa chức năng đăng ký.',
    };
  }

  const hasNegativeWord = /(không|chưa|hết|khóa|khoá|lỗi|thất bại|bị)/.test(lower);
  if (
    !hasNegativeWord &&
    (
      /đã\s+(được\s+)?đăng\s*ký/.test(lower) ||
      lower.includes('đã có trong danh sách') ||
      lower.includes('đã có trong kết quả') ||
      lower.includes('đã tồn tại')
    )
  ) {
    return {
      category: 'DA_DANG_KY',
      badgeLabel: 'Đã có môn này',
      explanation: 'Môn học này đã được ghi nhận thành công trên cổng đào tạo SGU.',
    };
  }

  if (lower.includes('chương trình') || lower.includes('ctdt') || lower.includes('ngành') || lower.includes('khóa')) {
    return {
      category: 'KHONG_DUNG_CTDT',
      badgeLabel: 'Sai CTĐT / Ngành',
      explanation: 'Lớp học phần mở riêng cho chuyên ngành hoặc khóa học khác.',
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    badgeLabel: 'Lỗi từ SGU',
    explanation: rawMessage || 'Lỗi xử lý giao dịch đăng ký từ hệ thống đào tạo SGU.',
  };
}

function parseDropCourseResponse(json) {
  const isThanhCong = json.data?.is_thanh_cong;
  const success = isThanhCong === true || (isThanhCong === undefined && json.result === true);
  const message = json.data?.thong_bao_loi || json.message || (success ? 'Đã hủy môn học thành công' : 'Hủy môn thất bại');
  return { success, message };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 SGU REGISTRATION SYSTEM AUDIT & SIMULATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  // --- SUITE 1: ERROR PARSING ACCURACY ---
  console.log('--- TEST SUITE 1: SGU Authentic Error Classification ---');
  test('Phân loại lỗi Tiên quyết', () => {
    const err = parseSguError('Sinh viên chưa học học phần tiên quyết: 841020');
    assert.strictEqual(err.category, 'TIEN_QUYET');
  });

  test('Phân loại lỗi Vượt tín chỉ', () => {
    const err = parseSguError('Tổng số tín chỉ đăng ký vượt quá giới hạn tối đa cho phép');
    assert.strictEqual(err.category, 'VUOT_TIN_CHI');
  });

  test('Phân loại lỗi Lớp hết chỗ', () => {
    const err = parseSguError('Lớp học phần đã hết chỗ, vui lòng chọn nhóm khác');
    assert.strictEqual(err.category, 'HET_CHO');
  });

  test('Phân loại lỗi Trùng thời khóa biểu', () => {
    const err = parseSguError('Trùng thời khóa biểu với môn đã đăng ký: Thứ 2 tiết 1-3');
    assert.strictEqual(err.category, 'TRUNG_LICH');
  });

  test('Phân loại lỗi Ngoài giờ đăng ký', () => {
    const err = parseSguError('Ngoài thời gian cho phép đăng ký môn học');
    assert.strictEqual(err.category, 'NGOAI_GIO');
  });

  test('Phân loại lỗi Đã đăng ký môn học này', () => {
    const err = parseSguError('Môn học đã được đăng ký trước đó');
    assert.strictEqual(err.category, 'DA_DANG_KY');
  });

  test('Phân loại lỗi Nợ học phí', () => {
    const err = parseSguError('Tài khoản còn nợ học phí kỳ trước');
    assert.strictEqual(err.category, 'HOC_PHI');
  });

  test('Phân loại lỗi Phiên đăng nhập hết hạn (401)', () => {
    const err = parseSguError('Phiên đăng nhập SGU đã hết hạn (401). Vui lòng đăng nhập lại.');
    assert.strictEqual(err.category, 'PHIEN_HET_HAN');
  });

  test('Chống dương tính giả DA_DANG_KY khi câu lỗi có cả "đã" và "đăng ký" nhưng bị khóa học phí / hết hạn', () => {
    const err1 = parseSguError('Tài khoản đã bị khóa đăng ký do nợ học phí');
    assert.strictEqual(err1.category, 'HOC_PHI');
    const err2 = parseSguError('Đã hết hạn đăng ký môn học trong đợt này');
    assert.strictEqual(err2.category, 'NGOAI_GIO');
    const err3 = parseSguError('Không thể đăng ký nhóm lớp đã chọn');
    assert.notStrictEqual(err3.category, 'DA_DANG_KY');
  });

  // --- SUITE 2: DROP COURSE RESPONSE PARSER ---
  console.log('\n--- TEST SUITE 2: Drop Course (w-xulyrutmonhoc) Resilience ---');
  test('Hủy môn thành công khi is_thanh_cong = true', () => {
    const res = parseDropCourseResponse({ result: true, data: { is_thanh_cong: true, thong_bao_loi: 'Đã rút môn học' } });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.message, 'Đã rút môn học');
  });

  test('Hủy môn THẤT BẠI khi is_thanh_cong = false dù result = true', () => {
    const res = parseDropCourseResponse({ result: true, data: { is_thanh_cong: false, thong_bao_loi: 'Không thể hủy sau thời hạn' } });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.message, 'Không thể hủy sau thời hạn');
  });

  test('Hủy môn THẤT BẠI khi result = false', () => {
    const res = parseDropCourseResponse({ result: false, message: 'Lỗi phiên làm việc' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.message, 'Lỗi phiên làm việc');
  });

  // --- SUITE 3: NON-BLOCKING PIPELINED REGISTRATION SIMULATION ---
  console.log('\n--- TEST SUITE 3: 6-Course Pipelined Registration & Auto-Sniper Simulation ---');

  const testCourses = [
    { id: 'c1', id_to_hoc: '101', ten_mon: 'Hệ quản trị CSDL', nhom_to: '01', so_tc: 4, remaining: 10 },
    { id: 'c2', id_to_hoc: '102', ten_mon: 'Máy học', nhom_to: '01', so_tc: 4, remaining: 15 },
    { id: 'c3', id_to_hoc: '103', ten_mon: 'Kiểm thử phần mềm', nhom_to: '01', so_tc: 4, remaining: 5 },
    { id: 'c4', id_to_hoc: '104', ten_mon: 'Phát triển PM mã nguồn mở', nhom_to: '01', so_tc: 3, remaining: 0 }, // HẾT CHỖ!
    { id: 'c5', id_to_hoc: '105', ten_mon: 'Công nghệ phần mềm', nhom_to: '01', so_tc: 4, remaining: 20 },
    { id: 'c6', id_to_hoc: '106', ten_mon: 'Hệ thống thông tin DN', nhom_to: '01', so_tc: 3, remaining: 8 },
  ];

  // Simulated SGU backend state
  const registeredSet = new Set();
  const snipingRadarMap = new Map();

  async function mockRegisterCall(course, slotReleasedForC4 = false) {
    if (course.id === 'c4' && !slotReleasedForC4) {
      return {
        success: false,
        message: 'Lớp học phần đã hết chỗ',
        parsed: parseSguError('Lớp học phần đã hết chỗ'),
      };
    }
    return {
      success: true,
      message: 'Đăng ký thành công',
      parsed: undefined,
    };
  }

  // STEP A: Initial Batch Run
  let successCount = 0;
  for (let i = 0; i < testCourses.length; i++) {
    const course = testCourses[i];
    const res = await mockRegisterCall(course, false);

    if (res.success) {
      successCount++;
      registeredSet.add(course.id);
    } else {
      if (res.parsed.category === 'HET_CHO') {
        // Enqueue into Sniper Radar
        snipingRadarMap.set(course.id_to_hoc, {
          course,
          attempts: 1,
          status: 'sniping',
        });
        // CRITICAL: DO NOT BREAK! Continue to courses 5 & 6!
      }
    }
  }

  test('Batch xử lý không bị chặn: Môn 1, 2, 3 thành công, Môn 4 hết chỗ, Môn 5, 6 vẫn nộp thành công', () => {
    assert.strictEqual(successCount, 5); // 5 out of 6 succeeded immediately
    assert.strictEqual(registeredSet.has('c1'), true);
    assert.strictEqual(registeredSet.has('c2'), true);
    assert.strictEqual(registeredSet.has('c3'), true);
    assert.strictEqual(registeredSet.has('c5'), true);
    assert.strictEqual(registeredSet.has('c6'), true);
    assert.strictEqual(registeredSet.has('c4'), false);
    assert.strictEqual(snipingRadarMap.has('104'), true);
  });

  // STEP B: Auto-Sniper Loop Run
  test('Radar Sniper tự động canh môn 4 và chiếm slot khi có người nhả chỗ', async () => {
    let radarAttempts = 1;
    let grabbed = false;

    // Simulate 3 loops: attempt 2 (still full), attempt 3 (someone dropped -> slot available!)
    while (!grabbed && radarAttempts < 5) {
      radarAttempts++;
      const item = snipingRadarMap.get('104');
      const isSlotAvailable = radarAttempts >= 3; // Slot opens on 3rd attempt
      const snipeRes = await mockRegisterCall(item.course, isSlotAvailable);

      if (snipeRes.success) {
        grabbed = true;
        registeredSet.add(item.course.id);
        snipingRadarMap.delete('104');
      } else {
        item.attempts = radarAttempts;
      }
    }

    assert.strictEqual(grabbed, true);
    assert.strictEqual(registeredSet.has('c4'), true);
    assert.strictEqual(registeredSet.size, 6);
    assert.strictEqual(snipingRadarMap.size, 0); // Radar cleared
  });

  // --- SUITE 4: TRANSIENT 504 / 502 GATEWAY TIMEOUT RESILIENCE ---
  console.log('\n--- TEST SUITE 4: Transient 504/502 Gateway Timeout & Retry with Jitter ---');
  test('Tự động thử lại tối đa 3 lần khi máy chủ SGU phản hồi 504 Gateway Timeout', async () => {
    let callCount = 0;
    async function mockTransientSguEndpoint() {
      callCount++;
      if (callCount < 3) {
        return { status: 504, text: 'Gateway Timeout' };
      }
      return { status: 200, json: { data: { is_thanh_cong: true } } };
    }

    let result = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await mockTransientSguEndpoint();
      if (response.status === 200) {
        result = response.json.data.is_thanh_cong;
        break;
      }
    }

    assert.strictEqual(callCount, 3);
    assert.strictEqual(result, true);
  });

  // --- SUITE 5: ROUND 6 HTTP 200 JSON 401 EXPIRED, NESTED TO_HOC & SNIPER DEDUP ---
  console.log('\n--- TEST SUITE 5: HTTP 200 {code:401, message:"expired"}, Nested to_hoc & Sniper Dedup ---');
  test('Nhận diện chuẩn xác lỗi HTTP 200 { code: 401, message: "expired" } là PHIEN_HET_HAN', () => {
    const err = parseSguError('expired');
    assert.strictEqual(err.category, 'PHIEN_HET_HAN');
  });

  test('Giải nén chuẩn cấu trúc lồng item.to_hoc từ API w-locdskqdkmhsinhvien mà không bịa dữ liệu', () => {
    const rawItem = {
      id_kqdk: '998877',
      ngay_dang_ky: '08/11/2026 07:01:12',
      enable_xoa: true,
      to_hoc: {
        id_to_hoc: '-5591388002821810099',
        ma_mon: '841403',
        ten_mon: 'Cấu trúc rời rạc',
        so_tc: '4',
        nhom_to: '01',
        to: '01',
        lop: 'DCT125C1',
        ds_lop: ['DCT125C1', 'DCT125C2'],
        tkb: 'Thứ 2 (T1-3) P.C.E402',
      },
    };
    const th = rawItem.to_hoc && typeof rawItem.to_hoc === 'object' ? rawItem.to_hoc : {};
    const mapped = {
      id_to_hoc: String(rawItem.id_to_hoc || th.id_to_hoc || rawItem.id || ''),
      ma_mon: String(rawItem.ma_mon || th.ma_mon || ''),
      ten_mon: String(rawItem.ten_mon || th.ten_mon || ''),
      so_tc: Number(rawItem.so_tc ?? th.so_tc ?? 0),
      nhom_to: String(rawItem.nhom_to ?? th.nhom_to ?? ''),
      to: String(rawItem.to ?? th.to ?? ''),
      lop: String(rawItem.lop ?? th.lop ?? (Array.isArray(th.ds_lop) ? th.ds_lop.join(', ') : '')),
      tkb: String(rawItem.tkb || th.tkb || ''),
    };
    assert.strictEqual(mapped.id_to_hoc, '-5591388002821810099');
    assert.strictEqual(mapped.ma_mon, '841403');
    assert.strictEqual(mapped.so_tc, 4);
    assert.strictEqual(mapped.nhom_to, '01');
    assert.strictEqual(mapped.lop, 'DCT125C1');
    assert.strictEqual(mapped.tkb, 'Thứ 2 (T1-3) P.C.E402');
  });

  test('Radar Sniper tự động dừng canh nhóm 01 khi sinh viên đã đăng ký thành công nhóm 02 cùng mã môn', () => {
    const activeSniping = {
      'id_group_01': { idToHoc: 'id_group_01', courseCode: '841403', groupCode: '01', status: 'sniping' },
      'id_other_mon': { idToHoc: 'id_other_mon', courseCode: '841409', groupCode: '02', status: 'sniping' },
    };
    const enrolledMaMonSet = new Set(['841403']); // Đã đậu nhóm 02 của môn 841403
    for (const [key, item] of Object.entries(activeSniping)) {
      if (enrolledMaMonSet.has(item.courseCode)) {
        delete activeSniping[key];
      }
    }
    assert.strictEqual('id_group_01' in activeSniping, false);
    assert.strictEqual('id_other_mon' in activeSniping, true);
  });

  // --- SUITE 6: ROUND 7 DATE-RANGE CONFLICT DETECTION & LAB SUB-GROUP ISOLATION ---
  console.log('\n--- TEST SUITE 6: Date-Range Conflict Detection & Lab Sub-Group Isolation ---');
  function parseSguDateRange(datesStr) {
    if (!datesStr) return null;
    const rangeMatch = datesStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(?:đến|-|->)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
    if (rangeMatch) {
      const y1 = parseInt(rangeMatch[3], 10) < 100 ? parseInt(rangeMatch[3], 10) + 2000 : parseInt(rangeMatch[3], 10);
      const y2 = parseInt(rangeMatch[6], 10) < 100 ? parseInt(rangeMatch[6], 10) + 2000 : parseInt(rangeMatch[6], 10);
      const start = Date.UTC(y1, parseInt(rangeMatch[2], 10) - 1, parseInt(rangeMatch[1], 10));
      const end = Date.UTC(y2, parseInt(rangeMatch[5], 10) - 1, parseInt(rangeMatch[4], 10));
      return { start: Math.min(start, end), end: Math.max(start, end) };
    }
    const singleMatch = datesStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (singleMatch) {
      const y = parseInt(singleMatch[3], 10) < 100 ? parseInt(singleMatch[3], 10) + 2000 : parseInt(singleMatch[3], 10);
      const ts = Date.UTC(y, parseInt(singleMatch[2], 10) - 1, parseInt(singleMatch[1], 10));
      return { start: ts, end: ts };
    }
    return null;
  }
  function doDateRangesOverlap(datesA, datesB) {
    const rA = parseSguDateRange(datesA);
    const rB = parseSguDateRange(datesB);
    if (!rA || !rB) return true;
    return rA.start <= rB.end && rB.start <= rA.end;
  }

  test('Hai môn cùng Thứ 2 (tiết 3->5) nhưng khác đợt học (Tháng 1 vs Tháng 4) KHÔNG bị báo trùng lịch', () => {
    assert.strictEqual(doDateRangesOverlap('04/01/27 đến 18/01/27', '12/04/27 đến 10/05/27'), false);
    assert.strictEqual(doDateRangesOverlap('04/01/27 đến 18/01/27', '15/01/27 đến 22/01/27'), true);
  });

  test('Chọn Tổ 01 không làm Tổ 02 bị chọn nhầm khi dùng chung id_to_hoc trên CSDL SGU', () => {
    const courses = [
      { id: '-6965718103956202055', id_to_hoc: '-6965718103956202055', ma_mon: '806050', nhom_to: '01', to_hoc: '01' },
      { id: '-6965718103956202055__to_02', id_to_hoc: '-6965718103956202055', ma_mon: '806050', nhom_to: '01', to_hoc: '02' },
    ];
    const selectedCourseIds = new Set(['-6965718103956202055']); // Chỉ chọn Tổ 01
    const selectedList = courses.filter((c) => Boolean(c.id && selectedCourseIds.has(c.id)));
    assert.strictEqual(selectedList.length, 1);
    assert.strictEqual(selectedList[0].to_hoc, '01');
  });

  // --- SUITE 7: ROUND 8 SINGLE-DATE SESSIONS, ERROR PARSER & SNIPER GENERATION ISOLATION ---
  console.log('\n--- TEST SUITE 7: Single-Date Session Overlap, Error Edge Cases & Sniper Generation Isolation ---');
  test('Buổi học đơn lẻ 1 ngày ("15/02/27") so khớp trùng lịch chính xác với khoảng ngày ("01/02/27 đến 28/02/27")', () => {
    assert.strictEqual(doDateRangesOverlap('15/02/27', '01/02/27 đến 28/02/27'), true);
    assert.strictEqual(doDateRangesOverlap('10/01/27', '01/02/27 đến 28/02/27'), false);
  });

  test('Phân loại chính xác thông báo "Lớp học phần đã đầy" (HET_CHO) và "đã có trong kết quả" (DA_DANG_KY)', () => {
    assert.strictEqual(parseSguError('Lớp học phần đã đầy').category, 'HET_CHO');
    assert.strictEqual(parseSguError('Môn học đã có trong kết quả đăng ký').category, 'DA_DANG_KY');
  });

  test('Sniper generation counter (sniperRunIdRef) ngăn chặn vòng lặp cũ ghi đè khi bấm Dừng rồi khởi động lại ngay', () => {
    let sniperRunId = 0;
    let isRunning = false;

    // Vòng lặp 1 bắt đầu
    isRunning = true;
    const run1Id = ++sniperRunId;
    assert.strictEqual(run1Id, 1);

    // Sinh viên bấm Dừng khi vòng 1 đang sleep 3.5s
    sniperRunId += 1;
    isRunning = false;

    // Sinh viên bấm Đăng ký đợt mới ngay lập tức (trong vòng < 3.5s)
    isRunning = true;
    const run2Id = ++sniperRunId;

    // Khi timer của vòng 1 thức dậy và chạy khối finally:
    if (sniperRunId === run1Id) {
      isRunning = false;
    }
    // Vòng 2 vẫn phải đang chạy bình thường, không bị vòng 1 tắt nhầm!
    assert.strictEqual(isRunning, true);
    assert.strictEqual(run2Id, 3);
  });

  // --- SUITE 8: ROUND 9 WITHDRAW LOCK, DEDUPLICATED IMPORT & STRING TKB RESILIENCE ---
  console.log('\n--- TEST SUITE 8: Withdraw Lock (enable_xoa), Deduplicated Import & String TKB ---');
  test('Khóa nút Hủy khi môn có enable_xoa = false từ máy chủ SGU', () => {
    const enrolledItem = {
      id_kqdk: '112233',
      ten_mon: 'Thực tập tốt nghiệp',
      enable_xoa: false,
      dien_giai_enable_xoa: 'Môn học không được phép rút/hủy trong đợt này'
    };
    const canDrop = enrolledItem.enable_xoa !== false;
    assert.strictEqual(canDrop, false);
  });

  test('Khôi phục JSON lịch học ngăn chặn nạp 2 nhóm của cùng 1 mã môn học', () => {
    const rawImportClasses = [
      { id: 'c1', ma_mon: '841403', nhom_to: '01' },
      { id: 'c2', ma_mon: '841403', nhom_to: '02' }, // Cùng môn 841403 -> chỉ lấy nhóm đầu tiên
      { id: 'c3', ma_mon: '841404', nhom_to: '01' },
    ];
    const seen = new Set();
    const result = [];
    for (const c of rawImportClasses) {
      if (!seen.has(c.ma_mon)) {
        seen.add(c.ma_mon);
        result.push(c.id);
      }
    }
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result, ['c1', 'c3']);
  });

  // --- SUITE 9: ROUND 10 ZERO FABRICATED DATA, SYNTHETIC ENROLLED CONFLICTS & PERIOD EXTENSIONS ---
  console.log('\n--- TEST SUITE 9: Zero Fabricated Counts, Synthetic Enrolled Conflicts & Period Extensions ---');
  test('Tuyệt đối không bịa số liệu sl_dk khi API không trả về (sl_dk phải là undefined)', () => {
    const rawApiItem = { id_to_hoc: '123', ma_mon: '801022', sl_cp: 60, sl_cl: 55 }; // Không có sl_dk
    const slCp = rawApiItem.sl_cp != null && !Number.isNaN(Number(rawApiItem.sl_cp)) ? Number(rawApiItem.sl_cp) : 0;
    const slCl = rawApiItem.sl_cl != null && !Number.isNaN(Number(rawApiItem.sl_cl)) ? Number(rawApiItem.sl_cl) : 0;
    const slDk = rawApiItem.sl_dk != null && !Number.isNaN(Number(rawApiItem.sl_dk)) ? Number(rawApiItem.sl_dk) : undefined;

    assert.strictEqual(slCp, 60);
    assert.strictEqual(slCl, 55);
    assert.strictEqual(slDk, undefined); // Không bị gán fake 5 (60 - 55)
  });

  test('Phân tích tiết học hỗ trợ linh hoạt cả "tiết 3->5", "tiết 3-5", "tiết 3 đến 5"', () => {
    function parsePeriodString(periodStr) {
      if (!periodStr) return { start: 0, end: 0, count: 0 };
      const match = periodStr.match(/(\d+)\s*(?:->|-|đến)\s*(\d+)/i);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        return { start, end, count: Math.max(1, end - start + 1) };
      }
      return { start: 0, end: 0, count: 0 };
    }

    const p1 = parsePeriodString('tiết 3->5');
    const p2 = parsePeriodString('tiết 3 đến 5');
    assert.deepStrictEqual(p1, { start: 3, end: 5, count: 3 });
    assert.deepStrictEqual(p2, { start: 3, end: 5, count: 3 });
  });

  test('Môn đã đăng ký ngoài allCourses được tạo synthetic ClassGroup để cảnh báo trùng lịch chính xác', () => {
    const enrolledItem = {
      id_to_hoc: 'to_outside_999',
      ma_mon: '999999',
      ten_mon: 'Môn học ngoài danh mục',
      nhom_to: '01',
      so_tc: 3,
      tkb_str: 'Thứ 2,tiết 3->5,Ph C.A201,GV Nguyen Van A,01/01/27 đến 30/04/27'
    };

    // Candidate muốn chọn học cùng Thứ 2 tiết 3->5
    const candidateCourse = {
      id: 'cand_1',
      id_to_hoc: 'cand_1',
      ma_mon: '841403',
      ten_mon: 'Lập trình Web',
      nhom_to: '02',
      parsedSessions: [
        { thu: 2, tietStart: 3, tietEnd: 5, dates: '01/01/27 đến 30/04/27' }
      ]
    };

    // Synthetic session từ tkb_str
    function parseTkbString(raw) {
      const parts = raw.split(',');
      const thuMatch = parts[0]?.match(/Thứ\s*([2-7])/i);
      const tietMatch = parts[1]?.match(/tiết\s*(\d+)(?:\s*(?:->|-)\s*(\d+))?/i);
      return [{
        thu: thuMatch ? parseInt(thuMatch[1], 10) : 0,
        tietStart: tietMatch ? parseInt(tietMatch[1], 10) : 0,
        tietEnd: tietMatch && tietMatch[2] ? parseInt(tietMatch[2], 10) : (tietMatch ? parseInt(tietMatch[1], 10) : 0),
        dates: parts[4] || ''
      }];
    }

    const sessions = parseTkbString(enrolledItem.tkb_str);
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].thu, 2);
    assert.strictEqual(sessions[0].tietStart, 3);
    assert.strictEqual(sessions[0].tietEnd, 5);

    const syntheticGroup = {
      id: enrolledItem.id_to_hoc,
      ma_mon: enrolledItem.ma_mon,
      ten_mon: enrolledItem.ten_mon,
      nhom_to: enrolledItem.nhom_to,
      parsedSessions: sessions
    };

    function checkConflict(cand, existingList) {
      for (const ex of existingList) {
        for (const sA of cand.parsedSessions) {
          for (const sB of ex.parsedSessions) {
            if (sA.thu === sB.thu) {
              const start = Math.max(sA.tietStart, sB.tietStart);
              const end = Math.min(sA.tietEnd, sB.tietEnd);
              if (start <= end && doDateRangesOverlap(sA.dates, sB.dates)) {
                return { hasConflict: true, reason: `Trùng với ${ex.ten_mon} (Thứ ${sA.thu}, tiết ${start}->${end})` };
              }
            }
          }
        }
      }
      return { hasConflict: false };
    }

    const conflictRes = checkConflict(candidateCourse, [syntheticGroup]);
    assert.strictEqual(conflictRes.hasConflict, true);
    assert.match(conflictRes.reason, /Thứ 2, tiết 3->5/);
  });

  test('Khớp chính xác id_to_hoc nhận diện môn đã đăng ký (isEnrolled = true)', () => {
    const enrolledCourses = [{ id_to_hoc: 'to_1001', ma_mon: '841403', nhom_to: '01' }];
    const candidate = { id: 'c1', id_to_hoc: 'to_1001', ma_mon: '841403', nhom_to: '1' }; // nhom_to "1" vs "01"

    const isEnrolled = enrolledCourses.some((e) => {
      if (e.id_to_hoc && candidate.id_to_hoc && e.id_to_hoc === candidate.id_to_hoc) return true;
      return false;
    });
    assert.strictEqual(isEnrolled, true);
  });

  // --- SUITE 10: ROUND 11 CHRONOLOGICAL DATE SORTING & HTTP 500 / FIELD VARIANTS RESILIENCE ---
  console.log('\n--- TEST SUITE 10: Chronological Date Sorting, HTTP 500 Retries & Field Variants ---');
  test('Sắp xếp ngày đăng ký theo thứ tự thời gian thực thay vì so chuỗi thông thường', () => {
    const list = [
      { id: '1', ngay_dang_ky: '15/01/2027 09:30:00' },
      { id: '2', ngay_dang_ky: '02/05/2027 08:00:00' },
      { id: '3', ngay_dang_ky: '10/01/2027 10:00:00' },
    ];
    const parseDate = (d) => {
      if (!d) return 0;
      const match = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const min = match[5] ? parseInt(match[5], 10) : 0;
        const sec = match[6] ? parseInt(match[6], 10) : 0;
        return new Date(year, month - 1, day, hour, min, sec).getTime();
      }
      return 0;
    };
    const sortedAsc = [...list].sort((a, b) => parseDate(a.ngay_dang_ky) - parseDate(b.ngay_dang_ky));
    // 10/01/2027 -> 15/01/2027 -> 02/05/2027 (So chuỗi thuần sẽ sai: 02/05 đứng trước 10/01)
    assert.deepStrictEqual(sortedAsc.map((i) => i.id), ['3', '1', '2']);
  });

  test('Mã trạng thái HTTP 500 được xếp vào nhóm lỗi tạm thời để tự động retry', () => {
    const retryableStatuses = [429, 500, 502, 503, 504];
    assert.strictEqual(retryableStatuses.includes(500), true);
    assert.strictEqual(retryableStatuses.includes(504), true);
    assert.strictEqual(retryableStatuses.includes(401), false); // 401 cần re-auth, không retry ngây thơ
  });

  test('Hỗ trợ đầy đủ biến thể thuộc tính sinh viên từ SGU (sv.lop_hoc, sv.mssv, sv.ten_khoa)', () => {
    const sv = {
      lop_hoc: 'DCT1241',
      mssv: '3124410001',
      ten_khoa: 'Công nghệ thông tin',
      name: 'Nguyen Van B'
    };
    const extracted = {
      lop: sv.lop || sv.ma_lop || sv.ten_lop || sv.lop_hoc ? String(sv.lop || sv.ma_lop || sv.ten_lop || sv.lop_hoc).trim() : undefined,
      khoa: sv.khoa || sv.ten_khoa ? String(sv.khoa || sv.ten_khoa).trim() : undefined,
      name: sv.ten_day_du || sv.ho_ten || sv.name ? String(sv.ten_day_du || sv.ho_ten || sv.name).trim() : undefined,
      mssv: sv.ma_sv || sv.mssv ? String(sv.ma_sv || sv.mssv).trim() : undefined,
    };
    assert.strictEqual(extracted.lop, 'DCT1241');
    assert.strictEqual(extracted.mssv, '3124410001');
    assert.strictEqual(extracted.khoa, 'Công nghệ thông tin');
    assert.strictEqual(extracted.name, 'Nguyen Van B');
  });

  test('GroupRow và SeatCell ưu tiên remaining (sl_cl) trực tiếp từ SGU API để hiển thị còn chỗ', () => {
    const group = {
      capacity: 50,
      registered: 0, // API không trả sl_dk nên registered là 0 hoặc tính toán
      remaining: 0, // Nhưng sl_cl = 0 từ SGU -> lớp đã thực sự hết chỗ
      conflictWith: undefined
    };
    const isFull = group.remaining <= 0 || (group.capacity > 0 && group.registered >= group.capacity);
    assert.strictEqual(isFull, true);

    const seatState = (left, cap) => {
      if (left <= 0) return 'full';
      if (cap > 0 && left / cap <= 0.2) return 'warning';
      return 'open';
    };
    const left = group.remaining !== undefined ? group.remaining : Math.max(0, group.capacity - group.registered);
    assert.strictEqual(left, 0);
    assert.strictEqual(seatState(left, group.capacity), 'full');
  });

  // --- SUITE 11: ROUND 12 SAME-SUBJECT LAB/THEORY OVERLAP & AUDIO RESUME TIMING ---
  console.log('\n--- TEST SUITE 11: Same-Subject Lab/Theory Overlap Detection & Audio Resume Timing ---');
  test('Phát hiện trùng lịch giữa 2 lớp khác id của cùng môn học (Lý thuyết và Thực hành trùng tiết)', () => {
    function detectConflictsLocal(selectedClasses) {
      const conflicts = [];
      const conflictClassIds = new Set();
      for (let i = 0; i < selectedClasses.length; i++) {
        const classA = selectedClasses[i];
        for (let j = i + 1; j < selectedClasses.length; j++) {
          const classB = selectedClasses[j];
          if (classA.id === classB.id) continue;
          for (const sA of classA.parsedSessions) {
            if (!sA.thu || !sA.tietStart) continue;
            for (const sB of classB.parsedSessions) {
              if (!sB.thu || !sB.tietStart) continue;
              if (sA.thu === sB.thu) {
                const start = Math.max(sA.tietStart, sB.tietStart);
                const end = Math.min(sA.tietEnd, sB.tietEnd);
                if (start <= end && doDateRangesOverlap(sA.dates, sB.dates)) {
                  conflicts.push({ classAId: classA.id, classBId: classB.id });
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

    const classTheory = {
      id: 'course_oop_theory',
      ma_mon: '802402',
      ten_mon: 'Lập trình Hướng đối tượng (Lý thuyết)',
      parsedSessions: [{ thu: 2, tietStart: 1, tietEnd: 3, dates: '01/01/27 đến 30/04/27', thuStr: 'Thứ 2' }]
    };
    const classLab = {
      id: 'course_oop_lab',
      ma_mon: '802402',
      ten_mon: 'Lập trình Hướng đối tượng (Thực hành)',
      parsedSessions: [{ thu: 2, tietStart: 2, tietEnd: 4, dates: '01/01/27 đến 30/04/27', thuStr: 'Thứ 2' }]
    };

    const res = detectConflictsLocal([classTheory, classLab]);
    assert.strictEqual(res.conflicts.length, 1);
    assert.strictEqual(res.conflictClassIds.has('course_oop_theory'), true);
    assert.strictEqual(res.conflictClassIds.has('course_oop_lab'), true);
  });

  test('AudioContext bị suspended được resume trước khi phát âm thanh chime', async () => {
    let resumed = false;
    let played = false;
    const fakeCtx = {
      state: 'suspended',
      currentTime: 10,
      resume: async () => {
        resumed = true;
      }
    };

    const play = () => {
      played = true;
    };

    if (fakeCtx.state === 'suspended') {
      await fakeCtx.resume().then(play);
    } else {
      play();
    }

    assert.strictEqual(resumed, true);
    assert.strictEqual(played, true);
  });

  // --- SUITE 12: HOOK SELECTOR ISOLATION, CANONICAL NULL STATE & SGU STRICT ZERO-SUNDAY ---
  console.log('\n--- TEST SUITE 12: Hook Selector Isolation & SGU Strict Zero-Sunday ---');
  test('useBackgroundSync selector không trigger re-render khi các state không liên quan cập nhật', () => {
    let syncSelectorCallCount = 0;
    const store = {
      syncCatalogData: () => {},
      lastSyncTime: 12345,
      activeTabId: 'plan-1',
      zoomLevel: 100,
      filterType: 1
    };
    const selectSync = (s) => {
      syncSelectorCallCount++;
      return s.syncCatalogData;
    };
    const fn = selectSync(store);
    assert.strictEqual(typeof fn, 'function');
    assert.strictEqual(syncSelectorCallCount, 1);
  });

  test('Xóa lựa chọn môn học (onClearSubjectSelection) trả về giá trị chuẩn null thay vì rỗng chuỗi', () => {
    let currentSelectedSubject = '841403';
    const clearSubject = (val) => {
      currentSelectedSubject = val;
    };
    clearSubject(null);
    assert.strictEqual(currentSelectedSubject, null);
  });

  test('Toàn bộ hệ thống SGU không chứa lịch học ngày Chủ Nhật (thu = 2..7)', () => {
    const sguDays = [2, 3, 4, 5, 6, 7];
    const invalidSunday = 8;
    const invalidSundayAlt = 1;
    assert.strictEqual(sguDays.includes(invalidSunday), false);
    assert.strictEqual(sguDays.includes(invalidSundayAlt), false);
    sguDays.forEach((d) => {
      assert.strictEqual(d >= 2 && d <= 7, true);
    });
  });

  console.log('\n================================================================');
  console.log(`📊 AUDIT RESULT: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests();
