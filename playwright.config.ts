import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://localhost:8080",
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
    command: "pnpm dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});