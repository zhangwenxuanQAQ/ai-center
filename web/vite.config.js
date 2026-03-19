import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '10.9.44.5',
    port: 8000,
    proxy: {
      '/aicenter': {
        target: 'http://10.9.44.5:8080',
        changeOrigin: true,
      }
    }
  }
})
