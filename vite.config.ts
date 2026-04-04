import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import compression from "vite-plugin-compression";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    VitePWA({
      registerType: 'generateSW',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'CYBER TMSAH - منصة الحضور الذكي',
        short_name: 'CYBER TMSAH',
        description: 'منصة جامعية شاملة لنظام الحضور الذكي',
        theme_color: '#0d9488',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'favicon.png', sizes: '192x192', type: 'image/png' },
          { src: 'favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'supabase-api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }, networkTimeoutSeconds: 10, cacheableResponse: { statuses: [0, 200] } } }
        ]
      }
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: "public",
  build: {
    copyPublicDir: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/') || id.includes('node_modules/scheduler/')) return 'react-vendor';
          if (id.includes('node_modules/@radix-ui/')) return 'radix-ui';
          if (id.includes('node_modules/@supabase/')) return 'supabase';
          if (id.includes('node_modules/qrcode')) return 'qrcode';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/html2canvas') || id.includes('node_modules/html2canvas-pro')) return 'export-image';
          if (id.includes('node_modules/jspdf')) return 'export-pdf';
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs')) return 'charts';
        },
        chunkFileNames: (chunkInfo) => mode === 'production' ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
        entryFileNames: (chunkInfo) => mode === 'production' ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
      },
    },
    sourcemap: mode === 'development',
  },
}));
