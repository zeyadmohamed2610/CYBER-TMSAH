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
function assertion(flags = 5, origin = "http://localhost:8080", rpId = "localhost", assertionChallenge = challenge, counter = 1) {
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: assertionChallenge, origin }));
  const authData = Buffer.concat([createHash("sha256").update(rpId).digest(), Buffer.from([flags, 0, 0, 0, counter])]);
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
    maybeSingle: () => { single = true; return builder; },
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
    mocks.context.mockResolvedValue({ data: { supabase: { auth: { getUser: async () => ({ data: { user: { id: "student-a", last_sign_in_at: new Date().toISOString() } }, error: null }) } } }, error: null });
  });
  it("verifies a real signature, consumes only its challenge and issues a bound receipt", async () => {
    const response = await handlePasskeyRequest(request());
    expect(await response.json()).toEqual({ success: true, proofId: "proof" });
    expect(rows.webauthn_challenges?.map(r => r.id)).toEqual(["challenge-b"]);
    expect(rows.attendance_biometric_proofs?.[0]).toMatchObject({ auth_id: "student-a", attendance_hash: "123456", device_fingerprint: "a".repeat(64) });
  });
  it('verifies a settings test on the server without creating an attendance receipt or login token', async () => {
    Object.assign(rows.webauthn_challenges?.[0] ?? {}, { purpose: 'verify', attendance_hash: null });
    const response = await handlePasskeyRequest(request(assertion(), 'verify-finish'));
    expect(await response.json()).toEqual({ success: true, credentialId: 'Y3JlZA' });
    expect(rows.attendance_biometric_proofs).toHaveLength(0);
  });
  it('does not turn a settings verification into a login or attendance ceremony', async () => {
    Object.assign(rows.webauthn_challenges?.[0] ?? {}, { purpose: 'verify', attendance_hash: null });
    expect((await (await handlePasskeyRequest(request(assertion(), 'auth-finish'))).json()).success).toBe(false);
    expect((await (await handlePasskeyRequest(request())).json()).success).toBe(false);
    expect(rows.webauthn_challenges).toHaveLength(2);
  });
  it('rejects another account testing a credential it does not own', async () => {
    Object.assign(rows.webauthn_challenges?.[0] ?? {}, { purpose: 'verify', attendance_hash: null });
    mocks.context.mockResolvedValue({ data: { supabase: { auth: { getUser: async () => ({ data: { user: { id: 'student-b' } }, error: null }) } } }, error: null });
    expect((await (await handlePasskeyRequest(request(assertion(), 'verify-finish'))).json()).success).toBe(false);
    expect(rows.webauthn_challenges).toHaveLength(2);
  });
  it.each([
    ['wrong origin', assertion(5,'https://attacker.example')],
    ['wrong relying party', assertion(5,'http://localhost:8080','attacker.example')],
    ['unissued challenge', assertion(5,'http://localhost:8080','localhost','unissued')],
    ['counter rollback', assertion(5,'http://localhost:8080','localhost',challenge,0)],
  ])('rejects %s despite a valid cryptographic signature',async(_label,credential)=>{
    rows.webauthn_credentials![0]!.sign_count=1;
    expect((await (await handlePasskeyRequest(request(credential))).json()).success).toBe(false);
    expect(rows.attendance_biometric_proofs).toHaveLength(0);
  });
  it('rejects expired challenges and a different attendance code',async()=>{
    rows.webauthn_challenges![0]!.expires_at='2000-01-01';
    expect((await (await handlePasskeyRequest(request())).json()).success).toBe(false);
    rows.webauthn_challenges![0]!.expires_at='2099-01-01';
    rows.webauthn_challenges![0]!.attendance_hash='999999';
    expect((await (await handlePasskeyRequest(request())).json()).success).toBe(false);
  });
  it('requires a recent account verification before adding a new key',async()=>{
    mocks.context.mockResolvedValue({data:{jwtClaims:{amr:[{method:'password',timestamp:1}]},supabase:{auth:{getUser:async()=>({data:{user:{id:'student-a',last_sign_in_at:new Date().toISOString()}},error:null})}}},error:null});
    expect((await handlePasskeyRequest(request(assertion(),'register-start'))).status).toBe(403);
    expect(rows.webauthn_credentials).toHaveLength(1);
  });
  it('supports the numeric local loopback origin without issuing the wrong relying party',async()=>{
    const credential=assertion(5,'http://127.0.0.1:8080','127.0.0.1');
    const req=new Request('http://127.0.0.1:8080/?action=attendance-finish',{method:'POST',headers:{origin:'http://127.0.0.1:8080','Content-Type':'application/json'},body:JSON.stringify({credential,attendanceHash:'123456',deviceFingerprint:'a'.repeat(64)})});
    expect((await (await handlePasskeyRequest(req)).json()).success).toBe(true);
  });
  it("rejects a forged signature without deleting challenges", async () => {
    const forged = assertion();
    forged.response.signature = Buffer.alloc(70, 9).toString("base64url");
    expect((await (await handlePasskeyRequest(request(forged))).json()).success).toBe(false);
    expect(rows.webauthn_challenges).toHaveLength(2);
    expect(rows.attendance_biometric_proofs).toHaveLength(0);
  });
  it("rejects user presence without user verification", async () => {
    const result = await (await handlePasskeyRequest(request(assertion(1)))).json();
    expect(result).toMatchObject({ success: false, code: 'USER_VERIFICATION_REQUIRED' });
    expect(result.error).toContain('رمز قفل الجهاز');
    expect(rows.attendance_biometric_proofs).toHaveLength(0);
    expect(rows.webauthn_challenges).toHaveLength(2);
    expect(rows.webauthn_credentials![0]!.sign_count).toBe(0);
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
