import { expect, test } from "@playwright/test";

for (const [role, destination] of [
  ["student", "student-panel"],
  ["doctor", "doctor-dashboard"],
  ["owner", "owner-dashboard"],
  ["coordinator", "coordinator-dashboard"],
  ["ta", "ta-dashboard"],
] as const) {
  test(`@auth ${role} uses scoped academic follow-up without imposed limits`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const identifier = process.env[`E2E_${role.toUpperCase()}_IDENTIFIER`];
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
    test.skip(
      process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password,
      "Dedicated QA accounts required",
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("supabase.co/rest/v1/") && response.status() >= 400)
        errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.goto("/login");
    await page.locator('input[name="identifier"]').fill(identifier!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(destination), { timeout: 30000 });
    if (role === "student") {
      const bind = page.getByRole("button", { name: "قفل هذا الجهاز والمتابعة" });
      await expect(bind.or(page.getByRole("tab").first()).first()).toBeVisible();
      if (await bind.isVisible()) await bind.click();
      await expect(page.getByRole("tab").first()).toBeVisible();
    }
    await page.goto(`/${destination}?tab=followup`);
    await expect(page.getByRole("heading", { name: "متابعة الدراسة", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "النتائج", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "الأعذار والمراجعة", exact: true }).click();
    await expect(page.getByText("لا توجد طلبات مراجعة لهذا الفصل.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^الإشعارات/ }).click();
    await expect(page.getByText("الإشعارات التي ترغب في تلقيها", { exact: true })).toBeVisible();
    if (role === "owner" || role === "coordinator") {
      await page.getByRole("button", { name: "سياسة الغياب", exact: true }).click();
      for (const field of ["max_absences", "warning_absences", "max_percent", "warning_percent"])
        await expect(page.locator(`input[name="${field}"]`)).toHaveValue("");
      await page.getByRole("button", { name: "حفظ البيانات", exact: true }).click();
      await expect(page.locator('input[name="location_retention_days"]')).toHaveValue("");
      await expect(page.locator('input[name="national_id_retention_days"]')).toHaveValue("");
      await page.getByRole("button", { name: "الفصول الدراسية", exact: true }).click();
      await expect(page.getByRole("button", { name: /إغلاق الفصل الحالي/ })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "سياسة الغياب", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "الفصول الدراسية", exact: true })).toHaveCount(
        0,
      );
    }
    await page.goto(`/${destination}?tab=followup&view=notifications`);
    await expect(page.getByText("الإشعارات التي ترغب في تلقيها", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `.private/academic-lifecycle-20261004/${role}-${info.project.name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
