import { createSupabaseContext } from 'npm:@supabase/server@1.8.0';
import { corsHeaders, isAllowedOrigin, json } from '../passkey-login/support.ts';
import { readJsonObject, RequestFailure, serverEnvironment } from '../_shared/request.ts';
export async function handleCreateUser(request: Request): Promise<Response> {
 if(request.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(!isAllowedOrigin(request.headers.get('origin')??''))return json({error:'Origin not allowed'},403);
 try {
  const {data:context,error}=await createSupabaseContext(request,{auth:'user',env:serverEnvironment()});
  if(error||!context)return json({error:'Authentication required'},401);
  const fresh=await context.supabase.auth.getUser();
  if(fresh.error||!fresh.data.user)return json({error:'Authentication required'},401);
  const body=await readJsonObject(request);
  const role=body.role;
  if(!['student','doctor','ta'].includes(String(role)))return json({error:'Invalid role'},400);
  if(typeof body.name!=='string'||body.name.trim().length<3||body.name.length>120||typeof body.password!=='string'||body.password.length<8||new TextEncoder().encode(body.password).length>72)return json({error:'Invalid account details'},400);
  const profile=await context.supabase.from('users').select('role,department').eq('auth_id',fresh.data.user.id).single();
  if(profile.error||!['owner','coordinator'].includes(profile.data?.role))return json({error:'Permission denied'},403);
  const nid=typeof body.national_id==='string'?body.national_id:null;
  const email=role==='student'&&nid&&/^\d{14}$/.test(nid)?`${nid}@nid.local`:body.email;
  if(typeof email!=='string'||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Invalid email'},400);
  const username=typeof body.username==='string'?body.username:email.split('@')[0];
  const department=typeof body.department==='string'?body.department:profile.data.department;
  if(typeof department!=='string'||!department)return json({error:'Department required'},400);
  // The same transactional RPC used by the dashboard enforces department/rank bounds.
  const result=await context.supabase.rpc('admin_create_user',{p_full_name:body.name.trim(),p_username:username,p_email:email.toLowerCase(),p_password:body.password,p_role:role,p_department:department,p_academic_year:typeof body.academic_year==='string'?body.academic_year:null,p_section_number:Number.isInteger(body.section_number)?body.section_number:null,p_subject_id:typeof body.subject_id==='string'?body.subject_id:null});
  if(result.error)return json({error:'Could not create account. Check its details and permissions.'},400);
  return json({success:true,user:{id:result.data,name:body.name.trim(),role}});
 }catch(error){return json({error:error instanceof RequestFailure?error.message:'Could not create account'},error instanceof RequestFailure?error.status:500);}
}
