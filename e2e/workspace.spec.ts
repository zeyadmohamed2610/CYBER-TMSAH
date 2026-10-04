import { expect, test } from "@playwright/test";
for (const [role, path] of [
  ["owner", "owner-dashboard"],
  ["coordinator", "coordinator-dashboard"],
  ["doctor", "doctor-dashboard"],
  ["ta", "ta-dashboard"],
  ["student", "student-panel"],
] as const) {
  test(`@auth ${role} has a focused workspace and compact account settings`, async ({ page }) => {
    test.setTimeout(90000);
    const identifier = process.env[`E2E_${role.toUpperCase()}_IDENTIFIER`];
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
    test.skip(
      !identifier || !password || process.env.E2E_ALLOW_LIVE_AUTH !== "1",
      "Dedicated QA accounts required",
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/login");
    await page.locator('[name="identifier"]').fill(identifier!);
    await page.locator('[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(path), { timeout: 30000 });
    await expect(page.getByRole("tabpanel").first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("region", { name: "ملخص المنصة", exact: true })).toHaveCount(
      role === "owner" ? 1 : 0,
    );
    if (role === "owner" || role === "coordinator") {
      await expect(page.getByRole("tabpanel", { name: "المستخدمون", exact: true })).toBeVisible();
      for (const manage of ["accounts", "requests", "devices", "fixes"]) {
        await page.goto(`/${path}?tab=users&manage=${manage}`);
        await expect(
          page.getByRole("navigation", { name: "إدارة المستخدمين والطلبات", exact: true }),
        ).toBeVisible({ timeout: 30000 });
      }
    } else {
      await expect(
        page.getByRole("heading", { name: "الجدول والامتحانات", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "الجدول الأسبوعي", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "عرض تفاصيل الأسبوع", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "الجدول اليومي", exact: true }).click();
      if (role === "doctor" || role === "ta") {
        const departments = page.getByRole("combobox", { name: "قسم الجدول", exact: true });
        await expect(departments.locator("option")).toHaveCount(2);
        await departments.selectOption("ai");
        await expect(page.getByText("الجدول لم يُنشر بعد", { exact: true })).toBeVisible();
      }
    }
    await expect(
      page
        .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
        .getByRole("link", { name: "الإشعارات", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('footer a[target="_blank"]')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto("/profile");
    await expect(page.getByRole("tab", { name: "البيانات الأساسية", exact: true })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("tab", { name: "الصورة الشخصية", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "تغيير الصورة الشخصية", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}
test("join form offers multiple departments only for doctors and teaching assistants", async ({
  page,
}) => {
  await page.goto("/join");
  await page.locator("#j-role").click();
  await page.getByRole("button", { name: "دكتور مادة", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(7);
  await page.getByRole("checkbox").nth(1).check();
  await expect(page.getByRole("checkbox").nth(0)).toBeChecked();
  await expect(page.getByRole("checkbox").nth(1)).toBeChecked();
  await page.locator("#j-role").click();
  await page.getByRole("button", { name: "معيد", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(7);
  for (const name of ["طالب", "منسق البرنامج (رئيس قسم)"]) {
    await page.locator("#j-role").click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator("#j-dept")).toBeVisible();
  }
});
