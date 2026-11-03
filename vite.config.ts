import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'on-demand-sync',
      configureServer(server) {
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

