import { defineConfig, devices } from "@playwright/test";

const testPort = Number(process.env.E2E_PORT ?? 8080);
const isWindows = process.platform === "win32";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 60000,
  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: isWindows
          ? {
              executablePath: CHROME_PATH,
              args: ["--headless=new"],
            }
          : undefined,
      },
    },
    {
      name: "mobile-chrome",
      use: isWindows
        ? {
            ...devices["Pixel 5"],
            launchOptions: {
              executablePath: CHROME_PATH,
              args: ["--headless=new"],
            },
          }
        : devices["Pixel 5"],
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${testPort} --strictPort`,
    url: `http://localhost:${testPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});