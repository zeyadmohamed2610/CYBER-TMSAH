import { expect, test } from "@playwright/test";

test("login fits small phones without horizontal scroll or repeated join links", async ({
  page,
}) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await page.goto("/login");
    await expect(page.locator("#l-user")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole("tab", { name: "طلب الانضمام" })).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "الدخول بمفتاح الدخول", exact: true }),
    ).toBeVisible();
    const box = await page
      .getByRole("button", { name: "الدخول بمفتاح الدخول", exact: true })
      .boundingBox();
    expect(box!.y + box!.height).toBeLessThan(844);
    expect(await page.locator("#l-user").getAttribute("enterkeyhint")).toBe("next");
    expect(await page.locator("#l-pass").getAttribute("autocomplete")).toBe("current-password");
  }
});

test("tabs support keyboard navigation and logo links home", async ({ page }) => {
  await page.goto("/login");
  const login = page.getByRole("tab", { name: "تسجيل الدخول", exact: true });
  await login.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "طلب الانضمام" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(login).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "auth-tab-login");
  await page.getByRole("link", { name: "الصفحة الرئيسية — سايبر تمساح" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("field errors focus the field and announce the reason", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#l-user").fill("١٢٣");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.locator("#l-user")).toBeFocused();
  await expect(page.locator("#l-user")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("14");
  await page.locator("#l-user").fill("student_name");
  await expect(page.locator("#l-user")).toHaveAttribute("aria-invalid", "false");
});

test("a slow password request disables passkeys and retains the exact password", async ({
  page,
}) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let payload: unknown;
  await page.route("**/functions/v1/account-login", async (route) => {
    payload = route.request().postDataJSON();
    await wait;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Sign-in failed" }),
    });
  });
  await page.goto("/login");
  await page.locator("#l-user").fill("٣٠٤١٠٢٦٠٢٠١٩١١");
  await page.locator("#l-pass").fill("  pasted password!  ");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "الدخول بمفتاح الدخول", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#l-pass")).toHaveAttribute("readonly", "");
  release();
  await expect(page.getByRole("alert")).toContainText("تعذر الاتصال");
  expect(payload).toEqual({ identifier: "30410260201911", password: "  pasted password!  " });
  await expect(page.locator("#l-pass")).toHaveValue("  pasted password!  ");
  await expect(
    page.getByRole("button", { name: "الدخول بمفتاح الدخول", exact: true }),
  ).toBeEnabled();
});

test("remembered identifier is erased immediately", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cyber_remember_user", "saved_name"));
  await page.goto("/login");
  const remember = page.getByRole("checkbox", { name: "تذكر اسم المستخدم" });
  await expect(remember).toBeChecked();
  await remember.uncheck();
  expect(await page.evaluate(() => localStorage.getItem("cyber_remember_user"))).toBeNull();
});

test("reduced motion, enlarged text and a keyboard-sized viewport remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 400 });
  await page.goto("/login");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await page.locator("#l-pass").fill("password");
  await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
  await expect(page.locator("#l-pass")).toHaveAttribute("type", "text");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator("#auth-tab-login")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
});

test("offline sign-in preserves input and offers a connection error", async ({ page, context }) => {
  await page.goto("/login");
  await page.locator("#l-user").fill("student_name");
  await page.locator("#l-pass").fill("retry_password");
  await context.setOffline(true);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("الاتصال بالإنترنت مقطوع");
  await expect(page.locator("#l-pass")).toHaveValue("retry_password");
  await context.setOffline(false);
});

test("recovery differentiates a saved request from a failed email without sending real mail", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/rest/v1/password_reset_requests", async (route) => {
    requests++;
    await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
  });
  await page.route("**/auth/v1/recover*", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "rate limited", code: "over_email_send_rate_limit" }),
    });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "نسيت كلمة المرور؟" }).click();
  await page.locator("#reset-email").fill("test@gmail.com");
  await page.locator("#reset-phone").fill("٠١٥٥٣٤٥٠٢٣٢");
  await page.getByRole("button", { name: "إرسال طلب الاستعادة" }).click();
  await expect(page.getByRole("alert")).toContainText("لكن تعذر طلب رسالة الاستعادة");
  await expect(page.getByRole("button", { name: /أعد المحاولة بعد/ })).toBeDisabled();
  await expect(page.getByRole("link", { name: "التواصل مع الإدارة عبر واتساب" })).toBeVisible();
  expect(requests).toBe(1);
});
