/** Compatibility entry point; every ceremony uses the same verified controller. */
export { registerPasskey, preparePasskeyRegistration, authenticateWithPasskey, verifyPasskeyForCurrentUser, type PreparedPasskeyRegistration } from './passkeys/controller';
export { isWebAuthnSupported, checkLocalPasskeyAvailability } from './passkeys/browser';
