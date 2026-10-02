import { expect, test } from '@playwright/test';
for (const [role, destination] of [['student', 'student-panel'], ['doctor', 'doctor-dashboard'], ['owner', 'owner-dashboard'], ['coordinator', 'coordinator-dashboard'], ['ta', 'ta-dashboard']] as const) {
  test(`@passkey ${role} registers, verifies and signs in with a real browser ceremony`, async ({ page, context }) => {
    test.setTimeout(120000);
    const identifier = process.env[`E2E_${role.toUpperCase()}_IDENTIFIER`];
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
    test.skip(process.env.E2E_ALLOW_LIVE_AUTH !== '1' || !identifier || !password, 'Dedicated QA accounts required');
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await page.goto('/login', { waitUntil: "domcontentloaded" });
    await page.locator('input[name="identifier"]').fill(identifier!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(destination));
    if (role === 'student') {
      const bind = page.getByRole('button', { name: 'قفل هذا الجهاز والمتابعة' });
      await expect(bind.or(page.getByRole('tab').first())).toBeVisible();
      if (await bind.isVisible()) await bind.click();
    }
    await page.goto('/profile', { waitUntil: "domcontentloaded" });
    await page.getByRole('tab', { name: /الدخول بالبصمة/ }).click();
    await page.getByRole('button', { name: 'إضافة جهاز للدخول بالبصمة' }).click();
    await page.locator('#passkey-reauth-pass').fill(password!);
    const registered = page.waitForResponse(r => r.url().includes('passkey-login?action=register-finish'));
    await page.getByRole('button', { name: 'تأكيد ومتابعة البصمة' }).click();
    expect((await (await registered).json()).success).toBe(true);
    const verified = page.waitForResponse(r => r.url().includes('passkey-login?action=verify-finish'));
    await page.getByRole('button', { name: 'تجربة الدخول' }).click();
    expect((await (await verified).json()).success).toBe(true);
    // Remove only this browser session; the virtual authenticator retains its passkey.
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/login', { waitUntil: "domcontentloaded" });
    const authenticated = page.waitForResponse(r => r.url().includes('passkey-login?action=auth-finish'));
    await page.getByRole('button', { name: 'تسجيل الدخول بالبصمة' }).click();
    expect((await (await authenticated).json()).success).toBe(true);
    await expect(page).toHaveURL(new RegExp(destination));
    if (role === 'student' && process.env.E2E_ATTENDANCE_CODE) {
      const bind = page.getByRole('button', { name: 'قفل هذا الجهاز والمتابعة' });
      await expect(bind.or(page.getByRole('tab').first())).toBeVisible();
      if (await bind.isVisible()) await bind.click();
      await page.getByRole('tab', { name: 'تسجيل الحضور', exact: true }).click();
      await page.locator('#attendance-code').fill(process.env.E2E_ATTENDANCE_CODE);
      const receipt = page.waitForResponse(r => r.url().includes('passkey-login?action=attendance-finish'));
      await page.getByRole('button', { name: 'تحقق بالبصمة / الوجه / رمز قفل الجهاز' }).click();
      expect((await (await receipt).json()).proofId).toBeTruthy();
      const submitted = page.waitForResponse(r => r.url().includes('/rpc/submit_attendance'));
      await page.getByRole('button', { name: 'تسجيل الحضور الآن' }).click();
      expect((await submitted).ok()).toBe(true);
      await expect(page.getByText('تم تسجيل حضورك بنجاح.', { exact: true })).toBeVisible();
    }
  });
}
