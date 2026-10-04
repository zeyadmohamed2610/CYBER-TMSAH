import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
// Dedicated live accounts are opt-in; the student test binds its disposable device.
for (const [role, destination] of [
  ["student", "student-panel"],
  ["doctor", "doctor-dashboard"],
  ["owner", "owner-dashboard"],
  ["coordinator", "coordinator-dashboard"],
  ["ta", "ta-dashboard"],
] as const) {
  test("@auth " + role + " opens the correct dashboard", async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const backendErrors: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes(".supabase.co/") && response.status() >= 400) {
        backendErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    });
    const identifier = process.env["E2E_" + role.toUpperCase() + "_IDENTIFIER"];
    const password = process.env["E2E_" + role.toUpperCase() + "_PASSWORD"];
    test.skip(
      process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password,
      "Requires dedicated test accounts",
    );
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="identifier"]').fill(identifier!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(destination), { timeout: 30000 });
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
    if (role === "student") {
      const bind = page.getByRole("button", { name: "قفل هذا الجهاز والمتابعة" });
      await expect(bind.or(page.getByRole("tab").first()).first()).toBeVisible();
      if (await bind.isVisible()) await bind.click();
      await expect(page.getByRole("tab").first()).toBeVisible();
    }
    const errors: string[] = [];
    const expectMobileLayout = async () => {
      if ((page.viewportSize()?.width ?? 1280) >= 640) return;
      const scrollers = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("*"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              rect.width > 20 &&
              rect.height > 0 &&
              style.visibility !== "hidden" &&
              element.scrollWidth > element.clientWidth + 2 &&
              ["auto", "scroll"].includes(style.overflowX)
            );
          })
          .map((element) => element.tagName + ":" + element.className),
      );
      expect(scrollers).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    };
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      const dock = page.locator(".mobile-dock");
      await expect(dock).toBeVisible();
      // Check viewport coordinates, not only visibility: transformed ancestors can
      // put a supposedly fixed bar thousands of pixels below the screen.
      for (const position of [0, 1000]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), position);
        await expect
          .poll(async () =>
            dock.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.top >= 0 && rect.bottom <= innerHeight && innerHeight - rect.bottom < 40;
            }),
          )
          .toBe(true);
        await expect
          .poll(async () =>
            page
              .locator('nav[aria-label="التنقل الرئيسي"]')
              .evaluate((element) => Math.abs(element.getBoundingClientRect().top)),
          )
          .toBeLessThan(2);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }
    await page.screenshot({
      path: `.private/screenshots/${role}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    page.on("pageerror", (error) => errors.push(error.message));
    if (role !== "student" && (page.viewportSize()?.width ?? 1280) < 1024) {
      await expect(page.getByRole("button", { name: "فتح قائمة التنقل", exact: true })).toHaveCount(
        0,
      );
      const menu = page.getByRole("button", { name: "المزيد من الصفحات", exact: true });
      await menu.click();
      const labels = await page.getByRole("dialog").locator("nav button").allTextContents();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      for (const label of labels) {
        await menu.click();
        await page.getByRole("dialog").locator("nav button").filter({ hasText: label }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("tabpanel").first()).toBeVisible();
        await expectMobileLayout();
      }
    }
    const tabs = page.getByRole("tab");
    for (let index = 0; index < (await tabs.count()); index++) {
      await tabs.nth(index).click();
      await expect(page.getByRole("tabpanel").first()).toBeVisible();
      await page.waitForTimeout(300);
      await expectMobileLayout();
    }
    if (role === "owner" || role === "coordinator") {
      const adminTabs = [
        "schedule",
        "departments",
        "doctors",
        "tas",
        "students",
        "fixes",
        "lectures",
        "manual-attendance",
        "attendance-records",
        "requests",
        "devices",
        ...(role === "owner" ? ["coordinators"] : []),
      ];
      for (const tab of adminTabs) {
        await page.goto(`/${destination}?tab=${tab}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("tabpanel").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        if (tab === "schedule") {
          const year = page.getByRole("combobox", { name: "الفرقة الدراسية", exact: true });
          await expect(year).toHaveValue("");
          await expect(year.locator("option:not([disabled])")).toHaveCount(4);
          await expect(page.getByRole("button", { name: "إدارة الجدول", exact: true })).toHaveCount(
            0,
          );
          if (role === "coordinator")
            await expect(
              page.getByRole("combobox", { name: "قسم الجدول", exact: true }),
            ).toHaveCount(0);
          else
            await expect(
              page.getByRole("combobox", { name: "قسم الجدول", exact: true }).locator("option"),
            ).toHaveCount(7);
          await year.selectOption("2");
          await expect(
            page.getByRole("button", { name: "إدارة الجدول", exact: true }),
          ).toBeVisible();
          await expectMobileLayout();
          await page.getByRole("button", { name: "إدارة الجدول", exact: true }).click();
          const downloaded = page.waitForEvent("download");
          await page.getByRole("button", { name: "قالب الاستيراد", exact: true }).click();
          const file = await downloaded;
          expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
          expect((await readFile((await file.path())!)).subarray(0, 2).toString()).toBe("PK");
          await page.getByRole("tab", { name: "الامتحانات", exact: true }).click();
          await expect(page.getByText("جداول الميدتيرم والفاينل", { exact: true })).toBeVisible();
        }
      }
    }
    expect(errors).toEqual([]);
    if (role !== "owner" && role !== "coordinator") {
      await page.goto("/owner-dashboard", { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/owner-dashboard(?:\?|$)/);
    }
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("الملف الشخصي والحساب", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "البيانات الأساسية" })).toBeVisible();
    if (role === "owner" && testInfo.project.name === "mobile-chrome") {
      const originalViewport = page.viewportSize()!;
      for (const viewport of [
        { width: 320, height: 480 },
        { width: 780, height: 360 },
      ]) {
        await page.setViewportSize(viewport);
        await page.getByRole("button", { name: "تغيير الصورة الشخصية", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect
          .poll(() =>
            dialog.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.top >= 0 &&
                rect.bottom <= innerHeight &&
                rect.left >= 0 &&
                rect.right <= innerWidth
              );
            }),
          )
          .toBe(true);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
      await page.setViewportSize({ width: 320, height: 480 });
      const menu = page.getByRole("button", { name: "فتح القائمة", exact: true });
      await expect
        .poll(() => menu.evaluate((element) => element.getBoundingClientRect().left))
        .toBeGreaterThanOrEqual(0);
      await menu.click();
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      await page.setViewportSize(originalViewport);
    }
    await page.screenshot({
      path: `.private/screenshots/${role}-profile-${testInfo.project.name}.png`,
      fullPage: true,
    });
    const profileTabs = page.getByRole("tab");
    for (let index = 0; index < (await profileTabs.count()); index++) {
      await profileTabs.nth(index).click();
      await expect(page.getByRole("tabpanel").first()).toBeVisible();
      await page.waitForTimeout(200);
    }
    expect(errors).toEqual([]);
    expect(backendErrors).toEqual([]);
  });
}
