# SGU Timetable Studio — Changelog

Tất cả những thay đổi, bổ sung tính năng và nâng cấp kiến trúc của dự án được ghi nhận tại đây.

---

## [1.5.1] - 2026-11-12

### 🎯 Gia cố Tự Động Thích Ứng cho Đợt K24 & Kiểm Chứng Live Bundle `dkmh.sgu.edu.vn`
- **Tự đồng bộ danh mục sống (`mergeLiveCatalog`) vào RAM cho tài khoản K24:**
  - Bất cứ khi nào gọi `syncSessionCatalogAndIdRs` hoặc lọc CTĐT (`w-locdsnhomto`), dữ liệu lớp mở mới, sĩ số `sl_cp/sl_cl/sl_dk` và mã `id_to_hoc` sống của chính tài khoản đang đăng nhập (bao gồm K24) được hợp nhất thẳng vào `useTimetableStore`, tự động phục hồi `selectedIds` nếu mã nhóm thay đổi.
- **Tự hồi phục phiên Sniper & Batch ngay giây mở cổng (`07:00:00`):**
  - `runBackgroundSniperLoop` theo dõi trạng thái `wasGateClosedPrevCycle`: ngay khi chuyển từ `NGOAI_GIO` sang mở cổng (hoặc gặp HTTP `500` / thiếu `id_rs`), tự động làm mới `id_rs` & `id_to_hoc` qua `syncAndApplyLiveCatalog` và cập nhật lại đích ngắm trước khi bắn tiếp.
  - `handleRegisterBatch` tự động resync 1 lần nếu gặp HTTP `500` do SGU đổi `id_rs` hoặc mã nhóm lúc mở cổng.
- **Chuẩn hóa lọc `Trong CTĐT` / `Chưa học CTĐT` / `Cần học lại` theo cờ boolean sống của `dkmh.sgu.edu.vn`:**
  - Đối chiếu chuẩn logic client của `dkmh.sgu.edu.vn`: lọc theo `is_ctdt`/`is_ctdtng2`, `is_chctdt`/`is_chctdtng2` và `is_rot` thay vì phụ thuộc vào `loai_dk` vốn không tương thích với phản hồi mới của SGU.
- **Mở rộng Failover `/api-mirror` & Endpoint kiểm tra giờ mở cổng mới:**
  - `checkRegistrationPeriod`, `fetchStudentInfo`, `syncSessionCatalogAndIdRs` tự động failover sang `/api-mirror` (`thongtindaotao.sgu.edu.vn`); `checkRegistrationPeriod` bổ sung fallback sang `w-kiemtrathoigiandkmhsinhvien` (`trong_thoi_gian_dang_ky`) và được tái sử dụng trực tiếp trong `Header.tsx`.

---

## [1.5.0] - 2026-11-12

### 🔥 Khớp 100% Contract API Chính thức của Cổng ĐKMH SGU (`dkmh.sgu.edu.vn`) & Xử lý OTP Email (412)
- **Sửa lỗi HTTP 500 hàng loạt khi mở cổng đăng ký (`POST /api/dkmh/w-xulydkmhsinhvien`):**
  - Đồng bộ chính xác cấu trúc payload bắt buộc của cổng SGU (`{ filter: { id_to_hoc, is_checked, sv_nganh, id_rs } }`) thay cho payload suy đoán cũ (`{ id_to_hoc, is_dk: true }`).
  - Tự động thu thập & truyền chuỗi `id_rs` (session token phiên ĐKMH từ `w-locdsnhomto` và cập nhật lại sau mỗi phản hồi `w-xulydkmhsinhvien`) cùng `sv_nganh` (từ `w-locsinhvieninfo`, mặc định `1`).
  - Tự động ánh xạ `id_to_hoc` sống mới nhất theo `(ma_mon, nhom_to, to)` trước khi gửi đăng ký hoặc bật Sniper nhằm tránh gửi mã nhóm tổ cũ.
- **Chuẩn hóa API Hủy môn trong đợt ĐKMH:**
  - Chuyển `dropCourse` ưu tiên dùng `POST /api/dkmh/w-xulydkmhsinhvien` với `filter.is_checked = false` (đúng luồng cổng `dkmh.sgu.edu.vn`), giữ `/api/dkmh/w-xulyrutmonhoc` làm fallback cho rút môn sau đợt.
- **Hỗ trợ luồng xác thực OTP Email 2 lớp (HTTP `412 Precondition Failed`):**
  - Tự động gọi `POST /api/otp/setup` khi SGU trả HTTP `412` (tự động vượt qua và gửi lại ngay nếu server trả `code: 499`).
  - Bổ sung hộp thoại nhập mã OTP 6 chữ số (`POST /api/otp/validate/{otp}`) trên `DkmhPortalView.tsx` và tự động thực thi tiếp thao tác đang chờ (`batch`, `drop`, `sniper`) sau khi xác thực thành công.

---

## [1.4.0] - 2026-11-09

### 🛡️ Gia cố Toàn diện Hệ thống Đăng Ký Học Phần (ĐKMH) & Bảo toàn 100% Dữ liệu API SGU
- **Nhận diện chuẩn lỗi hết hạn Token ẩn trong HTTP 200 (`{ code: 401, message: "expired" }`):**
  - Xử lý triệt để trường hợp máy chủ Edusoft.NET của SGU trả về HTTP `200 OK` nhưng bên trong JSON báo `{ code: 401, message: "expired", result: false }` trên toàn bộ API (`w-xulydkmhsinhvien`, `w-thoigiansinhviendkmh`, `w-locdskqdkmhsinhvien`, `w-xulyrutmonhoc`, `Header.tsx`).
  - Tự động kích hoạt làm mới Token ngầm (`tryRefreshToken`) ngay khi phát hiện `code: 401` hoặc `message: "expired"`, ngăn chặn tình trạng báo nhầm "TRONG THỜI GIAN ĐĂNG KÝ" hoặc đẩy nhầm vào Radar Sniper khi hết phiên.
- **Chống phát hiện công cụ tự động (`canh_cao_tool` Stealth Headers):**
  - Đồng bộ hóa bộ `BROWSER_HEADERS` chuẩn Chrome 130 (`User-Agent`, `sec-ch-ua`, `Origin`, `Referer`, `idpc`) trên cả `vite.config.ts` proxy và `scripts/sync-sgu.cjs`, loại bỏ hoàn toàn dấu vết `User-Agent: node`.
- **Bảo toàn 100% dữ liệu gốc từ API SGU & Giải nén cấu trúc lồng `item.to_hoc`:**
  - Giữ nguyên tuyệt đối số liệu gốc từ API SGU (`sl_cp`, `sl_cl`, `so_tc`, `nhom_to`, `to`, `lop`, `ds_lop`, `ngay_dang_ky`), không tự ý gán số mặc định khi API trả về `0` hoặc rỗng.
  - Hỗ trợ giải nén đầy đủ đối tượng lồng `item.to_hoc` trong API `w-locdskqdkmhsinhvien` và hiển thị trọn vẹn mảng `ds_lop` cho các lớp ghép đa ngành (82 học phần).
- **Nâng cấp Radar Sniper & Chuyển đổi Đa tài khoản:**
  - Vòng lặp `runBackgroundSniperLoop` luôn đọc Token mới nhất từ `localStorage` ở mỗi chu kỳ quét để không bị kẹt closure Token cũ sau khi auto-refresh.
  - Tự động dừng canh (xóa khỏi `activeSnipingMap`) ngay khi phát hiện môn học cùng `ma_mon` đã được đăng ký thành công ở nhóm/tổ khác.
  - Tự động đồng bộ và lưu trữ mã lớp thực tế (`lop`) theo từng tài khoản sinh viên từ API `w-locsinhvieninfo`.
  - Bổ sung cơ chế fallback tự động giữa hai cổng `dkmh.sgu.edu.vn` và `thongtindaotao.sgu.edu.vn` khi gặp lỗi `502/503/504 Gateway Timeout`.

---

## [1.3.0] - 2026-11-08

### 🚀 Nâng cấp Cổng Đăng Ký Mới SGU (dkmh.sgu.edu.vn)
- **Tương thích toàn diện cổng mới:** Kiểm tra và xác thực giao thức Next.js mới của `https://dkmh.sgu.edu.vn/` và backend `https://api-dkmh.sgu.edu.vn/api`. Khẳng định 100% API đăng ký (`/api/dkmh/w-xulydkmhsinhvien`, `/api/dkmh/w-locdsnhomto`, `/api/auth/login`) giữ nguyên cấu trúc và phương thức POST.
- **Cập nhật Proxy & Network Target:** Chuyển đổi proxy cục bộ và các script đồng bộ sang `https://dkmh.sgu.edu.vn` với đầy đủ stealth headers chống gắn cờ.

### 🎯 Tích hợp Luồng Tranh Giành Slot Tự Động (Auto-Sniper Flow)
- **Loại bỏ chế độ/card riêng biệt:** Xóa bỏ hoàn toàn khung "Chế độ Săn Slot" tách rời gây rối giao diện.
- **Tự động kích hoạt khi nộp đăng ký:** Khi sinh viên bấm "Gửi đăng ký", hệ thống nộp các môn bình thường; nếu phát hiện môn nào bị hết chỗ (full slot), chế độ tranh giành slot tự động kích hoạt ngay tại chỗ trên hàng đợi.
- **Radar & Báo chuông thời gian thực:** Trạng thái môn tự chuyển sang badge `🎯 Đang tranh slot... (Lần #X)`, nút chính chuyển thành `🛑 Đang tự canh X môn... Bấm để DỪNG`, tự động quét và chiếm chỗ ngay khi có người nhả môn kèm âm thanh chuông báo.

---

## [1.2.0] - 2026-11-04

### ✨ Tính năng mới (Major Features)
- **Cổng Đăng Ký Học Phần Trực Tiếp (DKMH Direct Live API Portal):**
  - Bổ sung trang/tab **"Cổng Đăng Ký"** riêng biệt kết nối trực tiếp đến API đào tạo của SGU (`api/dkmh/w-xulydkmhsinhvien`), sinh viên không cần truy cập giao diện web `thongtindaotao.sgu.edu.vn` khi mở cổng để tránh quá tải/sập web.
  - Tự động nạp danh sách các môn đã xếp trong các phương án thời khóa biểu (`TKB_1`, `TKB_2`, `TKB_3`...) vào hàng đợi đăng ký chỉ với 1 click.
  - Nút hành động **`[⚡ NỘP ĐĂNG KÝ BẰNG API NGAY]`** bắn đồng thời toàn bộ môn đã chọn qua API local proxy `api-local/batch-register` với token sinh viên đã xác thực.
  - Bảng kiểm tra môn chính thức đã được ghi nhận vào cơ sở dữ liệu SGU (`w-locdskqdkmhsinhvien`), hiển thị số tín chỉ, học phí tạm tính và hỗ trợ hủy môn (`w-xulyrutmonhoc`).
  - Tự động kiểm tra khung giờ mở cổng đăng ký SGU theo thời gian thực (`w-thoigiansinhviendkmh`).
  - Hộp console nhật ký tiến trình (Audit Log) theo thời gian thực từng giây cho mỗi request API.

### 🛡️ Bảo mật & Hiệu năng (Security & Performance)
- **Local Credential Protection:** Thông tin sinh viên (`MSSV`, `PASSWORD`) lưu trong `.env` chỉ được đọc từ máy local qua endpoint nội bộ `/api-local/env-login`, không bao giờ lộ ra frontend hay push lên git repository.
- **Tối ưu tài nguyên máy tính (0% Idle Background Usage):**
  - Hủy bỏ hoàn toàn tiến trình chạy nền liên tục (`watch-sync.cjs`) trên máy của sinh viên, đảm bảo CPU 0% và RAM 0% khi không thao tác.
  - Thay thế bằng nút làm mới tức thì (`/api-sync`) chỉ mất 0.6s khi sinh viên chủ động bấm nút "Làm mới".
  - Giữ nguyên quy trình đồng bộ tự động 24/7 trên hạ tầng đám mây GitHub Actions.

### 🎨 Giao diện & Trải nghiệm người dùng (UI / UX Polish)
- **Chuẩn hóa Typography tiếng Việt (Anti-Font Fallback):**
  - Loại bỏ hoàn toàn font `Lexend` bị lỗi hiển thị lệch dấu trên các ký tự tiếng Việt Latin mở rộng ("mở", "dưỡng", "n/lực", "cảm", "tiểu").
  - Chuẩn hóa 100% toàn bộ hệ thống sang **`Be Vietnam Pro`** (weights từ 300 đến 800) tải trực tiếp từ Google Fonts.
  - Loại bỏ style `font-mono` gắt trên tiêu đề và nhãn giao diện, chuyển sang sans-serif tinh tế kết hợp `tabular-nums` cho số liệu.
- **Điều hướng mượt mà:**
  - Bổ sung bộ chuyển tab điều hướng tức thì trên thanh Header (`Xếp Lịch Học` ↔ `Cổng Đăng Ký`).
  - Tích hợp đồng hồ hệ thống chính xác từng giây để sinh viên dễ dàng canh giờ mở cổng đăng ký.

