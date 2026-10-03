import { expect, it } from "vitest";
import { registrationDiagnostic } from "../passkeys/registrationDiagnostics";
it("copies only diagnostic metadata and redacts secrets from error text", () => {
  const report = registrationDiagnostic(
    {
      name: "TypeError",
      message: "private@example.com " + "a".repeat(80) + " https://example.com/?token=secret",
      credential: "credential-secret",
      session: "session-secret",
    },
    {
      rp: { id: "www.cyber-tmsah.site" },
      challenge: "challenge-secret",
      user: { id: "user-secret" },
    },
    "device",
    true,
  );
  const text = JSON.stringify(report);
  for (const value of [
    "private@example.com",
    "a".repeat(80),
    "token=secret",
    "credential-secret",
    "session-secret",
    "challenge-secret",
    "user-secret",
  ])
    expect(text).not.toContain(value);
  expect(report).toMatchObject({
    stage: "device-create",
    errorName: "TypeError",
    userActivation: true,
    rpId: "www.cyber-tmsah.site",
  });
});
it("preserves a wrapped native error name and code without its response payload", () => {
  expect(
    registrationDiagnostic(
      {
        name: "WebAuthnError",
        code: "ERROR_CEREMONY_ABORTED",
        cause: { name: "AbortError", message: "Aborted" },
        response: { credential: "secret" },
      },
      {},
      "device",
      false,
    ),
  ).toMatchObject({
    errorName: "AbortError",
    errorCode: "ERROR_CEREMONY_ABORTED",
    message: "Aborted",
  });
});
