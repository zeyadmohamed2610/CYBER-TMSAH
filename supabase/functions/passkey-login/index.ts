import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Convert ArrayBuffer to hex string */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert base64 / base64url to hex */
function base64ToHex(b64: string): string {
  try {
    const clean = b64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
    const bin = atob(padded);
    return Array.from(bin)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase configuration" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const { credentialId, rawId, userHandle } = body;

    if (!credentialId && !rawId && !userHandle) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing credential details in request" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build candidate credential strings across all base64 and base64url variations
    const candidates = new Set<string>();
    for (const val of [credentialId, rawId]) {
      if (val && typeof val === "string") {
        candidates.add(val);
        candidates.add(val.replace(/-/g, "+").replace(/_/g, "/"));
        candidates.add(val.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      }
    }

    const candidateArray = Array.from(candidates).filter(Boolean);

    let authId: string | null = null;
    let deviceName: string | null = null;

    // 1. Check in webauthn_credentials table
    if (candidateArray.length > 0) {
      const { data: dbCreds } = await supabaseAdmin
        .from("webauthn_credentials")
        .select("auth_id, user_id, device_name, credential_id")
        .in("credential_id", candidateArray)
        .limit(1);

      if (dbCreds && dbCreds.length > 0) {
        authId = dbCreds[0].auth_id;
        deviceName = dbCreds[0].device_name;
      }
    }

    // 2. Check in auth.users user_metadata->'passkeys' array
    if (!authId) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (authUsers?.users) {
        for (const u of authUsers.users) {
          const passkeys = u.user_metadata?.passkeys;
          if (Array.isArray(passkeys)) {
            const found = passkeys.find((pk: any) =>
              candidateArray.includes(pk.id) || candidateArray.includes(pk.rawId)
            );
            if (found) {
              authId = u.id;
              deviceName = found.label || "مفتاح أمان بيومتري";
              break;
            }
          }
        }
      }
    }

    // 3. Check via userHandle (SHA-256 of user.id)
    if (!authId && userHandle) {
      const targetHex = base64ToHex(userHandle);
      if (targetHex) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (authUsers?.users) {
          for (const u of authUsers.users) {
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(u.id));
            const uHex = bufferToHex(hashBuffer);

            if (uHex === targetHex) {
              authId = u.id;
              deviceName = "هاتف أندرويد (بصمة)";
              break;
            }
          }
        }
      }
    }

    if (!authId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "مفتاح المرور غير مسجل في النظام. يرجى تسجيل الدخول أولاً ثم تفعيل البصمة من الملف الشخصي.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Resolve user email & role
    const { data: authUserData, error: userFetchErr } = await supabaseAdmin.auth.admin.getUserById(authId);
    if (userFetchErr || !authUserData?.user?.email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "تعذر العثور على البريد الإلكتروني للحساب المرتبط بهذا المفتاح.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = authUserData.user.email;

    // Fetch role & name from public.users
    const { data: publicProfile } = await supabaseAdmin
      .from("users")
      .select("id, role, full_name, department")
      .eq("auth_id", authId)
      .maybeSingle();

    const role = publicProfile?.role || authUserData.user.user_metadata?.role || "student";
    const fullName = publicProfile?.full_name || authUserData.user.user_metadata?.full_name || "";

    // If credential was matched via userHandle, auto-register this credential to webauthn_credentials!
    if (credentialId) {
      try {
        await supabaseAdmin.from("webauthn_credentials").upsert({
          auth_id: authId,
          user_id: publicProfile?.id || null,
          credential_id: credentialId,
          device_name: deviceName || "مفتاح أمان بيومتري",
          last_used_at: new Date().toISOString(),
        }, { onConflict: "credential_id" });
      } catch {
        // non-blocking
      }
    }

    // 5. Generate login token via GoTrue Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("[passkey-login] generateLink failed:", linkError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "فشل إنشاء رمز التحقق للجلسة. يرجى المحاولة مرة أخرى.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        hashed_token: linkData.properties.hashed_token,
        email: email,
        role: role,
        full_name: fullName,
        device_name: deviceName,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[passkey-login] Unexpected error:", message);
    return new Response(
      JSON.stringify({
        success: false,
        error: "حدث خطأ داخلي أثناء معالجة بيانات البصمة.",
        details: message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
