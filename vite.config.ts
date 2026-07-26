import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 로컬 백엔드: docker-compose nginx → http://127.0.0.1:8080
  // 원격만 쓸 때: psj-web-app/.env 에 VITE_DEV_PROXY_TARGET=https://impsj.net
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET?.trim() || 'http://127.0.0.1:8080'

  const proxyOpts = {
    target: devProxyTarget,
    changeOrigin: true,
    secure: false,
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { ...proxyOpts, ws: true },
        '/ask-stream': { ...proxyOpts, ws: true },
        '/ask-claude': proxyOpts,
        '/ask-gemini': proxyOpts,
        '/rag': proxyOpts,
        '/ask': proxyOpts,
      },
    },
    optimizeDeps: {
      include: ['ckeditor5'],
    },
    build: {
      outDir: '/Users/parksungju/psj-data-space/nginx/html/dist',
      assetsDir: 'assets', // 정적 에셋 폴더 (기본값: 'assets')
      // xterm 6 + esbuild minify가 TUI(vi 등) 런타임 오류를 유발하는 경우가 있음
      target: 'esnext',
    },
  }
})
