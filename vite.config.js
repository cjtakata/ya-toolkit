import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The People app lives at /people — all asset paths are prefixed accordingly
  base: '/people',
  build: {
    outDir: 'dist/people',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
