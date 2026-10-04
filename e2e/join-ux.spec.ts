import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api.pwnedpasswords.com/**", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.goto("/join");
});

test("join validates locally, focuses the incorrect field and retains values", async ({ page }) => {
  const submit = page.getByRole("button", { name: "إرسال الطلب", exact: true });
  await submit.click();
  await expect(page.locator("#j-name")).toBeFocused();
  await expect(page.locator("#j-name")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#j-name").fill("Ahmed Mohamed Ali");
  await submit.click();
  await expect(page.locator("#j-email")).toBeFocused();
  await page.locator("#j-email").fill("student@example.com");
  await page.locator("#j-user").fill("invalid name");
  await submit.click();
  await expect(page.locator("#j-user")).toBeFocused();
  await expect(page.locator("#j-user-error")).toContainText("دون مسافات");
  await expect(page.locator("#j-name")).toHaveValue("Ahmed Mohamed Ali");
  await page.locator("#j-user").fill("student_name");
  await page.locator("#j-pass").fill("Example!123");
  await page.locator("#j-confirm-pass").fill("different");
  await submit.click();
  await expect(page.locator("#j-confirm-pass")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("لا يطابق");
});

test("join makes approval clear and offers a single sign-in entry", async ({ page }) => {
  await expect(
    page.getByText("اختيار الرتبة والقسم هو طلب للمراجعة", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "تسجيل الدخول", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "تسجيل الدخول", exact: true })).toHaveCount(0);
  await expect(page.locator("#j-name")).toHaveAttribute("autocomplete", "name");
  await expect(page.locator("#j-email")).toHaveAttribute("autocomplete", "email");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
});

test("valid submission accepts Arabic ID and section digits and shows server failure inline", async ({
  page,
}) => {
  let payload: Record<string, unknown> | undefined;
  await page.route("**/rest/v1/join_requests", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "service unavailable" }),
    });
  });
  await page.locator("#j-name").fill("Ahmed Mohamed Ali");
  await page.locator("#j-email").fill("student@example.com");
  await page.locator("#j-user").fill("student_name");
  await page.locator("#j-pass").fill("Example!123");
  await page.locator("#j-confirm-pass").fill("Example!123");
  await page.locator("#j-national-id").fill("٣٠٤١٠٢٦٠٢٠١٩١١");
  await page.locator("#j-sec").fill("٥");
  await page.getByRole("button", { name: "إرسال الطلب", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("احتفظنا ببياناتك");
  expect(payload).toMatchObject({ national_id: "30410260201911", section_number: 5 });
  await expect(page.locator("#j-email")).toHaveValue("student@example.com");
  await expect(page.locator("#j-name")).toBeEnabled();
});
