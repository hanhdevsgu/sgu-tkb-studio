const { execSync } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log('🔄 SGU AUTO-SYNC WATCHER STARTED');
console.log('⚡ Tự động quét và cập nhật Live Slot mỗi 3 PHÚT (180s).');
console.log('🔒 Bảo mật: Mật khẩu và tài khoản được bảo vệ tuyệt đối trong .env, không lộ ra ngoài.');
console.log('====================================================\n');

function runSync() {
  const time = new Date().toLocaleTimeString('vi-VN');
  console.log(`[${time}] 🔄 Đang tự động quét & đồng bộ dữ liệu SGU...`);
  try {
    const scriptPath = path.join(__dirname, 'sync-sgu.cjs');
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log(`[${time}] ✅ Hoàn tất đồng bộ! Dữ liệu slot mới nhất đã sẵn sàng.\n`);
  } catch (err) {
    console.error(`[${time}] ⚠️ Tạm thời chưa kết nối được SGU (sẽ thử lại sau 3 phút):`, err.message);
  }
}

// Chạy lần đầu ngay lập tức
runSync();

// Lặp lại mỗi 3 phút (180.000 ms)
const INTERVAL_MS = 3 * 60 * 1000;
setInterval(runSync, INTERVAL_MS);
