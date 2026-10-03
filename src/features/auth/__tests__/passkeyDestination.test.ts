import { beforeEach, expect, it, vi } from "vitest";
import { checkLocalPasskeyAvailability, createPasskey } from "../passkeys/browser";
const options = {
  challenge: "Y2hhbGxlbmdl",
  rp: { name: "CYBER TMSAH", id: "www.cyber-tmsah.site" },
  user: { id: "dXNlcg", name: "student", displayName: "Student" },
  pubKeyCredParams: [{ alg: -7, type: "public-key" as const }],
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform" as const,
    userVerification: "preferred" as const,
  },
  hints: ["hybrid"],
};
beforeEach(() => {
  vi.stubGlobal("PublicKeyCredential", class {});
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: {
      create: vi.fn().mockResolvedValue({
        id: "key",
        rawId: new ArrayBuffer(1),
        type: "public-key",
        response: {
          clientDataJSON: new ArrayBuffer(1),
          attestationObject: new ArrayBuffer(1),
          getTransports: () => ["internal"],
        },
        getClientExtensionResults: () => ({}),
      }),
    },
  });
});
it("asks for this device while retaining required verification and discoverability", async () => {
  await createPasskey(options);
  expect(navigator.credentials.create).toHaveBeenCalledWith(
    expect.objectContaining({
      publicKey: expect.objectContaining({
        hints: ["client-device"],
        authenticatorSelection: expect.objectContaining({
          authenticatorAttachment: "platform",
          residentKey: "required",
          requireResidentKey: true,
          userVerification: "required",
        }),
      }),
    }),
  );
});
it("permits native external-device and security-key choices only through the explicit alternative", async () => {
  await createPasskey(options, "any");
  const request = vi.mocked(navigator.credentials.create).mock.calls[0]![0]!.publicKey!;
  expect(request.authenticatorSelection).not.toHaveProperty("authenticatorAttachment");
  expect(request).not.toHaveProperty("hints");
  expect(request.authenticatorSelection?.userVerification).toBe("required");
});
it("does not silently retry a rejected local ceremony using another device", async () => {
  vi.mocked(navigator.credentials.create).mockRejectedValue(
    new DOMException("Unavailable or cancelled", "NotAllowedError"),
  );
  await expect(createPasskey(options)).rejects.toThrow();
  expect(navigator.credentials.create).toHaveBeenCalledTimes(1);
});
it.each([true, false])(
  "reports local availability %s without opening a prompt",
  async (available) => {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = vi
      .fn()
      .mockResolvedValue(available);
    expect(await checkLocalPasskeyAvailability()).toBe(available);
    expect(navigator.credentials.create).not.toHaveBeenCalled();
  },
);
it("treats a missing capability API as unknown rather than blocking registration", async () => {
  expect(await checkLocalPasskeyAvailability()).toBeNull();
});
it("treats a rejected capability check as unknown rather than a network failure", async () => {
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = vi
    .fn()
    .mockRejectedValue(new Error("unavailable"));
  expect(await checkLocalPasskeyAvailability()).toBeNull();
});
