/**
 * Tự động thăm dò cho đến khi máy chủ http://localhost:3000 VÀ module /src/App.tsx sẵn sàng 100% (HTTP 200)
 * mới kích hoạt mở trình duyệt web. Chống hoàn toàn hiện tượng mở tab sớm hoặc đơ màn hình trắng khi server chưa load xong.
 */
const http = require('http');
const { exec } = require('child_process');

let attempts = 0;
const MAX_ATTEMPTS = 120; // Thử tối đa 60 giây

function probeServer() {
  attempts++;
  if (attempts > MAX_ATTEMPTS) {
    process.exit(1);
  }

  // Thăm dò trực tiếp module /src/App.tsx để đảm bảo Vite đã biên dịch xong toàn bộ cây component React A-Z
  const req = http.get('http://localhost:3000/src/App.tsx', (res) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      // Máy chủ đã biên dịch xong A-Z và phản hồi 200 OK -> Cho máy chủ ổn định thêm 350ms rồi mở trình duyệt
      setTimeout(() => {
        const startCmd =
          process.platform === 'win32'
            ? 'start http://localhost:3000'
            : process.platform === 'darwin'
            ? 'open http://localhost:3000'
            : 'xdg-open http://localhost:3000';

        exec(startCmd, (err) => {
          if (err) console.error('Không thể tự mở trình duyệt:', err.message);
          process.exit(0);
        });
      }, 350);
    } else {
      setTimeout(probeServer, 350);
    }
  });

  req.on('error', () => {
    setTimeout(probeServer, 350);
  });

  req.setTimeout(1500, () => {
    req.destroy();
    setTimeout(probeServer, 350);
  });
}

// Bắt đầu thăm dò sau 500ms
setTimeout(probeServer, 500);
