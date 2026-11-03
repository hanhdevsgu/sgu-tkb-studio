import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export default defineConfig({
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
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'idpc': '0' },
              body: params.toString()
            });
            const auth = await loginRes.json();
            res.setHeader('Content-Type', 'application/json');
            if (auth.access_token) {
              res.end(JSON.stringify({
                success: true,
                token: auth.access_token,
                user: { name: auth.name, mssv: auth.userName }
              }));
            } else {
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: auth.error_description || 'Đăng nhập SGU thất bại' }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });

        // 3. Fast Batch Registration API runner
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

              // Register each group in parallel
              const results = await Promise.all(
                groups.map(async (grp) => {
                  const id_to_hoc = grp.id_to_hoc || grp.id;
                  try {
                    const regRes = await fetch('https://thongtindaotao.sgu.edu.vn/api/dkmh/w-xulydkmhsinhvien', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'idpc': '0',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ id_to_hoc, is_dk: true })
                    });
                    const regJson = await regRes.json();
                    const isSuccess = regJson.data?.is_thanh_cong === true;
                    const message = regJson.data?.thong_bao_loi || (isSuccess ? 'Đăng ký thành công' : 'Đăng ký thất bại');
                    return {
                      id: id_to_hoc,
                      ma_mon: grp.ma_mon,
                      ten_mon: grp.ten_mon,
                      nhom_to: grp.nhom_to,
                      so_tc: grp.so_tc,
                      success: isSuccess,
                      message: message,
                      raw: regJson.data
                    };
                  } catch (e) {
                    return {
                      id: id_to_hoc,
                      ma_mon: grp.ma_mon,
                      ten_mon: grp.ten_mon,
                      nhom_to: grp.nhom_to,
                      so_tc: grp.so_tc,
                      success: false,
                      message: e.message
                    };
                  }
                })
              );

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
      ignored: ['**/src/data/**', '**/public/data/**']
    },
    proxy: {
      '/api': {
        target: 'https://thongtindaotao.sgu.edu.vn',
        changeOrigin: true,
        secure: false,
        headers: {
          'idpc': '0'
        }
      }
    }
  }
});
