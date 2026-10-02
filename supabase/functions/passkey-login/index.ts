/**
 * WebAuthn Edge Function — Unified handler for all passkey ceremonies.
 *
 * Endpoints (via ?action= query param or JSON body action field):
 *   POST /functions/v1/passkey-login?action=register-start
 *   POST /functions/v1/passkey-login?action=register-finish
 *   POST /functions/v1/passkey-login?action=auth-start
 *   POST /functions/v1/passkey-login?action=auth-finish
 *
 * Security:
 *   - Challenges are generated server-side with crypto.getRandomValues
 *   - Challenges stored in DB with 5-min TTL and consumed on first use
 *   - Signature verified using @simplewebauthn/server
 *   - Private key NEVER touches the server
 */

import { createSupabaseContext } from "npm:@supabase/server@1.8.0";
import { createAdminClient } from "npm:@supabase/server@1.8.0/core";
import { readAssertionChallenge } from "../_shared/passkeyChallenge.ts";
import { Buffer } from "node:buffer";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "npm:@simplewebauthn/server@13.3.2";

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getOrigin(req?: Request): string | string[] {
  const envOrigin = Deno.env.get("WEBAUTHN_ORIGIN");
  const requestOrigin = req?.headers.get("origin") ?? "";

  const allowedOrigins = [
    "https://cyber-tmsah.vercel.app",
    "https://www.cyber-tmsah.site",
    "https://cyber-tmsah.site",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ];
  if (envOrigin && !allowedOrigins.includes(envOrigin)) {
    allowedOrigins.push(envOrigin);
  }

  if (requestOrigin) {
    try {
      const u = new URL(requestOrigin);
      if (
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        allowedOrigins.includes(requestOrigin)
      ) {
        if (!allowedOrigins.includes(requestOrigin)) {
          allowedOrigins.push(requestOrigin);
        }
        return requestOrigin;
      }
    } catch { /* ignore */ }
  }

  return allowedOrigins;
}

function getRpId(req?: Request): string {
  const envRpId = Deno.env.get("WEBAUTHN_RP_ID");
  if (envRpId) return envRpId;
  const requestOrigin = req?.headers.get("origin") ?? "";
  if (requestOrigin) {
    try {
      const u = new URL(requestOrigin);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        return "localhost";
      }
      return u.hostname;
    } catch { /* ignore */ }
  }
  return "www.cyber-tmsah.site";
}

function getExpectedRpIds(req?: Request): string[] {
  const current = getRpId(req);
  return Array.from(new Set([
    current,
    "cyber-tmsah.site",
    "www.cyber-tmsah.site",
    "cyber-tmsah.vercel.app",
    "localhost",
  ]));
}

function getRpName(): string {
  return Deno.env.get("WEBAUTHN_RP_NAME") ?? "CYBER TMSAH";
}

export async function handlePasskeyRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = (url.searchParams.get("action") ?? body.action ?? "") as string;

  try {
    const serverEnv = {
      ...(Deno.env.get("APP_SUPABASE_PUBLISHABLE_KEY") ? { publishableKeys: { default: Deno.env.get("APP_SUPABASE_PUBLISHABLE_KEY")! } } : {}),
      ...(Deno.env.get("APP_SUPABASE_SECRET_KEY") ? { secretKeys: { default: Deno.env.get("APP_SUPABASE_SECRET_KEY")! } } : {}),
    };
    const admin = createAdminClient({ env: serverEnv });
    // ──────────────────────────────────────────────────────────────────────
    // REGISTER-START: generate registration options + store challenge
    // ──────────────────────────────────────────────────────────────────────
    if (action === "register-start") {
      const { data: context, error: contextError } = await createSupabaseContext(req, { auth: "user", env: serverEnv });
      if (contextError || !context) return json({ success: false, error: "Unauthorized" }, 401);
      const { data: { user }, error: authErr } = await context.supabase.auth.getUser();
      if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

      // Fetch existing credentials to exclude (prevent re-registration)
      const { data: existingCreds } = await admin
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("auth_id", user.id);

      // Enforce limit of 2 passkeys per student/user
      if ((existingCreds?.length ?? 0) >= 2) {
        return json({
          success: false,
          error: "لقد وصلت للحد الأقصى المسموح به لمفاتيح المرور (جهازين فقط). يرجى حذف أحد الأجهزة القديمة لإضافة جهاز جديد.",
        });
      }

      const excludeCredentials = (existingCreds ?? []).flatMap((c) => {
        try {
          return [{ id: c.credential_id as string, type: "public-key" as const }];
        } catch { return []; }
      });

      const userName = user.email ?? user.id;
      const userDisplayName = user.user_metadata?.full_name ?? userName;

      const options = await generateRegistrationOptions({
        rpName: getRpName(),
        rpID: getRpId(req),
        userID: new TextEncoder().encode(user.id),
        userName,
        userDisplayName,
        timeout: 60000,
        attestationType: "none",
        excludeCredentials,
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",        // Force fingerprint / face ID prompt
        },
        supportedAlgorithmIDs: [-7, -257], // ES256, RS256
      });

      // Store challenge in DB (5-min TTL)
      const { error: insertErr } = await admin.from("webauthn_challenges").insert({
        challenge: options.challenge,
        auth_id: user.id,
        type: "registration",
        purpose: "registration",
      });
      if (insertErr) {
        console.error("[passkey-login] challenge insert failed:", insertErr);
        return json({ success: false, error: "Failed to create challenge" });
      }

      return json({ success: true, options });
    }

    // ──────────────────────────────────────────────────────────────────────
    // REGISTER-FINISH: verify registration + store credential
    // ──────────────────────────────────────────────────────────────────────
    if (action === "register-finish") {
      const { data: context, error: contextError } = await createSupabaseContext(req, { auth: "user", env: serverEnv });
      if (contextError || !context) return json({ success: false, error: "Unauthorized" }, 401);
      const { data: { user }, error: authErr } = await context.supabase.auth.getUser();
      if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

      const { credential, deviceName } = body as {
        credential: Record<string, unknown>;
        deviceName?: string;
      };

      // Fetch + consume the challenge
      const { data: challengeRows, error: fetchErr } = await admin
        .from("webauthn_challenges")
        .select("id, challenge")
        .eq("auth_id", user.id)
        .eq("type", "registration")
        .gt("expires_at", new Date().toISOString())
        .eq("challenge", readAssertionChallenge(credential))
        .limit(1);

      if (fetchErr || !challengeRows?.length) {
        return json({ success: false, error: "Challenge expired or not found. Please try again." });
      }

      const { id: challengeId, challenge } = challengeRows[0];



      // Verify the registration response cryptographically
      let verification: VerifiedRegistrationResponse;
      try {
        verification = await verifyRegistrationResponse({
          response: credential as unknown as Parameters<typeof verifyRegistrationResponse>[0]["response"],
          expectedChallenge: challenge,
          expectedOrigin: getOrigin(req),
          expectedRPID: getExpectedRpIds(req),
          requireUserVerification: true,
        });
      } catch (err) {
        console.error("[passkey-login] registration verification failed:", err);
        return json({ success: false, error: `Verification failed: ${(err as Error).message}` });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return json({ success: false, error: "Registration verification failed" });
      }

      const { data: consumed, error: consumeError } = await admin.from("webauthn_challenges")
        .delete().eq("id", challengeId).gt("expires_at", new Date().toISOString()).select("id");
      if (consumeError || consumed?.length !== 1) return json({ success: false, error: "Challenge already used" }, 409);
      const {
        credential: registeredCredential,
        aaguid,
      } = verification.registrationInfo;

      const credId = registeredCredential.id;
      const pubKeyB64 = uint8ArrayToBase64Url(registeredCredential.publicKey);

      // Get user's public.users record
      const { data: publicUser } = await admin
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      // Transports reported by browser, defaulting to "internal"
      const clientResp = credential.response as Record<string, unknown> | undefined;
      const clientTransports = clientResp?.transports as string[] | undefined;
      const validTransports = (clientTransports && clientTransports.length > 0) ? clientTransports : ["internal"];

      // Store credential
      const { error: upsertErr } = await admin.from("webauthn_credentials").insert({
        auth_id: user.id,
        user_id: publicUser?.id ?? null,
        credential_id: credId,
        public_key: pubKeyB64,
        sign_count: registeredCredential.counter ?? 0,
        transports: validTransports,
        aaguid: aaguid ?? null,
        device_name: deviceName ?? `جهاز بيومتري ${new Date().toLocaleDateString("ar-EG")}`,
        last_used_at: new Date().toISOString(),
      });

      if (upsertErr) {
        console.error("[passkey-login] credential upsert failed:", upsertErr);
        return json({ success: false, error: `فشل حفظ البصمة في قاعدة البيانات: ${upsertErr.message}` });
      }

      // Record security audit log entry visible to Owner
      try {
        const studentLabel = user.email ?? user.id;
        const deviceLabel = deviceName ?? "جهاز بيومتري";
        await admin.from("system_logs").insert({
          actor_id: publicUser?.id ?? null,
          action: `passkey_registered: قام الطالب (${studentLabel}) بإضافة مفتاح مرور بيومتري جديد [${deviceLabel}]`,
        });
      } catch (logErr) {
        console.warn("[passkey-login] audit log insertion warning:", logErr);
      }

      return json({ success: true, credentialId: credId });
    }

    // ──────────────────────────────────────────────────────────────────────
    // AUTH-START: generate authentication options + store challenge
    // ──────────────────────────────────────────────────────────────────────
    if (action === "auth-start" || action === "attendance-start" || action === "verify-start") {
      const { identifier } = body as { identifier?: string };

      let allowCredentials: Array<{ id: string; type: "public-key"; transports?: ("internal" | "usb" | "nfc" | "ble" | "hybrid")[] }> = [];
      let authId: string | null = null;

      let attendanceHash: string | null = null;
      if (action === "attendance-start" || action === "verify-start") {
      const { data: context, error: contextError } = await createSupabaseContext(req, { auth: "user", env: serverEnv });
      if (contextError || !context) return json({ success: false, error: "Unauthorized" }, 401);
      const { data: { user }, error: authErr } = await context.supabase.auth.getUser();
      if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);
        authId = user.id;
        if (action === 'attendance-start') {
          attendanceHash = typeof body.attendanceHash === "string" ? body.attendanceHash.trim() : "";
          if (!/^[0-9]{6}$/.test(attendanceHash)) return json({ success: false, error: "Invalid attendance code" }, 400);
        }
        const { data: creds, error: credsError } = await admin.from("webauthn_credentials")
          .select("credential_id, transports").eq("auth_id", user.id).not("public_key", "is", null);
        if (credsError) return json({ success: false, error: "Could not load credentials" }, 503);
        if (!creds?.length) return json({ success: false, noPasskeyRegistered: true, error: "سجل بصمة لحسابك أولاً." });
        const selected = action === 'verify-start' ? creds.filter(c => c.credential_id === body.credentialId) : creds;
        if (!selected.length) return json({ success: false, error: 'Credential does not belong to your account' }, 403);
        allowCredentials = selected.map(c => ({ id: c.credential_id as string, type: "public-key" as const, transports: (c.transports ?? []) as AuthenticatorTransport[] }));
      }
      // If identifier provided, restrict to that user's credentials
      if (action === "auth-start" && identifier?.trim()) {
        const clean = identifier.trim().toLowerCase();
        if (!/^[a-z0-9@._+-]+$/.test(clean)) return json({ success: false, error: "Invalid identifier" }, 400);
        const { data: uRow } = await admin
          .from("users")
          .select("auth_id")
          .or(`email.eq.${clean},national_id.eq.${clean},username.eq.${clean}`)
          .maybeSingle();

        if (uRow?.auth_id) {
          authId = uRow.auth_id;
          const { data: creds } = await admin
            .from("webauthn_credentials")
            .select("credential_id, transports")
            .eq("auth_id", authId);

          if (!creds || creds.length === 0) {
            return json({
              success: false,
              error: "لا توجد بصمة مسجلة لهذا الحساب. يرجى تسجيل الدخول بكلمة المرور أولاً وإضافة البصمة من الملف الشخصي.",
            });
          }

          allowCredentials = creds.map((c) => ({
            id: c.credential_id as string,
            type: "public-key" as const,
            // Preserve authenticator transports, including synced/cross-device passkeys.
            transports: (c.transports ?? []) as AuthenticatorTransport[],
          }));
        } else {
          return json({
            success: false,
            error: "الحساب غير موجود. يرجى التحقق من اسم المستخدم أو البريد الإلكتروني.",
          });
        }
      }

      const options = await generateAuthenticationOptions({
        rpID: getRpId(req),
        timeout: 60000,
        // CRITICAL: "required" forces biometric/PIN, never just presence.
        // "preferred" can silently fall back to no-UV and confuse the browser into showing a device picker.
        userVerification: "required",
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      });

      // Store challenge (no auth_id if discoverable/usernameless)
      const { error: challengeError } = await admin.from("webauthn_challenges").insert({
        challenge: options.challenge,
        auth_id: authId ?? null,
        type: "authentication",
        attendance_hash: attendanceHash,
        purpose: action === 'attendance-start' ? 'attendance' : action === 'verify-start' ? 'verify' : 'login',
      });
      if (challengeError) return json({ success: false, error: "Could not create challenge" }, 503);

      return json({ success: true, options });
    }

    // ──────────────────────────────────────────────────────────────────────
    // AUTH-FINISH: verify assertion + create session
    // ──────────────────────────────────────────────────────────────────────
    if (action === "auth-finish" || action === "attendance-finish" || action === "verify-finish") {
      const { credential } = body as { credential: Record<string, unknown> };
      if (!credential) return json({ success: false, error: "Missing credential" });

      const credentialId = credential.id as string ?? credential.rawId as string;
      if (!credentialId) return json({ success: false, error: "Missing credential ID" });

      // Find the stored credential (try all base64 variants)
      const variants = [
        credentialId,
        credentialId.replace(/-/g, "+").replace(/_/g, "/"),
        credentialId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      ];

      const { data: credRows } = await admin
        .from("webauthn_credentials")
        .select("id, auth_id, user_id, credential_id, public_key, sign_count, transports, device_name")
        .in("credential_id", variants)
        .limit(1);

      if (!credRows?.length || !credRows[0].public_key) {
        return json({
          success: false,
          error: "مفتاح المرور غير مسجل أو لم يتم التحقق منه بعد. يرجى التسجيل من الملف الشخصي.",
        });
      }

      const storedCred = credRows[0];

      // Select this assertion's exact server-issued challenge, never another user's.
      const { data: challengeRows } = await admin
        .from("webauthn_challenges")
        .select("id, challenge, auth_id, attendance_hash, purpose")
        .eq("type", "authentication")
        .gt("expires_at", new Date().toISOString())
        .eq("challenge", readAssertionChallenge(credential))
        .limit(1);

      if (!challengeRows?.length) {
        return json({ success: false, error: "Challenge expired. Please try again." });
      }

      const { id: challengeId, challenge } = challengeRows[0];

      const storedChallenge = challengeRows[0];
      if (storedChallenge.auth_id && storedChallenge.auth_id !== storedCred.auth_id) return json({ success: false, error: "Account mismatch" }, 403);
      const attendanceFlow = action === "attendance-finish";
      const expectedPurpose = attendanceFlow ? 'attendance' : action === 'verify-finish' ? 'verify' : 'login';
      if ((storedChallenge.purpose ?? (storedChallenge.attendance_hash ? 'attendance' : 'login')) !== expectedPurpose) return json({ success: false, error: 'Challenge purpose mismatch' }, 403);
      if (attendanceFlow !== Boolean(storedChallenge.attendance_hash)) return json({ success: false, error: "Challenge purpose mismatch" }, 403);
      if (attendanceFlow || action === 'verify-finish') {
      const { data: context, error: contextError } = await createSupabaseContext(req, { auth: "user", env: serverEnv });
      if (contextError || !context) return json({ success: false, error: "Unauthorized" }, 401);
      const { data: { user }, error: authErr } = await context.supabase.auth.getUser();
      if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);
        if (user.id !== storedCred.auth_id || attendanceFlow && storedChallenge.attendance_hash !== body.attendanceHash) return json({ success: false, error: "Account mismatch" }, 403);
      }

      // Decode stored public key
      let publicKeyBuffer: Uint8Array<ArrayBuffer>;
      try {
        const b64 = storedCred.public_key as string;
        const clean = b64.replace(/-/g, "+").replace(/_/g, "/");
        const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
        publicKeyBuffer = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
      } catch (err) {
        return json({ success: false, error: "Invalid stored public key" });
      }

      // Verify the authentication assertion
      let verification: VerifiedAuthenticationResponse;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential as unknown as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
          expectedChallenge: challenge,
          expectedOrigin: getOrigin(req),
          expectedRPID: getExpectedRpIds(req),
          requireUserVerification: true,
          credential: {
            id: storedCred.credential_id as string,
            publicKey: publicKeyBuffer,
            counter: Number(storedCred.sign_count ?? 0),
            transports: (storedCred.transports as Parameters<typeof verifyAuthenticationResponse>[0]["credential"]["transports"]) ?? ["internal"],
          },
        });
      } catch (err) {
        console.error("[passkey-login] authentication verification failed:", err);
        return json({ success: false, error: `Authentication failed: ${(err as Error).message}` });
      }

      if (!verification.verified) {
        return json({ success: false, error: "Authentication verification failed" });
      }

      // Only one concurrent request can consume this verified ceremony.
      const { data: consumed, error: consumeError } = await admin.from("webauthn_challenges")
        .delete().eq("id", challengeId).gt("expires_at", new Date().toISOString()).select("id");
      if (consumeError || consumed?.length !== 1) return json({ success: false, error: "Challenge already used" }, 409);
      const { data: updated, error: counterError } = await admin.from("webauthn_credentials")
        .update({ sign_count: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq("id", storedCred.id).eq("sign_count", storedCred.sign_count ?? 0).select("id");
      if (counterError || updated?.length !== 1) return json({ success: false, error: "Credential changed; retry verification" }, 409);
      if (action === 'verify-finish') return json({ success: true, credentialId: storedCred.credential_id });
      if (attendanceFlow) {
        const fingerprint = body.deviceFingerprint;
        if (typeof fingerprint !== "string" || !/^(?:[a-f0-9]{64}|fb[a-f0-9]{16})$/i.test(fingerprint)) return json({ success: false, error: "Invalid device" }, 400);
        const { data: proof, error: proofError } = await admin.from("attendance_biometric_proofs").insert({
          auth_id: storedCred.auth_id, attendance_hash: storedChallenge.attendance_hash,
          device_fingerprint: fingerprint, credential_id: storedCred.credential_id,
        }).select("id").single();
        if (proofError || !proof) return json({ success: false, error: "Could not confirm attendance" }, 503);
        await admin.from("attendance_biometric_proofs").delete().lt("expires_at", new Date().toISOString());
        return json({ success: true, proofId: proof.id });
      }
      // Fetch user info
      const authId = storedCred.auth_id as string;
      const { data: authUserData } = await admin.auth.admin.getUserById(authId);
      if (!authUserData?.user?.email) {
        return json({ success: false, error: "تعذر العثور على بيانات المستخدم." });
      }

      const email = authUserData.user.email;
      const { data: publicProfile } = await admin
        .from("users")
        .select("id, role, full_name")
        .eq("auth_id", authId)
        .maybeSingle();

      const role = publicProfile?.role ?? authUserData.user.app_metadata?.role ?? "student";
      const fullName = publicProfile?.full_name ?? authUserData.user.user_metadata?.full_name ?? "";

      // Create session via magic link token
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkError || !linkData?.properties?.hashed_token) {
        return json({ success: false, error: "فشل إنشاء الجلسة. حاول مرة أخرى." });
      }

      return json({
        success: true,
        hashed_token: linkData.properties.hashed_token,
        email,
        role,
        full_name: fullName,
        device_name: storedCred.device_name,
      });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[passkey-login] Unexpected error:", message);
    return json({ success: false, error: `حدث خطأ داخلي: ${message}` });
  }
}

if (typeof Deno !== "undefined") Deno.serve(handlePasskeyRequest);
