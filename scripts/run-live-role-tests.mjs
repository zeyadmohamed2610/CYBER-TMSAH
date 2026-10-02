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
 if(passkeys)await clearPasskeys();
 for(const project of ['chromium','mobile-chrome']){
  const reset=await admin.from('device_locks').delete().eq('student_auth_id',student.authId);if(reset.error)throw reset.error;
  if(passkeys)await clearPasskeys();
  if(passkeys)await prepareAttendance();
  const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test',passkeys?'e2e/passkeys.spec.ts':'e2e/authenticated.spec.ts',`--project=${project}`,'--workers=1'],{env,stdio:'inherit'});
  if(run.status!==0)failed=true;
 }
}finally{
 for(const id of fixtureSessions){const result=await admin.from('sessions').delete().eq('id',id);if(result.error)throw result.error;}
 for(const id of fixtureIds){const result=await admin.from('lectures').delete().eq('id',id);if(result.error)throw result.error;}
 if(passkeys)await clearPasskeys();
 const reset=await admin.from('device_locks').delete().eq('student_auth_id',student.authId);if(reset.error)throw reset.error;
}
if(failed)process.exitCode=1;
