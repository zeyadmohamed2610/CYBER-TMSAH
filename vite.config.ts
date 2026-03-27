import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "rss.xml", "sitemap.xml", "robots.txt", "browserconfig.xml"],
      manifest: {
        name: "CYBER TMSAH - منصة الأمن السيبراني",
        short_name: "CYBER TMSAH",
        description: "منصة أكاديمية متكاملة لطلاب الأمن السيبراني",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "ar",
        dir: "rtl",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
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
    // Minification — uses esbuild (built into Vite 8, no extra install needed)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // manualChunks must be a function in Vite 8 / Rolldown
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/'))
            return 'vendor';
          if (id.includes('node_modules/@radix-ui/'))
            return 'ui';
        },
        // Obfuscate chunk names in production
        chunkFileNames: (chunkInfo) => {
          if (mode === 'production') {
            return 'assets/[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        entryFileNames: (chunkInfo) => {
          if (mode === 'production') {
            return 'assets/[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
    // Source maps only in development
    sourcemap: mode === 'development',
  },
}));
