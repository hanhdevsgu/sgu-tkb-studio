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

loadEnv();

const USERNAME = process.env.SGU_USERNAME;
const PASSWORD = process.env.SGU_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('❌ [SGU Sync] Missing credentials! Please provide SGU_USERNAME and SGU_PASSWORD in .env or as environment variables.');
  process.exit(1);
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
  if (clean.includes('chủ nhật') || clean.includes('cn')) return 8;
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

    const thuMatch = trimmed.match(/Thứ\s*(\d+|CN|Chủ nhật)/i);
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

    const phongMatch = trimmed.match(/Ph\s*([a-zA-Z0-9_\.\-]+)/i);
    const phong = phongMatch ? `Ph ${phongMatch[1]}` : 'Chưa xếp';

    const gvMatch = trimmed.match(/GV\s*([^,;]+)/i);
    const giang_vien = gvMatch ? `GV ${gvMatch[1].trim()}` : 'Chưa phân công';

    const ngayMatch = trimmed.match(/(\d{2}\/\d{2}\/\d{2,4}\s*(?:đến|-)\s*\d{2}\/\d{2}\/\d{2,4}[^,;]*)/i);
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

  // Deduplicate by unique weekly schedule (thu + thoi_gian + phong + giang_vien)
  const uniqueSessions = [];
  const seen = new Set();

  for (const s of rawSessions) {
    const key = `${s.thu}_${s.thoi_gian}_${s.phong}_${s.giang_vien}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSessions.push(s);
    }
  }

  return uniqueSessions;
}

function cleanTitle(s) {
  if (!s) return '';
  let str = s.normalize('NFC');
  str = str.replace(/B\/dưỡng/g, 'Bồi dưỡng');
  str = str.replace(/b\/dưỡng/g, 'bồi dưỡng');
  str = str.replace(/n\/lực/g, 'năng lực');
  str = str.replace(/P\/tích/g, 'Phân tích');
  str = str.replace(/p\/tích/g, 'phân tích');
  str = str.replace(/b\/cáo/g, 'báo cáo');
  str = str.replace(/ứ\/dụng/g, 'ứng dụng');
  str = str.replace(/\bVH\b/g, 'Văn học');
  str = str.replace(/\bHS\b/g, 'học sinh');
  str = str.replace(/\bPPGD\b/g, 'Phương pháp giảng dạy');
  str = str.replace(/\bPP\b/g, 'Phương pháp');
  str = str.replace(/\bMN\b/g, 'Mầm non');
  str = str.replace(/\bGDPT\b/g, 'GD Phổ thông');
  str = str.replace(/\bGD\b/g, 'Giáo dục');
  str = str.replace(/\bNCKH\b/g, 'Nghiên cứu khoa học');
  str = str.replace(/\bQTVP\b/g, 'Quản trị văn phòng');
  str = str.replace(/\bTT-TV\b/g, 'Thông tin - Thư viện');
  str = str.replace(/\bHCNN\b/g, 'Hành chính nhà nước');
  str = str.replace(/\bHĐ\b/g, 'hoạt động');
  return str.trim();
}

async function syncSguData() {
  console.log(`[SGU Sync] 🔐 Logging in as ${USERNAME}...`);

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', USERNAME);
  params.append('password', PASSWORD);

  const loginRes = await fetch('https://thongtindaotao.sgu.edu.vn/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'idpc': '0'
    },
    body: params.toString()
  });

  const auth = await loginRes.json();
  if (!auth.access_token) {
    throw new Error(`Login failed: ${JSON.stringify(auth)}`);
  }

  console.log(`[SGU Sync] ✅ Logged in successfully: ${auth.name} (${auth.userName})`);
  console.log(`[SGU Sync] ⏳ Fetching live course catalog & slots...`);

  const res = await fetch('https://thongtindaotao.sgu.edu.vn/api/dkmh/w-locdsnhomto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'idpc': '0',
      'Authorization': `Bearer ${auth.access_token}`
    },
    body: JSON.stringify({
      is_CVHT: false,
      additional: { paging: { limit: 99999, page: 1 }, ordering: [{ name: '', order_type: '' }] }
    })
  });

  const json = await res.json();
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
    const maMon = item.ma_mon ? item.ma_mon.trim() : '';
    const tenMon = subjectMap.get(maMon) || item.ten_mon?.trim() || `Môn ${maMon}`;
    const nhomTo = item.nhom_to || item.to_hoc || '01';
    const soTc = String(item.so_tc || item.so_tc_so || 3);
    const slCp = Number(item.sl_cp) || 0;
    const slCl = typeof item.sl_cl === 'number' ? item.sl_cl : 0;
    const tkbSessions = parseTkbStringToSessions(item.tkb);

    return {
      ma_mon: maMon,
      ten_mon: cleanTitle(tenMon),
      nhom_to: nhomTo,
      to: item.to || '',
      so_tc: soTc,
      tkb: tkbSessions,
      id_to_hoc: String(item.id_to_hoc || `${maMon}_${nhomTo}`),
      sl_cp: slCp,
      sl_cl: slCl
    };
  });

  // Write to src/data/sguFullData.json
  const targetPath = path.join(__dirname, '../src/data/sguFullData.json');
  fs.writeFileSync(targetPath, JSON.stringify(fullData, null, 2), 'utf8');

  // Also write to public/data/sguFullData.json for runtime dynamic fetching
  const publicDataDir = path.join(__dirname, '../public/data');
  if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
  fs.writeFileSync(path.join(publicDataDir, 'sguFullData.json'), JSON.stringify(fullData, null, 2), 'utf8');

  console.log(`[SGU Sync] ✨ Successfully synced ${fullData.length} groups to src/data and public/data!`);

  // Also write metadata (sanitized - no personal info)
  const meta = {
    last_sync: new Date().toISOString(),
    total_groups: fullData.length,
    total_subjects: subjectMap.size,
    status: 'synced_success'
  };
  const metaPath = path.join(__dirname, '../src/data/sguMeta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  fs.writeFileSync(path.join(publicDataDir, 'sguMeta.json'), JSON.stringify(meta, null, 2), 'utf8');
}

syncSguData().catch((err) => {
  console.error('[SGU Sync Error]:', err.message);
  process.exit(1);
});
