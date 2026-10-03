import { describe, expect, it } from 'vitest';
import { getPasskeyVerificationDetails } from '../passkeyDiagnostics';

describe('non-secret authenticator header diagnostics', () => {
  it.each([1, 5, 29, 37])('reads the verification bit independently of other flags (%i)', flags => {
    const bytes = new Uint8Array(37);
    bytes[32] = flags;
    expect(getPasskeyVerificationDetails(bytes.buffer)).toEqual({bytes: 37, flags, userPresent: true, userVerified: Boolean(flags & 4)});
  });
  it('does not interpret a truncated response as a valid header', () => {
    expect(getPasskeyVerificationDetails(new ArrayBuffer(33))).toMatchObject({flags:null,userPresent:null,userVerified:null});
  });
});
