import { defineConfig } from "vite";
import type { ViteDevServer, PreviewServer, Plugin } from "vite";
import type { ServerResponse, IncomingMessage } from "http";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import compression from "vite-plugin-compression";
import {seoPages} from './scripts/seo-pages.ts';

type NextFn = () => void;

const initialScripts = new Set<string>();
const initialAssetsPlugin: Plugin = {
  name: 'initial-offline-assets',
  generateBundle(_, bundle) {
    initialScripts.clear();
    const visit = (name: string) => {
      if (initialScripts.has(name)) return;
      const chunk = bundle[name];
      if (!chunk || chunk.type !== 'chunk') return;
      initialScripts.add(name);
      chunk.imports.forEach(visit);
    };
    Object.values(bundle).forEach(chunk => {
      if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName);
    });
  },
};

let sentryVitePlugin: typeof import("@sentry/vite-plugin").sentryVitePlugin | null = null;
try {
  const mod = await import("@sentry/vite-plugin");
  sentryVitePlugin = mod.sentryVitePlugin;
} catch {
  sentryVitePlugin = null;
}

function e2eSupportPlugin() {
  const setHeaders = (res: ServerResponse) => {
    res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: wss:; frame-ancestors 'self';");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  };

  return {
    name: "vite-plugin-e2e-support",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: NextFn) => {
        setHeaders(res);
        if (req.url === "/api/health" || req.url?.startsWith("/api/health?")) {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: "ok",
            scope: "web-server",
            timestamp: new Date().toISOString(),
            checks: { server: "ok" },
          }));
          return;
        }
        next();
      });
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: NextFn) => {
        setHeaders(res);
        if (req.url === "/api/health" || req.url?.startsWith("/api/health?")) {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            checks: { database: "ok", server: "ok" },
          }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    headers: {
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: wss:; frame-ancestors 'self';",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  plugins: [
    react(),
    seoPages(),
    initialAssetsPlugin,
    e2eSupportPlugin(),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['manifest.json', 'favicon.png', 'brand/logo-small.webp'],
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['index.html', 'assets/*.{js,css}', 'favicon.png', 'brand/logo-small.webp'],
        manifestTransforms: [async entries => ({
          manifest: entries.filter(entry => !entry.url.endsWith('.js') || initialScripts.has(entry.url)),
          warnings: [],
        })],
        runtimeCaching: [
          { urlPattern: ({url, sameOrigin}) => sameOrigin && /\/assets\/.*\.(js|css)$/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'app-assets', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [200] } } },
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } }
        ]
      }
    }),
    Boolean(process.env.VITE_SENTRY_AUTH_TOKEN) && sentryVitePlugin && sentryVitePlugin({
      org: process.env.VITE_SENTRY_ORG,
      project: process.env.VITE_SENTRY_PROJECT,
      authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.VITE_SENTRY_RELEASE || `v${Date.now()}`,
      },
      sourcemaps: {
        assets: ['dist/**/*.js'],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname ?? path.resolve("."), "./src"),
    },
  },
  publicDir: "public",
  build: {
    copyPublicDir: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: () => mode === 'production' ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
        entryFileNames: (chunkInfo) => mode === 'production' ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
}));
