import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://impsj.net', changeOrigin: true },
    },
  },
  optimizeDeps: {
    include: ['ckeditor5'],
  },
  build: {
    outDir: '/Users/parksungju/psj-data-space/nginx/html/dist',
    assetsDir: 'assets',   // 정적 에셋 폴더 (기본값: 'assets')
  },
})
