import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Stealth Chrome Headers to ensure 100% indistinguishable requests from normal web browser
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Origin': 'https://thongtindaotao.sgu.edu.vn',
  'Referer': 'https://thongtindaotao.sgu.edu.vn/dkmh',
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

// Helper to safely write environment variables locally (100% excluded from Git)
function updateLocalEnv(username?: string, password?: string, token?: string) {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join('C:\\Users\\Lenovo\\Desktop\\sgu-tkb-studio', '.env')
  ];

  for (const envPath of envPaths) {
    try {
      const existing: Record<string, string> = {};
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [k, ...v] = trimmed.split('=');
            if (k) existing[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      }

      if (username) {
        existing['SGU_USERNAME'] = username;
        process.env.SGU_USERNAME = username;
      }
      if (password) {
        existing['SGU_PASSWORD'] = password;
        process.env.SGU_PASSWORD = password;
      }
      if (token) {
        existing['SGU_BEARER_TOKEN'] = token;
        existing['SGU_TOKEN_UPDATED_AT'] = new Date().toISOString();
      }

      const lines = [
        '# SGU Student Account Credentials (Tự động cập nhật linh hoạt theo tài khoản đăng nhập)',
        `SGU_USERNAME=${existing['SGU_USERNAME'] || ''}`,
        `SGU_PASSWORD=${existing['SGU_PASSWORD'] || ''}`,
        existing['SGU_BEARER_TOKEN'] ? `SGU_BEARER_TOKEN=${existing['SGU_BEARER_TOKEN']}` : 'SGU_BEARER_TOKEN=',
        existing['SGU_TOKEN_UPDATED_AT'] ? `SGU_TOKEN_UPDATED_AT=${existing['SGU_TOKEN_UPDATED_AT']}` : 'SGU_TOKEN_UPDATED_AT=',
        ''
      ];

      fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
    } catch (e) {
      console.warn('Could not update .env at', envPath, e);
    }
  }
}

export default defineConfig({
  envDir: './.vite_env', // Prevents Vite from restarting the dev server when root .env is dynamically updated
  plugins: [
    react(),
    {
      name: 'sgu-local-api',
      configureServer(server) {
        // 1. Manual on-demand sync trigger
        server.middlewares.use('/api-sync', (req, res) => {
          exec('node scripts/sync-sgu.cjs', { cwd: process.cwd() }, (err) => {
            res.setHeader('Content-Type', 'application/json');
            if (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            } else {
              res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString() }));
            }
          });
        });

        // 2. Auto login via .env credentials
        server.middlewares.use('/api-local/env-login', async (req, res) => {
          try {
            let username = process.env.SGU_USERNAME;
            let password = process.env.SGU_PASSWORD;
            if (!username || !password) {
              const envPath = path.join(process.cwd(), '.env');
              if (fs.existsSync(envPath)) {
                for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
                  const trimmed = l.trim();
                  if (trimmed && !trimmed.startsWith('#')) {
                    const [k, ...v] = trimmed.split('=');
                    if (k?.trim() === 'SGU_USERNAME') username = v.join('=').trim().replace(/^["']|["']$/g, '');
                    if (k?.trim() === 'SGU_PASSWORD') password = v.join('=').trim().replace(/^["']|["']$/g, '');
                  }
                }
              }
            }
            if (!username || !password) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'Chưa cấu hình tài khoản trong .env' }));
            }

            const params = new URLSearchParams();
            params.append('grant_type', 'password');
            params.append('username', username);
            params.append('password', password);

            const loginRes = await fetch('https://thongtindaotao.sgu.edu.vn/api/auth/login', {
              method: 'POST',
              headers: {
                ...BROWSER_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: params.toString()
            });
            const auth = await loginRes.json();
            res.setHeader('Content-Type', 'application/json');
            if (auth.access_token) {
              // Automatically write fresh token to local .env file
              updateLocalEnv(username, password, auth.access_token);
              res.end(JSON.stringify({
                success: true,
                token: auth.access_token,
                user: { name: auth.name, mssv: auth.userName }
              }));
            } else {
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: auth.message || auth.error_description || 'Đăng nhập SGU thất bại' }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });

        // 3. Update .env with new account credentials & token (Local only)
        server.middlewares.use('/api-local/update-env', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { username, password, token } = JSON.parse(body || '{}');
              if (!username && !password && !token) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'Không có dữ liệu tài khoản để cập nhật' }));
              }

              updateLocalEnv(username, password, token);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: 'Đã tự động cập nhật tài khoản và token vào file .env cục bộ',
                updatedAt: new Date().toISOString()
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        });

        // 4. Clear .env credentials on explicit logout
        server.middlewares.use('/api-local/clear-env', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }

          const envPaths = [
            path.join(process.cwd(), '.env'),
            path.join('C:\\Users\\Lenovo\\Desktop\\sgu-tkb-studio', '.env')
          ];

          for (const envPath of envPaths) {
            try {
              const lines = [
                '# SGU Student Account Credentials (Tự động cập nhật linh hoạt theo tài khoản đăng nhập)',
                'SGU_USERNAME=',
                'SGU_PASSWORD=',
                'SGU_BEARER_TOKEN=',
                'SGU_TOKEN_UPDATED_AT=',
                ''
              ];
              fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
            } catch (e) {
              console.warn('Could not clear .env at', envPath, e);
            }
          }

          process.env.SGU_USERNAME = '';
          process.env.SGU_PASSWORD = '';
          process.env.SGU_BEARER_TOKEN = '';

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Đã xóa tài khoản khỏi .env' }));
        });

        // 4. Fast Batch Registration API runner
        server.middlewares.use('/api-local/batch-register', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { token, groups } = JSON.parse(body);
              if (!token || !Array.isArray(groups)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'Thiếu token hoặc danh sách nhóm lớp' }));
              }

              // Register each group sequentially with a natural micro-stagger (120-180ms)
              // This completely avoids database row locks on SGU server and mimics ultra-fast natural clicking
              const results = [];
              for (let i = 0; i < groups.length; i++) {
                const grp = groups[i];
                if (i > 0) {
                  await new Promise(r => setTimeout(r, 120 + Math.floor(Math.random() * 60)));
                }
                const id_to_hoc = grp.id_to_hoc || grp.id;
                try {
                  const regRes = await fetch('https://thongtindaotao.sgu.edu.vn/api/dkmh/w-xulydkmhsinhvien', {
                    method: 'POST',
                    headers: {
                      ...BROWSER_HEADERS,
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ id_to_hoc, is_dk: true })
                  });
                  const regJson = await regRes.json();
                  const isSuccess = regJson.data?.is_thanh_cong === true;
                  const message = regJson.data?.thong_bao_loi || (isSuccess ? 'Đăng ký thành công' : 'Đăng ký thất bại');
                  results.push({
                    id: id_to_hoc,
                    ma_mon: grp.ma_mon,
                    ten_mon: grp.ten_mon,
                    nhom_to: grp.nhom_to,
                    so_tc: grp.so_tc,
                    success: isSuccess,
                    message: message,
                    raw: regJson.data
                  });
                } catch (e) {
                  results.push({
                    id: id_to_hoc,
                    ma_mon: grp.ma_mon,
                    ten_mon: grp.ten_mon,
                    nhom_to: grp.nhom_to,
                    so_tc: grp.so_tc,
                    success: false,
                    message: e.message
                  });
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, results }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        });
      }
    }
  ],
  server: {
    port: 3000,
    watch: {
      ignored: ['**/src/data/**', '**/public/data/**', '**/.env', '**/.env.*']
    },
    proxy: {
      '/api': {
        target: 'https://thongtindaotao.sgu.edu.vn',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://thongtindaotao.sgu.edu.vn',
          'Referer': 'https://thongtindaotao.sgu.edu.vn/dkmh',
          'idpc': '0'
        }
      }
    }
  }
});
