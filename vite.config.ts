import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
    // Use esbuild (fastest, built into Vite 8)
    minify: 'esbuild',
    // Raise chunk warning threshold slightly — large UI libs are expected
    chunkSizeWarningLimit: 600,
    // Target modern browsers that support ESM natively — smaller output
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Core React runtime — must load first
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          ) return 'react-vendor';

          // Radix UI components — lazy, only needed when UI renders
          if (id.includes('node_modules/@radix-ui/')) return 'radix-ui';

          // Supabase client — large, separately cached once logged in
          if (id.includes('node_modules/@supabase/')) return 'supabase';

          // QR code generation — only needed in attendance views
          if (id.includes('node_modules/qrcode')) return 'qrcode';

          // lucide icons — tree-shaken but still sizable
          if (id.includes('node_modules/lucide-react')) return 'icons';
        },
        chunkFileNames: (chunkInfo) => {
          if (mode === 'production') return 'assets/[hash].js';
          return 'assets/[name]-[hash].js';
        },
        entryFileNames: (chunkInfo) => {
          if (mode === 'production') return 'assets/[hash].js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
    // Source maps only in development
    sourcemap: mode === 'development',
  },
}));
