import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Optimisations pour la performance en dev
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    // Augmente la limite de fichiers observés
    watch: {
      usePolling: false,
    },
    // Désactive la minification en dev (plus rapide)
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  // Optimisations de build
  build: {
    chunkSizeWarningLimit: 1000,
    // manualChunks disabled: Vite auto-splits via dynamic imports in lazyRecharts.tsx
    // Forcing manualChunks creates frozen ES module namespaces that break React.lazy _status writes
  }
})
