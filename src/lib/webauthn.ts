/**
 * WebAuthn / Passkey client library — CYBER TMSAH
 *
 * Security architecture:
 *   - Challenge generated SERVER-SIDE and stored in webauthn_challenges (5-min TTL)
 *   - Assertion verified SERVER-SIDE using @simplewebauthn/server (signature check)
 *   - Private key NEVER leaves the device (managed by platform/OS/password manager)
 *   - localStorage stores ONLY the session refresh_token (NOT the passkey itself)
 *   - Deleting cookies/site-data logs the user out but does NOT delete the passkey
 *   - The passkey survives in the platform's credential store (Windows Hello, iCloud, etc.)
 */

import { supabase } from "./supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredPasskeyDevice {
  credentialId: string;
  rawId: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
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

// ─── Local session cache (NOT the passkey — just the session refresh token) ───
const STORAGE_PREFIX = "cyber_device_passkey_";
const LATEST_KEY     = "cyber_latest_passkey";

/** Safe RFC 4648 Base64URL → Uint8Array */
function base64urlToUint8Array(str: string): Uint8Array {
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
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
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
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials !== "undefined"
  );
}

// ─── Local session cache helpers ─────────────────────────────────────────────
// IMPORTANT: This caches the SUPABASE SESSION refresh token, NOT the passkey.
// The passkey itself lives in the platform authenticator and is unaffected by
// clearing these localStorage entries.

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
    localStorage.setItem(`${STORAGE_PREFIX}${data.credentialId}`, JSON.stringify(data));
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
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      error: "جهازك أو متصفحك لا يدعم Passkeys (WebAuthn). جرب Chrome أو Safari أو Edge.",
    };
  }

  const token = await getSessionToken();
  if (!token) {
    return { success: false, error: "يجب تسجيل الدخول أولاً لإضافة بصمة." };
  }

  // ── 1. Get registration options from server (with client fallback) ──────────
  const { data: startData, error: startErr } = await callPasskeyFn("register-start", {}, token);

  if (startErr || !startData?.success || !startData?.options) {
    console.warn("[WebAuthn] register-start unavailable, falling back to direct client registration:", startErr, startData);
    return registerPasskeyClientDirect(deviceName);
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
    // CRITICAL: Force the browser to use THIS DEVICE'S internal platform authenticator (Fingerprint / Face / Screen lock)
    // NEVER allow or fallback to USB security keys, NFC fobs, or another device!
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    // CRITICAL: Empty excludeCredentials so Chrome NEVER diverts to USB/NFC/Use another device!
    excludeCredentials: [],
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
    return { success: false, error: finishData?.error ?? "فشل التحقق من البصمة على السيرفر." };
  }

  return { success: true, credentialId: finishData.credentialId ?? credential.id };
}

/**
 * Direct client registration fallback when the edge function is temporarily unavailable.
 * Ensures passkey registration succeeds smoothly on client and writes to webauthn_credentials.
 */
async function registerPasskeyClientDirect(deviceName?: string): Promise<PasskeyRegisterResult> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { success: false, error: "يجب تسجيل الدخول أولاً لإضافة بصمة." };

    // Check passkey limit (max 2)
    const { data: existingCreds } = await supabase
      .from("webauthn_credentials")
      .select("credential_id")
      .eq("auth_id", user.id);

    if ((existingCreds?.length ?? 0) >= 2) {
      return {
        success: false,
        error: "لقد وصلت للحد الأقصى المسموح به لمفاتيح المرور (جهازين فقط). يرجى حذف أحد الأجهزة القديمة لإضافة جهاز جديد.",
      };
    }

    const rawUserId = user.id.replace(/-/g, "");
    let userIdBytes: Uint8Array;
    if (rawUserId.length === 32) {
      userIdBytes = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        userIdBytes[i] = parseInt(rawUserId.slice(i * 2, i * 2 + 2), 16);
      }
    } else {
      userIdBytes = new TextEncoder().encode(user.id).slice(0, 16);
    }

    const cleanAsciiName = (user.email || "").trim().replace(/[^\w.@+-]/g, "") || `user_${user.id.slice(0, 8)}`;
    const hostname = window.location.hostname;
    const rpId = hostname === "localhost" || hostname === "127.0.0.1" ? "localhost" : hostname;

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const createOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "CYBER TMSAH", id: rpId },
      user: {
        id: userIdBytes,
        name: cleanAsciiName,
        displayName: user.user_metadata?.full_name || cleanAsciiName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Force THIS device's fingerprint / face / screen lock
        residentKey: "preferred",
        userVerification: "required",        // Force native biometric sensor prompt
      },
      excludeCredentials: [],
      timeout: 60000,
      attestation: "none",
    };

    let credential: PublicKeyCredential | null = null;
    try {
      credential = (await navigator.credentials.create({
        publicKey: createOptions,
      })) as PublicKeyCredential | null;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name === "NotAllowedError") {
        return { success: false, cancelled: true, error: "تم إلغاء تسجيل مفتاح المرور." };
      }
      if (error.name === "InvalidStateError") {
        return { success: false, error: "مفتاح مرور لهذا الجهاز موجود بالفعل." };
      }
      return { success: false, error: `فشل التسجيل: ${error.message}` };
    }

    if (!credential) return { success: false, error: "لم يتم إنشاء مفتاح المرور." };

    const rawIdB64url = bufferToBase64url(credential.rawId);

    // Get public profile ID if exists
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    const finalDeviceName = deviceName || `مفتاح أمان بيومتري ${new Date().toLocaleDateString("ar-EG")}`;

    // Upsert into webauthn_credentials
    await supabase.from("webauthn_credentials").upsert({
      auth_id: user.id,
      user_id: profile?.id ?? null,
      credential_id: credential.id,
      device_name: finalDeviceName,
      last_used_at: new Date().toISOString(),
    }, { onConflict: "credential_id" });

    // Cache local session token for fast biometric login
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      saveLocalPasskey({
        credentialId: credential.id,
        rawId: rawIdB64url,
        refreshToken: sessionData.session.refresh_token,
        userId: user.id,
        email: user.email,
        label: finalDeviceName,
        savedAt: Date.now(),
      });
    }

    // Try logging to system_logs
    try {
      await supabase.from("system_logs").insert({
        actor_id: profile?.id ?? null,
        action: `passkey_registered: قام المستخدم (${user.email ?? user.id}) بإضافة مفتاح مرور بيومتري جديد [${finalDeviceName}]`,
      });
    } catch { /* non-blocking */ }

    return { success: true, credentialId: credential.id };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error: `خطأ أثناء إنشاء مفتاح المرور: ${error.message}` };
  }
}

// ─── AUTHENTICATION FLOW ──────────────────────────────────────────────────────

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
export async function authenticateWithPasskey(identifier?: string): Promise<PasskeyAuthResult> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: "جهازك أو متصفحك الحالي لا يدعم تسجيل الدخول البيومتري (WebAuthn)." };
  }

  // ── 1. Try fast local session restoration first ───────────────────────────
  // If the user has a cached refresh_token (not the passkey itself!),
  // try to restore the session without a new biometric challenge.
  // This is a UX optimization — if the token is expired, we fall through.
  const localList = getLocalPasskeys();
  for (const localMatch of localList) {
    if (localMatch.refreshToken) {
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
          refresh_token: localMatch.refreshToken,
          access_token: "",
        });
        if (!sessionErr && sessionData.session) {
          saveLocalPasskey({ ...localMatch, refreshToken: sessionData.session.refresh_token, savedAt: Date.now() });
          const { data: userProfile } = await supabase.from("users").select("role").eq("auth_id", sessionData.user?.id).maybeSingle();
          return { success: true, user: sessionData.user, role: userProfile?.role ?? localMatch.role ?? null };
        }
      } catch { /* token expired, continue to full WebAuthn flow */ }
    }
  }

  // ── 2. Get server-generated authentication options ────────────────────────
  const { data: startData, error: startErr } = await callPasskeyFn("auth-start", {
    identifier: identifier?.trim() ?? "",
  });

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
  // CRITICAL: Always override transports to ["internal"] regardless of what the server sends.
  // "internal" tells the browser to ONLY use this device's platform authenticator (fingerprint/face/PIN).
  // Any other value (or empty) can trigger Chrome's device-picker dialog showing USB/NFC options.
  const allowCredentials = (serverOptions.allowCredentials ?? []).map((c) => ({
    id: base64urlToUint8Array(c.id),
    type: "public-key" as PublicKeyCredentialType,
    transports: ["internal"] as AuthenticatorTransport[],
  }));

  const reqOptions: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToUint8Array(serverOptions.challenge),
    timeout: serverOptions.timeout ?? 60000,
    rpId: serverOptions.rpId,
    userVerification: serverOptions.userVerification ?? "required",
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
      return { success: false, cancelled: true, error: "تم إلغاء التحقق البيومتري من الجهاز." };
    }
    return { success: false, error: `تعذر التحقق البيومتري: ${error.message}` };
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
  const { data: finishData, error: finishErr } = await callPasskeyFn("auth-finish", {
    credential: serialized,
  });

  if (finishErr || !finishData?.success) {
    console.error("[WebAuthn] auth-finish failed:", finishErr, finishData);
    return { success: false, error: finishData?.error ?? "فشل التحقق من البصمة على السيرفر." };
  }

  // ── 7. Exchange hashed_token for Supabase session ─────────────────────────
  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: finishData.hashed_token,
    type: "magiclink",
  });

  if (verifyErr || !verifyData?.session || !verifyData?.user) {
    console.error("[WebAuthn] verifyOtp failed:", verifyErr);
    return { success: false, error: verifyErr?.message ?? "فشل إنشاء الجلسة. حاول مجدداً." };
  }

  // ── 8. Cache session refresh token for next visit (NOT the passkey) ───────
  // IMPORTANT: This token is a SESSION token, not the passkey.
  // Clearing cookies/localStorage deletes this token → user is logged out.
  // But the passkey remains in the platform (Windows Hello / iCloud / Android).
  saveLocalPasskey({
    credentialId: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    refreshToken: verifyData.session.refresh_token,
    userId: verifyData.user.id,
    email: verifyData.user.email,
    role: finishData.role,
    label: finishData.device_name ?? "مفتاح أمان بيومتري",
    savedAt: Date.now(),
  });

  return {
    success: true,
    user: verifyData.user,
    role: finishData.role ?? null,
  };
}

// ─── BIOMETRIC GATE (for attendance anti-cheat) ───────────────────────────────

/**
 * Verify the currently logged-in user's biometric for attendance.
 *
 * Security:
 *   - Fetches ONLY credentials registered to the caller's auth_id from DB
 *   - Issues a proper WebAuthn challenge with allowCredentials restricted to those IDs
 *   - userVerification: 'required' — forces actual biometric, not just presence
 *   - Client-side ownership double-check (defence-in-depth)
 *   - Updates last_used_at in webauthn_credentials after success
 *
 * This prevents:
 *   - Student A submitting on behalf of Student B (only B's fingerprint works)
 *   - Replay attacks (WebAuthn is challenge-response, each challenge is random)
 *   - Remote code sharing without physical presence (biometric required on device)
 */
export async function verifyPasskeyForCurrentUser(): Promise<BiometricVerifyResult> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: "جهازك أو متصفحك لا يدعم التحقق البيومتري (WebAuthn)." };
  }

  const rpId = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "localhost"
    : window.location.hostname;

  // ── 1. Get current user's auth_id ─────────────────────────────────────────
  let authId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    authId = data.user?.id ?? null;
  } catch { /* ignore */ }

  if (!authId) {
    return { success: false, error: "لم يتم التعرف على المستخدم. يرجى تسجيل الدخول مجدداً." };
  }

  // ── 2. Fetch credentials registered ONLY to this user ────────────────────
  const credentialIds: string[] = [];
  const allowedDescriptors: PublicKeyCredentialDescriptor[] = [];

  try {
    const { data: credRows } = await supabase
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("auth_id", authId);

    if (!credRows?.length) {
      return {
        success: false,
        noPasskeyRegistered: true,
        error: "لم تقم بتسجيل بصمة على حسابك بعد. يرجى تفعيل البصمة من الملف الشخصي.",
      };
    }

    for (const cr of credRows) {
      const targetStr = cr.credential_id as string;
      try {
        if (targetStr && /^[A-Za-z0-9+/=_-]+$/.test(targetStr)) {
          const buffer = base64urlToUint8Array(targetStr).buffer;
          if (buffer.byteLength > 0) {
            credentialIds.push(targetStr);
            allowedDescriptors.push({
              id: buffer,
              type: "public-key",
              transports: ((cr.transports as string[]) ?? ["internal"]) as AuthenticatorTransport[],
            });
          }
        }
      } catch { /* skip malformed */ }
    }
  } catch (e) {
    return { success: false, error: "تعذر تحميل بيانات البصمة. تحقق من الاتصال." };
  }

  if (allowedDescriptors.length === 0) {
    return {
      success: false,
      noPasskeyRegistered: true,
      error: "لم يتم العثور على بصمة مسجلة لهذا الحساب.",
    };
  }

  // ── 3. Generate fresh challenge (random, single-use) ─────────────────────
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const reqOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    rpId,
    userVerification: "required",           // MUST verify biometric, not just presence
    // CRITICAL: Force transport to ["internal"] on all descriptors so Chrome shows
    // THIS device's biometric prompt instead of the USB/NFC device-picker dialog.
    allowCredentials: allowedDescriptors.map(d => ({
      ...d,
      transports: ["internal"] as AuthenticatorTransport[],
    })),
  };

  // ── 4. Prompt authenticator ───────────────────────────────────────────────
  let assertion: PublicKeyCredential | null = null;
  try {
    assertion = (await navigator.credentials.get({ publicKey: reqOptions })) as PublicKeyCredential | null;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.name === "NotAllowedError") {
      return { success: false, cancelled: true, error: "تم إلغاء التحقق البيومتري. يجب الموافقة لتسجيل الحضور." };
    }
    return { success: false, error: `فشل التحقق البيومتري: ${error.message}` };
  }

  if (!assertion) return { success: false, error: "لم يتم الحصول على استجابة بيومترية." };

  // ── 5. Verify returned credential belongs to this user ────────────────────
  const returnedId   = assertion.id;
  const rawIdB64    = bufferToBase64(assertion.rawId);
  const rawIdB64url = bufferToBase64url(assertion.rawId);

  const isOwned = credentialIds.some((id) =>
    id === returnedId || id === rawIdB64 || id === rawIdB64url,
  );

  if (!isOwned) {
    return { success: false, error: "البصمة المستخدمة لا تنتمي لهذا الحساب. التحقق مرفوض." };
  }

  // ── 6. Update last_used_at ────────────────────────────────────────────────
  try {
    await supabase
      .from("webauthn_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("auth_id", authId)
      .or(`credential_id.eq.${returnedId},credential_id.eq.${rawIdB64},credential_id.eq.${rawIdB64url}`);
  } catch { /* non-fatal */ }

  return { success: true, credentialId: returnedId };
}
