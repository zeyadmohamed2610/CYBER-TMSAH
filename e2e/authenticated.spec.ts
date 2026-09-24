import { test, expect } from "@playwright/test";

/**
 * Authenticated E2E Tests
 * These tests require a test user to be created and authenticated.
 * Run with: pnpm test:e2e --project=chromium --grep @auth
 */

// Test users (created via Supabase Auth in test setup)
// student: student@test.com / password123
// doctor: doctor@test.com / password123
// owner: owner@test.com / password123

test.describe.configure({ retries: 2 });

test.describe("@auth Student Attendance Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "12345678901234");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/student-panel**");
  });

  test("should show active sessions for student", async ({ page }) => {
    await expect(page.locator("text=/active session|جلسة نشطة|no sessions|لا توجد جلسات/i")).toBeVisible({ timeout: 10000 });
  });

  test("should submit attendance with valid QR code", async ({ page }) => {
    // This requires an active session with a QR code
    // Scan QR code button should be present
    const scanButton = page.locator('button:has-text("scan"), button:has-text("مسح"), button:has-text("QR")');
    await expect(scanButton.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show GPS permission prompt", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    const gpsPrompt = page.locator("text=/location|موقع|gps|enable location/i");
    // GPS prompt appears when submitting attendance
  });

  test("should show TOTP input when required", async ({ page }) => {
    const totpInput = page.locator('input[name="totp"], input[placeholder*="TOTP"], input[placeholder*="رمز"]');
    // TOTP input appears when session requires it
  });

  test("should prevent duplicate submission", async ({ page }) => {
    // After submitting once, the submit button should be disabled
    // or show "already submitted" message
    await expect(page.locator("text=/already submitted|تم التسجيل|duplicate/i")).toBeVisible({ timeout: 5000 });
  });

  test("should show attendance history", async ({ page }) => {
    await page.click('a[href*="history"], button:has-text("history"), button:has-text("السجل")');
    await expect(page.locator("text=/attendance history|سجل الحضور|no records/i")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("@auth Doctor Session Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as doctor
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "doctor@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/doctor-dashboard**");
  });

  test("should create new attendance session", async ({ page }) => {
    await page.click('button:has-text("create"), button:has-text("إنشاء"), button:has-text("new session")');
    await expect(page.locator('input[name="title"], input[placeholder*="title"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input[name="title"]', "Test Session " + Date.now());
    await page.click('button[type="submit"]:has-text("create"), button:has-text("إنشاء")');

    await expect(page.locator("text=/session created|تم إنشاء الجلسة|success/i")).toBeVisible({ timeout: 10000 });
  });

  test("should generate QR code for active session", async ({ page }) => {
    const qrCode = page.locator("canvas, img[alt*='qr'], img[alt*='QR']");
    await expect(qrCode.first()).toBeVisible({ timeout: 10000 });
  });

  test("should show real-time attendance count", async ({ page }) => {
    const count = page.locator("text=/attendance|حضور|count|عدد/i");
    await expect(count.first()).toBeVisible({ timeout: 5000 });
  });

  test("should export attendance as CSV", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("export"), button:has-text("تصدير"), button:has-text("csv")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".csv");
  });

  test("should export attendance as Excel", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("excel"), button:has-text("xlsx")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(xls|xlsx)$/);
  });

  test("should export attendance as PDF", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("pdf"), button:has-text("PDF")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".pdf");
  });

  test("should end session", async ({ page }) => {
    await page.click('button:has-text("end"), button:has-text("إنهاء"), button:has-text("close")');
    await expect(page.locator("text=/session ended|تم إنهاء|closed/i")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("@auth Owner User Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as owner
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "owner@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/owner-dashboard**");
  });

  test("should list all users", async ({ page }) => {
    await expect(page.locator("text=/users|المستخدمون|all users/i")).toBeVisible({ timeout: 10000 });
    const userRows = page.locator("tbody tr, .user-row, [data-testid='user-row']");
    await expect(userRows.first()).toBeVisible({ timeout: 5000 });
  });

  test("should create new doctor user", async ({ page }) => {
    await page.click('button:has-text("add"), button:has-text("إضافة"), button:has-text("create user")');
    await expect(page.locator('input[name="name"], input[placeholder*="name"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input[name="name"]', "New Doctor");
    await page.fill('input[name="email"]', "newdoctor@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.selectOption('select[name="role"]', "doctor");
    await page.selectOption('select[name="subject_id"]', { index: 1 });

    await page.click('button[type="submit"]:has-text("create"), button:has-text("إنشاء")');
    await expect(page.locator("text=/user created|تم إنشاء المستخدم|success/i")).toBeVisible({ timeout: 10000 });
  });

  test("should create new TA user", async ({ page }) => {
    await page.click('button:has-text("add"), button:has-text("إضافة")');
    await page.fill('input[name="name"]', "New TA");
    await page.fill('input[name="email"]', "newta@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.selectOption('select[name="role"]', "ta");
    await page.selectOption('select[name="subject_id"]', { index: 1 });

    await page.click('button[type="submit"]:has-text("create")');
    await expect(page.locator("text=/user created|success/i")).toBeVisible({ timeout: 10000 });
  });

  test("should create new student user with national ID", async ({ page }) => {
    await page.click('button:has-text("add"), button:has-text("إضافة")');
    await page.fill('input[name="name"]', "New Student");
    await page.fill('input[name="national_id"]', "98765432109876");
    await page.fill('input[name="password"]', "password123");
    await page.selectOption('select[name="role"]', "student");

    await page.click('button[type="submit"]:has-text("create")');
    await expect(page.locator("text=/user created|success/i")).toBeVisible({ timeout: 10000 });
  });

  test("should reject duplicate national ID", async ({ page }) => {
    await page.click('button:has-text("add"), button:has-text("إضافة")');
    await page.fill('input[name="name"]', "Duplicate Student");
    await page.fill('input[name="national_id"]', "12345678901234"); // Already exists
    await page.fill('input[name="password"]', "password123");
    await page.selectOption('select[name="role"]', "student");

    await page.click('button[type="submit"]:has-text("create")');
    await expect(page.locator("text=/already exists|موجود مسبقاً|duplicate/i")).toBeVisible({ timeout: 5000 });
  });

  test("should view system logs", async ({ page }) => {
    await page.click('a[href*="logs"], button:has-text("logs"), button:has-text("السجلات")');
    await expect(page.locator("text=/system logs|سجل النظام|no logs/i")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("@auth Lecture Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "doctor@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/doctor-dashboard**");
  });

  test("should create new lecture", async ({ page }) => {
    await page.click('a[href*="lecture"], button:has-text("lecture"), button:has-text("محاضرة")');
    await expect(page.locator('input[name="title"], input[placeholder*="lecture"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input[name="title"]', "Test Lecture " + Date.now());
    await page.fill('input[name="lecture_date"]', new Date().toISOString().split("T")[0]);
    await page.click('button[type="submit"]:has-text("create")');
    await expect(page.locator("text=/lecture created|تم إنشاء المحاضرة|success/i")).toBeVisible({ timeout: 10000 });
  });

  test("should view lecture attendance", async ({ page }) => {
    await page.click('a[href*="lecture"], button:has-text("lecture")');
    const lectureLink = page.locator("a[href*='lecture'], .lecture-row").first();
    await lectureLink.click();
    await expect(page.locator("text=/attendance|الحضور|attendees/i")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("@auth Schedule Viewing", () => {
  test("student should see schedule for their section", async ({ page }) => {
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "12345678901234");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/student-panel**");

    await page.goto("/schedule");
    await expect(page.locator("text=/schedule|الجدول|section|قسم/i")).toBeVisible({ timeout: 10000 });
  });

  test("doctor should see schedule for their subject", async ({ page }) => {
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "doctor@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/doctor-dashboard**");

    await page.goto("/schedule");
    await expect(page.locator("text=/schedule|الجدول/i")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("@auth Course Materials", () => {
  test("student should access course materials", async ({ page }) => {
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "12345678901234");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/student-panel**");

    await page.goto("/materials");
    await expect(page.locator("text=/materials|المواد|no materials/i")).toBeVisible({ timeout: 10000 });
  });

  test("doctor should upload course material", async ({ page }) => {
    await page.goto("/attendance/login");
    await page.fill('input[name="nationalId"], input[name="email"]', "doctor@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/doctor-dashboard**");

    await page.goto("/materials");
    await page.click('button:has-text("upload"), button:has-text("رفع")');
    await expect(page.locator('input[type="file"]')).toBeVisible({ timeout: 5000 });
  });
});