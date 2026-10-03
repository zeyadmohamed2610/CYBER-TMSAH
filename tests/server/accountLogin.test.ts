// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { readJsonObject } from "../../supabase/functions/_shared/request.ts";
import { handleAccountLogin } from "../../supabase/functions/account-login/handler.ts";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signIn: vi.fn() }));
vi.mock("npm:@supabase/server@1.8.0/core", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
  createContextClient: () => ({ auth: { signInWithPassword: mocks.signIn } }),
}));
vi.stubGlobal("Deno", { env: { get: () => undefined } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === "reserve_account_login" ? true : "private@example.com",
    error: null,
  }));
  mocks.signIn.mockResolvedValue({
    data: {
      session: { access_token: "signed", refresh_token: "refresh" },
      user: { id: "account" },
    },
    error: null,
  });
});
const request = (
  body: unknown = { identifier: "username", password: "Password" },
  origin = "https://www.cyber-tmsah.site",
) =>
  new Request("https://backend/account-login", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("returns a session only after password authentication and throttles all aliases by the resolved account", async () => {
  expect((await handleAccountLogin(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("reserve_account_login", {
    p_identifier: "private@example.com",
  });
  expect(mocks.signIn).toHaveBeenCalledWith({ email: "private@example.com", password: "Password" });
});
it("does not disclose the resolved email, identity, or server error on failed authentication", async () => {
  mocks.signIn.mockResolvedValue({
    data: null,
    error: new Error("private@example.com does not exist"),
  });
  const result = await handleAccountLogin(request());
  expect(result.status).toBe(401);
  expect(await result.json()).toEqual({ error: "Invalid credentials" });
});
it("refuses exhausted server-side limits before checking passwords", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === "reserve_account_login" ? false : "private@example.com",
    error: null,
  }));
  expect((await handleAccountLogin(request())).status).toBe(429);
  expect(mocks.signIn).not.toHaveBeenCalled();
});
it.each([null, [], { identifier: {}, password: "x" }, { identifier: "x", password: {} }])(
  "rejects malformed input %j",
  async (body) => {
    expect((await handleAccountLogin(request(body))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it("rejects untrusted origins and unsupported methods", async () => {
  expect((await handleAccountLogin(request({}, "https://attacker.test"))).status).toBe(403);
  expect((await handleAccountLogin(new Request("https://backend"))).status).toBe(405);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("bounds streamed request bodies without Content-Length", async () => {
  await expect(readJsonObject(request({ payload: "x".repeat(17_000) }))).rejects.toMatchObject({
    status: 413,
  });
});
