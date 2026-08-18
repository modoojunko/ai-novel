import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 5175 与 dev-up 的 S_FRONT_PORT 对齐；5173 是 C端前端默认端口，撞车后
    // playwright 的 reuseExistingServer 会复用错应用导致 e2e 大面积假失败
    port: 5175,
    // 端口被占时直接报错，避免 vite 静默递增端口后连到错误的服务
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:19000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
})
