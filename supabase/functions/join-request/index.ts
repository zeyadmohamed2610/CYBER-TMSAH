import { createAdminClient } from "npm:@supabase/server@1.8.0/core";
import { assertUncompromisedPassword } from "../_shared/passwordBreach.ts";
import { readJsonObject, RequestFailure, serverEnvironment } from "../_shared/request.ts";
import { corsHeaders, isAllowedOrigin, json } from "../passkey-login/support.ts";

export async function handleJoinRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedOrigin(request.headers.get("origin") ?? ""))
    return json({ error: "Origin not allowed" }, 403);
  try {
    const admin = createAdminClient({ env: serverEnvironment() });
    const allowed = await admin.rpc("reserve_password_action", {
      p_ip: request.headers.get("x-real-ip") ?? "unknown",
      p_actor: null,
      p_operation: "join",
    });
    if (allowed.error || !allowed.data) return json({ error: "Try again later" }, 429);
    const body = await readJsonObject(request);
    const {
      full_name,
      username,
      email,
      national_id,
      role,
      department,
      departments,
      academic_year,
      section_number,
    } = body;
    const validDepartments = [
      "cybersecurity",
      "ai",
      "data_science",
      "mechatronics",
      "autotronics",
      "control_systems",
      "garments",
    ];
    if (
      typeof full_name !== "string" ||
      full_name.trim().length < 3 ||
      full_name.length > 120 ||
      typeof username !== "string" ||
      !/^[A-Za-z0-9_]{3,64}$/.test(username) ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (role === "student" && (typeof national_id !== "string" || !/^\d{14}$/.test(national_id))) ||
      (role !== "student" && national_id !== null) ||
      !["student", "doctor", "ta", "coordinator"].includes(String(role)) ||
      typeof department !== "string" ||
      !validDepartments.includes(department) ||
      !Array.isArray(departments) ||
      departments.length < 1 ||
      departments.length > 7 ||
      !departments.every((value) => validDepartments.includes(String(value))) ||
      departments[0] !== department ||
      (role === "student" &&
        (departments.length !== 1 ||
          !["1", "2", "3", "4"].includes(String(academic_year)) ||
          !Number.isInteger(section_number) ||
          Number(section_number) < 1 ||
          Number(section_number) > 15))
    )
      return json({ error: "Invalid join details" }, 400);
    const password = await assertUncompromisedPassword(body.password);
    const proof = await admin.rpc("register_password_check", {
      p_password: password,
      p_actor: null,
      p_target: null,
    });
    if (proof.error) return json({ error: "Join unavailable" }, 503);
    // Allow-list fields: clients cannot set approval, reviewer or verification flags.
    const inserted = await admin.from("join_requests").insert({
      full_name: full_name.trim(),
      username: username.toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      national_id,
      role,
      department,
      departments,
      academic_year: role === "student" ? academic_year : null,
      section_number: role === "student" ? section_number : null,
    });
    if (inserted.error) return json({ error: "Could not submit join request" }, 400);
    return json({ success: true });
  } catch (error) {
    return json(
      { error: error instanceof RequestFailure ? error.message : "Join unavailable" },
      error instanceof RequestFailure ? error.status : 503,
    );
  }
}
export default { fetch: handleJoinRequest };
