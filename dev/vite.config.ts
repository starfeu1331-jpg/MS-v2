import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
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
    // Proxy vers le serveur backend local Node.js
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
    rollupOptions: {
      output: {
        manualChunks: {
          'recharts-vendor': ['recharts'],
          'lucide-vendor': ['lucide-react'],
          'react-vendor': ['react', 'react-dom'],
        }
      }
    }
  }
})
