import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn(), setSession: vi.fn(), from: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { getSession: mocks.getSession, setSession: mocks.setSession }, from: mocks.from } }));
import { authenticateWithPasskey, registerPasskey } from "../webauthn";

describe("passkey sign-in safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("PublicKeyCredential", class {});
    Object.defineProperty(navigator, "credentials", { configurable: true, value: { create: vi.fn(), get: vi.fn() } });
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("unavailable") });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
  });
  it("does not restore a cached account without a fresh device verification", async () => {
    localStorage.setItem("cyber_device_passkey_old", JSON.stringify({ credentialId: "old", refreshToken: "cached-session", userId: "another-account" }));
    const result = await authenticateWithPasskey("requested-account");
    expect(mocks.invoke).toHaveBeenCalledWith("passkey-login?action=auth-start", expect.objectContaining({ body: expect.objectContaining({ identifier: "requested-account" }) }));
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
  it("does not save an unverified credential when registration is unavailable", async () => {
    const result = await registerPasskey("my device");
    expect(result.success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(navigator.credentials.create).not.toHaveBeenCalled();
  });
});
