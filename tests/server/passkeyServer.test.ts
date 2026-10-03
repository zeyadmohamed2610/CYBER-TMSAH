// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),native:vi.fn(),context:vi.fn(),verify:vi.fn(),signOut:vi.fn(),rpc:vi.fn()}));
vi.mock('@supabase/server/core',()=>({createAdminClient:mocks.admin,createContextClient:mocks.native}));
vi.mock('@supabase/server',()=>({createSupabaseContext:mocks.context}));
import {handlePasskeyRequest} from '../../supabase/functions/passkey-login/index';
type Row=Record<string,unknown>;
let binding:Row|undefined,proofs:Row[];
function query(table:string) {
 const filters:((r:Row)=>boolean)[]=[];let insert:Row|undefined,remove=false;
 const b={select:()=>b,eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return b;},gt:(k:string,v:string)=>{filters.push(r=>String(r[k])>v);return b;},lt:()=>b,delete:()=>{remove=true;return b;},insert:(r:Row)=>{insert=r;return b;},single:()=>b,maybeSingle:()=>b,then:(resolve:(value:unknown)=>unknown)=>{
  if(table==='users')return Promise.resolve(resolve({data:{role:'student'},error:null}));
  if(table==='attendance_biometric_proofs'){proofs.push(insert!);return Promise.resolve(resolve({data:{id:'proof'},error:null}));}
  const found=binding&&filters.every(f=>f(binding!))?[binding]:[];
  if(remove&&found.length)binding=undefined;
  return Promise.resolve(resolve({data:found,error:null}));
 }};return b;
}
function request(action='attendance-finish',flags=5,overrides:Row={}) {
 const bytes=Buffer.alloc(37);bytes[32]=flags;
 return new Request('https://backend/?action='+action,{method:'POST',headers:{origin:'https://www.cyber-tmsah.site'},body:JSON.stringify({challengeId:'challenge',credential:{id:'key',response:{authenticatorData:bytes.toString('base64url')}},attendanceHash:'123456',deviceFingerprint:'a'.repeat(64),...overrides})});
}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('Deno',{env:{get:()=>undefined}});
 binding={challenge_id:'challenge',auth_id:'user-a',purpose:'attendance',attendance_hash:'123456',device_fingerprint:'a'.repeat(64),expires_at:'2099-01-01',selected_key:null};proofs=[];
 mocks.context.mockResolvedValue({data:{supabase:{auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})}}},error:null});
 mocks.verify.mockResolvedValue({data:{session:{access_token:'fresh',refresh_token:'refresh'},user:{id:'user-a'}},error:null});
 mocks.signOut.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({data:'native-key',error:null});
 mocks.admin.mockReturnValue({from:query,rpc:mocks.rpc});
 mocks.native.mockReturnValue({auth:{passkey:{verifyAuthentication:mocks.verify},signOut:mocks.signOut}});
});
describe('Supabase native verification boundary',()=>{
 it.each([5,29])('accepts verified device/synced flags %i and binds a one-use receipt',async flags=>{
  expect(await (await handlePasskeyRequest(request('attendance-finish',flags))).json()).toEqual({success:true,proofId:'proof'});
  expect(binding).toBeUndefined();expect(proofs[0]).toMatchObject({auth_id:'user-a',attendance_hash:'123456',credential_id:'key'});
  expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});
 });
 it.each([1,25,0])('refuses missing UV before asking Supabase to verify flags %i',async flags=>{
  expect(await (await handlePasskeyRequest(request('auth-finish',flags))).json()).toMatchObject({success:false,code:'USER_VERIFICATION_REQUIRED'});
  expect(mocks.verify).not.toHaveBeenCalled();expect(proofs).toHaveLength(0);
 });
 it('returns a session only from successful Supabase cryptographic verification',async()=>{
  mocks.verify.mockResolvedValueOnce({data:null,error:new Error('forged signature')});
  expect((await handlePasskeyRequest(request('auth-finish'))).status).toBe(403);
  const result=await (await handlePasskeyRequest(request('auth-finish'))).json();
  expect(result.session.access_token).toBe('fresh');expect(result.role).toBe('student');
 });
 it.each([{attendanceHash:'654321'},{deviceFingerprint:'b'.repeat(64)},{challengeId:'other'}])('rejects changed request binding %j',async overrides=>{
  expect((await handlePasskeyRequest(request('attendance-finish',5,overrides))).status).toBeGreaterThanOrEqual(400);
  expect(mocks.verify).not.toHaveBeenCalled();expect(proofs).toHaveLength(0);
 });
 it('refuses another account even after a valid native verification and revokes the temporary session',async()=>{
  mocks.verify.mockResolvedValue({data:{session:{access_token:'fresh'},user:{id:'user-b'}},error:null});
  expect((await handlePasskeyRequest(request())).status).toBe(403);expect(proofs).toHaveLength(0);expect(mocks.signOut).toHaveBeenCalled();
 });
 it('refuses replay and an expired request',async()=>{
  await handlePasskeyRequest(request());expect((await handlePasskeyRequest(request())).status).toBe(409);
  binding={challenge_id:'challenge',auth_id:'user-a',purpose:'attendance',expires_at:'2000-01-01'};
  expect((await handlePasskeyRequest(request())).status).toBe(409);
 });
 it('never converts a settings challenge into attendance',async()=>{
  binding!.purpose='verify';expect((await handlePasskeyRequest(request())).status).toBe(409);
 });
 it('binds a settings test to the selected native credential and returns no session',async()=>{
  Object.assign(binding!,{purpose:'verify',selected_key:'native-key'});
  expect(await (await handlePasskeyRequest(request('verify-finish'))).json()).toEqual({success:true,credentialId:'native-key'});
  expect(proofs).toHaveLength(0);
 });
 it('refuses a different selected key',async()=>{
  Object.assign(binding!,{purpose:'verify',selected_key:'another-key'});
  expect((await handlePasskeyRequest(request('verify-finish'))).status).toBe(403);
 });
 it('refuses an untrusted HTTP origin',async()=>{
  const req=new Request('https://backend/?action=auth-finish',{method:'POST',headers:{origin:'https://attacker.test'},body:'{}'});
  expect((await handlePasskeyRequest(req)).status).toBe(403);expect(mocks.verify).not.toHaveBeenCalled();
 });
});
