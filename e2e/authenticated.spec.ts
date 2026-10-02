import { test, expect } from "@playwright/test";
// Dedicated live accounts are opt-in; the student test binds its disposable device.
for (const [role, destination] of [["student", "student-panel"], ["doctor", "doctor-dashboard"], ["owner", "owner-dashboard"], ["coordinator", "coordinator-dashboard"], ["ta", "ta-dashboard"]] as const) {
  test("@auth " + role + " opens the correct dashboard", async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const backendErrors: string[] = [];
    page.on("response", response => {
      if (response.url().includes(".supabase.co/") && response.status() >= 400) {
        backendErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    });
    const identifier = process.env["E2E_" + role.toUpperCase() + "_IDENTIFIER"];
    const password = process.env["E2E_" + role.toUpperCase() + "_PASSWORD"];
    test.skip(process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password, "Requires dedicated test accounts");
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="identifier"]').fill(identifier!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(destination));
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
    if (role === "student") {
      const bind = page.getByRole("button", { name: "قفل هذا الجهاز والمتابعة" });
      await expect(bind.or(page.getByRole("tab").first())).toBeVisible();
      if (await bind.isVisible()) await bind.click();
      await expect(page.getByRole("tab").first()).toBeVisible();
    }
    const errors: string[] = [];
    await page.screenshot({ path: `.private/screenshots/${role}-${testInfo.project.name}.png`, fullPage: true });
    page.on("pageerror", error => errors.push(error.message));
    const tabs = page.getByRole("tab");
    for (let index = 0; index < await tabs.count(); index++) {
      await tabs.nth(index).click();
      await expect(page.getByRole("tabpanel").first()).toBeVisible();
      await page.waitForTimeout(300);
    }
    if (role === "owner" || role === "coordinator") {
      const adminTabs = ["schedule", "departments", "doctors", "tas", "students", "fixes", "lectures", "manual-attendance", "attendance-records",
        ...(role === "owner" ? ["requests", "coordinators", "devices"] : [])];
      for (const tab of adminTabs) {
        await page.goto(`/${destination}?tab=${tab}`);
        await expect(page.getByRole("tabpanel").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
      }
    }
    expect(errors).toEqual([]);
    if (role !== "owner" && role !== "coordinator") {
      await page.goto("/owner-dashboard");
      await expect(page).not.toHaveURL(/\/owner-dashboard(?:\?|$)/);
    }
    await page.goto("/profile");
    await expect(page.getByText("الملف الشخصي والحساب", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "البيانات الأساسية" })).toBeVisible();
    await page.screenshot({ path: `.private/screenshots/${role}-profile-${testInfo.project.name}.png`, fullPage: true });
    const profileTabs = page.getByRole("tab");
    for (let index = 0; index < await profileTabs.count(); index++) {
      await profileTabs.nth(index).click();
      await expect(page.getByRole("tabpanel").first()).toBeVisible();
      await page.waitForTimeout(200);
    }
    expect(errors).toEqual([]);
    expect(backendErrors).toEqual([]);
  });
}
