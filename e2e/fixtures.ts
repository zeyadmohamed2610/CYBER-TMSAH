import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import { chromium } from "@playwright/test";

/**
 * Test fixtures for authenticated tests
 * Provides pre-authenticated pages for different user roles
 */

interface AuthFixtures {
  studentPage: Page;
  doctorPage: Page;
  ownerPage: Page;
  studentContext: BrowserContext;
  doctorContext: BrowserContext;
  ownerContext: BrowserContext;
}

// Test user credentials (these should match test data in Supabase)
const TEST_USERS = {
  student: {
    identifier: "12345678901234", // national ID
    password: "password123",
    redirectPath: "/attendance/student-panel",
  },
  doctor: {
    identifier: "doctor@test.com",
    password: "password123",
    redirectPath: "/attendance/doctor-dashboard",
  },
  owner: {
    identifier: "owner@test.com",
    password: "password123",
    redirectPath: "/attendance/owner-dashboard",
  },
};

async function login(page: Page, role: keyof typeof TEST_USERS): Promise<void> {
  const user = TEST_USERS[role];
  await page.goto("/attendance/login");

  // Fill identifier (national ID for student, email for doctor/owner)
  const identifierInput = page.locator('input[name="nationalId"], input[name="email"], input[type="text"], input[type="email"]').first();
  await identifierInput.fill(user.identifier);

  // Fill password
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.fill(user.password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect
  await page.waitForURL(`**${user.redirectPath}**`, { timeout: 15000 });
}

export const test = base.extend<AuthFixtures>({
  // Student authenticated page
  studentPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, "student");
    await use(page);
    await context.close();
  },

  // Doctor authenticated page
  doctorPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, "doctor");
    await use(page);
    await context.close();
  },

  // Owner authenticated page
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, "owner");
    await use(page);
    await context.close();
  },

  // Persistent contexts for reuse across tests
  studentContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, "student");
    await use(context);
    await context.close();
  },

  doctorContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, "doctor");
    await use(context);
    await context.close();
  },

  ownerContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, "owner");
    await use(context);
    await context.close();
  },
});

export { expect } from "@playwright/test";

/**
 * Helper functions for common test actions
 */

export async function waitForToast(page: Page, message: string, timeout = 5000) {
  await expect(page.locator(`text=${message}`)).toBeVisible({ timeout });
}

export async function clickAndWaitForDownload(page: Page, selector: string) {
  const downloadPromise = page.waitForEvent("download");
  await page.click(selector);
  return downloadPromise;
}

export async function fillForm(page: Page, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    const input = page.locator(`input[name="${name}"], select[name="${name}"], textarea[name="${name}"]`).first();
    const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "select") {
      await input.selectOption(value);
    } else {
      await input.fill(value);
    }
  }
}

export async function submitForm(page: Page, submitText = "submit") {
  await page.click(`button[type="submit"]:has-text("${submitText}"), button:has-text("${submitText}")`);
}

export async function expectSuccess(page: Page, message = "success") {
  await expect(page.locator(`text=/${message}/i`)).toBeVisible({ timeout: 10000 });
}

export async function expectError(page: Page, message: string) {
  await expect(page.locator(`text=/${message}/i`)).toBeVisible({ timeout: 5000 });
}

export async function grantPermissions(context: BrowserContext, permissions: string[]) {
  await context.grantPermissions(permissions);
}

export async function mockGeolocation(page: Page, latitude: number, longitude: number) {
  await page.context().grantPermissions(["geolocation"]);
  await page.evaluate(
    ({ lat, lon }) => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: { latitude: lat, longitude: lon, accuracy: 10 },
        } as GeolocationPosition);
      };
    },
    { lat: latitude, lon: longitude }
  );
}

export function generateTestId(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function waitForRealtimeUpdate(page: Page, selector: string, expectedChange: string) {
  // Wait for Supabase Realtime to update the UI
  await page.waitForFunction(
    ({ sel, expected }) => {
      const el = document.querySelector(sel);
      return el && el.textContent?.includes(expected);
    },
    { sel: selector, expected: expectedChange },
    { timeout: 10000 }
  );
}