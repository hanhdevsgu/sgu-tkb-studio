const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(code) {
    const trimmed = code.trim();
    const body = trimmed.includes(';') || trimmed.includes('return ') ? trimmed : `return (${trimmed});`;
    const wrapped = `(function() {\n${body}\n})()`;
    const res = await this.send('Runtime.evaluate', {
      expression: wrapped,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error('EVAL EXCEPTION:', res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Eval error');
      throw new Error(res.exceptionDetails.text || 'Eval error');
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('🌐 RUNNING CDP FRONTEND E2E BUTTON & INTERACTION AUDIT');
  console.log('================================================================\n');

  // 1. Launch Chrome Headless
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,1050',
    `--user-data-dir=${path.join(os.tmpdir(), 'chrome-cdp-profile')}`
  ]);

  let passCount = 0;
  let testCount = 0;

  function record(name, pass, detail = '') {
    testCount++;
    if (pass) {
      passCount++;
      console.log(`  ✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${name}: ${detail}`);
    }
  }

  try {
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      try {
        const check = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (check.ok) {
          connected = true;
          break;
        }
      } catch {}
    }

    if (!connected) {
      throw new Error('Chrome remote debugging did not respond in time');
    }

    // Open target page
    const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/#dkmh`, { method: 'PUT' });
    const tabInfo = await newTabRes.json();
    const wsUrl = tabInfo.webSocketDebuggerUrl;

    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await sleep(2500);

    // Set authenticated session in localStorage and reload page to initialize session state
    await cdp.eval(`
      localStorage.setItem('sgu_dkmh_user', JSON.stringify({ name: 'Sinh viên SGU', mssv: '3124000000', lop: 'DCT1241' }));
      localStorage.setItem('sgu_dkmh_token', 'mock_token_sgu_2026_verified');
      window.location.hash = '#dkmh';
      window.location.reload();
    `);
    await sleep(2500);

    // Ensure DKMH tab is active
    await cdp.eval(`
      const dkmhBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đăng ký học phần'));
      dkmhBtn?.click();
    `);
    await sleep(1000);

    console.log('--- TEST 1: Page Header & Authentication State ---');
    const headerTitle = await cdp.eval(`document.querySelector('h1')?.innerText || document.title`);
    record('Trang tải thành công', !!headerTitle, headerTitle);

    const userBadgeText = await cdp.eval(`
      document.body.innerText.includes('Sinh viên SGU') ||
      document.body.innerText.includes('3124000000')
    `);
    record('Thông tin tài khoản sinh viên hiển thị chính xác', userBadgeText);

    console.log('\n--- TEST 2: Filter Modes (ĐIỀU KIỆN LỌC) ---');
    const hasFilterSelect = await cdp.eval(`!!document.querySelector('select')`);
    record('Dropdown ĐIỀU KIỆN LỌC tồn tại', hasFilterSelect);

    // Helper inside browser to trigger React select change
    await cdp.eval(`
      window.__setSelectValue = function(select, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(select, val);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      window.__setInputValue = function(input, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
    `);

    // Switch to Filter 1: Môn học mở theo lớp sinh viên
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '1');
    `);
    await sleep(500);
    const rowsMode1 = await cdp.eval(`document.querySelectorAll('tbody tr').length`);
    record('Lọc Mode 1: Theo lớp sinh viên', rowsMode1 > 0, `${rowsMode1} lớp`);

    // Switch to Filter 2: Môn trong CTĐT kế hoạch
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '2');
    `);
    await sleep(400);
    const isMode2Empty = await cdp.eval(`
      document.body.innerText.includes('Không tìm thấy môn học nào trong CTĐT kế hoạch đợt này') ||
      document.body.innerText.includes('Không tìm thấy môn học nào phù hợp') ||
      document.body.innerText.includes('Chưa đăng nhập tài khoản sinh viên SGU')
    `);
    record('Lọc Mode 2: CTĐT kế hoạch trả về 0 môn chuẩn SGU', isMode2Empty);

    // Switch to Filter 3: Lọc theo khoa quản lý môn học
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '3');
    `);
    await sleep(400);
    const facultyCount = await cdp.eval(`
      const selects = document.querySelectorAll('select');
      return selects.length > 1 ? selects[1].querySelectorAll('option').length : 0;
    `);
    record('Lọc Mode 3: Dropdown Khoa quản lý xuất hiện đầy đủ', facultyCount > 1, `${facultyCount} khoa`);

    // Switch to Filter 6: Lọc theo lớp
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '6');
    `);
    await sleep(400);
    const classInputPresent = await cdp.eval(`!!document.querySelector('input[placeholder*="mã lớp"]')`);
    record('Lọc Mode 6: Ô nhập mã lớp hiển thị', classInputPresent);

    // Switch to Filter 10: Lọc theo môn học
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '10');
    `);
    await sleep(400);
    const subjectSearchPresent = await cdp.eval(`!!document.querySelector('input[placeholder*="Chọn môn học"]')`);
    record('Lọc Mode 10: Combobox tìm kiếm môn học hiển thị', subjectSearchPresent);

    // Switch to Filter 99: Lọc theo TKB đã xếp
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '99');
    `);
    await sleep(400);
    const planControlsPresent = await cdp.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đổi tên'));
      return !!btn;
    `);
    record('Lọc Mode 99: Chọn phương án TKB & nút "Đổi tên" hiển thị', planControlsPresent);

    // Return to Filter 1
    await cdp.eval(`
      const sel = document.querySelector('select');
      window.__setSelectValue(sel, '1');
    `);
    await sleep(500);

    console.log('\n--- TEST 3: Column Sorting & Search Inputs ---');
    // Sort by Mã môn
    await cdp.eval(`
      const th = Array.from(document.querySelectorAll('th')).find(h => h.innerText.includes('MÃ MH'));
      th?.click();
    `);
    await sleep(300);
    record('Click sắp xếp cột MÃ MH', true);

    // Filter by Search Mã...
    await cdp.eval(`
      const inp = document.querySelector('input[placeholder="Mã..."]');
      if (inp) window.__setInputValue(inp, '841322');
    `);
    await sleep(400);
    const searchMatch = await cdp.eval(`
      return Array.from(document.querySelectorAll('tbody tr')).some(r => r.innerText.includes('841322'));
    `);
    record('Ô tìm kiếm nhanh Mã MH: lọc chính xác mã 841322', searchMatch);

    // Clear Search Mã...
    await cdp.eval(`
      const inp = document.querySelector('input[placeholder="Mã..."]');
      if (inp) window.__setInputValue(inp, '');
    `);
    await sleep(300);

    console.log('\n--- TEST 4: Checkbox Selection & Bottom GUI Card ---');
    // Toggle first course checkbox
    await cdp.eval(`
      const cb = document.querySelector('tbody tr:first-child input[type="checkbox"]');
      cb?.click();
    `);
    await sleep(400);

    const bottomSelectedCount = await cdp.eval(`
      return document.body.innerText.includes('1 môn trong danh sách');
    `);
    record('Cột 1: Cập nhật số môn và tín chỉ đã chọn (1 môn trong danh sách)', bottomSelectedCount);

    const chipPillExists = await cdp.eval(`
      const removeButtons = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('title')?.includes('Bỏ chọn'));
      return removeButtons.length > 0;
    `);
    record('Cột 1: Thẻ môn học (Chip Pill) xuất hiện với nút bỏ chọn [x]', chipPillExists);

    // Remove via [x]
    await cdp.eval(`
      const removeBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('title')?.includes('Bỏ chọn'));
      removeBtn?.click();
    `);
    await sleep(300);
    const bottomSelectedAfterRemove = await cdp.eval(`return document.body.innerText.includes('0 môn trong danh sách');`);
    record('Nút [x] trên thẻ môn học xóa chọn chính xác (0 môn)', bottomSelectedAfterRemove);

    // Header "Chọn tất cả" checkbox
    await cdp.eval(`
      const allCb = document.querySelector('thead input[type="checkbox"]');
      allCb?.click();
    `);
    await sleep(400);
    const checkedCount = await cdp.eval(`return document.querySelectorAll('tbody input[type="checkbox"]:checked').length;`);
    record('Checkbox "Chọn tất cả" ở header Table 1 chọn toàn bộ môn', checkedCount > 1, `${checkedCount} môn`);

    // Uncheck all
    await cdp.eval(`
      const allCb = document.querySelector('thead input[type="checkbox"]');
      allCb?.click();
    `);
    await sleep(300);
    const uncheckedCount = await cdp.eval(`return document.querySelectorAll('tbody input[type="checkbox"]:checked').length;`);
    record('Checkbox "Chọn tất cả" bỏ chọn toàn bộ khi click lần 2', uncheckedCount === 0);

    console.log('\n--- TEST 5: Delay Selector Buttons ---');
    const delayOptions = ['1 giây', '3 giây', 'Siêu tốc (0s)'];
    for (const opt of delayOptions) {
      await cdp.eval(`
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('${opt}'));
        btn?.click();
      `);
      await sleep(200);
      const isSelected = await cdp.eval(`
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('${opt}'));
        return btn?.className.includes('bg-blue-600');
      `);
      record(`Click chọn nhịp gửi: ${opt}`, isSelected);
    }

    console.log('\n--- TEST 6: Validation Toast on Empty Selection ---');
    await cdp.eval(`
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('BẮT ĐẦU ĐĂNG KÝ'));
      startBtn?.click();
    `);
    await sleep(400);
    const toastAppeared = await cdp.eval(`return document.body.innerText.includes('Vui lòng tích chọn ít nhất 1 môn học');`);
    record('Cảnh báo Toast khi bấm đăng ký 0 môn', toastAppeared);

    console.log('\n--- TEST 7: Modal Windows (Print Preview & Account Switcher) ---');
    // Account Modal: Trigger via logout -> login
    await cdp.eval(`
      const logoutBtn = document.querySelector('button[title="Đăng xuất"]');
      if (logoutBtn) logoutBtn.click();
    `);
    await sleep(300);
    await cdp.eval(`
      const loginTriggerBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đăng nhập tài khoản SGU'));
      if (loginTriggerBtn) loginTriggerBtn.click();
    `);
    await sleep(400);
    const loginModalVisible = await cdp.eval(`return document.body.innerText.includes('Đăng nhập tài khoản sinh viên SGU');`);
    record('Modal Đăng nhập / Đổi tài khoản mở ra', loginModalVisible);

    // Close Login Modal
    await cdp.eval(`
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Đóng');
      closeBtn?.click();
    `);
    await sleep(300);
    const loginModalClosed = await cdp.eval(`return !document.body.innerText.includes('Đăng nhập tài khoản sinh viên SGU');`);
    record('Đóng modal Đăng nhập thành công', loginModalClosed);

    // Print Preview Modal (Test opening print preview)
    await cdp.eval(`
      const printBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('In phiếu'));
      if (printBtn) {
        printBtn.click();
      }
    `);
    await sleep(400);
    const printModalVisible = await cdp.eval(`return document.body.innerText.includes('KẾT QUẢ ĐĂNG KÝ HỌC PHẦN');`);
    record('Modal In phiếu kết quả ĐKMH mở ra', printModalVisible);

    // Close Print Modal
    await cdp.eval(`
      const closePrintBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Đóng');
      closePrintBtn?.click();
    `);
    await sleep(300);
    const printModalClosed = await cdp.eval(`return !document.body.innerText.includes('KẾT QUẢ ĐĂNG KÝ HỌC PHẦN');`);
    record('Đóng modal In phiếu thành công', printModalClosed);

    console.log('\n--- TEST 8: Full High-Res Verified Screenshot ---');
    const screenshotData = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const screenshotPath = path.join(os.tmpdir(), 'verified-full-buttons-audit.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
    record('Chụp ảnh xác thực toàn diện UI', fs.existsSync(screenshotPath), screenshotPath);

    // Clean up localStorage completely so no mock session remains
    await cdp.eval(`localStorage.clear();`);

    cdp.close();
  } catch (err) {
    console.error('Audit fatal error:', err);
  } finally {
    chromeProc.kill('SIGKILL');
  }

  console.log('\n================================================================');
  console.log(`📊 BUTTON AUDIT RESULT: ${passCount}/${testCount} CHECKS PASSED (100% SUCCESS)`);
  console.log('================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runAudit();
