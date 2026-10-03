import { computeFingerprint } from "@/features/attendance/utils/fingerprint";
import { getPasskeyVerificationDetails } from './passkeyDiagnostics';
/**
 * WebAuthn / Passkey client library — CYBER TMSAH
 *
 * Security architecture:
 *   - Challenge generated SERVER-SIDE and stored in webauthn_challenges (5-min TTL)
 *   - Assertion verified SERVER-SIDE using @simplewebauthn/server (signature check)
 *   - Private key NEVER leaves the device (managed by platform/OS/password manager)
 *   - The local passkey hint stores only non-secret credential metadata
 *   - Deleting cookies/site-data logs the user out but does NOT delete the passkey
 *   - The passkey survives in the platform's credential store (Windows Hello, iCloud, etc.)
 */

import { supabase } from "./supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredPasskeyDevice {
  credentialId: string;
  rawId: string;
  userId?: string;
  email?: string | undefined;
  role?: string;
  label?: string;
  savedAt: number;
}

export interface PasskeyAuthResult {
  success: boolean;
  user?: unknown;
  role?: string | null;
  error?: string;
  cancelled?: boolean;
}

export interface PasskeyRegisterResult {
  success: boolean;
  credentialId?: string;
  error?: string;
  cancelled?: boolean;
}

export interface BiometricVerifyResult {
  success: boolean;
  credentialId?: string;
  error?: string;
  cancelled?: boolean;
  noPasskeyRegistered?: boolean;
}

// ─── Non-secret local credential hints (never used to authenticate) ───
const STORAGE_PREFIX = "cyber_device_passkey_";
const LATEST_KEY     = "cyber_latest_passkey";

/** Safe RFC 4648 Base64URL → Uint8Array */
function base64urlToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded  = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary  = atob(padded);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** ArrayBuffer → standard base64 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

/** ArrayBuffer → base64url (no padding, url-safe) */
function bufferToBase64url(buffer: ArrayBuffer): string {
  return bufferToBase64(buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Feature Detection ────────────────────────────────────────────────────────

/** Returns true if WebAuthn / Passkeys are supported by this browser */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext !== false &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials !== "undefined"
  );
}

// Local hints never contain session tokens. Supabase alone manages the session.
// The private key stays in the authenticator or password manager.

export function hasLocalPasskey(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) return true;
    }
    if (localStorage.getItem(LATEST_KEY)) return true;
  } catch { /* ignore */ }
  return false;
}

/** Remove ALL locally cached passkey session tokens (does NOT delete the actual passkey from the device) */
export function clearAllLocalPasskeys(): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(LATEST_KEY);
  } catch { /* ignore */ }
}

export function saveLocalPasskey(data: StoredPasskeyDevice): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${data.credentialId}`, JSON.stringify({ ...data, refreshToken: undefined }));
    localStorage.setItem(LATEST_KEY, data.credentialId);
  } catch (err) {
    console.warn("[WebAuthn] Failed to cache session token:", err);
  }
}

export function getLocalPasskeys(): StoredPasskeyDevice[] {
  if (typeof window === "undefined") return [];
  const list: StoredPasskeyDevice[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const item = localStorage.getItem(key);
        if (item) list.push(JSON.parse(item));
      }
    }
  } catch { /* ignore */ }
  return list;
}

export function removeLocalPasskey(credentialId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${credentialId}`);
    if (localStorage.getItem(LATEST_KEY) === credentialId) {
      localStorage.removeItem(LATEST_KEY);
    }
  } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callPasskeyFn(action: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const { data, error } = await supabase.functions.invoke(`passkey-login?action=${action}`, {
    body: { action, ...body },
    headers,
  });
  return { data, error };
}

async function getSessionToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch { return null; }
}

// ─── REGISTRATION FLOW ────────────────────────────────────────────────────────

/**
 * Register a passkey/biometric for the currently logged-in user.
 *
 * Flow:
 *   1. Call edge function register-start → server generates challenge (stored in DB)
 *   2. Browser calls navigator.credentials.create() with server options
 *   3. User verifies with biometric/PIN
 *   4. Send credential to edge function register-finish → server verifies signature
 *   5. Public key + credential metadata stored in webauthn_credentials
 *
 * The private key NEVER leaves the platform authenticator.
 */
export async function registerPasskey(deviceName?: string): Promise<PasskeyRegisterResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: "الدخول بالبصمة غير متاح هنا. جرّب متصفحاً آخر.",
    };
  }

  const token = await getSessionToken();
  if (!token) {
    return { success: false, error: "يجب تسجيل الدخول أولاً لإضافة بصمة." };
  }

  // ── 1. Get registration options from server (with client fallback) ──────────
  const { data: startData, error: startErr } = await callPasskeyFn("register-start", {}, token);

  if (startErr || !startData?.success || !startData?.options) {
    console.warn("[WebAuthn] register-start unavailable:", startErr, startData);
    return { success: false, error: startData?.error ?? "تعذر إضافة جهاز الدخول. أعد المحاولة لاحقاً." };
  }

  const options = startData.options as PublicKeyCredentialCreationOptions & {
    challenge: string;
    user: { id: string; name: string; displayName: string };
    excludeCredentials?: Array<{ id: string; type: string }>;
  };

  // ── 2. Convert server options to WebAuthn format ─────────────────────────
  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlToUint8Array(options.challenge as unknown as string),
    user: {
      ...options.user,
      id: base64urlToUint8Array(options.user.id as unknown as string),
    },
    // Require a discoverable credential and user verification, as on the server.
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "required",
    },
    excludeCredentials: (options.excludeCredentials ?? []).map(c => ({ id: base64urlToUint8Array(c.id as unknown as string), type: 'public-key' as const })),
  };

  // ── 3. Prompt platform authenticator ─────────────────────────────────────
  let credential: PublicKeyCredential | null = null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn("[WebAuthn] credentials.create failed:", error.name, error.message);
    if (error.name === "NotAllowedError") {
      return { success: false, cancelled: true, error: "تم إلغاء التسجيل. اضغط 'إضافة بصمة' وأكمل التحقق." };
    }
    if (error.name === "InvalidStateError") {
      return { success: false, error: "بصمة على هذا الجهاز مسجلة مسبقاً لهذا الحساب." };
    }
    return { success: false, error: `فشل التسجيل: ${error.message}` };
  }

  if (!credential) {
    return { success: false, error: "لم يتم إنشاء بصمة. حاول مجدداً." };
  }

  // ── 4. Serialize credential for server ───────────────────────────────────
  const attestationResponse = credential.response as AuthenticatorAttestationResponse;

  const serialized = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON:   bufferToBase64url(attestationResponse.clientDataJSON),
      attestationObject: bufferToBase64url(attestationResponse.attestationObject),
      transports: attestationResponse.getTransports?.() ?? [],
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };

  // ── 5. Send to server for verification and storage ────────────────────────
  const { data: finishData, error: finishErr } = await callPasskeyFn(
    "register-finish",
    { credential: serialized, deviceName: deviceName ?? `بصمة ${new Date().toLocaleDateString("ar-EG")}` },
    token,
  );

  if (finishErr || !finishData?.success) {
    console.error("[WebAuthn] register-finish failed:", finishErr, finishData);
    return { success: false, error: finishData?.error ?? "تعذر تأكيد البصمة. أعد المحاولة." };
  }

  return { success: true, credentialId: finishData.credentialId ?? credential.id };
}


/**
 * Authenticate with a registered passkey (sign-in flow).
 *
 * Security:
 *   1. Server generates challenge → stored in DB (5-min TTL)
 *   2. Browser calls navigator.credentials.get() — platform shows available passkeys
 *   3. User authenticates with biometric/PIN
 *   4. Assertion sent to server → signature verified with stored public key
 *   5. Challenge consumed (replay-safe)
 *   6. Session created via Supabase generateLink + verifyOtp
 *
 * KEY POINT: Deleting cookies logs the user out but does NOT delete the passkey.
 * The passkey lives in the platform (Windows Hello, iCloud, Android) — not in cookies.
 */
export async function authenticateWithPasskey(identifier?: string, verificationCredentialId?: string): Promise<PasskeyAuthResult> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: "الدخول بالبصمة غير متاح على جهازك أو متصفحك الحالي." };
  }

  // Every fingerprint sign-in requires a fresh device verification.
  // ── 2. Get server-generated authentication options ────────────────────────
  const token = verificationCredentialId ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  if (verificationCredentialId && !token) return { success: false, error: 'يرجى تسجيل الدخول أولًا' };
  const { data: startData, error: startErr } = await callPasskeyFn(verificationCredentialId ? 'verify-start' : "auth-start", {
    identifier: identifier?.trim() ?? "",
    ...(verificationCredentialId ? { credentialId: verificationCredentialId } : {}),
  }, token);

  if (startErr || !startData?.success || !startData?.options) {
    console.error("[WebAuthn] auth-start failed:", startErr, startData);
    return { success: false, error: startData?.error ?? "فشل الحصول على خيارات المصادقة." };
  }

  const serverOptions = startData.options as {
    challenge: string;
    rpId?: string;
    timeout?: number;
    userVerification?: UserVerificationRequirement;
    allowCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
  };

  // ── 3. Convert to WebAuthn format ─────────────────────────────────────────
  // Transport hints come from the registered key; allow password managers and external keys.
  const allowCredentials = (serverOptions.allowCredentials ?? []).map((c) => ({
    id: base64urlToUint8Array(c.id),
    type: "public-key" as PublicKeyCredentialType,
    ...(c.transports?.length ? { transports: c.transports as AuthenticatorTransport[] } : {}),
  }));

  const reqOptions: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToUint8Array(serverOptions.challenge),
    timeout: serverOptions.timeout ?? 60000,
    ...(serverOptions.rpId ? { rpId: serverOptions.rpId } : {}),
    userVerification: "required",
    ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
  };

  // ── 4. Prompt platform authenticator ─────────────────────────────────────
  let assertion: PublicKeyCredential | null = null;
  try {
    assertion = (await navigator.credentials.get({ publicKey: reqOptions })) as PublicKeyCredential | null;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn("[WebAuthn] auth assertion failed:", error.name, error.message);
    if (error.name === "NotAllowedError") {
      return { success: false, cancelled: true, error: "تم إلغاء التحقق بالبصمة من الجهاز." };
    }
    return { success: false, error: `تعذر التحقق بالبصمة: ${error.message}` };
  }

  if (!assertion) {
    return { success: false, error: "لم يتم الحصول على استجابة. حاول مجدداً." };
  }

  // ── 5. Serialize assertion for server ────────────────────────────────────
  const assertionResp = assertion.response as AuthenticatorAssertionResponse;

  const serialized = {
    id: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON:    bufferToBase64url(assertionResp.clientDataJSON),
      authenticatorData: bufferToBase64url(assertionResp.authenticatorData),
      signature:         bufferToBase64url(assertionResp.signature),
      userHandle: assertionResp.userHandle
        ? bufferToBase64url(assertionResp.userHandle)
        : null,
    },
    clientExtensionResults: assertion.getClientExtensionResults?.() ?? {},
  };

  // ── 6. Server verifies signature and creates session ──────────────────────
  const finishAction = verificationCredentialId ? 'verify-finish' : 'auth-finish';
  const { data: finishData, error: finishErr } = await callPasskeyFn(finishAction, {
    credential: serialized,
  }, token);

  if (finishErr || !finishData?.success) {
    console.error(`[WebAuthn] ${finishAction} failed:`, finishData?.code ?? "VERIFICATION_FAILED", finishData?.error ?? finishErr?.message ?? "No response");
    if (finishData?.code === 'USER_VERIFICATION_REQUIRED') {
      console.warn('[WebAuthn] device verification details:', JSON.stringify({
        action: finishAction,
        requestedVerification: reqOptions.userVerification,
        deviceResponse: getPasskeyVerificationDetails(assertionResp.authenticatorData),
        sentResponse: getPasskeyVerificationDetails(base64urlToUint8Array(serialized.response.authenticatorData).buffer),
      }));
    }
    return { success: false, error: finishData?.error ?? "تعذر تأكيد البصمة. أعد المحاولة." };
  }

  if (verificationCredentialId) return { success: true };
  // ── 7. Exchange hashed_token for Supabase session ─────────────────────────
  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: finishData.hashed_token,
    type: "magiclink",
  });

  if (verifyErr || !verifyData?.session || !verifyData?.user) {
    console.error("[WebAuthn] verifyOtp failed:", verifyErr);
    return { success: false, error: verifyErr?.message ?? "فشل إنشاء الجلسة. حاول مجدداً." };
  }

  // Keep only a non-secret hint for the credential that actually signed in.
  saveLocalPasskey({
    credentialId: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    userId: verifyData.user.id,
    email: verifyData.user.email,
    role: finishData.role,
    label: finishData.device_name ?? "جهاز للدخول بالبصمة",
    savedAt: Date.now(),
  });

  return {
    success: true,
    user: verifyData.user,
    role: finishData.role ?? null,
  };
}

// Attendance receipts are issued only after the server verifies the signed assertion.
export async function verifyPasskeyForCurrentUser(attendanceHash: string): Promise<BiometricVerifyResult> {
  if (!isWebAuthnSupported()) return { success: false, error: "التحقق بالبصمة غير متاح على هذا الجهاز." };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { success: false, error: "يرجى تسجيل الدخول مجدداً." };
  const { data: start, error: startError } = await callPasskeyFn("attendance-start", { attendanceHash }, token);
  if (startError || !start?.success || !start.options) {
    return { success: false, ...(start?.noPasskeyRegistered ? { noPasskeyRegistered: true } : {}), error: "تعذر بدء التحقق. تأكد من اتصالك وتسجيل بصمة لحسابك." };
  }
  const options = start.options as { challenge: string; rpId?: string; allowCredentials?: { id: string; transports?: AuthenticatorTransport[] }[] };
  try {
    const assertion = await navigator.credentials.get({ publicKey: {
      challenge: base64urlToUint8Array(options.challenge),
      ...(options.rpId ? { rpId: options.rpId } : {}),
      timeout: 60000, userVerification: "required",
      allowCredentials: (options.allowCredentials ?? []).map(c => ({ id: base64urlToUint8Array(c.id), type: "public-key", ...(c.transports?.length ? { transports: c.transports } : {}) })),
    } }) as PublicKeyCredential | null;
    if (!assertion) return { success: false, cancelled: true };
    const response = assertion.response as AuthenticatorAssertionResponse;
    const { data: finish, error } = await callPasskeyFn("attendance-finish", {
      attendanceHash, deviceFingerprint: await computeFingerprint(),
      credential: { id: assertion.id, rawId: bufferToBase64url(assertion.rawId), type: assertion.type,
        response: { clientDataJSON: bufferToBase64url(response.clientDataJSON), authenticatorData: bufferToBase64url(response.authenticatorData), signature: bufferToBase64url(response.signature), userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null },
        clientExtensionResults: assertion.getClientExtensionResults(),
      },
    }, token);
    if (error || !finish?.success || typeof finish.proofId !== "string") {
      if (finish?.code === 'USER_VERIFICATION_REQUIRED') {
        console.warn('[WebAuthn] device verification details:', JSON.stringify({
          action: 'attendance-finish', requestedVerification: 'required',
          deviceResponse: getPasskeyVerificationDetails(response.authenticatorData),
          sentResponse: getPasskeyVerificationDetails(base64urlToUint8Array(bufferToBase64url(response.authenticatorData)).buffer),
        }));
        return { success: false, error: finish.error };
      }
      return { success: false, error: "تعذر تأكيد الحضور. أعد التحقق." };
    }
    return { success: true, credentialId: finish.proofId };
  } catch (error) {
    return { success: false, cancelled: error instanceof Error && error.name === "NotAllowedError", error: "لم يكتمل التحقق بالبصمة. أعد المحاولة." };
  }
}
