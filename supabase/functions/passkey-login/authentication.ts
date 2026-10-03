import { createSupabaseContext } from "npm:@supabase/server@1.8.0";
import { readAssertionChallenge } from "../_shared/passkeyChallenge.ts";
import { json, getOrigin, getRpId, getExpectedRpIds } from "./support.ts";
import type { PasskeyContext } from "./context.ts";
import { Buffer } from "node:buffer";
import { generateAuthenticationOptions, verifyAuthenticationResponse, type VerifiedAuthenticationResponse } from "npm:@simplewebauthn/server@13.3.2";
export async function handleAuthentication({req,body,action,admin,serverEnv}:PasskeyContext):Promise<Response|null> {
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
            transports: (storedCred.transports as Parameters<typeof verifyAuthenticationResponse>[0]["credential"]["transports"]) ?? [],
          },
        });
      } catch (err) {
        console.error("[passkey-login] authentication verification failed:", err);
        if (err instanceof Error && err.message === 'User verification required, but user could not be verified') {
          const encoded = (credential.response as { authenticatorData: string }).authenticatorData;
          const header = Buffer.from(encoded, 'base64url');
          const flags = header.length >= 37 ? header[32] : undefined;
          console.warn('[passkey-login] verification header:', JSON.stringify({
            action, bytes: header.length, flags: flags ?? null,
            userPresent: flags === undefined ? null : Boolean(flags & 1),
            userVerified: flags === undefined ? null : Boolean(flags & 4),
          }));
          return json({ success: false, code: 'USER_VERIFICATION_REQUIRED', error: 'لم يؤكد الجهاز هويتك. أعد المحاولة باستخدام البصمة أو الوجه أو رمز قفل الجهاز. إذا تكرر الرفض، ادخل بكلمة المرور وأضف مفتاح دخول من جهاز يدعم تأكيد الهوية.' });
        }
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


return null;
}
