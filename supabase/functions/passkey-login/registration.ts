import { createSupabaseContext } from "npm:@supabase/server@1.8.0";
import { readAssertionChallenge } from "../_shared/passkeyChallenge.ts";
import { json, getOrigin, getRpId, getRpName, getExpectedRpIds, uint8ArrayToBase64Url } from "./support.ts";
import type { PasskeyContext } from "./context.ts";
import { generateRegistrationOptions, verifyRegistrationResponse, type VerifiedRegistrationResponse } from "npm:@simplewebauthn/server@13.3.2";
export async function handleRegistration({req,body,action,admin,serverEnv}:PasskeyContext):Promise<Response|null> {
    if (action === "register-start") {
      const { data: context, error: contextError } = await createSupabaseContext(req, { auth: "user", env: serverEnv });
      if (contextError || !context) return json({ success: false, error: "Unauthorized" }, 401);
      const { data: { user }, error: authErr } = await context.supabase.auth.getUser();
      if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

      // The proof belongs to THIS verified session; another session's recent login is insufficient.
      const methods = context.jwtClaims?.amr;
      const nowSeconds = Date.now() / 1000;
      const recentlyVerified = Array.isArray(methods) && methods.some(method =>
        method && typeof method === 'object' && method.method === 'password'
        && typeof method.timestamp === 'number' && method.timestamp >= nowSeconds - 300 && method.timestamp <= nowSeconds + 60);
      if (!recentlyVerified) {
        return json({ success: false, error: 'أكد كلمة المرور مجددًا قبل إضافة جهاز للدخول.' }, 403);
      }

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
      const validTransports = (clientTransports ?? []).filter(transport => ["internal", "hybrid", "usb", "nfc", "ble", "smart-card"].includes(transport));

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

return null;
}
