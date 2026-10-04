import { expect, it } from "vitest";
import { getLoginDestination, normalizeDigits, normalizeIdentifier } from "../utils/loginInput";

it("normalizes Arabic and Persian digits and identifier prefixes", () => {
  expect(normalizeIdentifier(" @٣٠٤١٠٢٦٠٢٠١٩١١ ")).toBe("30410260201911");
  expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
});
it.each(["owner", "coordinator", "doctor", "ta", "student"] as const)(
  "preserves a permitted profile URL for %s",
  (role) => {
    expect(getLoginDestination(role, "/profile?tab=passkeys#settings")).toBe(
      "/profile?tab=passkeys#settings",
    );
  },
);
it.each([
  "https://evil.test/profile",
  "//evil.test/profile",
  "//[",
  "/\\evil.test/profile",
  "/login",
  "/owner-dashboard",
  "/unknown",
  "/%2f%2fevil.test",
  "/profile\n",
])("rejects an unsafe or unauthorized student destination: %s", (path) => {
  expect(getLoginDestination("student", path)).toBe("/student-panel");
});
it("keeps the query and fragment of the account's own dashboard", () => {
  expect(getLoginDestination("owner", "/owner-dashboard?tab=users#pending")).toBe(
    "/owner-dashboard?tab=users#pending",
  );
});
