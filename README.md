# SGU Timetable Studio & Auto-Sniper (Cổng ĐKMH SGU)

> Hệ thống Xếp Thời Khóa Biểu 5 Phương Án & Đăng Ký Học Phần / Canh Slot Tự Động dành cho Sinh viên Trường Đại học Sài Gòn (SGU).

Ứng dụng chạy **100% cục bộ trên máy tính cá nhân** của sinh viên, kết nối trực tiếp tới cổng đào tạo `dkmh.sgu.edu.vn` / `thongtindaotao.sgu.edu.vn` qua Reverse Proxy nội bộ chống nghẽn CORS, bảo mật tuyệt đối thông tin tài khoản.

---

## 🚀 Cài Đặt & Chạy Nhanh (Quick Start)

### Yêu cầu hệ thống
- **Node.js** `v18+` (khuyên dùng `v20` hoặc `v22` LTS)
- Trình duyệt web hiện đại (Chrome, Edge, Brave, Cốc Cốc, Safari...)

### Cách 1: Chạy bằng dòng lệnh (Khuyên dùng cho mọi hệ điều hành)

```bash
# 1. Tải mã nguồn về máy
git clone https://github.com/hanhdevsgu/sgu-tkb-studio.git
cd sgu-tkb-studio

# 2. Cài đặt thư viện
npm install

# 3. Khởi chạy ứng dụng
npm run dev
```

Sau khi chạy, mở trình duyệt tại địa chỉ: **`http://localhost:3000`**

### Cách 2: Chạy 1-Click trên Windows
- Nhấp đúp vào file **`Chay-SGU-TKB-Studio.bat`** trong thư mục dự án.
- Nếu chạy lần đầu tiên chưa có `node_modules`, script sẽ tự động cài đặt thư viện (`npm install`) rồi tự mở trình duyệt tại `http://localhost:3000`.

---

## ✨ Tính Năng Nổi Bật

### 1. Chế độ Xếp Lịch Thời Khóa Biểu (`Xếp lịch`)
- **Lưới Thời Khóa Biểu Chuẩn SGU**: 6 ngày trong tuần (**Thứ 2 ➔ Thứ 7**) × **13 tiết học** (Tiết 1 ➔ Tiết 13, từ `07:00` đến `20:50`).
- **Hỗ trợ tối đa 5 Phương Án độc lập**: So sánh nhiều phương án lịch học khác nhau, đổi tên phương án trực tiếp, tự động lưu trên trình duyệt (`localStorage`).
- **Phát hiện trùng lịch tức thì**: Tự động kiểm tra xung đột Thứ / Tiết / Tuần học giữa các nhóm lớp và cảnh báo rõ ràng môn bị trùng.
- **So sánh môn cùng tên khác mã**: Cảnh báo và mở bảng đối chiếu khi môn học có nhiều mã học phần khác nhau (môn chung toàn trường vs môn chuyên ngành).
- **Xuất ảnh PNG & Sao lưu JSON**: Tải ảnh thời khóa biểu độ phân giải cao về máy hoặc xuất/nhập file `.json` để chia sẻ với bạn bè.

### 2. Chế độ Cổng Đăng Ký Học Phần & Auto-Sniper (`Đăng ký học phần`)
- **Giao diện đồng bộ 100% với Cổng ĐKMH SGU**:
  - Hỗ trợ đầy đủ 8 chế độ lọc: *Môn mở theo lớp sinh viên*, *Lọc theo môn học*, *Lọc theo TKB đã xếp*, *Môn trong CTĐT kế hoạch*, *Môn chưa học trong CTĐT*, *Môn cần học lại (đã rớt)*, *Lọc theo khoa*, *Lọc theo lớp*.
  - Phân trang mượt mà (`25 / 50 / 100 / Tất cả`) và tìm kiếm nhanh theo từng cột (`Mã MH`, `Tên môn học`, `Nhóm`, `Lớp`).
- **Nạp thẳng từ Phương án TKB đã xếp (`⚡ Lọc theo TKB đã xếp`)**:
  - Tự động nạp đúng các nhóm/tổ đã chọn bên tab *Xếp lịch* và tích chọn sẵn những môn chưa đăng ký để bấm gửi 1 lần duy nhất lúc mở cổng.
- **Đăng Ký Hàng Loạt Không Nghẽn (Pipelined Registration)**:
  - Khi gửi đăng ký nhiều môn cùng lúc (ví dụ 6 môn), nếu có môn bị hết chỗ (`Còn lại = 0`), hệ thống **không bị dừng lại** mà tiếp tục nộp ngay các môn còn lại, đồng thời tự động đưa môn hết chỗ vào **Radar Sniper**.
- **Radar Canh Giành Slot Tự Động (Auto-Sniper)**:
  - Tự động canh ngầm các nhóm lớp hết chỗ và gửi đăng ký ngay giây phút có sinh viên khác hủy/nhả lớp, phát âm báo chime khi chiếm slot thành công.
  - Tự động dừng canh nếu môn học bị từ chối bởi lỗi quy chế cố định (tiên quyết, vượt tín chỉ, trùng lịch...).
- **Đa hình thức đăng nhập & Chuyển đổi nhiều tài khoản**:
  - Đăng nhập bằng **MSSV & Mật khẩu** hoặc **⚡ Dán Bearer Token** trực tiếp.
  - Lưu danh sách tài khoản trên máy để chuyển đổi 1-click và tự động làm mới token khi hết hạn.

---

## 🛠️ Các Lệnh Kiểm Tra & Build

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Khởi chạy máy chủ phát triển kèm Reverse Proxy tới cổng SGU tại `http://localhost:3000` |
| `npm run sync` | Đồng bộ thủ công dữ liệu môn học & sĩ số mới nhất từ cổng SGU về máy |
| `npm run check:real` | Chạy bộ kiểm thử tự động trên dữ liệu thực tế và các module TypeScript (`src/utils/`) |
| `npm run build` | Kiểm tra kiểu TypeScript (`tsc -b`) và đóng gói bản dựng Production (`dist/`) |

---

## 🔒 Bảo Mật & Quyền Riêng Tư
- Toàn bộ request đăng nhập và đăng ký môn học được gửi **trực tiếp từ máy tính của bạn** tới máy chủ `dkmh.sgu.edu.vn`, không đi qua bất kỳ máy chủ trung gian bên thứ ba nào.
- File `.env` và `.env.local` đã được cấu hình trong `.gitignore` để không bao giờ bị đẩy lên GitHub.
