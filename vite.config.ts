import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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

