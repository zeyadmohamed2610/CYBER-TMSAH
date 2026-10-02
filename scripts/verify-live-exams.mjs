import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url='https://clfhllujvxhfvhenvwfz.supabase.co';
const keys=JSON.parse(await readFile('.private/api-keys.json','utf8'));
const accounts=JSON.parse(await readFile('.private/test-accounts.json','utf8'));
if(accounts.some(a=>!/^qa\.[a-z]+\.20261002@example\.com$/.test(a.email)))throw new Error('Dedicated QA accounts required');
const clients={};
for(const role of ['owner','coordinator','student']){
 const a=accounts.find(a=>a.role===role);
 const c=createClient(url,keys.find(k=>k.type==='publishable').api_key,{auth:{persistSession:false}});
 const login=await c.auth.signInWithPassword({email:a.email,password:a.password});if(login.error)throw login.error;
 clients[role]=c;
}
const paths=[];const ids=[];
const check=(name,result)=>{assert.ok(result,name);console.log('PASS '+name);};
try{
 for(const [role,department] of [['owner','cybersecurity'],['coordinator','cybersecurity'],['owner','ai']]){
  const c=clients[role];const path=`${department}/1/qa-${crypto.randomUUID()}.pdf`;paths.push(path);
  const upload=await c.storage.from('exam-files').upload(path,new TextEncoder().encode('%PDF-1.4\n% QA temporary exam fixture\n%%EOF'),{contentType:'application/pdf'});
  if(upload.error)throw upload.error;
  check(role+' uploads scoped exam file',!upload.error);
  const {data:{publicUrl}}=c.storage.from('exam-files').getPublicUrl(path);
  const saved=await c.rpc('save_academic_exam',{p_department:department,p_year:'1',p_exam:{title:'اختبار مؤقت للامتحانات',exam_type:'midterm',file_url:publicUrl,file_name:'qa.pdf',section:null}});
  if(saved.error)throw saved.error;ids.push(saved.data);
  const read=await clients.student.from('exam_schedules').select('id').eq('id',saved.data);
  check('student exam scope '+department,!read.error&&read.data.length===(department==='cybersecurity'?1:0));
  if(department==='cybersecurity')check('exam file can be downloaded',(await fetch(publicUrl)).ok);
  else{
   const other=await clients.coordinator.from('exam_schedules').select('id').eq('id',saved.data);
   check('coordinator cannot read foreign exam',!other.error&&other.data.length===0);
   check('coordinator cannot delete foreign exam',!!(await clients.coordinator.rpc('delete_academic_exam',{p_id:saved.data})).error);
  }
 }
 const denied=await clients.coordinator.storage.from('exam-files').upload(`ai/1/qa-${crypto.randomUUID()}.pdf`,new Uint8Array([1]),{contentType:'application/pdf'});
 check('coordinator cannot upload outside department',!!denied.error);
}finally{
 for(const id of ids){const r=await clients.owner.rpc('delete_academic_exam',{p_id:id});if(r.error)throw r.error;}
 const cleanup=await clients.owner.storage.from('exam-files').remove(paths);if(cleanup.error)throw cleanup.error;
}
