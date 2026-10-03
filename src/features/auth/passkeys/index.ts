/** Compatibility entry point; every ceremony uses the same verified controller. */
export { checkLocalPasskeyAvailability, isWebAuthnSupported } from "./browser";
export {
  authenticateWithPasskey,
  preparePasskeyRegistration,
  registerPasskey,
  verifyPasskeyForCurrentUser,
  type PreparedPasskeyRegistration,
} from "./controller";
