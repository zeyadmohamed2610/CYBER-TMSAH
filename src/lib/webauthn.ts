/** Compatibility entry point; every ceremony uses the same verified controller. */
export { registerPasskey, authenticateWithPasskey, verifyPasskeyForCurrentUser } from './passkeys/controller';
export { isWebAuthnSupported } from './passkeys/browser';
