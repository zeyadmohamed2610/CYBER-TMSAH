import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Public smoke checks use no live accounts and never write to the hosted project.
  await page.route("**/*.supabase.co/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
});

for (const route of ["/", "/login", "/attendance/login", "/schedule"]) {
  test(`login renders and stays usable at ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(route === '/' ? /\/$/ : /\/login$/);
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    await expect(page.locator("#root")).not.toBeEmpty();
    expect(errors).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });
}

for (const route of ["/profile", "/owner-dashboard", "/coordinator-dashboard", "/doctor-dashboard", "/student-panel", "/ta-dashboard"]) {
  test(`unauthenticated access is rejected at ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("unknown routes show a real not-found screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/audit-missing-page", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("join and password reset pages render without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).not.toBeEmpty();
  expect(errors).toEqual([]);
});
