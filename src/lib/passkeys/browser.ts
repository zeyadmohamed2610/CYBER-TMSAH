import { browserSupportsWebAuthn, startAuthentication, startRegistration, type PublicKeyCredentialRequestOptionsJSON, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { PasskeyError } from './errors';
import { getPasskeyVerificationDetails } from '../passkeyDiagnostics';

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && window.isSecureContext !== false && typeof navigator !== 'undefined' && Boolean(navigator.credentials) && browserSupportsWebAuthn();
}

function requireBrowser() {
  if (!isWebAuthnSupported()) throw new PasskeyError('الدخول بالبصمة غير متاح في هذا المتصفح.','UNSUPPORTED_BROWSER');
}

export type PasskeyDestination = 'device' | 'any';
export async function checkLocalPasskeyAvailability():Promise<boolean|null> {
  if(!isWebAuthnSupported())return false;
  try {
    if(typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable==='function')return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }catch {/* An unavailable capability check is not proof that registration is unsupported. */}
  return null;
}
export async function createPasskey(options: unknown, destination: PasskeyDestination = 'device') {
  requireBrowser();
  const json = options as PublicKeyCredentialCreationOptionsJSON;
  if (!json?.challenge || !json.user?.id || !json.rp?.name) throw new PasskeyError('تعذر بدء إضافة مفتاح الدخول. أعد المحاولة.','INVALID_OPTIONS');
  const {authenticatorAttachment: _attachment, ...selection} = json.authenticatorSelection ?? {};
  const {hints: _hints, ...base} = json;
  // The explicit alternative permits roaming keys; the primary action stays on this device.
  return startRegistration({optionsJSON:{...base,...(destination==='device' ? {hints:['client-device']} : {}),authenticatorSelection:{...selection,...(destination==='device' ? {authenticatorAttachment:'platform'} : {}),residentKey:'required',requireResidentKey:true,userVerification:'required'}}});
}

export async function getPasskeyAssertion(options: unknown) {
  requireBrowser();
  const json = options as PublicKeyCredentialRequestOptionsJSON;
  if (!json?.challenge) throw new PasskeyError('تعذر بدء التحقق من مفتاح الدخول. أعد المحاولة.','INVALID_OPTIONS');
  // Standard browser adapter handles serialization, transports and cancellation.
  return startAuthentication({optionsJSON:{...json,userVerification:'required'}});
}

export function logPasskeyVerification(action: string, encoded: string) {
  const binary = atob(encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'='));
  const bytes = Uint8Array.from(binary,c=>c.charCodeAt(0));
  console.warn('[WebAuthn] device verification details:',JSON.stringify({action,requestedVerification:'required',response:getPasskeyVerificationDetails(bytes.buffer)}));
}
