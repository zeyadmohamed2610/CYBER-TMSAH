import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn(), setSession: vi.fn(), from: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { getSession: mocks.getSession, setSession: mocks.setSession }, from: mocks.from } }));
import { authenticateWithPasskey, registerPasskey, saveLocalPasskey } from "../webauthn";

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
  it('stores credential metadata without duplicating a session token',()=>{
    saveLocalPasskey({credentialId:'key',rawId:'key',savedAt:1,...{refreshToken:'must-not-be-stored'}});
    expect(localStorage.getItem('cyber_device_passkey_key')).not.toContain('must-not-be-stored');
  });
  it('requires device identity verification and reports the refusal without logging the whole response',async()=>{
    const message='لم يؤكد الجهاز هويتك. أعد المحاولة باستخدام رمز قفل الجهاز.';
    mocks.invoke.mockResolvedValueOnce({data:{success:true,options:{challenge:'Y2hhbGxlbmdl',userVerification:'preferred'}},error:null})
      .mockResolvedValueOnce({data:{success:false,code:'USER_VERIFICATION_REQUIRED',error:message},error:null});
    const authenticatorData=new Uint8Array(37);authenticatorData[32]=1;
    vi.mocked(navigator.credentials.get).mockResolvedValue({id:'key',rawId:new ArrayBuffer(1),type:'public-key',response:{clientDataJSON:new ArrayBuffer(1),authenticatorData:authenticatorData.buffer,signature:new ArrayBuffer(1),userHandle:null},getClientExtensionResults:()=>({})} as unknown as PublicKeyCredential);
    const logged=vi.spyOn(console,'error').mockImplementation(()=>{});
    const diagnostic=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      expect(await authenticateWithPasskey()).toMatchObject({success:false,error:message});
      expect(navigator.credentials.get).toHaveBeenCalledWith(expect.objectContaining({publicKey:expect.objectContaining({userVerification:'required'})}));
      expect(logged).toHaveBeenCalledWith('[WebAuthn] auth-finish failed:','USER_VERIFICATION_REQUIRED',message);
      expect(JSON.parse(diagnostic.mock.calls[0]![1] as string)).toEqual({action:'auth-finish',requestedVerification:'required',deviceResponse:{bytes:37,flags:1,userPresent:true,userVerified:false},sentResponse:{bytes:37,flags:1,userPresent:true,userVerified:false}});
      expect(mocks.setSession).not.toHaveBeenCalled();
    } finally { logged.mockRestore();diagnostic.mockRestore(); }
  });
  it("does not save an unverified credential when registration is unavailable", async () => {
    const result = await registerPasskey("my device");
    expect(result.success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(navigator.credentials.create).not.toHaveBeenCalled();
  });
});
