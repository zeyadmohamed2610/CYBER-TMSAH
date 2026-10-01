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

import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "npm:@simplewebauthn/server@10";

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
        u.hostname.endsWith(".vercel.app") ||
        u.hostname.endsWith("cyber-tmsah.site")
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
  return "cyber-tmsah.vercel.app";
}

function getRpName(): string {
  return Deno.env.get("WEBAUTHN_RP_NAME") ?? "CYBER TMSAH";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = (url.searchParams.get("action") ?? body.action ?? "") as string;

  try {
    // ──────────────────────────────────────────────────────────────────────
    // REGISTER-START: generate registration options + store challenge
    // ──────────────────────────────────────────────────────────────────────
    if (action === "register-start") {
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ success: false, error: "Unauthorized" }, 401);

      // Verify the JWT to get the calling user
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) return json({ success: false, error: "Unauthorized — invalid session" }, 401);

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
        excludeCredentials: [], // Never exclude platform authenticator so user is never prompted for USB/NFC
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Force this device's biometric scanner
          residentKey: "preferred",
          userVerification: "required",        // Force fingerprint / face ID prompt
        },
        supportedAlgorithmIDs: [-7, -257], // ES256, RS256
      });

      // Store challenge in DB (5-min TTL)
      const { error: insertErr } = await admin.from("webauthn_challenges").insert({
        challenge: options.challenge,
        auth_id: user.id,
        type: "registration",
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
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ success: false, error: "Unauthorized" }, 401);

      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
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
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchErr || !challengeRows?.length) {
        return json({ success: false, error: "Challenge expired or not found. Please try again." });
      }

      const { id: challengeId, challenge } = challengeRows[0];

      // Delete challenge immediately (single-use)
      await admin.from("webauthn_challenges").delete().eq("id", challengeId);

      // Verify the registration response cryptographically
      let verification: VerifiedRegistrationResponse;
      try {
        verification = await verifyRegistrationResponse({
          response: credential as Parameters<typeof verifyRegistrationResponse>[0]["response"],
          expectedChallenge: challenge,
          expectedOrigin: getOrigin(req),
          expectedRPID: getRpId(req),
          requireUserVerification: false,
        });
      } catch (err) {
        console.error("[passkey-login] registration verification failed:", err);
        return json({ success: false, error: `Verification failed: ${(err as Error).message}` });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return json({ success: false, error: "Registration verification failed" });
      }

      const { credential: regCredential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { id: credId, publicKey, counter, transports } = regCredential;

      // Encode publicKey as base64url for storage (safe without Buffer dependency)
      let pubKeyB64: string;
      try {
        pubKeyB64 = uint8ArrayToBase64Url(publicKey);
      } catch {
        pubKeyB64 = Buffer.from(publicKey).toString("base64url");
      }

      // Get user's public.users record
      const { data: publicUser } = await admin
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      // Store credential (force internal transport for platform biometrics)
      const validTransports = (transports && transports.length > 0) ? transports : ["internal"];
      const { error: upsertErr } = await admin.from("webauthn_credentials").upsert({
        auth_id: user.id,
        user_id: publicUser?.id ?? null,
        credential_id: credId,
        public_key: pubKeyB64,
        sign_count: counter,
        transports: validTransports,
        device_name: deviceName ?? `جهاز بيومتري ${new Date().toLocaleDateString("ar-EG")}`,
        last_used_at: new Date().toISOString(),
      }, { onConflict: "credential_id" });

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
    if (action === "auth-start") {
      const { identifier } = body as { identifier?: string };

      let allowCredentials: Array<{ id: string; type: "public-key"; transports?: string[] }> = [];
      let authId: string | null = null;

      // If identifier provided, restrict to that user's credentials
      if (identifier?.trim()) {
        const clean = identifier.trim().toLowerCase();
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
            // CRITICAL: Always force "internal" transport to prevent Chrome from showing
            // USB/NFC/another-device picker. "internal" = platform authenticator only (fingerprint/face/PIN)
            transports: ["internal"] as string[],
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
      await admin.from("webauthn_challenges").insert({
        challenge: options.challenge,
        auth_id: authId ?? null,
        type: "authentication",
      });

      return json({ success: true, options });
    }

    // ──────────────────────────────────────────────────────────────────────
    // AUTH-FINISH: verify assertion + create session
    // ──────────────────────────────────────────────────────────────────────
    if (action === "auth-finish") {
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

      // Fetch the challenge by finding the most recent valid one
      // (for discoverable flow, auth_id may be null)
      const { data: challengeRows } = await admin
        .from("webauthn_challenges")
        .select("id, challenge")
        .eq("type", "authentication")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (!challengeRows?.length) {
        return json({ success: false, error: "Challenge expired. Please try again." });
      }

      const { id: challengeId, challenge } = challengeRows[0];

      // Consume challenge immediately
      await admin.from("webauthn_challenges").delete().eq("id", challengeId);

      // Decode stored public key
      let publicKeyBuffer: Uint8Array;
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
          response: credential as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
          expectedChallenge: challenge,
          expectedOrigin: getOrigin(req),
          expectedRPID: getRpId(req),
          requireUserVerification: false,
          credential: {
            id: storedCred.credential_id as string,
            publicKey: publicKeyBuffer,
            counter: Number(storedCred.sign_count ?? 0),
            transports: (storedCred.transports as AuthenticatorTransport[]) ?? ["internal"],
          },
        });
      } catch (err) {
        console.error("[passkey-login] authentication verification failed:", err);
        return json({ success: false, error: `Authentication failed: ${(err as Error).message}` });
      }

      if (!verification.verified) {
        return json({ success: false, error: "Authentication verification failed" });
      }

      // Update sign counter
      await admin
        .from("webauthn_credentials")
        .update({
          sign_count: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", storedCred.id);

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

      const role = publicProfile?.role ?? authUserData.user.user_metadata?.role ?? "student";
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

    // ──────────────────────────────────────────────────────────────────────
    // LEGACY fallback — old clients that POST credentialId + rawId directly
    // ──────────────────────────────────────────────────────────────────────
    if (!action || action === "legacy") {
      const { credentialId, rawId, userHandle } = body as {
        credentialId?: string;
        rawId?: string;
        userHandle?: string;
      };

      if (!credentialId && !rawId && !userHandle) {
        return json({ success: false, error: "Missing credential details" });
      }

      const candidates = new Set<string>();
      for (const val of [credentialId, rawId]) {
        if (val && typeof val === "string") {
          candidates.add(val);
          candidates.add(val.replace(/-/g, "+").replace(/_/g, "/"));
          candidates.add(val.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
        }
      }

      const { data: dbCreds } = await admin
        .from("webauthn_credentials")
        .select("auth_id, device_name, credential_id, public_key")
        .in("credential_id", Array.from(candidates))
        .limit(1);

      let authId: string | null = null;
      let deviceName: string | null = null;

      if (dbCreds?.length) {
        authId = dbCreds[0].auth_id as string;
        deviceName = dbCreds[0].device_name as string;
      }

      if (!authId) {
        return json({
          success: false,
          error: "هذا المفتاح غير مسجل في النظام. يرجى تسجيل بصمتك من الملف الشخصي.",
        });
      }

      const { data: authUserData } = await admin.auth.admin.getUserById(authId);
      if (!authUserData?.user?.email) {
        return json({ success: false, error: "تعذر العثور على بريد المستخدم." });
      }

      const { data: publicProfile } = await admin
        .from("users")
        .select("id, role, full_name")
        .eq("auth_id", authId)
        .maybeSingle();

      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: authUserData.user.email,
      });

      if (linkError || !linkData?.properties?.hashed_token) {
        return json({ success: false, error: "فشل إنشاء الجلسة." });
      }

      return json({
        success: true,
        hashed_token: linkData.properties.hashed_token,
        email: authUserData.user.email,
        role: publicProfile?.role ?? "student",
        full_name: publicProfile?.full_name ?? "",
        device_name: deviceName,
      });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[passkey-login] Unexpected error:", message);
    return json({ success: false, error: `حدث خطأ داخلي: ${message}` });
  }
});
