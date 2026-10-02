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
try{
 for(const project of ['chromium','mobile-chrome']){
  const reset=await admin.from('device_locks').delete().eq('student_auth_id',student.authId);if(reset.error)throw reset.error;
  const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','e2e/authenticated.spec.ts',`--project=${project}`,'--workers=1'],{env,stdio:'inherit'});
  if(run.status!==0)failed=true;
 }
}finally{
 const reset=await admin.from('device_locks').delete().eq('student_auth_id',student.authId);if(reset.error)throw reset.error;
}
if(failed)process.exitCode=1;
