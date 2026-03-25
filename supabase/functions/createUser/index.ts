// supabase/functions/createUser/index.ts
// Edge Function — creates an auth user + public.users record.
// Called exclusively by the Owner dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RequestBody {
  name:        string;
  national_id?: string;   // students only
  email?:       string;   // doctors only
  password:    string;
  role:        "doctor" | "student";
  subject_id:  string | null;
}

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:8080";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify caller is owner
    const { data: callerAuth, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerAuth.user) return json({ error: "Invalid or expired token" }, 401);

    const { data: callerProfile, error: profileErr } = await callerClient
      .from("users").select("role").eq("auth_id", callerAuth.user.id).maybeSingle();

    if (profileErr || !callerProfile)     return json({ error: "Cannot resolve caller profile" }, 403);
    if (callerProfile.role !== "owner")   return json({ error: "Only owners may create users" }, 403);

    // Parse body
    const body: RequestBody = await req.json();
    const { name, national_id, email, password, role, subject_id } = body;

    if (!name?.trim() || !password || !role) {
      return json({ error: "Missing required fields: name, password, role" }, 400);
    }
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (!["doctor", "student"].includes(role)) return json({ error: "Role must be doctor or student" }, 400);

    // Determine the auth email
    let authEmail: string;
    if (role === "student") {
      if (!national_id || !/^\d{14}$/.test(national_id.trim())) {
        return json({ error: "Students require a valid 14-digit national ID" }, 400);
      }
      authEmail = `${national_id.trim()}@nid.local`;
    } else {
      if (!email?.trim()) return json({ error: "Doctors require a valid email address" }, 400);
      authEmail = email.trim().toLowerCase();
    }

    // Create auth user
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
      email:         authEmail,
      password,
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      return json({ error: authErr?.message ?? "Failed to create auth user" }, 400);
    }

    const authUserId = authData.user.id;

    // Create public.users row via RPC
    const { data: newUser, error: rpcErr } = await callerClient.rpc("create_user", {
      p_auth_id:    authUserId,
      p_full_name:  name.trim(),
      p_role:       role,
      p_subject_id: subject_id ?? null,
    });

    if (rpcErr) {
      await serviceClient.auth.admin.deleteUser(authUserId);
      return json({ error: rpcErr.message }, 400);
    }

    // If doctor + subject_id: update subject's doctor_name to the doctor's name
    if (role === "doctor" && subject_id) {
      await serviceClient.from("subjects")
        .update({ doctor_name: name.trim() })
        .eq("id", subject_id);
    }

    return json({
      success: true,
      user: { id: (newUser as { id: string }).id, name: name.trim(), role },
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
