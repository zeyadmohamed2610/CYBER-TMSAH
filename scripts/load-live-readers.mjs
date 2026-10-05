// Read-only capacity probe. Never uses an administrative key or writes fixtures.
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

if (process.env.LOAD_ALLOW_LIVE !== "1")
  throw new Error("Set LOAD_ALLOW_LIVE=1 to explicitly run a live load test");
const accounts = JSON.parse(await readFile(".private/test-accounts.json", "utf8"));
if (
  accounts.length !== 5 ||
  accounts.some(
    (a) => !/^qa\.(owner|coordinator|doctor|ta|student)\.20261002@example\.com$/.test(a.email),
  )
)
  throw new Error("Exactly five dedicated QA identities are required");
const keys = JSON.parse(await readFile(".private/api-keys.json", "utf8"));
const publicKey = keys.find((key) => key.type === "publishable")?.api_key;
if (!publicKey?.startsWith("sb_publishable_")) throw new Error("A publishable key is required");
const url = "https://clfhllujvxhfvhenvwfz.supabase.co";
const sessions = {};
for (const account of accounts) {
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || data.user?.id !== account.authId)
    throw new Error(`QA authentication failed for ${account.role}`);
  sessions[account.role] = { token: data.session.access_token, account };
}
const observations = [];
const stages = [];
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0);
};
const summarize = (rows) => ({
  requests: rows.length,
  failures: rows.filter((row) => !row.ok).length,
  p50Ms: percentile(
    rows.map((row) => row.ms),
    0.5,
  ),
  p95Ms: percentile(
    rows.map((row) => row.ms),
    0.95,
  ),
  p99Ms: percentile(
    rows.map((row) => row.ms),
    0.99,
  ),
});
async function request(role, operation, path, body) {
  const started = performance.now();
  let status = 0;
  let ok = false;
  let transportError = null;
  try {
    const response = await fetch(url + path, {
      method: body ? "POST" : "GET",
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${sessions[role].token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    status = response.status;
    const data = await response.json();
    ok =
      response.ok &&
      (operation === "profile"
        ? data.length === 1 &&
          data[0].auth_id === sessions[role].account.authId &&
          data[0].role === role
        : operation === "schedule"
          ? Array.isArray(data.entries)
          : Array.isArray(data));
  } catch (error) {
    transportError = error.cause?.code ?? error.code ?? error.name;
    /* Record failures without storing tokens, credentials, or response data. */
  }
  observations.push({
    role,
    operation,
    status,
    ok,
    transportError,
    ms: performance.now() - started,
  });
}
const roleAt = (i) => {
  const n = i % 100;
  return n < 80 ? "student" : n < 88 ? "doctor" : n < 94 ? "ta" : n < 98 ? "coordinator" : "owner";
};
let aborted = false;
for (const users of [10, 50, 100, 250, 500, 1000]) {
  const before = observations.length;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: users }, async (_, index) => {
      const role = roleAt(index);
      await request(
        role,
        "profile",
        `/rest/v1/users?select=auth_id,role&auth_id=eq.${sessions[role].account.authId}`,
      );
      await request(role, "schedule", "/rest/v1/rpc/get_academic_schedule", {
        p_department: "cybersecurity",
        p_year: "1",
      });
      await request(
        role,
        "attendance",
        "/rest/v1/attendance?select=id,student_id,session_id&limit=50&order=created_at.desc",
      );
    }),
  );
  const stage = {
    concurrentVirtualUsers: users,
    durationMs: Math.round(performance.now() - started),
    ...summarize(observations.slice(before)),
  };
  stages.push(stage);
  console.log(JSON.stringify(stage));
  if (stage.failures > 0 || stage.p95Ms > 5000) {
    aborted = true;
    console.log("Stopped escalation: failure or p95 latency above 5 seconds");
    break;
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  target: url,
  mode: "read-only authenticated HTTP journeys",
  identityCount: accounts.length,
  identityReuse: true,
  roleMixPer100: { student: 80, doctor: 8, ta: 6, coordinator: 4, owner: 2 },
  excludes: [
    "1000 distinct accounts",
    "1000 browsers",
    "login bursts",
    "attendance writes",
    "WebAuthn hardware",
    "Realtime sockets",
    "sustained capacity",
  ],
  aborted,
  stages,
  overall: summarize(observations),
  byRole: Object.fromEntries(
    accounts.map((a) => [a.role, summarize(observations.filter((r) => r.role === a.role))]),
  ),
  failures: observations.filter((r) => !r.ok),
};
await writeFile(".private/release-load-readers.json", JSON.stringify(report, null, 2));
if (aborted || stages.at(-1)?.concurrentVirtualUsers !== 1000) process.exitCode = 1;
