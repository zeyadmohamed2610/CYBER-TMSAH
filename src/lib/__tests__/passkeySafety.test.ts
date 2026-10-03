import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn(), setSession: vi.fn(), verifyOtp:vi.fn(), from: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { getSession: mocks.getSession, setSession: mocks.setSession,verifyOtp:mocks.verifyOtp }, from: mocks.from } }));
import { authenticateWithPasskey, registerPasskey, verifyPasskeyForCurrentUser } from "../webauthn";

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
  it('cleans obsolete local credential tokens without clearing the managed account session',async()=>{
    localStorage.setItem('cyber_device_passkey_key',JSON.stringify({refreshToken:'obsolete'}));
    localStorage.setItem('sb-account-session','managed-session');
    await authenticateWithPasskey();
    expect(localStorage.getItem('cyber_device_passkey_key')).toBeNull();
    expect(localStorage.getItem('sb-account-session')).toBe('managed-session');
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
      expect(JSON.parse(diagnostic.mock.calls[0]![1] as string)).toEqual({action:'auth-finish',requestedVerification:'required',response:{bytes:37,flags:1,userPresent:true,userVerified:false}});
      expect(mocks.setSession).not.toHaveBeenCalled();
    } finally { logged.mockRestore();diagnostic.mockRestore(); }
  });
  it("does not save an unverified credential when registration is unavailable", async () => {
    const result = await registerPasskey("my device");
    expect(result.success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(navigator.credentials.create).not.toHaveBeenCalled();
  });
  it('keeps overlapping device ceremonies from replacing each other',async()=>{
    let release!:(value:unknown)=>void;
    mocks.invoke.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const first=authenticateWithPasskey('first');
    expect(await authenticateWithPasskey('second')).toMatchObject({success:false,code:'CEREMONY_IN_PROGRESS'});
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    release({data:null,error:new Error('unavailable')});
    await first;
    await authenticateWithPasskey('third');
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
  it('rejects an expired settings session before asking the device to verify',async()=>{
    mocks.getSession.mockResolvedValueOnce({data:{session:null}});
    expect(await authenticateWithPasskey(undefined,'key')).toMatchObject({success:false,code:'SESSION_REQUIRED'});
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(navigator.credentials.get).not.toHaveBeenCalled();
  });
  it('retains helpful registration errors from a non-success HTTP response',async()=>{
    mocks.invoke.mockResolvedValueOnce({data:null,error:{context:new Response(JSON.stringify({success:false,error:'أكد كلمة المرور مجددًا قبل إضافة جهاز للدخول.'}),{status:403})}});
    expect(await registerPasskey()).toMatchObject({success:false,error:'أكد كلمة المرور مجددًا قبل إضافة جهاز للدخول.'});
    expect(navigator.credentials.create).not.toHaveBeenCalled();
  });
  it('rejects incomplete options before prompting for a key',async()=>{
    mocks.invoke.mockResolvedValueOnce({data:{success:true,options:{}},error:null});
    expect(await authenticateWithPasskey()).toMatchObject({success:false,code:'INVALID_OPTIONS'});
    expect(navigator.credentials.get).not.toHaveBeenCalled();
  });
  it('preserves the no-key response for attendance setup',async()=>{
    mocks.invoke.mockResolvedValueOnce({data:{success:false,noPasskeyRegistered:true,error:'سجل بصمة لحسابك أولًا.'},error:null});
    expect(await verifyPasskeyForCurrentUser('123456')).toMatchObject({success:false,noPasskeyRegistered:true});
    expect(navigator.credentials.get).not.toHaveBeenCalled();
  });
  it('handles a cancelled browser request and permits a subsequent attempt',async()=>{
    mocks.invoke.mockResolvedValueOnce({data:{success:true,options:{challenge:'Y2hhbGxlbmdl'}},error:null});
    vi.mocked(navigator.credentials.get).mockRejectedValueOnce(new DOMException('cancelled','NotAllowedError'));
    expect(await authenticateWithPasskey()).toMatchObject({success:false,cancelled:true});
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    await authenticateWithPasskey();
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
});
