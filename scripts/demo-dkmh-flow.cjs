/**
 * DEMO CHI TIẾT LUỒNG LOGIC KHI BẤM ĐĂNG KÝ MÔN HỌC (ĐKMH)
 * Minh họa chính xác từng mili-giây và hành vi rẽ nhánh của hệ thống.
 */

function parseSguError(rawMessage) {
  const lower = (rawMessage || '').normalize('NFC').toLowerCase();
  if (lower.includes('hết chỗ') || lower.includes('đủ số lượng') || lower.includes('sĩ số') || lower.includes('không còn chỗ') || lower.includes('đã đầy') || /vượt\s+quá\s+(số\s+lượng|sĩ\s+số|chỉ\s+tiêu)/.test(lower)) {
    return { category: 'HET_CHO', badgeLabel: 'Lớp đã hết chỗ' };
  }
  const isExplicitlyNegated = /(không|chưa)\s+(được\s+|thể\s+)?đăng\s*ký\s+môn/.test(lower) || /(sinh\s+viên\s+)?(không|chưa)\s+được\s+đăng\s*ký/.test(lower);
  if (!isExplicitlyNegated && (/đã\s+(được\s+)?đăng\s*ký/.test(lower) || lower.includes('đã có trong danh sách') || lower.includes('đã có trong kết quả') || lower.includes('đã tồn tại'))) {
    return { category: 'DA_DANG_KY', badgeLabel: 'Đã có môn này' };
  }
  return { category: 'UNKNOWN_ERROR', badgeLabel: 'Lỗi từ SGU' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDkmhFlowDemo() {
  console.log('================================================================================');
  console.log('🚀 MÔ PHỎNG CHI TIẾT LUỒNG LOGIC KHI THỰC HIỆN ĐĂNG KÝ MÔN HỌC (ĐKMH)');
  console.log('================================================================================\n');

  console.log('📌 BƯỚC 1: TIỀN XỬ LÝ & LÀM SẠCH DANH SÁCH (Deduplication & Validation)');
  console.log('   - Sinh viên Nguyễn Hoàng Anh chọn 4 môn từ bảng:');
  console.log('     1. [841403] Kiến trúc phần mềm - Nhóm 01 (3 TC)');
  console.log('     2. [841108] Cơ sở dữ liệu NC  - Nhóm 02 (3 TC)');
  console.log('     3. [841322] Thiết kế giao diện - Nhóm 01 (3 TC)');
  console.log('     4. [841021] Mạng máy tính      - Nhóm 01 (3 TC)');
  console.log('   - Hệ thống quét qua `enrolledMaMonSet`: không có môn nào đã đăng ký trước.');
  console.log('   - Lọc trùng lặp mã môn: 4/4 môn hợp lệ.');
  console.log('   - Bật cờ Mutex `isBatchSubmittingRef.current = true` để tạm hoãn Radar Sniper nếu đang chạy ngầm.');
  console.log('   - Kiểm tra Token: Hợp lệ (Bearer eyJhbGciOi...).\n');

  await sleep(1000);

  console.log('📌 BƯỚC 2: GỬI ĐĂNG KÝ HÀNG LOẠT KHÔNG CHẶN (Pipelined Execution)');

  // Môn 1: Thành công
  console.log('\n   👉 [1/4] Gửi POST /api/dkmh/w-xulydkmhsinhvien -> id_to_hoc: "to_841403_01"');
  await sleep(350);
  console.log('      ⬅️ SGU phản hồi (HTTP 200, 320ms): { result: true, data: { is_thanh_cong: true } }');
  console.log('      ✅ KẾT QUẢ: Thành công!');
  console.log('      🔊 Phát âm thanh Chime (Web Audio API).');
  console.log('      🗑️ Tự động gỡ mã 841403 khỏi hàng đợi chọn.');
  console.log('      ⏳ Nghỉ nhịp vi bước (Micro-jitter 142ms)...');

  await sleep(500);

  // Môn 2: Hết chỗ -> Chuyển Radar Sniper
  console.log('\n   👉 [2/4] Gửi POST /api/dkmh/w-xulydkmhsinhvien -> id_to_hoc: "to_841108_02"');
  await sleep(350);
  const sguMsg2 = 'Lớp học phần đã vượt quá sĩ số tối đa cho phép';
  const parsed2 = parseSguError(sguMsg2);
  console.log(`      ⬅️ SGU phản hồi (HTTP 200, 310ms): { result: false, data: { is_thanh_cong: false, thong_bao_loi: "${sguMsg2}" } }`);
  console.log(`      ⚠️ Phân loại lỗi: [${parsed2.category}] - ${parsed2.badgeLabel}`);
  console.log('      🎯 HÀNH ĐỘNG THÔNG MINH:');
  console.log('         - Tự động nạp [841108 Nhóm 02] vào Radar Sniper chạy ngầm.');
  console.log('         - ⚡ KHÔNG DỪNG LẠI! Tiếp tục đăng ký ngay Môn 3 và Môn 4!');
  console.log('      ⏳ Nghỉ nhịp vi bước (Micro-jitter 135ms)...');

  await sleep(500);

  // Môn 3: Nghẽn mạng tạm thời 502 -> Tự động Retry
  console.log('\n   👉 [3/4] Gửi POST /api/dkmh/w-xulydkmhsinhvien -> id_to_hoc: "to_841322_01"');
  await sleep(200);
  console.log('      ⬅️ SGU phản hồi: HTTP 502 Bad Gateway (Máy chủ trường đang tải nặng)');
  console.log('      🔄 Tự động thử lại lần 1 sau 520ms (Exponential Backoff + Jitter)...');
  await sleep(520);
  console.log('      ⬅️ SGU phản hồi lại (HTTP 200, 290ms): { result: true, data: { is_thanh_cong: true } }');
  console.log('      ✅ KẾT QUẢ: Đăng ký thành công sau retry!');
  console.log('      🔊 Phát âm thanh Chime.');
  console.log('      ⏳ Nghỉ nhịp vi bước (Micro-jitter 150ms)...');

  await sleep(500);

  // Môn 4: Câu thông báo phức hợp SGU
  console.log('\n   👉 [4/4] Gửi POST /api/dkmh/w-xulydkmhsinhvien -> id_to_hoc: "to_841021_01"');
  await sleep(350);
  const sguMsg4 = 'Môn học này đã được đăng ký, không thể đăng ký lại';
  const parsed4 = parseSguError(sguMsg4);
  console.log(`      ⬅️ SGU phản hồi: "${sguMsg4}"`);
  console.log(`      ✨ Phân loại phản hồi: [${parsed4.category}] - Đã có trong CSDL trường.`);
  console.log('      ✅ KẾT QUẢ: Ghi nhận thành công!');

  await sleep(800);

  console.log('\n📌 BƯỚC 3: KẾT THÚC BATCH GỬI CHÍNH & CHUYỂN GIAO CHO RADAR');
  console.log('   - Kết quả đợt gửi đầu tiên: 3 môn ĐĂNG KÝ THÀNH CÔNG, 1 môn hết chỗ.');
  console.log('   - Gọi `fetchEnrolledList()` cập nhật Bảng 2 (Môn đã đăng ký: 3 môn, 9 tín chỉ).');
  console.log('   - Nhả cờ Mutex `isBatchSubmittingRef.current = false`.');
  console.log('   - Radar Sniper nền tiếp nhận môn [841108 Nhóm 02] và bắt đầu chu kỳ quét ngầm...\n');

  await sleep(1000);

  console.log('📌 BƯỚC 4: RADAR SNIPER CANH GIẬT SLOT CHẠY NGẦM (Background Engine)');
  console.log('   [Vòng quét 1] 07:01:15 - Bắn dò slot môn 841108...');
  await sleep(400);
  console.log('   -> SGU: Lớp vẫn đủ số lượng (0 chỗ trống). Nghỉ 2.4s có ngẫu nhiên hóa thời gian...');
  await sleep(800);

  console.log('   [Vòng quét 2] 07:01:18 - Bắn dò slot môn 841108...');
  await sleep(400);
  console.log('   🎉 BÙM! Có sinh viên khác vừa nhả môn!');
  console.log('   -> SGU: Đăng ký thành công!');
  console.log('   🔊 Phát âm thanh chúc mừng chiến thắng!');
  console.log('   🎉 CHIẾM SLOT THÀNH CÔNG: Cơ sở dữ liệu NC (Nhóm 02)!');
  console.log('   🗑️ Xóa môn 841108 khỏi Radar Sniper.');
  console.log('   🔄 Cập nhật Bảng 2: Đủ 4/4 môn (12 tín chỉ).\n');

  console.log('================================================================================');
  console.log('🏁 KẾT THÚC LUỒNG: 100% MÔN ĐÃ ĐƯỢC ĐĂNG KÝ VÀO CƠ SỞ DỮ LIỆU SGU HOÀN TẤT!');
  console.log('================================================================================\n');
}

runDkmhFlowDemo();
