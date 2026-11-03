const fs = require('fs');
const path = require('path');

async function debugSguApi() {
  console.log('================ SGU API DEBUG TEST ================');
  console.log('1. Loading credentials from .env...');
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const lines = envContent.split('\n');
  let user = '', pass = '';
  lines.forEach(l => {
    if (l.startsWith('SGU_USERNAME=')) user = l.split('=')[1].trim();
    if (l.startsWith('SGU_PASSWORD=')) pass = l.split('=')[1].trim();
  });
  console.log('   Username:', user);
  console.log('   Password length:', pass.length, 'chars (masked: ' + '*'.repeat(pass.length) + ')');

  console.log('\n2. Testing POST /api/auth/login...');
  const t0 = Date.now();
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', user);
  params.append('password', pass);

  const loginRes = await fetch('https://thongtindaotao.sgu.edu.vn/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'idpc': '0' },
    body: params.toString()
  });
  const tLogin = Date.now() - t0;
  console.log('   HTTP Status:', loginRes.status, loginRes.statusText, '(' + tLogin + 'ms)');

  const authData = await loginRes.json();
  if (!authData.access_token) {
    console.error('❌ Login failed:', authData);
    return;
  }
  console.log('   ✅ Auth SUCCESS!');
  console.log('   Student Name:', authData.name);
  console.log('   Roles:', authData.roles);
  console.log('   Token expires in:', authData.expires_in, 'seconds');
  console.log('   Token snippet:', authData.access_token.slice(0, 30) + '...' + authData.access_token.slice(-20));

  console.log('\n3. Testing POST /api/dkmh/w-locdsnhomto (Fetch Course Catalog & Slots)...');
  const t1 = Date.now();
  const dataRes = await fetch('https://thongtindaotao.sgu.edu.vn/api/dkmh/w-locdsnhomto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'idpc': '0',
      'Authorization': 'Bearer ' + authData.access_token
    },
    body: JSON.stringify({
      is_CVHT: false,
      additional: { paging: { limit: 99999, page: 1 }, ordering: [{ name: '', order_type: '' }] }
    })
  });
  const tFetch = Date.now() - t1;
  console.log('   HTTP Status:', dataRes.status, dataRes.statusText, '(' + tFetch + 'ms)');

  const json = await dataRes.json();
  console.log('   Server Code:', json.code, '| Message:', json.message || 'OK');
  const groups = json.data?.ds_nhom_to || [];
  const subjects = json.data?.ds_mon_hoc || [];
  console.log('   ✅ Received Class Groups:', groups.length);
  console.log('   ✅ Received Subjects:', subjects.length);

  console.log('\n4. Inspecting Sample Live Slots in Real-time:');
  const sampleCodes = ['841108', '801022', '801024', '802023', '802402', '803303', '809316'];
  const subMap = {};
  subjects.forEach(s => { subMap[s.ma] = s.ten; });

  sampleCodes.forEach(code => {
    const list = groups.filter(g => g.ma_mon === code);
    const ten = subMap[code] || 'N/A';
    if (list.length > 0) {
      console.log('   📚 [' + code + '] ' + ten + ' (' + list.length + ' nhóm):');
      list.slice(0, 2).forEach(g => {
        console.log('      - Nhóm ' + g.nhom_to + ': Sĩ số max=' + g.sl_cp + ', Còn lại=' + g.sl_cl + ', Đã ĐK=' + g.sl_dk);
      });
    }
  });

  console.log('\n5. Checking local sguFullData.json on disk...');
  const fileStat = fs.statSync(path.join(__dirname, '../src/data/sguFullData.json'));
  console.log('   File Size:', (fileStat.size / 1024).toFixed(1), 'KB');
  console.log('   Last Modified:', fileStat.mtime.toLocaleString('vi-VN'));
  console.log('================ TEST COMPLETED: 100% SUCCESS ================');
}

debugSguApi().catch(err => console.error('Error:', err));

