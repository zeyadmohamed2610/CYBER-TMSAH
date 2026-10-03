import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createHash,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {isoCBOR} from '@simplewebauthn/server/helpers';
import assert from 'node:assert/strict';
const url='https://clfhllujvxhfvhenvwfz.supabase.co',origin='https://www.cyber-tmsah.site';
const keys=JSON.parse(await readFile('.private/api-keys.json','utf8')),accounts=JSON.parse(await readFile('.private/test-accounts.json','utf8'));
const account=accounts.find(a=>a.role==='student');assert.equal(account.email,'qa.student.20261002@example.com');
const pub=keys.find(k=>k.type==='publishable').api_key;
const admin=createClient(url,keys.find(k=>k.type==='secret').api_key,{auth:{persistSession:false,experimental:{passkey:true}}});
const client=createClient(url,pub,{auth:{persistSession:false,experimental:{passkey:true}}});
const login=await client.auth.signInWithPassword({email:account.email,password:account.password});if(login.error)throw login.error;
const originalToken=login.data.session.access_token;let nativeId;
const edge=async(action,body)=>fetch(url+'/functions/v1/passkey-login?action='+action,{method:'POST',headers:{apikey:pub,Authorization:'Bearer '+originalToken,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
try {
 const options=await client.auth.passkey.startRegistration();if(options.error)throw options.error;
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=publicKey.export({format:'jwk'});
 const cose=isoCBOR.encode(new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x,'base64url')],[-3,Buffer.from(jwk.y,'base64url')]]));
 const id=randomBytes(32),length=Buffer.alloc(2);length.writeUInt16BE(id.length);
 const authData=Buffer.concat([createHash('sha256').update(options.data.options.rp.id).digest(),Buffer.from([69,0,0,0,0]),Buffer.alloc(16),length,id,cose]);
 const registration={id:id.toString('base64url'),rawId:id.toString('base64url'),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:Buffer.from(JSON.stringify({type:'webauthn.create',challenge:options.data.options.challenge,origin})).toString('base64url'),attestationObject:Buffer.from(isoCBOR.encode(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]]))).toString('base64url'),transports:['internal']}};
 const registered=await client.auth.passkey.verifyRegistration({challengeId:options.data.challenge_id,credential:registration});if(registered.error)throw registered.error;
 nativeId=registered.data.id;assert.ok(nativeId);console.log('Native registration: actual ES256 credential accepted');
 const assertion=(start,flags=5)=>{const cd=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:start.options.challenge,origin}));const ad=Buffer.concat([createHash('sha256').update(start.options.rpId).digest(),Buffer.from([flags,0,0,0,0])]);return {id:registration.id,rawId:registration.id,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:cd.toString('base64url'),authenticatorData:ad.toString('base64url'),signature:sign('sha256',Buffer.concat([ad,createHash('sha256').update(cd).digest()]),privateKey).toString('base64url'),userHandle:options.data.options.user.id}};};
 const start=await client.auth.passkey.startAuthentication();if(start.error)throw start.error;
 const good=await edge('auth-finish',{challengeId:start.data.challenge_id,credential:assertion(start.data)});assert.equal(good.success,true);assert.equal(good.user.id,account.authId);assert.ok(good.session.access_token);console.log('Native login: genuine Supabase session returned');
 const replay=await edge('auth-finish',{challengeId:start.data.challenge_id,credential:assertion(start.data)});assert.equal(replay.success,false);assert.equal(replay.session,undefined);console.log('Native challenge replay refused');
 const signatureStart=await client.auth.passkey.startAuthentication();const invalidSignature=assertion(signatureStart.data);invalidSignature.response.signature=randomBytes(72).toString('base64url');const refusedSignature=await edge('auth-finish',{challengeId:signatureStart.data.challenge_id,credential:invalidSignature});assert.equal(refusedSignature.success,false);assert.equal(refusedSignature.session,undefined);console.log('Invalid signature refused by native Auth');
 const badStart=await client.auth.passkey.startAuthentication();const bad=await edge('auth-finish',{challengeId:badStart.data.challenge_id,credential:assertion(badStart.data,1)});assert.equal(bad.code,'USER_VERIFICATION_REQUIRED');assert.equal(bad.session,undefined);console.log('Presence-only assertion refused');
 const verify=await edge('verify-start',{credentialId:nativeId});assert.equal(verify.success,true);
 const confirmed=await edge('verify-finish',{challengeId:verify.challengeId,credential:assertion(verify)});assert.equal(confirmed.success,true);assert.equal(confirmed.session,undefined);console.log('Settings verification: account bound, no exposed session');
 const attendance=await edge('attendance-start',{attendanceHash:'123456',deviceFingerprint:'a'.repeat(64)});assert.equal(attendance.success,true);
 const proof=await edge('attendance-finish',{challengeId:attendance.challengeId,credential:assertion(attendance),attendanceHash:'123456',deviceFingerprint:'a'.repeat(64)});assert.equal(proof.success,true);assert.ok(proof.proofId);
 const exists=await admin.from('attendance_biometric_proofs').select('native_credential_uuid').eq('id',proof.proofId).single();assert.equal(exists.data.native_credential_uuid,nativeId);
 const removed=await admin.auth.admin.passkey.deletePasskey({userId:account.authId,passkeyId:nativeId});if(removed.error)throw removed.error;nativeId=null;
 const deleted=await admin.from('attendance_biometric_proofs').select('id').eq('id',proof.proofId);assert.deepEqual(deleted.data,[]);console.log('Native key deletion revoked its unused attendance proof');
} finally {if(nativeId)await admin.auth.admin.passkey.deletePasskey({userId:account.authId,passkeyId:nativeId});await admin.from('native_passkey_requests').delete().eq('auth_id',account.authId);}

