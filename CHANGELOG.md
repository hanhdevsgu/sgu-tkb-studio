# SGU Timetable Studio — Changelog

Tất cả những thay đổi, bổ sung tính năng và nâng cấp kiến trúc của dự án được ghi nhận tại đây.

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

