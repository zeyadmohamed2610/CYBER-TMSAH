/** Match the server's new-password policy; existing passwords remain usable for sign-in. */
export function newPasswordError(password: string, lang = "ar"): string | null {
  if (Array.from(password).length < 8) {
    return lang === "ar" ? "كلمة المرور يجب ألا تقل عن 8 أحرف." : "Use at least 8 characters.";
  }
  if (new TextEncoder().encode(password).length > 72) {
    return lang === "ar"
      ? "كلمة المرور طويلة جدًا؛ الحد الأقصى 72 بايت."
      : "Password must not exceed 72 bytes.";
  }
  const symbols = password.replace(/[A-Za-z0-9]/g, "");
  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!-~]/.test(symbols)
  ) {
    return lang === "ar"
      ? "استخدم حرفًا إنجليزيًا كبيرًا وآخر صغيرًا ورقمًا ورمزًا."
      : "Include uppercase and lowercase letters, a digit and a symbol.";
  }
  return null;
}
