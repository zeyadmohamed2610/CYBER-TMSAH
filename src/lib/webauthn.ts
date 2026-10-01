import { supabase } from "./supabaseClient";

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

const STORAGE_PREFIX = "cyber_device_passkey_";
const LATEST_KEY = "cyber_latest_passkey";

/** Safe RFC 4648 Base64URL to Uint8Array converter */
function base64urlToUint8Array(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Binary buffer to standard base64 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Binary buffer to base64url (no padding, url-safe) */
function bufferToBase64url(buffer: ArrayBuffer): string {
  return bufferToBase64(buffer)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Check if WebAuthn / Passkeys are supported by the browser and device */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials !== "undefined"
  );
}

/** Check if this device has a saved biometric/passkey session */
export function hasLocalPasskey(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) return true;
    }
    const latest = localStorage.getItem(LATEST_KEY);
    if (latest) return true;
  } catch {
    // ignore
  }
  return false;
}

/** Store local passkey device info and refresh token */
export function saveLocalPasskey(data: StoredPasskeyDevice): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${data.credentialId}`, JSON.stringify(data));
    localStorage.setItem(LATEST_KEY, data.credentialId);
  } catch (err) {
    console.warn("[WebAuthn] Failed to cache local passkey device:", err);
  }
}

/** Retrieve all local passkey devices stored on this browser */
export function getLocalPasskeys(): StoredPasskeyDevice[] {
  if (typeof window === "undefined") return [];
  const list: StoredPasskeyDevice[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const item = localStorage.getItem(key);
        if (item) {
          list.push(JSON.parse(item));
        }
      }
    }
  } catch (err) {
    console.warn("[WebAuthn] Failed to read local passkeys:", err);
  }
  return list;
}

/** Remove a local passkey device from storage */
export function removeLocalPasskey(credentialId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${credentialId}`);
    if (localStorage.getItem(LATEST_KEY) === credentialId) {
      localStorage.removeItem(LATEST_KEY);
    }
  } catch {
    // ignore
  }
}

export interface PasskeyAuthResult {
  success: boolean;
  user?: any;
  role?: string | null;
  error?: string;
  cancelled?: boolean;
}

/**
 * Authenticate with the device's native biometric authenticator (Fingerprint, Face ID, Windows Hello, PIN).
 * Uses hints: ['client-device'] so mobile devices skip the 3-option roaming selection and prompt immediately!
 */
export async function authenticateWithPasskey(identifier?: string): Promise<PasskeyAuthResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: "جهازك أو متصفحك الحالي لا يدعم تسجيل الدخول البيومتري (WebAuthn).",
    };
  }

  const rpId =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "localhost"
      : window.location.hostname;

  // 1. Gather allowed credentials
  let localList = getLocalPasskeys();

  // If user entered a username / email / national ID, attempt to pull matching credentials from Supabase
  if (identifier && identifier.trim()) {
    try {
      const cleanIdent = identifier.trim().toLowerCase();
      const { data: uRow } = await supabase
        .from("users")
        .select("id, auth_id, email, role")
        .or(`username.eq.${cleanIdent},email.eq.${cleanIdent},national_id.eq.${cleanIdent}`)
        .maybeSingle();

      if (uRow?.auth_id) {
        const { data: credRows } = await supabase
          .from("webauthn_credentials")
          .select("id, credential_id, device_name, created_at")
          .eq("auth_id", uRow.auth_id);

        if (credRows && credRows.length > 0) {
          for (const cr of credRows) {
            if (!localList.some((l) => l.credentialId === cr.credential_id)) {
              localList.push({
                credentialId: cr.credential_id,
                rawId: cr.credential_id,
                userId: uRow.id,
                email: uRow.email,
                role: uRow.role,
                label: cr.device_name || "مفتاح أمان بيومتري",
                savedAt: Date.now(),
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("[WebAuthn] Supabase credentials fetch notice:", e);
    }
  }

  // Build allowed descriptors if we have credentials
  const allowedDescriptors: PublicKeyCredentialDescriptor[] = [];
  for (const item of localList) {
    try {
      let buffer: ArrayBuffer | null = null;
      const targetStr = item.rawId || item.credentialId;
      if (targetStr && /^[A-Za-z0-9+/=_-]+$/.test(targetStr)) {
        buffer = base64urlToUint8Array(targetStr).buffer;
      }
      if (buffer && buffer.byteLength > 0) {
        allowedDescriptors.push({
          id: buffer,
          type: "public-key",
          transports: ["internal", "hybrid"] as AuthenticatorTransport[],
        });
      }
    } catch (e) {
      console.warn("[WebAuthn] Error parsing descriptor:", e);
    }
  }

  let assertion: PublicKeyCredential | null = null;
  let lastErr: Error | null = null;

  // Attempt 1: Direct platform biometric authenticator ("This Device") with client-device hint
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const reqOptions: Record<string, unknown> = {
    challenge,
    timeout: 60000,
    rpId,
    userVerification: "preferred",
    hints: ["client-device"],
  };

  if (allowedDescriptors.length > 0) {
    reqOptions.allowCredentials = allowedDescriptors;
  }

  try {
    assertion = (await navigator.credentials.get({
      publicKey: reqOptions as unknown as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;
  } catch (err: unknown) {
    lastErr = err instanceof Error ? err : new Error(String(err));
    console.warn("[WebAuthn] Biometric assertion (Attempt 1) notice:", lastErr);

    // If user actively canceled the prompt, abort gracefully
    if (lastErr.name === "NotAllowedError") {
      return {
        success: false,
        cancelled: true,
        error: "تم إلغاء عملية التحقق بالبصمة.",
      };
    }

    // Attempt 2: Fallback without transport restrictions for OEM compatibility
    if (allowedDescriptors.length > 0) {
      try {
        const challenge2 = crypto.getRandomValues(new Uint8Array(32));
        const fallbackReq: Record<string, unknown> = {
          challenge: challenge2,
          timeout: 60000,
          rpId,
          userVerification: "preferred",
          hints: ["client-device"],
          allowCredentials: allowedDescriptors.map((d) => ({ id: d.id, type: d.type })),
        };
        assertion = (await navigator.credentials.get({
          publicKey: fallbackReq as unknown as PublicKeyCredentialRequestOptions,
        })) as PublicKeyCredential | null;
      } catch (err2: unknown) {
        lastErr = err2 instanceof Error ? err2 : new Error(String(err2));
        console.warn("[WebAuthn] Biometric assertion (Attempt 2) notice:", lastErr);
      }
    }
  }

  if (!assertion) {
    if (lastErr?.name === "NotAllowedError") {
      return {
        success: false,
        cancelled: true,
        error: "تم إلغاء التحقق البيومتري من الجهاز أو لم يتم التعرف على البصمة.",
      };
    }
    return {
      success: false,
      error: "تعذر التحقق من البصمة. تأكد من تفعيل البصمة أو رمز المرور على جهازك وإضافتها من صفحة الملف الشخصي أولاً.",
    };
  }

  // ── Verification & Full Session Establishment ──
  try {
    const credId = assertion.id;
    const rawIdBase64 = bufferToBase64(assertion.rawId);
    const rawIdBase64url = bufferToBase64url(assertion.rawId);

    // 1. Fast local session restoration if this browser has an active cached refresh token
    const localMatch =
      localList.find(
        (l) =>
          l.credentialId === credId ||
          l.credentialId === rawIdBase64 ||
          l.credentialId === rawIdBase64url ||
          l.rawId === rawIdBase64 ||
          l.rawId === rawIdBase64url
      ) ||
      (localStorage.getItem(`${STORAGE_PREFIX}${credId}`)
        ? JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${credId}`)!)
        : null);

    if (localMatch?.refreshToken) {
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
          refresh_token: localMatch.refreshToken,
          access_token: "",
        });

        if (!sessionErr && sessionData.session) {
          saveLocalPasskey({
            ...localMatch,
            refreshToken: sessionData.session.refresh_token,
            savedAt: Date.now(),
          });

          await supabase.auth.getSession();

          let userRole = localMatch.role || null;
          if (!userRole) {
            const { data: userProfile } = await supabase
              .from("users")
              .select("role")
              .eq("auth_id", sessionData.user?.id)
              .maybeSingle();
            userRole = userProfile?.role || null;
          }

          return {
            success: true,
            user: sessionData.user,
            role: userRole,
          };
        }
      } catch (localErr) {
        console.warn("[WebAuthn] Local session setSession notice (will use Edge Function):", localErr);
      }
    }

    // 2. Primary Cross-Device Auth: Authenticate via passkey-login Edge Function
    // This issues an official Supabase Auth session token via verified passkey
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("passkey-login", {
        body: {
          credentialId: credId,
          rawId: rawIdBase64,
        },
      });

      if (!fnErr && fnData?.success && fnData.hashed_token) {
        // Exchange OTP token hash for full authenticated Supabase session
        const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: fnData.hashed_token,
          type: "magiclink",
        });

        if (!verifyErr && verifyData?.session && verifyData?.user) {
          // Cache fresh refresh token for instant subsequent platform biometric unlocks
          saveLocalPasskey({
            credentialId: credId,
            rawId: rawIdBase64,
            refreshToken: verifyData.session.refresh_token,
            userId: verifyData.user.id,
            email: verifyData.user.email,
            role: fnData.role,
            label: fnData.device_name || "مفتاح أمان بيومتري",
            savedAt: Date.now(),
          });

          await supabase.auth.getSession();

          return {
            success: true,
            user: verifyData.user,
            role: fnData.role || null,
          };
        }

        if (verifyErr) {
          console.error("[WebAuthn] verifyOtp failed:", verifyErr);
        }
      }

      if (fnData?.error) {
        return {
          success: false,
          error: fnData.error,
        };
      }
    } catch (edgeErr) {
      console.warn("[WebAuthn] Edge function login invocation notice:", edgeErr);
    }

    // 3. Fallback: Lookup via secure RPC passkey_lookup_user
    try {
      const { data: rpcUser } = await supabase.rpc("passkey_lookup_user", {
        p_credential_id: credId,
        p_raw_id: rawIdBase64,
      });

      if (rpcUser && rpcUser.length > 0 && rpcUser[0].auth_id) {
        const u = rpcUser[0];
        const { data: curSession } = await supabase.auth.getSession();
        if (curSession?.session && curSession.session.user.id === u.auth_id) {
          return {
            success: true,
            user: curSession.session.user,
            role: u.role,
          };
        }
      }
    } catch (rpcErr) {
      console.warn("[WebAuthn] RPC lookup notice:", rpcErr);
    }

    return {
      success: false,
      error: "مفتاح المرور تم التحقق منه ولكن الحساب غير مسجل في النظام. يرجى تسجيل الدخول بالرمز أولاً ثم تفعيل البصمة من الملف الشخصي.",
    };
  } catch (err: unknown) {
    console.error("[WebAuthn] Verification unexpected error:", err);
    return {
      success: false,
      error: "حدث خطأ أثناء معالجة بيانات البصمة.",
    };
  }
}
