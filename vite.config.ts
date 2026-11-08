import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] [UNCAUGHT EXCEPTION]: ${err?.stack || err}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(process.cwd(), 'dev-server-crash.log'), msg, 'utf8'); } catch {}
});
process.on('unhandledRejection', (reason: any) => {
  const msg = `[${new Date().toISOString()}] [UNHANDLED REJECTION]: ${reason?.stack || reason}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(process.cwd(), 'dev-server-crash.log'), msg, 'utf8'); } catch {}
});

const originalExit = process.exit;
(process as any).exit = function (code?: number) {
  const msg = `[${new Date().toISOString()}] [PROCESS.EXIT CALLED]: code=${code}\n${new Error().stack}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(process.cwd(), 'dev-server-crash.log'), msg, 'utf8'); } catch {}
  return originalExit.call(process, code);
};

process.on('SIGTERM', () => {
  const msg = `[${new Date().toISOString()}] [SIGTERM SIGNAL RECEIVED]\n`;
  try { fs.appendFileSync(path.join(process.cwd(), 'dev-server-crash.log'), msg, 'utf8'); } catch {}
});

// Stealth Chrome Headers to ensure 100% indistinguishable requests from normal web browser
const BROWSER_HEADERS: Record<string, string> = {
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

// Helper to safely write environment variables locally (100% excluded from Git)
// Password is kept strictly in-memory during active session and never stored as plaintext on disk
function updateLocalEnv(username?: string, password?: string, token?: string, name?: string) {
  const envPath = path.join(process.cwd(), '.env');

  if (password) {
    process.env.SGU_PASSWORD = password;
  }

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
    if (name) {
      existing['SGU_STUDENT_NAME'] = name;
      process.env.SGU_STUDENT_NAME = name;
    }
    if (token) {
      existing['SGU_BEARER_TOKEN'] = token;
      existing['SGU_TOKEN_UPDATED_AT'] = new Date().toISOString();
      process.env.SGU_BEARER_TOKEN = token;
    }

    const lines = [
      '# SGU Multi-Account Session (Tự động cập nhật linh hoạt theo tài khoản đang đăng nhập)',
      `SGU_USERNAME=${existing['SGU_USERNAME'] || ''}`,
      `SGU_STUDENT_NAME=${existing['SGU_STUDENT_NAME'] || ''}`,
      existing['SGU_BEARER_TOKEN'] ? `SGU_BEARER_TOKEN=${existing['SGU_BEARER_TOKEN']}` : 'SGU_BEARER_TOKEN=',
      existing['SGU_TOKEN_UPDATED_AT'] ? `SGU_TOKEN_UPDATED_AT=${existing['SGU_TOKEN_UPDATED_AT']}` : 'SGU_TOKEN_UPDATED_AT=',
      ''
    ];

    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  } catch (e) {
    console.warn('Could not update .env at', envPath, e);
  }
}

export default defineConfig({
  envDir: './.vite_env', // Prevents Vite from restarting the dev server when root .env is dynamically updated
  plugins: [
    react(),
    {
      name: 'sgu-local-api',
      configureServer(server) {
        // Manual on-demand sync trigger (supports dynamic active token from browser)
        server.middlewares.use('/api-sync', (req, res) => {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            let userToken = '';
            try {
              if (body) {
                const parsed = JSON.parse(body);
                if (parsed.token) userToken = parsed.token;
              }
            } catch {}

            const args = ['scripts/sync-sgu.cjs'];
            if (userToken) {
              args.push(`--token=${userToken.replace(/["'\r\n]/g, '')}`);
            }

            execFile(process.execPath, args, { cwd: process.cwd() }, (err, _stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                let parsedErr: any = null;
                try {
                  const match = (stderr || '').match(/\{[\s\S]*\}/);
                  if (match) parsedErr = JSON.parse(match[0]);
                } catch {}

                if (parsedErr && parsedErr.reason) {
                  res.statusCode = 200;
                  return res.end(JSON.stringify(parsedErr));
                }

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: false,
                  reason: (stderr || '').includes('expired') ? 'expired' : 'failed',
                  error: stderr || err.message
                }));
              } else {
                if (userToken) {
                  updateLocalEnv(undefined, undefined, userToken);
                }
                res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString() }));
              }
            });
          });
        });

        // 2. Auto login via .env credentials
        server.middlewares.use('/api-local/env-login', async (req, res) => {
          try {
            const envPath = path.join(process.cwd(), '.env');
            let username = process.env.SGU_USERNAME;
            let studentName = process.env.SGU_STUDENT_NAME;
            let password = process.env.SGU_PASSWORD;
            let token = process.env.SGU_BEARER_TOKEN;

            if (fs.existsSync(envPath)) {
              for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
                const trimmed = l.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                  const [k, ...v] = trimmed.split('=');
                  if (k?.trim() === 'SGU_USERNAME' && !username) username = v.join('=').trim().replace(/^["']|["']$/g, '');
                  if (k?.trim() === 'SGU_STUDENT_NAME' && !studentName) studentName = v.join('=').trim().replace(/^["']|["']$/g, '');
                  if (k?.trim() === 'SGU_PASSWORD' && !password) password = v.join('=').trim().replace(/^["']|["']$/g, '');
                  if (k?.trim() === 'SGU_BEARER_TOKEN' && !token) token = v.join('=').trim().replace(/^["']|["']$/g, '');
                }
              }
            }

            const isForceRefresh = (req.url || '').includes('force=1');

            // Nếu đã có token hợp lệ trong session/.env (và không yêu cầu force=1), phục hồi đăng nhập ngay lập tức theo đúng nick đang lưu
            if (!isForceRefresh && token && username) {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({
                success: true,
                token,
                user: { name: studentName || `Sinh viên ${username}`, mssv: username }
              }));
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

            let auth: any = null;
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
                auth = JSON.parse(rawText);
                if (loginRes.ok || auth?.access_token || loginRes.status === 400 || loginRes.status === 401) {
                  break;
                }
              } catch {
                // Fallback to next SGU gateway
              }
            }
            if (!auth) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'Máy chủ SGU đang quá tải hoặc không phản hồi JSON hợp lệ' }));
            }
            res.setHeader('Content-Type', 'application/json');
            if (auth.access_token) {
              // Automatically write fresh token to local .env file
              updateLocalEnv(username, password, auth.access_token, auth.name);
              res.end(JSON.stringify({
                success: true,
                token: auth.access_token,
                user: { name: auth.name, mssv: auth.userName }
              }));
            } else {
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: auth.message || auth.error_description || 'Đăng nhập SGU thất bại' }));
            }
          } catch (err: any) {
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
              const { username, password, token, name } = JSON.parse(body || '{}');
              if (!username && !password && !token) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'Không có dữ liệu tài khoản để cập nhật' }));
              }

              updateLocalEnv(username, password, token, name);
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
                '# SGU Multi-Account Session (Tự động cập nhật linh hoạt theo tài khoản đang đăng nhập)',
                'SGU_USERNAME=',
                'SGU_STUDENT_NAME=',
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
          process.env.SGU_STUDENT_NAME = '';
          process.env.SGU_PASSWORD = '';
          process.env.SGU_BEARER_TOKEN = '';

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Đã xóa tài khoản khỏi .env' }));
        });
      }
    }
  ],
  server: {
    host: true,
    port: 3000,
    watch: {
      ignored: ['**/src/data/**', '**/public/data/**', '**/.env', '**/.env.*', '**/.git/**']
    },
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'https://dkmh.sgu.edu.vn',
        changeOrigin: true,
        secure: false,
        headers: BROWSER_HEADERS
      }
    }
  }
});
