import { expect, it } from "vitest";
import { passkeyFailure } from "../passkeys/errors";
it.each(["ConstraintError", "NotSupportedError", "UnknownError", "TypeError", "NotReadableError"])(
  "does not label a %s device error as a network failure",
  (name) => {
    const failure = passkeyFailure(new DOMException("provider error", name));
    expect(failure.error).not.toMatch(/اتصال|إنترنت/);
    expect(failure.success).toBe(false);
  },
);
it.each([
  new DOMException(
    "An unknown error occurred while talking to the credential manager.",
    "NotReadableError",
  ),
  { name: "WebAuthnError", cause: { name: "NotReadableError", message: "private@example.com" } },
])(
  "identifies credential manager failures without blaming connectivity or cancellation",
  (error) => {
    const failure = passkeyFailure(error);
    expect(failure).toMatchObject({ success: false, code: "CREDENTIAL_MANAGER_UNAVAILABLE" });
    expect(failure.error).toContain("مدير مفاتيح الدخول");
    expect(failure).not.toHaveProperty("cancelled");
    expect(failure.error).not.toContain("private@example.com");
  },
);
it("recognizes a wrapped DOM error without relying on Error instance identity", () => {
  expect(
    passkeyFailure({ name: "WebAuthnError", cause: { name: "ConstraintError" } }),
  ).toMatchObject({ code: "DEVICE_REQUIREMENTS_UNAVAILABLE" });
});
it("keeps cancellation distinct from unsupported device requirements", () => {
  expect(passkeyFailure({ cause: { name: "NotAllowedError" } })).toMatchObject({ cancelled: true });
});
it("does not expose native provider messages containing account details", () => {
  expect(
    passkeyFailure(new DOMException("private-account@example.com", "UnknownError")).error,
  ).not.toContain("private-account");
});
