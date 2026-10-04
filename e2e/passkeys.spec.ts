import { chromium, expect, test } from "@playwright/test";
for (const [role, destination] of [
  ["student", "student-panel"],
  ["doctor", "doctor-dashboard"],
  ["owner", "owner-dashboard"],
  ["coordinator", "coordinator-dashboard"],
  ["ta", "ta-dashboard"],
] as const) {
  test(`@passkey ${role} registers, verifies and signs in with a real browser ceremony`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    const identifier = process.env[`E2E_${role.toUpperCase()}_IDENTIFIER`];
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
    test.skip(
      process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password,
      "Dedicated QA accounts required",
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: process.env.E2E_PASSKEY_TRANSPORT === "usb" ? "usb" : "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="identifier"]').fill(identifier!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(destination), { timeout: 30000 });
    if (role === "student") {
      const bind = page.getByRole("button", { name: "قفل هذا الجهاز والمتابعة" });
      await expect(bind.or(page.getByRole("tab").first()).first()).toBeVisible();
      if (await bind.isVisible()) await bind.click();
    }
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /الدخول بالبصمة/ }).click();
    await page
      .getByRole("button", {
        name:
          process.env.E2E_PASSKEY_TRANSPORT === "usb"
            ? "جهاز آخر أو مفتاح أمان"
            : "إضافة جهاز للدخول بالبصمة",
      })
      .click();
    await page.locator("#passkey-reauth-pass").fill(password!);
    const registered = page.waitForResponse((r) =>
      r.url().includes("/passkeys/registration/verify"),
    );
    await page.getByRole("button", { name: "تأكيد ومتابعة البصمة" }).click();
    await page
      .getByRole("button", {
        name:
          process.env.E2E_PASSKEY_TRANSPORT === "usb" ? "اختيار مكان الحفظ" : "حفظ على هذا الجهاز",
        exact: true,
      })
      .click();
    expect((await (await registered).json()).id).toBeTruthy();
    const verified = page.waitForResponse((r) =>
      r.url().includes("passkey-login?action=verify-finish"),
    );
    await page.getByRole("button", { name: "تجربة الدخول" }).click();
    expect((await (await verified).json()).success).toBe(true);
    await page.getByRole("button", { name: "تعديل الاسم" }).click();
    await page.locator("#passkey-name").fill("مفتاح اختبار الدخول");
    const renamed = page.waitForResponse(
      (r) => r.url().includes("/auth/v1/passkeys/") && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
    expect((await (await renamed).json()).friendly_name).toBe("مفتاح اختبار الدخول");
    await expect(page.getByText("مفتاح اختبار الدخول", { exact: true })).toBeVisible();
    await expect(page.getByText(/آخر استخدام:/)).toBeVisible();
    // Remove only this browser session; the virtual authenticator retains its passkey.
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await context.clearCookies();
    await cdp.send("Storage.clearDataForOrigin", {
      origin: new URL(page.url()).origin,
      storageTypes: "all",
    });
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const authenticated = page.waitForResponse((r) =>
      r.url().includes("passkey-login?action=auth-finish"),
    );
    await page.getByRole("button", { name: "الدخول بمفتاح الدخول" }).click();
    expect((await (await authenticated).json()).success).toBe(true);
    await expect(page).toHaveURL(new RegExp(destination), { timeout: 30000 });
    if (role === "student" && process.env.E2E_ATTENDANCE_CODE) {
      const bind = page.getByRole("button", { name: "قفل هذا الجهاز والمتابعة" });
      await expect(bind.or(page.getByRole("tab").first()).first()).toBeVisible();
      if (await bind.isVisible()) await bind.click();
      await page.getByRole("tab", { name: "تسجيل الحضور", exact: true }).click();
      await page.locator("#attendance-code").fill(process.env.E2E_ATTENDANCE_CODE);
      const receipt = page.waitForResponse((r) =>
        r.url().includes("passkey-login?action=attendance-finish"),
      );
      await page.getByRole("button", { name: "تحقق بالبصمة / الوجه / رمز قفل الجهاز" }).click();
      expect((await (await receipt).json()).proofId).toBeTruthy();
      const submitted = page.waitForResponse((r) => r.url().includes("/rpc/submit_attendance"));
      await page.getByRole("button", { name: "تسجيل الحضور الآن" }).click();
      expect((await submitted).ok()).toBe(true);
      await expect(page.getByText("تم تسجيل حضورك بنجاح.", { exact: true })).toBeVisible();
    }
  });
}

test("@passkey a stored credential creates a fresh session after site-data deletion and browser restart", async ({}, testInfo) => {
  test.setTimeout(120000);
  const identifier = process.env.E2E_OWNER_IDENTIFIER,
    password = process.env.E2E_OWNER_PASSWORD;
  test.skip(
    process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password,
    "Dedicated QA account required",
  );
  const launchOptions =
    process.platform === "win32"
      ? {
          executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          headless: true,
        }
      : { headless: true };
  let browser = await chromium.launch(launchOptions);
  try {
    const baseURL = testInfo.project.use.baseURL!;
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const options = {
      protocol: "ctap2" as const,
      transport: "internal" as const,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    };
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", { options });
    await page.goto("/login");
    await page.locator('input[name="identifier"]').fill(identifier!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/owner-dashboard/, { timeout: 30000 });
    await page.goto("/profile?section=passkeys");
    await page.getByRole("button", { name: "إضافة جهاز للدخول بالبصمة" }).click();
    await page.locator("#passkey-reauth-pass").fill(password!);
    const registered = page.waitForResponse((r) =>
      r.url().includes("/passkeys/registration/verify"),
    );
    await page.getByRole("button", { name: "تأكيد ومتابعة البصمة" }).click();
    await page.getByRole("button", { name: "حفظ على هذا الجهاز", exact: true }).click();
    expect((await (await registered).json()).id).toBeTruthy();
    await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
    await expect(page).toHaveURL(/login/, { timeout: 30000 });
    await page.goto("/login");
    const initialLogin = page.waitForResponse((r) => r.url().includes("action=auth-finish"));
    await page.getByRole("button", { name: "الدخول بمفتاح الدخول" }).click();
    expect((await (await initialLogin).json()).success).toBe(true);
    await expect(page).toHaveURL(/owner-dashboard/, { timeout: 30000 });
    await page.goto("/profile");
    await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
    await expect(page).toHaveURL(/login/, { timeout: 30000 });
    await page.goto("/login");
    await context.clearCookies();
    await cdp.send("Storage.clearDataForOrigin", {
      origin: new URL(baseURL).origin,
      storageTypes: "all",
    });
    // CDP authenticators live inside Chrome; preserve their state separately to simulate an OS/provider vault.
    // This proves website-storage independence, not physical hardware compatibility.
    const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
    expect(credentials).toHaveLength(1);
    await browser.close();
    browser = await chromium.launch(launchOptions);
    const reopened = await browser.newContext({ baseURL });
    const newPage = await reopened.newPage();
    const newCdp = await reopened.newCDPSession(newPage);
    await newCdp.send("WebAuthn.enable");
    const created = await newCdp.send("WebAuthn.addVirtualAuthenticator", { options });
    for (const credential of credentials)
      await newCdp.send("WebAuthn.addCredential", {
        authenticatorId: created.authenticatorId,
        credential,
      });
    await newPage.goto("/login");
    expect(
      await newPage.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith("sb-")),
      ),
    ).toEqual([]);
    const authenticated = newPage.waitForResponse((r) => r.url().includes("action=auth-finish"));
    await newPage.getByRole("button", { name: "الدخول بمفتاح الدخول" }).click();
    expect((await (await authenticated).json()).success).toBe(true);
    await expect(newPage).toHaveURL(/owner-dashboard/, { timeout: 30000 });
  } finally {
    await browser.close();
  }
});

test("@passkey failed device registration exposes a safe copyable report", async ({
  page,
  context,
}) => {
  const identifier = process.env.E2E_OWNER_IDENTIFIER,
    password = process.env.E2E_OWNER_PASSWORD;
  test.skip(
    process.env.E2E_ALLOW_LIVE_AUTH !== "1" || !identifier || !password,
    "Dedicated QA account required",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/login");
  await page.locator('input[name="identifier"]').fill(identifier!);
  await page.locator('input[name="password"]').fill(password!);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/owner-dashboard/, { timeout: 30000 });
  await page.goto("/profile?section=passkeys");
  await page.evaluate(() =>
    Object.defineProperty(navigator.credentials, "create", {
      configurable: true,
      value: async () => {
        throw new DOMException(
          "An unknown error occurred while talking to the credential manager. private@example.com",
          "NotReadableError",
        );
      },
    }),
  );
  await page.getByRole("button", { name: "إضافة جهاز للدخول بالبصمة" }).click();
  await page.locator("#passkey-reauth-pass").fill(password!);
  await page.getByRole("button", { name: "تأكيد ومتابعة البصمة" }).click();
  await page.getByRole("button", { name: "حفظ على هذا الجهاز", exact: true }).click();
  await expect(
    page.getByText("تعذر التواصل مع مدير مفاتيح الدخول على جهازك.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "كيفية اختيار مدير مفاتيح الدخول" })).toHaveAttribute(
    "href",
    "https://support.google.com/chrome/answer/14124480?hl=ar",
  );
  await page.getByRole("button", { name: "نسخ تفاصيل الخطأ", exact: true }).click();
  await expect(page.getByText("تم نسخ تفاصيل الخطأ.", { exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(copied)).toMatchObject({
    stage: "device-create",
    errorName: "NotReadableError",
    errorCode: "CREDENTIAL_MANAGER_UNAVAILABLE",
    userActivation: true,
  });
  expect(copied).not.toContain("private@example.com");
  expect(copied).not.toContain(identifier!);
});
