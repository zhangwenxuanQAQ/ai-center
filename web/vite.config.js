import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 8000,
      proxy: {
        '/aicenter': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
          ws: true,
          timeout: 300000,
          onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('X-Accel-Buffering', 'no');
            proxyReq.setHeader('Connection', 'keep-alive');
          },
          onProxyRes: (proxyRes, req, res) => {
            proxyRes.headers['X-Accel-Buffering'] = 'no';
            proxyRes.headers['Cache-Control'] = 'no-cache';
            proxyRes.headers['Connection'] = 'keep-alive';
            proxyRes.headers['Transfer-Encoding'] = 'chunked';
          }
        }
      }
    }
  }
})
