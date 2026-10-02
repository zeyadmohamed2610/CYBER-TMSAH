// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), context: vi.fn() }));
vi.mock("@supabase/server/core", () => ({ createAdminClient: mocks.admin }));
vi.mock("@supabase/server", () => ({ createSupabaseContext: mocks.context }));
import { handlePasskeyRequest } from "../../supabase/functions/passkey-login/index";

type Row = Record<string, unknown>;
const rows: Record<string, Row[]> = {};
const challenge = "c".repeat(43);
const otherChallenge = "d".repeat(43);
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = publicKey.export({ format: "jwk" });
const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([
  [1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, "base64url")], [-3, Buffer.from(jwk.y!, "base64url")],
]));
function assertion(flags = 5) {
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: "http://localhost:8080" }));
  const authData = Buffer.concat([createHash("sha256").update("localhost").digest(), Buffer.from([flags, 0, 0, 0, 1])]);
  const signed = Buffer.concat([authData, createHash("sha256").update(clientData).digest()]);
  return {
    id: "Y3JlZA", rawId: "Y3JlZA", type: "public-key", clientExtensionResults: {},
    response: { clientDataJSON: clientData.toString("base64url"), authenticatorData: authData.toString("base64url"), signature: sign("sha256", signed, privateKey).toString("base64url"), userHandle: null },
  };
}
function query(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let operation = "select";
  let value: Row = {};
  let single = false;
  const builder = {
    select: () => builder,
    eq: (key: string, target: unknown) => { filters.push(r => r[key] === target); return builder; },
    gt: (key: string, target: string) => { filters.push(r => String(r[key]) > target); return builder; },
    lt: (key: string, target: string) => { filters.push(r => String(r[key]) < target); return builder; },
    in: (key: string, targets: unknown[]) => { filters.push(r => targets.includes(r[key])); return builder; },
    limit: () => builder,
    delete: () => { operation = "delete"; return builder; },
    insert: (row: Row) => { operation = "insert"; value = row; return builder; },
    update: (row: Row) => { operation = "update"; value = row; return builder; },
    single: () => { single = true; return builder; },
    then: (resolve: (result: { data: Row | Row[] | null; error: null }) => unknown) => {
      const matching = (rows[table] ?? []).filter(r => filters.every(f => f(r)));
      if (operation === "delete") rows[table] = (rows[table] ?? []).filter(r => !matching.includes(r));
      if (operation === "update") matching.forEach(r => Object.assign(r, value));
      if (operation === "insert") { const row = { id: "proof", ...value }; (rows[table] ??= []).push(row); matching.push(row); }
      return Promise.resolve(resolve({ data: single ? matching[0] ?? null : matching, error: null }));
    },
  };
  return builder;
}
const request = (credential = assertion(), action = "attendance-finish") => new Request("http://localhost:8080/?action=" + action, {
  method: "POST", headers: { origin: "http://localhost:8080", "Content-Type": "application/json" },
  body: JSON.stringify({ credential, attendanceHash: "123456", deviceFingerprint: "a".repeat(64) }),
});

describe("actual server verification of attendance assertions", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
    rows.webauthn_credentials = [{ id: "cred-row", auth_id: "student-a", credential_id: "Y3JlZA", public_key: Buffer.from(cose).toString("base64url"), sign_count: 0 }];
    rows.webauthn_challenges = [
      { id: "challenge-a", challenge, type: "authentication", auth_id: "student-a", attendance_hash: "123456", expires_at: "2099-01-01" },
      { id: "challenge-b", challenge: otherChallenge, type: "authentication", auth_id: "student-b", attendance_hash: "654321", expires_at: "2099-01-01" },
    ];
    rows.attendance_biometric_proofs = [];
    mocks.admin.mockReturnValue({ from: query });
    mocks.context.mockResolvedValue({ data: { supabase: { auth: { getUser: async () => ({ data: { user: { id: "student-a" } }, error: null }) } } }, error: null });
  });
  it("verifies a real signature, consumes only its challenge and issues a bound receipt", async () => {
    const response = await handlePasskeyRequest(request());
    expect(await response.json()).toEqual({ success: true, proofId: "proof" });
    expect(rows.webauthn_challenges?.map(r => r.id)).toEqual(["challenge-b"]);
    expect(rows.attendance_biometric_proofs?.[0]).toMatchObject({ auth_id: "student-a", attendance_hash: "123456", device_fingerprint: "a".repeat(64) });
  });
  it("rejects a forged signature without deleting challenges", async () => {
    const forged = assertion();
    forged.response.signature = Buffer.alloc(70, 9).toString("base64url");
    expect((await (await handlePasskeyRequest(request(forged))).json()).success).toBe(false);
    expect(rows.webauthn_challenges).toHaveLength(2);
    expect(rows.attendance_biometric_proofs).toHaveLength(0);
  });
  it("rejects user presence without user verification", async () => {
    expect((await (await handlePasskeyRequest(request(assertion(1)))).json()).success).toBe(false);
    expect(rows.attendance_biometric_proofs).toHaveLength(0);
  });
  it("rejects a replay", async () => {
    const credential = assertion();
    await handlePasskeyRequest(request(credential));
    expect((await (await handlePasskeyRequest(request(credential))).json()).success).toBe(false);
    expect(rows.attendance_biometric_proofs).toHaveLength(1);
  });
  it("issues only one receipt for concurrent copies of the same assertion", async () => {
    const credential = assertion();
    const results = await Promise.all([handlePasskeyRequest(request(credential)), handlePasskeyRequest(request(credential))]);
    const responses = await Promise.all(results.map(result => result.json()));
    expect(responses.filter(result => result.success)).toHaveLength(1);
    expect(rows.attendance_biometric_proofs).toHaveLength(1);
  });
  it("does not let an attendance assertion create a login session", async () => {
    expect((await handlePasskeyRequest(request(assertion(), "auth-finish"))).status).toBe(403);
  });
  it("rejects the unsigned legacy login endpoint", async () => {
    expect((await handlePasskeyRequest(request(assertion(), "legacy"))).status).toBe(400);
  });
  it("rejects a different signed-in account", async () => {
    mocks.context.mockResolvedValue({ error: null, data: { supabase: { auth: { getUser: async () => ({ data: { user: { id: "student-b" } }, error: null }) } } } });
    expect((await handlePasskeyRequest(request())).status).toBe(403);
  });
});
