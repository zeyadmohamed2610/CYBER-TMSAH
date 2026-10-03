import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),session:vi.fn(),start:vi.fn(),register:vi.fn(),verifyRegistration:vi.fn(),update:vi.fn(),setSession:vi.fn()}));
vi.mock('../supabaseClient',()=>({supabase:{functions:{invoke:mocks.invoke},auth:{getSession:mocks.session,setSession:mocks.setSession,passkey:{startAuthentication:mocks.start,startRegistration:mocks.register,verifyRegistration:mocks.verifyRegistration,update:mocks.update}}}}));
import {authenticateWithPasskey,registerPasskey,verifyPasskeyForCurrentUser} from '../webauthn';
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();vi.stubGlobal('PublicKeyCredential',class{});
 Object.defineProperty(navigator,'credentials',{configurable:true,value:{create:vi.fn(),get:vi.fn()}});
 mocks.session.mockResolvedValue({data:{session:{access_token:'token'}}});
 mocks.start.mockResolvedValue({data:null,error:new Error('unavailable')});
 mocks.register.mockResolvedValue({data:null,error:new Error('unavailable')});
 mocks.invoke.mockResolvedValue({data:null,error:new Error('unavailable')});
});
it('does not restore cached tokens when native authentication cannot start',async()=>{
 localStorage.setItem('cyber_device_passkey_old','cached');
 expect((await authenticateWithPasskey()).success).toBe(false);expect(mocks.setSession).not.toHaveBeenCalled();expect(navigator.credentials.get).not.toHaveBeenCalled();
});
it('cleans legacy hints without deleting managed sessions',async()=>{
 localStorage.setItem('cyber_device_passkey_old','cached');localStorage.setItem('sb-account-session','managed');await authenticateWithPasskey();
 expect(localStorage.getItem('cyber_device_passkey_old')).toBeNull();expect(localStorage.getItem('sb-account-session')).toBe('managed');
});
it('does not fake registration when native Supabase registration fails',async()=>{
 expect((await registerPasskey()).success).toBe(false);expect(navigator.credentials.create).not.toHaveBeenCalled();expect(mocks.verifyRegistration).not.toHaveBeenCalled();
});
it('requires UV and sends the native challenge ID to the server guard',async()=>{
 mocks.start.mockResolvedValue({data:{challenge_id:'native-challenge',options:{challenge:'Y2hhbGxlbmdl',userVerification:'preferred'}},error:null});
 const bytes=new Uint8Array(37);bytes[32]=5;
 vi.mocked(navigator.credentials.get).mockResolvedValue({id:'key',rawId:new ArrayBuffer(1),type:'public-key',response:{clientDataJSON:new ArrayBuffer(1),authenticatorData:bytes.buffer,signature:new ArrayBuffer(1),userHandle:null},getClientExtensionResults:()=>({})} as unknown as PublicKeyCredential);
 mocks.invoke.mockResolvedValue({data:{success:true,session:{access_token:'fresh',refresh_token:'refresh'}},error:null});
 mocks.setSession.mockResolvedValue({data:{session:{access_token:'fresh'},user:{id:'user'}},error:null});
 expect((await authenticateWithPasskey()).success).toBe(true);
 expect(navigator.credentials.get).toHaveBeenCalledWith(expect.objectContaining({publicKey:expect.objectContaining({userVerification:'required'})}));
 expect(mocks.invoke).toHaveBeenCalledWith('passkey-login?action=auth-finish',expect.objectContaining({body:expect.objectContaining({challengeId:'native-challenge'})}));
 expect(mocks.setSession).toHaveBeenCalledWith({access_token:'fresh',refresh_token:'refresh'});
});
it('keeps attendance without a registered native key out of the native prompt',async()=>{
 mocks.invoke.mockResolvedValue({data:{success:false,noPasskeyRegistered:true,error:'أضف مفتاحًا'},error:null});
 expect(await verifyPasskeyForCurrentUser('123456')).toMatchObject({success:false,noPasskeyRegistered:true});expect(navigator.credentials.get).not.toHaveBeenCalled();
});
it('opens a prepared registration directly from the click without session or challenge fetches',async()=>{
 const nativeOptions={challenge:'Y2hhbGxlbmdl',rp:{name:'CYBER TMSAH'},user:{id:'dXNlcg',name:'student',displayName:'Student'},pubKeyCredParams:[{alg:-7,type:'public-key'}]};
 vi.mocked(navigator.credentials.create).mockResolvedValue({id:'key',rawId:new ArrayBuffer(1),type:'public-key',response:{clientDataJSON:new ArrayBuffer(1),attestationObject:new ArrayBuffer(1),getTransports:()=>['internal']},getClientExtensionResults:()=>({})} as unknown as PublicKeyCredential);
 mocks.verifyRegistration.mockResolvedValue({data:{id:'native-key'},error:null});
 const result=registerPasskey(undefined,'device',{challengeId:'prepared-challenge',options:nativeOptions,expiresAt:Date.now()+60000});
 expect(navigator.credentials.create).toHaveBeenCalledTimes(1);
 expect(mocks.session).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();
 expect(await result).toMatchObject({success:true,credentialId:'native-key'});
 expect(mocks.verifyRegistration).toHaveBeenCalledWith(expect.objectContaining({challengeId:'prepared-challenge'}));
});
it('refuses an expired prepared request before opening the device prompt',async()=>{
 expect(await registerPasskey(undefined,'device',{challengeId:'expired',options:{},expiresAt:Date.now()-1000})).toMatchObject({success:false,code:'REGISTRATION_EXPIRED'});
 expect(navigator.credentials.create).not.toHaveBeenCalled();expect(mocks.verifyRegistration).not.toHaveBeenCalled();
});
