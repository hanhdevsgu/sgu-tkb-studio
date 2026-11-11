# SGU Timetable Studio & Auto-Sniper (Cổng ĐKMH SGU)

> 🎓 **Hệ thống Xếp Thời Khóa Biểu 5 Phương Án & Đăng Ký Học Phần / Canh Giật Slot Tự Động dành cho Sinh viên Trường Đại học Sài Gòn (SGU).**

Ứng dụng chạy **100% cục bộ trên máy tính cá nhân (Localhost)** của bạn, kết nối trực tiếp tới cổng đào tạo chính thức của trường (`dkmh.sgu.edu.vn` / `thongtindaotao.sgu.edu.vn`) qua Reverse Proxy nội bộ chống nghẽn CORS, bảo mật tuyệt đối tài khoản và thông tin cá nhân.

---

## 📑 MỤC LỤC
1. [Yêu cầu tiên quyết](#-yêu-cầu-tiên-quyết)
2. [Cài đặt & Khởi chạy A-Z](#-cài-đặt--khởi-chạy-a-z)
   - [Cách 1: Chạy 1-Click trên Windows (Không cần biết gõ code)](#cách-1-chạy-1-click-trên-windows-khuyên-dùng-cho-windows)
   - [Cách 2: Chạy bằng dòng lệnh Git / Terminal (Mọi hệ điều hành)](#cách-2-chạy-bằng-dòng-lệnh-terminal-windows--macos--linux)
3. [Hướng dẫn sử dụng chi tiết A-Z](#-hướng-dẫn-sử-dụng-chi-tiết-a-z)
   - [1. Chế độ Xếp Lịch Thời Khóa Biểu](#1-chế-độ-xếp-lịch-thời-khóa-biểu-5-phương-án)
   - [2. Chế độ Cổng Đăng Ký Môn Học & Radar Canh Slot](#2-chế-độ-cổng-đăng-ký-môn-học-đkmh--radar-sniper)
4. [Bí kíp thực chiến khi mở cổng ĐKMH](#-bí-kíp-thực-chiến-ngày-mở-cổng-đkmh)
5. [Giải đáp sự cố thường gặp (FAQ / Troubleshooting)](#-giải-đáp-sự-cố-thường-gặp-troubleshooting)
6. [Bảo mật & Quyền riêng tư](#-bảo-mật--quyền-riêng-tư)

---

## 💻 Yêu Cầu Tiên Quyết

Trước khi cài đặt, máy tính của bạn cần có:
- **Node.js phiên bản 18 trở lên** (Khuyên dùng bản **Node.js v20 hoặc v22 LTS**):
  - Tải bộ cài chính thức tại: 👉 [https://nodejs.org/](https://nodejs.org/) (Chọn bản **LTS - Recommended for Most Users**).
  - Cài đặt bình thường (bấm *Next ➔ Next*), chú ý tích chọn ô **"Add to PATH"**.
- Trình duyệt web hiện đại: Chrome, Edge, Brave, Cốc Cốc, Safari, Firefox...

---

## 🚀 Cài Đặt & Khởi Chạy A-Z

### Cách 1: Chạy 1-Click trên Windows (Khuyên dùng cho Windows)

Dành cho các bạn không quen gõ lệnh dòng lệnh:

1. Vào trang GitHub của dự án: [https://github.com/hanhdevsgu/sgu-tkb-studio](https://github.com/hanhdevsgu/sgu-tkb-studio)
2. Bấm vào nút màu xanh lá **`Code`** ➔ Chọn **`Download ZIP`**.
3. Giải nén file ZIP vừa tải về vào một thư mục trên máy tính (ví dụ: `Desktop\sgu-tkb-studio`).
4. Trong thư mục dự án, nhấp đúp chuột vào file:
   👉 **`Chay-SGU-TKB-Studio.bat`**
5. Script sẽ tự động:
   - Cài đặt các thư viện cần thiết (`npm install`) trong lần chạy đầu tiên.
   - Bật máy chủ nội bộ tại `http://localhost:3000`.
   - Tự động mở trình duyệt web lên trang ứng dụng.

---

### Cách 2: Chạy bằng dòng lệnh Terminal (Windows / macOS / Linux)

Dành cho các bạn quen dùng Git & Terminal:

```bash
# 1. Tải mã nguồn về máy tính
git clone https://github.com/hanhdevsgu/sgu-tkb-studio.git
cd sgu-tkb-studio

# 2. Cài đặt các gói phụ thuộc (Dependencies)
npm install

# 3. Khởi chạy ứng dụng ở chế độ phát triển
npm run dev
```

Sau khi terminal hiển thị:
```text
  VITE v6.4.5 ready in 350 ms
  ➜  Local:   http://localhost:3000/
```
👉 Bạn mở trình duyệt lên và truy cập: **`http://localhost:3000`**

---

## 📖 Hướng Dẫn Sử Dụng Chi Tiết A-Z

Ứng dụng có 2 chế độ chính được chuyển đổi qua lại nhanh chóng bằng thanh điều hướng ở góc trên bên phải:

### 1. Chế độ Xếp Lịch Thời Khóa Biểu (5 Phương Án)

* **Lưới Thời Khóa Biểu Chuẩn SGU**:
  - Gồm 6 ngày trong tuần (**Thứ 2 ➔ Thứ 7**) và **13 tiết học** (`07:00` đến `20:50`).
  - Phân rõ ca sáng (Tiết 1 - 5), ca chiều (Tiết 6 - 10) và ca tối (Tiết 11 - 13).
* **Quản lý 5 Phương Án độc lập**:
  - Cho phép bạn xếp sẵn **Phương án 1, Phương án 2, Phương án 3...** để có phương án dự phòng (Plan B, Plan C) nếu phương án chính bị hết chỗ.
  - Có thể bấm nút **"Đổi tên"** để đặt tên phương án theo ý muốn (ví dụ: *"Học sáng không học chiều"*, *"Né Thứ 7"*).
* **Kiểm tra trùng lịch thông minh (Conflict Detection)**:
  - Nếu 2 nhóm lớp trùng Thứ, Tiết và **Tuần học thực tế**, hệ thống sẽ lập tức cảnh báo bằng viền đỏ và thông báo cụ thể hai môn nào bị đụng giờ.
  - Tự động phân biệt các môn cùng thứ cùng tiết nhưng khác tuần/tháng (ví dụ: Môn A học từ tháng 1 đến tháng 2, Môn B học từ tháng 3 đến tháng 5) thì **hoàn toàn không bị báo trùng**.
* **Xuất ảnh & Chia sẻ**:
  - Bấm **"Xuất ảnh TKB"** để tải về máy file ảnh PNG độ nét cao (2K) để làm hình nền điện thoại/máy tính.
  - Bấm **"Sao lưu TKB (.json)"** để lưu phương án hoặc gửi file cấu hình cho bạn bè nhập vào xem chung.

---

### 2. Chế độ Cổng Đăng Ký Môn Học (ĐKMH & Radar Sniper)

Bấm vào nút **"Cổng Đăng Ký SGU"** ở thanh điều hướng để mở cổng:

* **Bước 1: Đăng nhập tài khoản sinh viên**:
  - Bấm **"Đăng nhập / Đổi tài khoản"**.
  - **Cách 1 (Khuyên dùng)**: Nhập MSSV và Mật khẩu tài khoản SGU ➔ Bấm **Đăng nhập**. Hệ thống sẽ tự động lưu tài khoản vào danh sách trên máy để những lần sau chỉ cần bấm 1 click là đổi tài khoản ngay.
  - **Cách 2**: Dán chuỗi `Bearer Token` lấy từ Developer Tools trên trang `dkmh.sgu.edu.vn`.
* **Bước 2: Lọc môn học cần đăng ký**:
  - **Chế độ 1**: *Môn học mở theo lớp sinh viên* (Ví dụ: `DCT1241`).
  - **Chế độ 99 (Tuyệt vời nhất)**: **`⚡ Lọc theo TKB đã xếp`** — Tự động hiển thị đúng danh sách các nhóm môn mà bạn đã xếp ở Tab *Xếp lịch* bên kia, không cần mất công đi tìm lại từng môn.
  - Các chế độ khác: *Môn trong CTĐT kế hoạch*, *Môn chưa học*, *Môn cần học lại (đã rớt)*, *Lọc theo khoa*, *Lọc theo lớp*, *Lọc theo mã môn*.
* **Bước 3: Chọn môn & Tùy chỉnh nhịp gửi**:
  - Tích chọn các môn muốn đăng ký trong Bảng 1.
  - Chọn nhịp gửi mong muốn:
    - **⚡ Siêu tốc (0s)**: Tốc độ cao nhất, có micro-jitter 120ms - 180ms để vừa nhanh nhất vừa không bị chặn IP.
    - **1 giây**: Nhịp đều đặn chuẩn.
    - **3 giây**: Chậm rãi an toàn.
* **Bước 4: Bấm ĐĂNG KÝ**:
  - Bấm nút to màu xanh lá: **`⚡ BẮT ĐẦU ĐĂNG KÝ (n MÔN)`**.
  - Hệ thống sẽ duyệt nộp các môn lần lượt theo cơ chế không nghẽn (**Pipelined Execution**):
    - Môn có chỗ ➔ Đăng ký thành công, tiếng chuông *chime* vang lên, tự động cập nhật vào Bảng 2.
    - Môn bị hết chỗ (`Còn lại = 0`) ➔ Tự động nạp vào **Radar Sniper** chạy ngầm để canh giật slot, **không làm dừng các môn phía sau**!
    - Cổng chưa mở (trước 07:00) ➔ Tự động đưa toàn bộ môn vào Radar Canh Mở Cổng.
* **Bước 5: Radar Sniper canh slot chạy ngầm**:
  - Khi có môn hết chỗ, bảng Radar Sniper sẽ xuất hiện.
  - Radar sẽ âm thầm bắn kiểm tra định kỳ mỗi 2.2s - 2.8s.
  - **Ngay giây phút có sinh viên khác nhả môn**, Radar sẽ giật slot ngay trong vòng 0.2 giây và phát chuông báo cho bạn.
* **Bước 6: Bảng kết quả & Hủy môn**:
  - Bảng 2 hiển thị danh sách các môn đã được ghi nhận trên máy chủ SGU.
  - Bạn có thể bấm **"Hủy môn"** (nếu trường cho phép rút) hoặc bấm **"In phiếu ĐKMH"** để xem và in biên lai đăng ký học phần chính thức.

---

## 🎯 Bí Kíp Thực Chiến Ngày Mở Cổng ĐKMH

Để đạt tỷ lệ đăng ký thành công cao nhất (gần như 99%):

1. **Trước 07:00 khoảng 10 phút**:
   - Mở ứng dụng tại `http://localhost:3000`.
   - Vào Tab *Xếp lịch* kiểm tra kỹ phương án chính và phương án phụ.
   - Chuyển sang Tab *Cổng ĐKMH*, đăng nhập tài khoản sinh viên.
2. **Trước 07:00 khoảng 2 phút**:
   - Chọn bộ lọc: **`⚡ Lọc theo TKB đã xếp`** ➔ Chọn đúng phương án đã chuẩn bị.
   - Tích chọn toàn bộ các môn cần đăng ký.
   - Chọn nhịp gửi: **`⚡ Siêu tốc (0s)`**.
3. **Lúc 06:59:58 (Trước giờ mở cổng 2 giây)**:
   - Bấm nút **[⚡ BẮT ĐẦU ĐĂNG KÝ]** hoặc bấm **[🎯 Bật Radar Canh Mở Cổng]**.
   - Nếu cổng mở đúng 07:00: Hệ thống sẽ nộp toàn bộ môn chỉ trong 1 - 2 giây trước khi hàng nghìn người khác kịp tải xong trang web trường.
   - Nếu có môn nào bị đối thủ bấm trước hoặc bị full chỗ: Cứ để nguyên tab trình duyệt, Radar Sniper sẽ tự động canh và giật slot ngay khi có người nhả.

---

## ❓ Giải Đáp Sự Cố Thường Gặp (Troubleshooting)

### 1. Báo lỗi `'node' is not recognized as an internal or external command`?
- **Nguyên nhân**: Máy tính của bạn chưa cài đặt Node.js hoặc khi cài đặt chưa chọn "Add to PATH".
- **Cách sửa**: Tải lại Node.js LTS từ [nodejs.org](https://nodejs.org/), chạy bộ cài và khởi động lại máy tính hoặc mở lại cửa sổ Terminal mới.

### 2. Báo lỗi `Port 3000 is already in use` (Cổng 3000 đang bị chiếm)?
- **Nguyên nhân**: Đang có một tiến trình khác hoặc một cửa sổ terminal trước đó chạy trên cổng 3000.
- **Cách sửa trên Windows**: Mở PowerShell và chạy lệnh sau để đóng tiến trình cũ:
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
  ```
  Sau đó nhấp đúp lại file `Chay-SGU-TKB-Studio.bat`.

### 3. Thông báo `Phiên đăng nhập SGU đã hết hạn (401)`?
- **Cách sửa**: Bấm vào nút tài khoản góc trên bên phải ➔ Chọn tài khoản của bạn trong danh sách tài khoản đã lưu để nạp lại hoặc nhập lại mật khẩu để lấy Token mới.

### 4. Máy chủ trường báo `502 Bad Gateway` hoặc `504 Gateway Timeout`?
- **Nguyên nhân**: Máy chủ SGU của trường đang bị nghẽn do quá đông sinh viên truy cập cùng lúc.
- **Cách xử lý**: Bạn **không cần F5 lại trang**. Hệ thống đã có cơ chế tự động thử lại (Retry with Exponential Backoff) và Radar ngầm sẽ tự động tiếp tục ngay khi server trường phản hồi lại.

---

## 🔒 Bảo Mật & Quyền Riêng Tư

- **Bảo mật tuyệt đối**: Ứng dụng chạy hoàn toàn trên máy tính cá nhân (`localhost`). Không có bất kỳ máy chủ trung gian hay bên thứ ba nào nhận được MSSV hay mật khẩu của bạn. Mọi request gửi trực tiếp tới máy chủ chính thức của Đại học Sài Gòn (`dkmh.sgu.edu.vn`).
- **An toàn mã nguồn**: Các file chứa thông tin nhạy cảm như `.env` đã được cấu hình trong `.gitignore` để không bao giờ bị đẩy lên GitHub.

---

## 📜 Giấy Phép & Bản Quyền

- Dự án được phát triển phi thương mại nhằm hỗ trợ cộng đồng sinh viên Trường Đại học Sài Gòn (SGU) có trải nghiệm xếp thời khóa biểu và đăng ký học phần thuận tiện, nhanh chóng và mượt mà nhất.
- Chúc các bạn sinh viên SGU đăng ký môn học thành công 100%! 🎉
