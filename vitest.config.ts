import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.test.ts"],
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
