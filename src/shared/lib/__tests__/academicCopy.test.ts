import { describe, expect, it } from "vitest";
import { getDeviceDisplayName, getFriendlyErrorMessage } from "../academicCopy";

describe("academic interface messages", () => {
  it("keeps actionable Arabic messages", () => {
    expect(getFriendlyErrorMessage("البصمة المستخدمة لا تنتمي لهذا الحساب.")).toBe(
      "البصمة المستخدمة لا تنتمي لهذا الحساب.",
    );
  });

  it.each([
    "relation webauthn_credentials does not exist",
    "فشل الاتصال بقاعدة البيانات",
    "تعذر التحقق باستخدام FIDO2 / WebAuthn",
    "خطأ في الخادم: HTTP 500",
    undefined,
  ])("replaces implementation details with a helpful message: %s", (message) => {
    expect(getFriendlyErrorMessage(message, "تعذر تسجيل الحضور. أعد المحاولة.")).toBe(
      "تعذر تسجيل الحضور. أعد المحاولة.",
    );
  });

  it.each([
    ["هاتف iPhone (Face ID / Touch ID)", "هاتف للدخول بالبصمة"],
    ["جهاز كمبيوتر (Windows Hello)", "كمبيوتر للدخول بالبصمة"],
    ["جهاز iPad", "جهاز لوحي للدخول بالبصمة"],
    ["مفتاح أمان بيومتري", "جهاز للدخول بالبصمة"],
  ])("simplifies previously saved device labels: %s", (label, expected) => {
    expect(getDeviceDisplayName(label)).toBe(expected);
  });
});
