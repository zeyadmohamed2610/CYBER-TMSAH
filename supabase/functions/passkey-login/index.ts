import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const { credentialId, rawId } = body;

    if (!credentialId && !rawId) {
      return new Response(
        JSON.stringify({ error: "Missing credentialId or rawId in request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build candidate variants (base64url, base64, etc.)
    const candidates = new Set<string>();
    if (credentialId) {
      candidates.add(credentialId);
      candidates.add(credentialId.replace(/-/g, "+").replace(/_/g, "/"));
      candidates.add(credentialId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    }
    if (rawId) {
      candidates.add(rawId);
      candidates.add(rawId.replace(/-/g, "+").replace(/_/g, "/"));
      candidates.add(rawId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    }

    const candidateArray = Array.from(candidates).filter(Boolean);

    // 1. Look up credential in webauthn_credentials table
    const { data: dbCreds } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("auth_id, user_id, device_name, credential_id")
      .in("credential_id", candidateArray)
      .limit(1);

    let authId = dbCreds && dbCreds.length > 0 ? dbCreds[0].auth_id : null;
    let deviceName = dbCreds && dbCreds.length > 0 ? dbCreds[0].device_name : null;

    // 2. If not found in table, search in auth.users user_metadata->passkeys
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

    if (!authId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "مفتاح المرور غير مسجل في النظام. يرجى تسجيل الدخول أولاً ثم تفعيل البصمة من الملف الشخصي.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Resolve user email & role
    const { data: authUserData, error: userFetchErr } = await supabaseAdmin.auth.admin.getUserById(authId);
    if (userFetchErr || !authUserData?.user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: "تعذر العثور على البريد الإلكتروني للمستخدم المرتبط بهذا المفتاح." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = authUserData.user.email;

    // Fetch role & name from public.users
    const { data: publicProfile } = await supabaseAdmin
      .from("users")
      .select("role, full_name, department")
      .eq("auth_id", authId)
      .maybeSingle();

    const role = publicProfile?.role || authUserData.user.user_metadata?.role || "student";
    const fullName = publicProfile?.full_name || authUserData.user.user_metadata?.full_name || "";

    // 4. Generate login link / hashed_token via GoTrue Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("[passkey-login] generateLink failed:", linkError);
      return new Response(
        JSON.stringify({ success: false, error: "فشل إنشاء رمز التحقق. يرجى المحاولة مرة أخرى." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at on webauthn_credentials
    try {
      await supabaseAdmin
        .from("webauthn_credentials")
        .update({ last_used_at: new Date().toISOString() })
        .eq("auth_id", authId)
        .in("credential_id", candidateArray);
    } catch {
      // non-blocking
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[passkey-login] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: "حدث خطأ داخلي في الخادم أثناء معالجة البصمة.", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
