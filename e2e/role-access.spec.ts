import { expect, test } from "@playwright/test";

for (const [role, destination] of [
  ["student", "student-panel"],
  ["doctor", "doctor-dashboard"],
  ["ta", "ta-dashboard"],
] as const) {
  test(`@auth ${role} sees only permitted destinations and cannot open administrative pages`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const identifier = process.env[`E2E_${role.toUpperCase()}_IDENTIFIER`];
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
    test.skip(
      process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password,
      "Dedicated QA accounts required",
    );
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("supabase.co/rest/v1/") && response.status() >= 400)
        failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.goto("/login");
    await page.locator('[name="identifier"]').fill(identifier!);
    await page.locator('[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(destination), { timeout: 30000 });
    await expect(page.getByRole("tabpanel").first()).toBeVisible({ timeout: 30000 });
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole("button", { name: "المزيد من الصفحات", exact: true }).click();
      const menu = page.getByRole("dialog");
      for (const label of [
        "المستخدمون",
        "الأقسام والمواد",
        "إدارة الأجهزة",
        "سياسة الغياب",
        "أمان الجهاز",
        "بياناتي الشخصية",
      ])
        await expect(menu.getByRole("button", { name: label, exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    const tabs =
      role === "student"
        ? ["records", "schedule", "analytics", "followup"]
        : ["records", "schedule", "stats", "subjects", "followup"];
    for (const tab of tabs) {
      await page.goto(`/${destination}?tab=${tab}`);
      await expect(page.getByRole("tabpanel").first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("button", { name: "إدارة الجدول", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "إضافة مادة جديدة", exact: true })).toHaveCount(
        0,
      );
      if (role === "student") {
        await expect(page.getByRole("button", { name: /تصدير/ })).toHaveCount(0);
        await expect(
          page.getByRole("combobox", { name: "الفرقة الدراسية", exact: true }),
        ).toHaveCount(0);
      }
      if ((page.viewportSize()?.width ?? 1280) < 640)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
    }
    for (const view of ["terms", "rules", "privacy"]) {
      await page.goto(`/${destination}?tab=followup&view=${view}`);
      await expect(
        page.getByRole("heading", { name: "الحضور والغياب حسب المادة", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("button", { name: "الفصول الدراسية", exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.locator('[name="max_absences"], [name="location_retention_days"]'),
      ).toHaveCount(0);
    }
    for (const target of [
      "owner-dashboard",
      "coordinator-dashboard",
      ...(role === "student"
        ? ["doctor-dashboard", "ta-dashboard"]
        : ["student-panel", role === "doctor" ? "ta-dashboard" : "doctor-dashboard"]),
    ]) {
      await page.goto(`/${target}`);
      await expect(page).toHaveURL(new RegExp(destination), { timeout: 30000 });
    }
    await page.goto(`/${destination}?tab=${role === "student" ? "device" : "users"}`);
    await expect(page.getByRole("tabpanel").first()).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name:
          role === "student"
            ? /^(جهاز تسجيل الحضور|تسجيل الحضور)$/
            : role === "doctor"
              ? "المحاضرات"
              : "السكاشن",
        exact: true,
      }),
    ).toBeVisible({ timeout: 30000 });
    expect(failures).toEqual([]);
  });
}
