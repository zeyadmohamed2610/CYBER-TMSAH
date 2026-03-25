// supabase/functions/createUser/index.ts
// Edge Function — creates an auth user + public.users record.
// Called exclusively by the Owner dashboard.
// Requires: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY env vars.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RequestBody {
  name: string;
  email: string;
  password: string;
  role: "doctor" | "student";
  subject_id: string | null;
}

// Restrict CORS to the known frontend origin (set ALLOWED_ORIGIN env var in production).
// Falls back to localhost for local dev only.
const ALLOWED_ORIGIN =
  Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:8080";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    // 1. Build a caller-scoped client (uses the owner's JWT)
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // 2. Verify caller identity and role
    const { data: callerAuth, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerAuth.user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    const { data: callerProfile, error: profileErr } = await callerClient
      .from("users")
      .select("role")
      .eq("auth_id", callerAuth.user.id)
      .maybeSingle();

    if (profileErr || !callerProfile) {
      return json({ error: "Cannot resolve caller profile" }, 403);
    }

    if (callerProfile.role !== "owner") {
      return json({ error: "Only owners may create users" }, 403);
    }

    // 3. Parse and validate body
    const body: RequestBody = await req.json();
    const { name, email, password, role, subject_id } = body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return json({ error: "Missing required fields: name, email, password, role" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }
    const validRoles = ["doctor", "student"];
    if (!validRoles.includes(role)) {
      return json({ error: "Role must be doctor or student" }, 400);
    }
    if (!subject_id) {
      return json({ error: "subject_id is required for doctors and students" }, 400);
    }

    // 4. Create auth.users record via service_role (only this key can do it)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      return json({ error: authErr?.message ?? "Failed to create auth user" }, 400);
    }

    const authUserId = authData.user.id;

    // 5. Create the public.users row via the create_user RPC (enforces owner-only internally)
    const { data: newUser, error: rpcErr } = await callerClient.rpc("create_user", {
      p_auth_id: authUserId,
      p_full_name: name.trim(),
      p_role: role,
      p_subject_id: subject_id ?? null,
    });

    if (rpcErr) {
      // Rollback: remove the auth user we just created to avoid orphaned accounts
      await serviceClient.auth.admin.deleteUser(authUserId);
      return json({ error: rpcErr.message }, 400);
    }

    return json({
      success: true,
      user: {
        id: (newUser as { id: string }).id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return json({ error: message }, 500);
  }
});
