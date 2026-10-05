// Explicitly opted-in live fixture test. Creates and cleans 1000 independent identities.
import { readFile, writeFile } from "node:fs/promises";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

if (process.env.LOAD_ALLOW_LIVE !== "1") throw new Error("LOAD_ALLOW_LIVE=1 is required");
const keys = JSON.parse(await readFile(".private/api-keys.json", "utf8"));
const url = "https://clfhllujvxhfvhenvwfz.supabase.co";
const publicKey = keys.find((key) => key.type === "publishable").api_key;
const admin = createClient(url, keys.find((key) => key.type === "secret").api_key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = `qa-load-${randomUUID().slice(0, 8)}`;
const password = `Qa!${randomBytes(24).toString("base64url")}9a`;
const subject = "da995757-05bf-4ca1-bfc1-80b601a018ac";
const accounts = [];
const records = [];
const fixture = {};
const report = {
  run,
  startedAt: new Date().toISOString(),
  identityCount: 1000,
  roleMix: { student: 800, doctor: 80, ta: 60, coordinator: 40, owner: 20 },
  requestConcurrency: 32,
  provisioningConcurrency: 8,
  authenticationRateLimitResponses: 0,
  stages: [],
  attendanceProofs: "service-issued test fixtures; WebAuthn ceremonies tested separately",
  exclusions: ["1000 simultaneous browser instances", "hardware biometrics", "sustained soak"],
};
async function pool(items, limit, action) {
  let cursor = 0;
  const errors = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          await action(items[index], index);
        } catch (error) {
          errors.push(error);
        }
      }
    }),
  );
  if (errors.length) throw new Error(`${errors.length} operations failed: ${errors[0].message}`);
}
const roleAt = (index) => {
  const n = index % 100;
  return n < 80 ? "student" : n < 88 ? "doctor" : n < 94 ? "ta" : n < 98 ? "coordinator" : "owner";
};
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0);
};
const summarize = (rows) => ({
  requests: rows.length,
  failures: rows.filter((r) => !r.ok).length,
  p50Ms: percentile(
    rows.map((r) => r.ms),
    0.5,
  ),
  p95Ms: percentile(
    rows.map((r) => r.ms),
    0.95,
  ),
  p99Ms: percentile(
    rows.map((r) => r.ms),
    0.99,
  ),
});
async function request(account, operation, path, body, expectedDenial = false) {
  const started = performance.now();
  let status = 0,
    ok = false,
    errorCode = null;
  try {
    const response = await fetch(url + path, {
      method: body ? "POST" : "GET",
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${account.token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    status = response.status;
    const data = await response.json();
    errorCode = response.ok ? null : data.code;
    ok = expectedDenial
      ? !response.ok && data.message?.startsWith("permission_denied:")
      : response.ok &&
        (operation === "profile"
          ? data.length === 1 && data[0].auth_id === account.authId && data[0].role === account.role
          : operation === "schedule"
            ? Array.isArray(data.entries)
            : operation === "submit"
              ? data.student_id === account.profileId
              : Array.isArray(data));
  } catch (error) {
    errorCode = error.cause?.code ?? error.name;
  }
  records.push({
    role: account.role,
    operation,
    status,
    ok,
    expectedDenial,
    errorCode,
    ms: performance.now() - started,
  });
}
async function persistManifest() {
  await writeFile(
    ".private/release-load-users-manifest.json",
    JSON.stringify(
      {
        run,
        fixture,
        accounts: accounts.map(({ authId, profileId, role, email }) => ({
          authId,
          profileId,
          role,
          email,
        })),
      },
      null,
      2,
    ),
  );
}
try {
  await pool(
    Array.from({ length: 1000 }, (_, index) => index),
    8,
    async (index) => {
      const role = roleAt(index),
        email = `${run}.${index}@example.com`;
      const result = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role },
        user_metadata: { full_name: `QA load ${role} ${index}` },
      });
      if (result.error)
        throw new Error(`Provisioning ${index}: ${result.error.code ?? result.error.status}`);
      accounts.push({ index, role, email, authId: result.data.user.id });
      if (accounts.length % 100 === 0) {
        await persistManifest();
        console.log(`Provisioned ${accounts.length}/1000`);
      }
    },
  );
  accounts.sort((a, b) => a.index - b.index);
  for (let offset = 0; offset < accounts.length; offset += 100) {
    const batch = accounts.slice(offset, offset + 100);
    const saved = await admin
      .from("users")
      .upsert(
        batch.map((a) => ({
          auth_id: a.authId,
          full_name: `QA load ${a.role} ${a.index}`,
          username: `${run}_${a.index}`,
          email: a.email,
          role: a.role,
          department: "cybersecurity",
          departments: ["cybersecurity"],
          academic_year: a.role === "student" ? "1" : null,
          section_number: a.role === "student" ? (a.index % 15) + 1 : null,
          national_id: a.role === "student" ? String(99000000000000 + a.index) : null,
          subject_id: ["doctor", "ta"].includes(a.role) ? subject : null,
        })),
        { onConflict: "auth_id" },
      )
      .select("id,auth_id");
    if (saved.error) throw new Error(`Profile provisioning: ${saved.error.message}`);
    for (const a of batch) a.profileId = saved.data.find((row) => row.auth_id === a.authId).id;
  }
  await persistManifest();
  const assignments = await admin
    .from("user_subjects")
    .insert(
      accounts
        .filter((a) => ["doctor", "ta"].includes(a.role))
        .map((a) => ({ user_id: a.profileId, subject_id: subject })),
    );
  if (assignments.error) throw assignments.error;
  let authenticated = 0;
  await pool(accounts, 8, async (account) => {
    const client = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let result;
    for (let attempt = 0; attempt < 20; attempt++) {
      result = await client.auth.signInWithPassword({ email: account.email, password });
      if (result.error?.status !== 429) break;
      report.authenticationRateLimitResponses++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (result.error || result.data.user?.id !== account.authId)
      throw new Error(
        `Login failed for ${account.index}: ${result.error?.code ?? result.error?.status ?? "identity_mismatch"}`,
      );
    account.token = result.data.session.access_token;
    if (++authenticated % 100 === 0) console.log(`Authenticated ${authenticated}/1000`);
  });
  for (const users of [10, 50, 100, 250, 500, 1000]) {
    const before = records.length,
      started = performance.now();
    await pool(accounts.slice(0, users), 32, async (a) => {
      await request(a, "profile", `/rest/v1/users?select=auth_id,role&auth_id=eq.${a.authId}`);
      await request(a, "schedule", "/rest/v1/rpc/get_academic_schedule", {
        p_department: "cybersecurity",
        p_year: "1",
      });
      await request(
        a,
        "attendance",
        "/rest/v1/attendance?select=id,student_id,session_id&limit=50&order=created_at.desc",
      );
    });
    const stage = {
      virtualUsers: users,
      maxActiveJourneys: Math.min(users, 32),
      durationMs: Math.round(performance.now() - started),
      ...summarize(records.slice(before)),
    };
    report.stages.push(stage);
    console.log(JSON.stringify(stage));
    if (stage.failures || stage.p95Ms > 5000) throw new Error("Read stage failed its safety gate");
  }
  const owner = accounts.find((a) => a.role === "owner");
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Avoid a second password grant while retaining a normal authenticated client boundary.
  const ownerLogin = await client.auth.signInWithPassword({ email: owner.email, password });
  if (ownerLogin.error) throw ownerLogin.error;
  const lecture = await client.rpc("create_lecture", {
    p_subject_id: subject,
    p_title: run,
    p_kind: "lecture",
    p_section: null,
  });
  if (lecture.error) throw lecture.error;
  fixture.lectureId = lecture.data.id;
  await persistManifest();
  const session = await client.rpc("generate_rotating_hash", {
    p_subject_id: subject,
    p_lecture_id: fixture.lectureId,
    p_duration_minutes: 30,
    p_latitude: 30,
    p_longitude: 31,
    p_radius_meters: 50,
  });
  if (session.error) throw session.error;
  fixture.sessionId = session.data.id;
  await persistManifest();
  const students = accounts.filter((a) => a.role === "student");
  const proofs = students.map((a) => {
    a.proof = randomUUID();
    a.fingerprint = `${run}-${a.index}`;
    a.credential = randomBytes(32).toString("base64url");
    const { publicKey: fixturePublicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = fixturePublicKey.export({ format: "jwk" });
    a.fixtureCoseKey =
      "a5010203262001215820" +
      Buffer.from(jwk.x, "base64url").toString("hex") +
      "225820" +
      Buffer.from(jwk.y, "base64url").toString("hex");
    return {
      id: a.proof,
      auth_id: a.authId,
      attendance_hash: session.data.short_code,
      device_fingerprint: a.fingerprint,
      credential_id: a.credential,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    };
  });
  // Isolated native credential fixtures satisfy the current-key FK/guard. They
  // are not browser registrations and do not measure WebAuthn throughput.
  const fixtureSql = `BEGIN;
    INSERT INTO auth.webauthn_credentials(user_id,credential_id,public_key,friendly_name)
    SELECT v.auth_id::uuid,decode(v.credential_hex,'hex'),decode(v.public_key_hex,'hex'),'${run}'
    FROM (VALUES ${students.map((a) => `('${a.authId}','${Buffer.from(a.credential, "base64url").toString("hex")}','${a.fixtureCoseKey}')`).join(",")}) v(auth_id,credential_hex,public_key_hex)
    JOIN auth.users u ON u.id=v.auth_id::uuid
    WHERE u.email LIKE '${run}.%@example.com';
    COMMIT;`;
  await writeFile(".private/release-load-credential-fixtures.sql", fixtureSql);
  execFileSync(
    process.platform === "win32" ? "powershell.exe" : "supabase",
    process.platform === "win32"
      ? [
          "-NoProfile",
          "-Command",
          "supabase db query --linked --file .private/release-load-credential-fixtures.sql",
        ]
      : ["db", "query", "--linked", "--file", ".private/release-load-credential-fixtures.sql"],
    { stdio: "pipe" },
  );
  const seeded = await admin.from("attendance_biometric_proofs").insert(proofs);
  if (seeded.error) throw seeded.error;
  const beforeWrites = records.length;
  await pool(accounts, 32, (a) =>
    request(
      a,
      a.role === "student" ? "submit" : "rank-denial",
      "/rest/v1/rpc/submit_attendance",
      {
        p_hash: session.data.short_code,
        p_student_latitude: 30,
        p_student_longitude: 31,
        p_device_fingerprint: a.fingerprint ?? `${run}-${a.index}`,
        p_biometric_credential_id: a.proof ?? null,
      },
      a.role !== "student",
    ),
  );
  const saved = await admin
    .from("attendance")
    .select("student_id", { count: "exact" })
    .eq("session_id", fixture.sessionId);
  if (saved.error) throw saved.error;
  const left = await admin
    .from("attendance_biometric_proofs")
    .select("id", { count: "exact", head: true })
    .like("device_fingerprint", run + "-%");
  if (left.error) throw left.error;
  report.writes = {
    ...summarize(records.slice(beforeWrites)),
    recorded: saved.count,
    distinctStudents: new Set(saved.data.map((row) => row.student_id)).size,
    receiptsRemaining: left.count,
    expectedRankDenials: 200,
  };
  console.log(JSON.stringify(report.writes));
  if (
    report.writes.failures ||
    saved.count !== 800 ||
    report.writes.distinctStudents !== 800 ||
    left.count !== 0
  )
    throw new Error("Attendance integrity gate failed");
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
  console.log(`Load test failed: ${error.message}`);
} finally {
  console.log(`Cleaning ${accounts.length} dedicated fixture identities`);
  try {
    if (fixture.sessionId) {
      const removed = await admin.from("sessions").delete().eq("id", fixture.sessionId);
      if (removed.error) throw removed.error;
    }
    if (fixture.lectureId) {
      const removed = await admin.from("lectures").delete().eq("id", fixture.lectureId);
      if (removed.error) throw removed.error;
    }
    for (let offset = 0; offset < accounts.length; offset += 100) {
      const ids = accounts
        .slice(offset, offset + 100)
        .map((a) => a.profileId)
        .filter(Boolean);
      if (ids.length) {
        const logs = await admin.from("system_logs").delete().in("actor_id", ids);
        if (logs.error) throw logs.error;
      }
    }
    await pool(accounts, 8, async (a) => {
      if (!a.email.startsWith(run + ".") || !a.email.endsWith("@example.com"))
        throw new Error("Cleanup identity guard failed");
      const removed = await admin.auth.admin.deleteUser(a.authId);
      if (removed.error) throw removed.error;
    });
    report.cleanup = { deletedIdentities: accounts.length, result: "PASS" };
  } catch (error) {
    report.cleanup = { result: "FAIL", error: error.message };
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  report.overall = summarize(records);
  report.byRole = Object.fromEntries(
    Object.keys(report.roleMix).map((role) => [
      role,
      summarize(records.filter((r) => r.role === role)),
    ]),
  );
  report.failures = records.filter((r) => !r.ok);
  await writeFile(".private/release-load-users-result.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ result: report.result, cleanup: report.cleanup, overall: report.overall }),
  );
}
