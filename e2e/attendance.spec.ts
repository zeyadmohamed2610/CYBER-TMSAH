import { test, expect } from "@playwright/test";

test.describe("Health Check", () => {
  test("should load health check page", async ({ page }) => {
    await page.goto("/health");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Attendance Routes", () => {
  test("should load login page", async ({ page }) => {
    await page.goto("/attendance/login");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load student panel route", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load doctor dashboard route", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load owner dashboard route", async ({ page }) => {
    await page.goto("/attendance/owner-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Public Pages", () => {
  test("should load home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load schedule page", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load materials page", async ({ page }) => {
    await page.goto("/materials");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("PWA Features", () => {
  test("should have manifest.json", async ({ page }) => {
    const response = await page.request.get("/manifest.json");
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
  });
});

test.describe("Accessibility", () => {
  test("should have proper RTL direction", async ({ page }) => {
    await page.goto("/");
    const htmlDir = await page.getAttribute("html", "dir");
    expect(htmlDir).toBe("rtl");
  });
});