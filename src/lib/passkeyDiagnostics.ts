/** Non-secret header details for troubleshooting; never an authorization decision. */
export function getPasskeyVerificationDetails(authenticatorData: ArrayBuffer) {
  const bytes = new Uint8Array(authenticatorData);
  const flags = bytes.length >= 37 ? bytes[32] : undefined;
  return {
    bytes: bytes.length,
    flags: flags ?? null,
    userPresent: flags === undefined ? null : Boolean(flags & 0x01),
    userVerified: flags === undefined ? null : Boolean(flags & 0x04),
  };
}
