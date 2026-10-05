import { expect, test } from "@playwright/test";
const roles = ["owner", "coordinator", "doctor", "ta"] as const;
for (const role of roles) {
  for (const kind of role === "doctor"
    ? ["lecture"]
    : role === "ta"
      ? ["section"]
      : ["lecture", "section"]) {
    test(`@session ${role} creates and starts a ${kind} with its correct section`, async ({
      page,
      context,
    }) => {
      test.setTimeout(90000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.url().includes("supabase.co") && response.status() >= 400)
          errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      const identifier = process.env[`E2E_${role.toUpperCase()}_IDENTIFIER`];
      const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
      test.skip(
        process.env.E2E_ALLOW_LIVE_AUTH !== "1" ||
          !identifier ||
          !password ||
          !process.env.E2E_SESSION_RUN,
        "Dedicated fixtures required",
      );
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: 30, longitude: 31 });
      await page.goto("/login");
      await page.locator("input[name=identifier]").fill(identifier!);
      await page.locator("input[name=password]").fill(password!);
      await page.locator("button[type=submit]").click();
      await expect(page).toHaveURL(new RegExp(role + "-dashboard"), { timeout: 30000 });
      await page.goto(`/${role}-dashboard?tab=lectures`);
      await page
        .getByRole("button", { name: role === "ta" ? "سكشن جديد" : "حصة جديدة", exact: true })
        .click();
      if (role === "owner" || role === "coordinator")
        await page.locator("#unit-kind").selectOption(kind);
      if (kind === "section") await page.locator("#unit-section").selectOption("15");
      if (await page.locator("#lecture-subject").isVisible()) {
        await page.locator("#lecture-subject").click();
        await page.getByRole("option", { name: /مادة اختبار الحضور/ }).click();
      }
      const title = `${process.env.E2E_SESSION_RUN} ${role} ${kind} ${test.info().project.name}`;
      await page.getByLabel("عنوان الحصة").fill(title);
      const create = page.waitForResponse((response) =>
        response.url().includes("/rpc/create_lecture"),
      );
      await page.getByRole("button", { name: "انشاء", exact: true }).click();
      expect((await create).ok()).toBe(true);
      await page.getByRole("button", { name: "عرض المحاضرة " + title, exact: true }).click();
      if (kind === "section")
        await expect(page.getByRole("combobox").filter({ hasText: "سكشن 15" })).toBeDisabled();
      const started = page.waitForResponse((response) =>
        response.url().includes("/rpc/generate_rotating_hash"),
      );
      await page.getByRole("spinbutton", { name: "نطاق الحضور حول القاعة بالمتر" }).fill("75");
      await page.getByRole("button", { name: "بدء جلسة الحضور", exact: true }).click();
      const response = await started;
      expect(response.ok()).toBe(true);
      const session = await response.json();
      expect(session.radius_meters).toBe(75);
      expect(session.latitude).toBe(30);
      expect(session.longitude).toBe(31);
      expect(session.section).toBe(kind === "section" ? "15" : null);
      await expect(page.getByRole("button", { name: "نسخ رمز الحضور", exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      const duration = page.waitForResponse((r) =>
        r.url().includes("/rpc/update_session_duration"),
      );
      await page.getByRole("spinbutton", { name: "مدة الجلسة بالدقائق" }).fill("25");
      await page.getByRole("button", { name: "تطبيق", exact: true }).click();
      expect((await duration).ok()).toBe(true);
      const stopped = page.waitForResponse((r) => r.url().includes("/rpc/stop_session"));
      await page.getByRole("button", { name: /إيقاف الجلسة فور/ }).click();
      expect((await stopped).ok()).toBe(true);
      await expect(
        page.getByRole("button", { name: "بدء جلسة الحضور", exact: true }),
      ).toBeVisible();
      const end = page.waitForResponse((response) => response.url().includes("/rpc/end_lecture"));
      // The compact mobile action is icon-only; its button still contains the accessible hidden label.
      const endButton = page.getByRole("button", { name: "إنهاء المحاضرة", exact: true });
      if (await endButton.count()) await endButton.click();
      else
        await page
          .locator("button")
          .filter({ has: page.locator("svg.lucide-stop-circle") })
          .first()
          .click();
      await page
        .getByRole("dialog", { name: "إنهاء المحاضرة" })
        .getByRole("button", { name: "إنهاء المحاضرة", exact: true })
        .click();
      expect((await end).ok()).toBe(true);
      expect(errors, "Successful session operations must have no browser/backend errors").toEqual(
        [],
      );
    });
  }
}
