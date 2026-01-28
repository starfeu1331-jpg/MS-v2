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
        target: 'https://decor-discount-api.progiapps.fr/ws',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
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
