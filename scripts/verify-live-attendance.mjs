import { readFile, writeFile } from 'node:fs/promises';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const keys=JSON.parse(await readFile('.private/api-keys.json','utf8'));
const accounts=JSON.parse(await readFile('.private/test-accounts.json','utf8'));
if(accounts.some(a=>!/^qa\.[a-z]+\.20261002@example\.com$/.test(a.email)))throw new Error('Dedicated QA accounts required');
const url='https://clfhllujvxhfvhenvwfz.supabase.co';
const publishable=keys.find(k=>k.type==='publishable').api_key;
const admin=createClient(url,keys.find(k=>k.type==='secret').api_key,{auth:{persistSession:false}});
const clients={}; const sessions={}; const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};
for(const account of accounts){
 const client=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await client.auth.signInWithPassword({email:account.email,password:account.password});
 if(result.error)throw result.error;
 clients[account.role]=client;sessions[account.role]=result.data.session;
 check(account.role+' login',!!result.data.user);
 const summary=await client.rpc('get_attendance_summary',{p_sections:null});
 if(summary.error)throw summary.error;
 check(account.role+' summary',!!summary.data.dashboard);
}
const student=accounts.find(a=>a.role==='student');
const baseline=await clients.student.rpc('get_attendance_register',{p_limit:500,p_offset:0});if(baseline.error)throw baseline.error;
const baselinePresent=baseline.data.filter(r=>r.status==='present').length;
const baselineAbsent=baseline.data.filter(r=>r.status==='absent').length;
await admin.from('device_locks').delete().eq('student_auth_id',student.authId);
const foreignSubject='8e9a9733-3972-4284-865f-890f972d782d';
const foreign = await admin.from('subjects').upsert({id:foreignSubject,name:'مادة اختبار قسم آخر',doctor_name:'اختبار',department:'ai',academic_year:'1'});
if(foreign.error)throw foreign.error;
const foreignCreate=await clients.doctor.rpc('create_lecture',{p_subject_id:foreignSubject,p_title:'غير مصرح'});
check('doctor cannot manage another department subject',!!foreignCreate.error);
const foreignCoordinator=await clients.coordinator.rpc('create_lecture',{p_subject_id:foreignSubject,p_title:'غير مصرح'});
check('coordinator cannot manage another department',!!foreignCoordinator.error);
const otherProfiles=await clients.student.from('users').select('id').neq('id',student.profileId);
if(otherProfiles.error)throw otherProfiles.error;
check('student sees only own profile',otherProfiles.data.length===0);
const deniedRole=await clients.student.from('users').update({role:'owner'}).eq('id',student.profileId);
check('student cannot elevate role',!!deniedRole.error);
const deniedLecture=await clients.student.rpc('create_lecture',{p_subject_id:'da995757-05bf-4ca1-bfc1-80b601a018ac',p_title:'غير مصرح'});
check('student cannot create lecture',!!deniedLecture.error);
const anon=createClient(url,publishable,{auth:{persistSession:false}});
check('anonymous cannot read register',!!(await anon.rpc('get_attendance_register')).error);
const lectures=[];
const originalAssignments=[];
const edge=async(action,body={})=>{
 const response=await fetch(url+'/functions/v1/passkey-login?action='+action,{method:'POST',headers:{
  apikey:publishable,Authorization:'Bearer '+sessions.student.access_token,'Content-Type':'application/json',Origin:'http://localhost:8080'},body:JSON.stringify(body)});
 const payload=await response.json();if(!response.ok||!payload.success)throw new Error(action+': '+JSON.stringify(payload));return payload;
};
try{
 for (const role of ['doctor','ta']) {
  const account=accounts.find(a=>a.role===role);
  const assigned=await clients.owner.rpc('get_user_subjects',{p_user_id:account.profileId});if(assigned.error)throw assigned.error;
  const profile=await admin.from('users').select('subject_id').eq('id',account.profileId).single();if(profile.error)throw profile.error;
  const ids=assigned.data.map(s=>s.subject_id);
  originalAssignments.push({id:account.profileId,ids,subjectId:profile.data.subject_id});
  const setup=await clients.owner.rpc('assign_user_subjects',{p_user_id:account.profileId,p_subject_ids:[...new Set([...ids,'da995757-05bf-4ca1-bfc1-80b601a018ac'])]});if(setup.error)throw setup.error;
 }
 for(const role of ['doctor','ta']){
  const result=await clients[role].rpc('create_lecture',{p_subject_id:'da995757-05bf-4ca1-bfc1-80b601a018ac',p_title:'اختبار حضور '+(role==='doctor'?'الدكتور':'المعيد')+' '+Date.now(),p_kind:role==='ta'?'section':'lecture',p_section:role==='ta'?'1':null});
  if(result.error)throw result.error;lectures.push(result.data.id);check(role+' creates lecture',!!result.data.id);
 }
 const generated=await clients.doctor.rpc('generate_rotating_hash',{p_subject_id:'da995757-05bf-4ca1-bfc1-80b601a018ac',p_lecture_id:lectures[0],p_duration_minutes:10,p_section:null,p_latitude:30,p_longitude:31,p_radius_meters:50});
 if(generated.error)throw generated.error;
 const session=generated.data;check('doctor creates scoped session',!!session.id);
 const direct=await clients.student.from('attendance').insert({student_id:student.profileId,session_id:session.id});
 check('direct student attendance denied',!!direct.error);
 const missingLocation=await clients.student.rpc('submit_attendance',{p_hash:session.short_code,p_device_fingerprint:'a'.repeat(64),p_biometric_credential_id:'fake-proof'});
 check('session requiring location rejects missing coordinates',missingLocation.error?.message.includes('location_denied'));
 const distantLocation=await clients.student.rpc('submit_attendance',{p_hash:session.short_code,p_device_fingerprint:'a'.repeat(64),p_biometric_credential_id:'fake-proof',p_student_latitude:30.02,p_student_longitude:31});
 check('session rejects coordinates outside classroom radius',distantLocation.error?.message.includes('location_denied'));
 const fake=await clients.student.rpc('submit_attendance',{p_hash:session.short_code,p_device_fingerprint:'a'.repeat(64),p_biometric_credential_id:'fake-proof',p_student_latitude:30,p_student_longitude:31});
 check('fake attendance receipt denied',!!fake.error);
 const before=await clients.student.rpc('get_attendance_register',{p_lecture_id:lectures[0]});
 if(before.error)throw before.error;check('open session is pending, not absent',before.data[0]?.status==='pending');
 const registration=await edge('register-start');
 const options=registration.options ?? registration;
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const jwk=publicKey.export({format:'jwk'});
 const cose=isoCBOR.encode(new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x,'base64url')],[-3,Buffer.from(jwk.y,'base64url')]]));
 const credentialId=randomBytes(32);const length=Buffer.alloc(2);length.writeUInt16BE(credentialId.length);
 const clientData=Buffer.from(JSON.stringify({type:'webauthn.create',challenge:options.challenge,origin:'http://localhost:8080'}));
 const authData=Buffer.concat([createHash('sha256').update('localhost').digest(),Buffer.from([0x45,0,0,0,0]),Buffer.alloc(16),length,credentialId,Buffer.from(cose)]);
 const attestation=isoCBOR.encode(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]]));
 const cred={id:credentialId.toString('base64url'),rawId:credentialId.toString('base64url'),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:clientData.toString('base64url'),attestationObject:Buffer.from(attestation).toString('base64url'),transports:['internal']}};
 await edge('register-finish',{credential:cred});check('actual WebAuthn registration',true);
 let counter=0;
 const proof=async(code)=>{
  const started=await edge('attendance-start',{attendanceHash:code,deviceFingerprint:'a'.repeat(64)});
  const opt=started.options??started;const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:opt.challenge,origin:'http://localhost:8080'}));
  const count=Buffer.alloc(4);count.writeUInt32BE(++counter);
  const auth=Buffer.concat([createHash('sha256').update('localhost').digest(),Buffer.from([5]),count]);
  const credential={id:cred.id,rawId:cred.id,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:client.toString('base64url'),authenticatorData:auth.toString('base64url'),signature:sign('sha256',Buffer.concat([auth,createHash('sha256').update(client).digest()]),privateKey).toString('base64url'),userHandle:null}};
  return edge('attendance-finish',{credential,attendanceHash:code,deviceFingerprint:'a'.repeat(64)});
 };
 const receipt=await proof(session.short_code);
 check('signed attendance yields receipt',!!receipt.proofId);
 const submitted=await clients.student.rpc('submit_attendance',{p_hash:session.short_code,p_device_fingerprint:'a'.repeat(64),p_biometric_credential_id:receipt.proofId,p_student_latitude:30,p_student_longitude:31});
 if(submitted.error)throw submitted.error;check('verified attendance stored',!!submitted.data.id);
 const replay=await clients.student.rpc('submit_attendance',{p_hash:session.short_code,p_device_fingerprint:'a'.repeat(64),p_biometric_credential_id:receipt.proofId,p_student_latitude:30,p_student_longitude:31});
 check('replay blocked',!!replay.error);
 const second=await clients.doctor.rpc('generate_rotating_hash',{p_subject_id:session.subject_id,p_lecture_id:lectures[0],p_duration_minutes:10});
 if(second.error)throw second.error;
 const duplicateReceipt=await proof(second.data.short_code);
 const duplicate=await clients.student.rpc('submit_attendance',{p_hash:second.data.short_code,p_device_fingerprint:'a'.repeat(64),p_biometric_credential_id:duplicateReceipt.proofId});
 check('same lecture cannot count twice',!!duplicate.error);
 const ended=await clients.doctor.rpc('end_lecture',{p_lecture_id:lectures[0]});if(ended.error)throw ended.error;
 const register=await clients.student.rpc('get_attendance_register',{p_lecture_id:lectures[0]});if(register.error)throw register.error;
 check('one present row for two sessions',register.data.length===1&&register.data[0].status==='present');
 const absentSession=await clients.ta.rpc('generate_rotating_hash',{p_subject_id:session.subject_id,p_lecture_id:lectures[1],p_duration_minutes:10});if(absentSession.error)throw absentSession.error;
 const absentEnd=await clients.ta.rpc('end_lecture',{p_lecture_id:lectures[1]});if(absentEnd.error)throw absentEnd.error;
 const absent=await clients.student.rpc('get_attendance_register',{p_lecture_id:lectures[1]});if(absent.error)throw absent.error;
 check('closed unattended lecture is absent',absent.data[0]?.status==='absent');
 const summary=await clients.student.rpc('get_attendance_summary');if(summary.error)throw summary.error;
 const expectedRate=100*(baselinePresent+1)/(baselinePresent+baselineAbsent+2);
 check('one present and one absent unit update the real denominator',Math.abs(Number(summary.data.dashboard.attendanceRate)-expectedRate)<0.0001);
 const noReason=await clients.owner.rpc('add_manual_attendance',{p_student_id:student.profileId,p_session_id:absentSession.data.id,p_reason:''});
 check('manual correction requires reason',!!noReason.error);
 const corrected=await clients.owner.rpc('add_manual_attendance',{p_student_id:student.profileId,p_session_id:absentSession.data.id,p_reason:'تصحيح حضور موثق للاختبار'});
 if(corrected.error)throw corrected.error;
 check('manual correction stores author and reason',corrected.data.metadata.reason==='تصحيح حضور موثق للاختبار'&&!!corrected.data.metadata.recorded_by);
 const afterCorrection=await clients.student.rpc('get_attendance_register',{p_lecture_id:lectures[1]});if(afterCorrection.error)throw afterCorrection.error;
 check('manual correction updates absence to present',afterCorrection.data[0]?.status==='present');
 await admin.from('attendance').delete().eq('id',corrected.data.id);
 await writeFile('.private/live-verification.json',JSON.stringify({checks,lectureIds:lectures,completedAt:new Date().toISOString()},null,2));
}finally{
 if(lectures.length){
  const removedSessions=await admin.from('sessions').delete().in('lecture_id',lectures);if(removedSessions.error)throw removedSessions.error;
  const removedLectures=await admin.from('lectures').delete().in('id',lectures);if(removedLectures.error)throw removedLectures.error;
 }
 // Reset only the dedicated QA student's temporary credentials and device lock.
 await admin.from('webauthn_credentials').delete().eq('auth_id',student.authId);
 await admin.from('device_locks').delete().eq('student_auth_id',student.authId);
 await admin.from('attendance_biometric_proofs').delete().eq('auth_id',student.authId);
 await admin.from('subjects').delete().eq('id',foreignSubject);
 for (const original of originalAssignments) {
  const restored=await clients.owner.rpc('assign_user_subjects',{p_user_id:original.id,p_subject_ids:original.ids});if(restored.error)throw restored.error;
  const primary=await admin.from('users').update({subject_id:original.subjectId}).eq('id',original.id);if(primary.error)throw primary.error;
 }
}
