import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const accounts=JSON.parse(await readFile('.private/test-accounts.json','utf8'));
const keys=JSON.parse(await readFile('.private/api-keys.json','utf8'));
const admin=createClient('https://clfhllujvxhfvhenvwfz.supabase.co',keys.find(k=>k.type==='secret').api_key,{auth:{persistSession:false}});
const student=accounts.find(a=>a.role==='student');
const env={...process.env,E2E_ALLOW_LIVE_AUTH:'1',E2E_PORT:process.env.E2E_PORT??'8085'};
for(const account of accounts){env[`E2E_${account.role.toUpperCase()}_IDENTIFIER`]=account.email;env[`E2E_${account.role.toUpperCase()}_PASSWORD`]=account.password;}
let failed=false;
const passkeys=process.env.E2E_LIVE_SUITE==='passkeys';
const sessionSuite=process.env.E2E_LIVE_SUITE==='sessions';
const sessionRun='QA browser sessions '+crypto.randomUUID();
if(sessionSuite)env.E2E_SESSION_RUN=sessionRun;
const originalAssignments=[];
if(accounts.some(a=>!/^qa\.[a-z]+\.20261002@example\.com$/.test(a.email)))throw new Error('Live runner only accepts dedicated QA accounts');
const fixtureIds=[];
const fixtureSessions=[];
const prepareAttendance=async()=>{
 const owner=accounts.find(a=>a.role==='owner');
 const client=createClient('https://clfhllujvxhfvhenvwfz.supabase.co',keys.find(k=>k.type==='publishable').api_key,{auth:{persistSession:false}});
 const login=await client.auth.signInWithPassword({email:owner.email,password:owner.password});if(login.error)throw login.error;
 const unit=await client.rpc('create_lecture',{p_subject_id:'da995757-05bf-4ca1-bfc1-80b601a018ac',p_title:'اختبار مؤقت للحضور من المتصفح '+crypto.randomUUID(),p_kind:'lecture',p_section:null});if(unit.error)throw unit.error;
 fixtureIds.push(unit.data.id);
 const session=await client.rpc('generate_rotating_hash',{p_subject_id:unit.data.subject_id,p_lecture_id:unit.data.id,p_duration_minutes:30});if(session.error)throw session.error;
 fixtureSessions.push(session.data.id);
 env.E2E_ATTENDANCE_CODE=session.data.short_code;
};
const clearPasskeys=async()=>{for(const account of accounts){const result=await admin.from('webauthn_credentials').delete().eq('auth_id',account.authId);if(result.error)throw result.error;}};
try{
 if(sessionSuite){
  const owner=accounts.find(account=>account.role==='owner');
  const client=createClient('https://clfhllujvxhfvhenvwfz.supabase.co',keys.find(key=>key.type==='publishable').api_key,{auth:{persistSession:false}});
  const login=await client.auth.signInWithPassword({email:owner.email,password:owner.password});if(login.error)throw login.error;
  for(const account of accounts.filter(account=>account.role==='doctor'||account.role==='ta')){
   const assigned=await client.rpc('get_user_subjects',{p_user_id:account.profileId});if(assigned.error)throw assigned.error;
   const profile=await admin.from('users').select('subject_id').eq('id',account.profileId).single();if(profile.error)throw profile.error;
   originalAssignments.push({id:account.profileId,ids:assigned.data.map(subject=>subject.subject_id),subjectId:profile.data.subject_id});
   const setup=await client.rpc('assign_user_subjects',{p_user_id:account.profileId,p_subject_ids:['da995757-05bf-4ca1-bfc1-80b601a018ac',...assigned.data.map(subject=>subject.subject_id)]});if(setup.error)throw setup.error;
  }
 }
 if(passkeys)await clearPasskeys();
 for(const project of ['chromium','mobile-chrome']){
  const reset=await admin.from('device_locks').delete().eq('student_auth_id',student.authId);if(reset.error)throw reset.error;
  if(passkeys)await clearPasskeys();
  if(passkeys)await prepareAttendance();
  const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test',sessionSuite?'e2e/sessions.spec.ts':passkeys?'e2e/passkeys.spec.ts':'e2e/authenticated.spec.ts',`--project=${project}`,'--workers=1'],{env,stdio:'inherit'});
  if(run.status!==0)failed=true;
 }
}finally{
 if(sessionSuite){
  const created=await admin.from('lectures').select('id').eq('subject_id','da995757-05bf-4ca1-bfc1-80b601a018ac').like('title',sessionRun+'%');if(created.error)throw created.error;
  fixtureIds.push(...created.data.map(lecture=>lecture.id));
  if(fixtureIds.length){const deleted=await admin.from('sessions').delete().in('lecture_id',fixtureIds);if(deleted.error)throw deleted.error;}
  for(const original of originalAssignments){
   const cleared=await admin.from('user_subjects').delete().eq('user_id',original.id);if(cleared.error)throw cleared.error;
   if(original.ids.length){const restored=await admin.from('user_subjects').insert(original.ids.map(subjectId=>({user_id:original.id,subject_id:subjectId})));if(restored.error)throw restored.error;}
   const profile=await admin.from('users').update({subject_id:original.subjectId}).eq('id',original.id);if(profile.error)throw profile.error;
  }
 }
 for(const id of fixtureSessions){const result=await admin.from('sessions').delete().eq('id',id);if(result.error)throw result.error;}
 for(const id of fixtureIds){const result=await admin.from('lectures').delete().eq('id',id);if(result.error)throw result.error;}
 if(passkeys)await clearPasskeys();
 const reset=await admin.from('device_locks').delete().eq('student_auth_id',student.authId);if(reset.error)throw reset.error;
}
if(failed)process.exitCode=1;
