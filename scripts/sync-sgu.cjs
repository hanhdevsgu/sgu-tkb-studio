const fs = require('fs');
const path = require('path');

// Try reading .env if present
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v) {
          process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }
}

function getCredentials() {
  loadEnv();
  return {
    username: process.env.SGU_USERNAME,
    password: process.env.SGU_PASSWORD,
    token: process.env.SGU_BEARER_TOKEN
  };
}

function parseDayOfWeek(thuStr) {
  if (!thuStr) return null;
  const clean = thuStr.trim().toLowerCase();
  if (clean.includes('2')) return 2;
  if (clean.includes('3')) return 3;
  if (clean.includes('4')) return 4;
  if (clean.includes('5')) return 5;
  if (clean.includes('6')) return 6;
  if (clean.includes('7')) return 7;
  return null;
}

function parseTkbStringToSessions(tkbString) {
  if (!tkbString) {
    return [{
      thu: 'Chưa xếp',
      thoi_gian: 'Chưa xếp',
      phong: 'Chưa xếp',
      giang_vien: 'Chưa phân công',
      ngay: '',
      isUnscheduled: true
    }];
  }

  const parts = tkbString.split(/<hr\s*\/?>/i);
  const rawSessions = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const thuMatch = trimmed.match(/Thứ\s*([2-7])/i);
    const thuStr = thuMatch ? thuMatch[0] : '';
    const thu = parseDayOfWeek(thuStr);

    const tietMatch = trimmed.match(/tiết\s*(\d+)\s*(?:->|-)\s*(\d+)/i);
    let tietStart = null;
    let tietEnd = null;
    let soTiet = null;

    if (tietMatch) {
      tietStart = parseInt(tietMatch[1], 10);
      tietEnd = parseInt(tietMatch[2], 10);
      soTiet = Math.max(1, tietEnd - tietStart + 1);
    } else {
      const singleTiet = trimmed.match(/tiết\s*(\d+)/i);
      if (singleTiet) {
        tietStart = parseInt(singleTiet[1], 10);
        tietEnd = tietStart;
        soTiet = 1;
      }
    }

    const phongMatch = trimmed.match(/Ph\s*([^,;]+)/i);
    const phong = phongMatch ? `Ph ${phongMatch[1].trim()}` : 'Chưa xếp';

    const gvMatch = trimmed.match(/GV\s*([^,;]+)/i);
    const giang_vien = gvMatch ? `GV ${gvMatch[1].trim()}` : 'Chưa phân công';

    const ngayMatch = trimmed.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*(?:đến|-)\s*\d{1,2}\/\d{1,2}\/\d{2,4})?[^,;]*)/i);
    const ngay = ngayMatch ? ngayMatch[1].trim() : '';

    const isUnscheduled = !thuMatch || tietStart === null;

    rawSessions.push({
      thu: isUnscheduled ? 'Chưa xếp' : (thuStr || `Thứ ${thu}`),
      thoi_gian: isUnscheduled ? 'Chưa xếp' : `tiết ${tietStart}->${tietEnd}`,
      tietStart: isUnscheduled ? null : tietStart,
      tietEnd: isUnscheduled ? null : tietEnd,
      soTiet: isUnscheduled ? null : soTiet,
      phong,
      giang_vien,
      ngay,
      isUnscheduled
    });
  }

  if (rawSessions.length === 0) {
    return [{
      thu: 'Chưa xếp',
      thoi_gian: 'Chưa xếp',
      phong: 'Chưa xếp',
      giang_vien: 'Chưa phân công',
      ngay: '',
      isUnscheduled: true
    }];
  }

  // Deduplicate exact identical lines while preserving distinct date ranges (ngay)
  const uniqueSessions = [];
  const seen = new Set();

  for (const s of rawSessions) {
    const key = `${s.thu}_${s.thoi_gian}_${s.phong}_${s.giang_vien}_${s.ngay || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSessions.push(s);
    }
  }

  return uniqueSessions;
}

function cleanTitle(s) {
  if (!s) return '';
  return s.normalize('NFC').trim();
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Origin': 'https://dkmh.sgu.edu.vn',
  'Referer': 'https://dkmh.sgu.edu.vn/course-registration/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'idpc': '0'
};

async function tryLoginWithPassword(username, password) {
  if (!username || !password) return null;
  console.log(`[SGU Sync] 🔐 Logging in as ${username}...`);
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username.trim());
    params.append('password', password);

    for (const baseUrl of ['https://dkmh.sgu.edu.vn', 'https://thongtindaotao.sgu.edu.vn']) {
      try {
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Origin': baseUrl,
            'Referer': `${baseUrl}/`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
        const rawText = await loginRes.text();
        const auth = JSON.parse(rawText);
        if (auth && auth.access_token) {
          console.log(`[SGU Sync] ✅ Logged in successfully via ${baseUrl}: ${auth.name} (${auth.userName})`);
          console.log(`[SGU_NEW_TOKEN]:${auth.access_token}`);
          return auth.access_token;
        }
        if (loginRes.status === 400 || loginRes.status === 401) break;
      } catch (err) {
        console.warn(`[SGU Sync] Login gateway ${baseUrl} error: ${err.message}`);
      }
    }
  } catch (e) {
    console.warn(`[SGU Sync] Re-login failed: ${e.message}`);
  }
  return null;
}

async function fetchCatalogWithToken(accessToken) {
  let json = null;
  for (const baseUrl of ['https://dkmh.sgu.edu.vn', 'https://thongtindaotao.sgu.edu.vn']) {
    try {
      const res = await fetch(`${baseUrl}/api/dkmh/w-locdsnhomto`, {
        method: 'POST',
        headers: {
          ...BROWSER_HEADERS,
          'Origin': baseUrl,
          'Referer': `${baseUrl}/`,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          is_CVHT: false,
          additional: { paging: { limit: 99999, page: 1 }, ordering: [{ name: '', order_type: '' }] }
        })
      });
      const rawText = await res.text();
      json = JSON.parse(rawText);
      if (res.ok || json?.code === 401 || json?.message === 'expired') {
        break;
      }
    } catch (err) {
      console.warn(`[SGU Sync] Catalog gateway ${baseUrl} error: ${err.message}`);
    }
  }
  return json;
}

async function syncSguData() {
  const { username, password, token } = getCredentials();
  let accessToken = token;
  let alreadyLoggedIn = false;

  // Accept dynamic active token passed from CLI argument (e.g. from user active session in browser)
  const tokenArg = process.argv.find((a) => a.startsWith('--token='));
  if (tokenArg) {
    const rawVal = tokenArg.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    if (rawVal && rawVal !== 'null' && rawVal !== 'undefined') {
      accessToken = rawVal;
    }
  }

  // 1. If no token yet, try login with account configured in .env / process.env
  if (!accessToken && username && password) {
    accessToken = await tryLoginWithPassword(username, password);
    alreadyLoggedIn = true;
  }

  if (!accessToken) {
    console.error(JSON.stringify({ success: false, reason: 'unauthorized', error: 'Chưa có tài khoản SGU để quét dữ liệu trực tiếp.' }));
    process.exit(2);
  }

  console.log(`[SGU Sync] ⏳ Fetching live course catalog & slots...`);

  let json = await fetchCatalogWithToken(accessToken);

  // 2. If token expired and password is available in .env / process.env, automatically re-login & retry once!
  if ((json?.message === 'expired' || json?.code === 401) && !alreadyLoggedIn && username && password) {
    const freshToken = await tryLoginWithPassword(username, password);
    if (freshToken) {
      accessToken = freshToken;
      json = await fetchCatalogWithToken(accessToken);
    }
  }

  if (!json) {
    throw new Error('Không thể kết nối tới máy chủ SGU (dkmh / thongtindaotao) để lấy danh sách nhóm tổ');
  }
  if (json.message === 'expired' || json.code === 401) {
    console.error(JSON.stringify({ success: false, reason: 'expired', error: 'Phiên đăng nhập SGU đã hết hạn. Vui lòng đăng nhập lại trên Cổng Đăng Ký.' }));
    process.exit(2);
  }
  if (!json.data || !json.data.ds_nhom_to) {
    throw new Error(`Failed to fetch ds_nhom_to: ${json.message || JSON.stringify(json)}`);
  }

  const dsNhomTo = json.data.ds_nhom_to;
  const dsMonHoc = json.data.ds_mon_hoc || [];

  console.log(`[SGU Sync] 📚 Received ${dsNhomTo.length} groups across ${dsMonHoc.length} subjects.`);

  const subjectMap = new Map();
  for (const m of dsMonHoc) {
    if (m.ma && m.ten) {
      subjectMap.set(m.ma.trim(), m.ten.trim());
    }
  }

  // Transform to clean format for sguFullData.json
  const fullData = dsNhomTo.map((item) => {
    const maMon = item.ma_mon ? String(item.ma_mon).trim() : '';
    const tenMon = subjectMap.get(maMon) || (item.ten_mon ? String(item.ten_mon).trim() : '');
    const nhomTo = String(item.nhom_to ?? item.to_hoc ?? '').trim();
    const toHoc = String(item.to ?? '').trim();
    const soTc = String(item.so_tc ?? item.so_tc_so ?? 0);
    const slCp = item.sl_cp != null && item.sl_cp !== '' && !Number.isNaN(Number(item.sl_cp)) ? Number(item.sl_cp) : 0;
    const slCl = item.sl_cl != null && item.sl_cl !== '' && !Number.isNaN(Number(item.sl_cl)) ? Number(item.sl_cl) : 0;
    const slDk = item.sl_dk != null && item.sl_dk !== '' && !Number.isNaN(Number(item.sl_dk)) ? Number(item.sl_dk) : Math.max(0, slCp - slCl);
    const dsLop = Array.isArray(item.ds_lop) ? item.ds_lop : (item.lop ? [item.lop] : []);
    const lop = dsLop.length > 0 ? dsLop.join(', ') : (item.lop || '');
    const dsKhoa = Array.isArray(item.ds_khoa) ? item.ds_khoa : [];
    const tkbSessions = parseTkbStringToSessions(item.tkb);

    return {
      ma_mon: maMon,
      ten_mon: cleanTitle(tenMon),
      nhom_to: nhomTo,
      to: toHoc,
      so_tc: soTc,
      tkb: tkbSessions,
      id_to_hoc: String(item.id_to_hoc || `${maMon}_${nhomTo}`),
      sl_cp: slCp,
      sl_cl: slCl,
      sl_dk: slDk,
      lop: lop,
      ds_lop: dsLop,
      ds_khoa: dsKhoa
    };
  });

  // 1. Always write to public/data/ for dynamic runtime fetching without triggering Vite HMR page reloads
  const publicDataDir = path.join(__dirname, '../public/data');
  if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
  fs.writeFileSync(path.join(publicDataDir, 'sguFullData.json'), JSON.stringify(fullData, null, 2), 'utf8');

  // Also write metadata
  const meta = {
    last_sync: new Date().toISOString(),
    total_groups: fullData.length,
    total_subjects: subjectMap.size,
    status: 'synced_success'
  };
  fs.writeFileSync(path.join(publicDataDir, 'sguMeta.json'), JSON.stringify(meta, null, 2), 'utf8');

  // 2. Only write to src/data/ if explicitly commanded (e.g. during pre-build: SYNC_WRITE_SRC=true)
  // This completely eliminates dev-server HMR page reloads and preserves all student state in RAM!
  if (process.env.SYNC_WRITE_SRC === 'true') {
    const srcDataDir = path.join(__dirname, '../src/data');
    if (!fs.existsSync(srcDataDir)) fs.mkdirSync(srcDataDir, { recursive: true });
    fs.writeFileSync(path.join(srcDataDir, 'sguFullData.json'), JSON.stringify(fullData, null, 2), 'utf8');
    fs.writeFileSync(path.join(srcDataDir, 'sguMeta.json'), JSON.stringify(meta, null, 2), 'utf8');
    console.log(`[SGU Sync] 📁 Also updated src/data files for static build.`);
  }

  console.log(`[SGU Sync] ✨ Successfully synced ${fullData.length} groups to public/data!`);
}

syncSguData().catch((err) => {
  console.error('[SGU Sync Error]:', err.message);
  process.exit(1);
});
