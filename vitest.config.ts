import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // PGlite starts a real WASM Postgres instance for each database suite.
    maxWorkers: 4,
    hookTimeout: 30000,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.{ts,tsx}", "api/**/*.ts", "supabase/functions/**/*.ts"],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**", "src/test/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "npm:@supabase/server@1.8.0/core": "@supabase/server/core",
      "npm:@supabase/server@1.8.0": "@supabase/server",
      "npm:@simplewebauthn/server@13.3.2": "@simplewebauthn/server",
    },
  },
});
