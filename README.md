# SGU Timetable Studio & Slot Watcher
> Hệ thống Xếp Thời Khóa Biểu & Giám Sát Slot Đăng Ký Môn Học Chuẩn SGU

Ứng dụng web chuyên nghiệp, hiện đại, chuẩn mực 100% dành cho sinh viên Trường Đại học Sài Gòn (SGU). Hỗ trợ tra cứu môn học, xem trước slot thời gian thực, trực quan hóa thời khóa biểu tuần và tự động phát hiện xung đột môn học.

---

## ✨ Tính Năng Nổi Bật

1. **Đồng bộ Live API SGU (`api/dkmh/w-locdsnhomto`)**:
   * Tự động lấy danh sách nhóm/tổ môn học mở đăng ký kèm tên môn tiếng Việt chuẩn xác.
   * Hiển thị số lượng slot còn lại thời gian thực (`sl_cl`), badge cảnh báo môn sắp hết slot.
   * Tách chi tiết Giảng viên, Phòng học, Thứ, Tiết, Ngày bắt đầu/kết thúc.

2. **Lưới Thời Khóa Biểu Tuần Trực Quan (Interactive Timetable Grid)**:
   * 7 ngày trong tuần (Thứ 2 ➔ Chủ Nhật) x 12 tiết học chuẩn SGU.
   * Khối môn học được định vị chính xác theo tiết, màu sắc phân biệt tự động theo từng môn.
   * Click vào khối môn trên lưới TKB để xem thông tin chi tiết hoặc xóa nhanh.

3. **Thuật Toán Phát Hiện Trùng Lịch (Conflict Detection Engine)**:
   * Tự động quét trùng lặp các tiết học giữa các môn đã chọn.
   * Khối môn bị trùng sẽ **viền đỏ nhấp nháy (pulsing alert)** và ghi chú rõ ràng đang trùng với môn nào.

4. **Hỗ Trợ Đăng Ký Nhanh**:
   * **1-Click Copy**: Sao chép danh sách mã môn, mã tổ vào Clipboard để chuẩn bị dán nộp khi cổng trường vừa mở.
   * **Xuất ảnh TKB (PNG)**: Lưu ảnh thời khóa biểu độ phân giải cao vào máy tính / điện thoại.
   * **Lưu file JSON**: Lưu trữ và chia sẻ phương án xếp lịch với bạn bè.

5. **Chế Độ Offline & Dán JSON Dự Phòng**:
   * Tích hợp sẵn bộ dữ liệu mẫu thực tế của SGU để trải nghiệm ngay cả khi offline.
   * Hỗ trợ dán JSON trực tiếp từ Console F12 hoặc tải file `.json` lên.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### Yêu cầu hệ thống:
* Node.js v18+ trở lên
* Trình duyệt web hiện đại (Chrome, Edge, Brave, Cốc Cốc...)

### Các bước chạy:
```bash
# 1. Đi vào thư mục dự án
cd "C:\Users\Lenovo\.gemini\antigravity\scratch\sgu-tkb-studio"

# 2. Cài đặt dependencies (nếu chưa cài)
npm install

# 3. Khởi chạy server phát triển
npm run dev
```

Truy cập: `http://localhost:3000` trên trình duyệt.

---

## 🔑 Hướng Dẫn Lấy Token SGU Để Kết Nối Live

1. Đăng nhập vào trang đào tạo của trường: `https://thongtindaotao.sgu.edu.vn`
2. Bấm phím **F12** ➔ chọn tab **Console**
3. Dán dòng lệnh sau và Enter:
   ```javascript
   copy(JSON.parse(sessionStorage.getItem("CURRENT_USER") || "{}").access_token)
   ```
4. Quay lại **SGU Timetable Studio**, bấm nút **"Token SGU"** trên thanh công cụ và dán vào. Hệ thống sẽ tự động đồng bộ toàn bộ lớp học phần và số lượng slot hiện tại của bạn!

