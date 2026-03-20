import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      host: '10.9.44.5',
      port: 8000,
      proxy: {
        '/aicenter': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
          ws: true,
          onProxyReq: (proxyReq, req, res) => {
            if (req.url?.includes('/chat')) {
              proxyReq.setHeader('X-Accel-Buffering', 'no');
            }
          }
        }
      }
    }
  }
})
