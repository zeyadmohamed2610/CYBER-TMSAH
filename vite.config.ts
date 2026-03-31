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
