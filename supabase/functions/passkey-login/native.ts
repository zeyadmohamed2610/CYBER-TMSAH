import {createSupabaseContext} from 'npm:@supabase/server@1.8.0';
import {passkeyAdmin,nativePasskeyClient} from './context.ts';
import {corsHeaders,json,isAllowedOrigin} from './support.ts';
import {readJsonObject, RequestFailure} from '../_shared/request.ts';
interface PasskeyRequestBody {
 action?:string; challengeId:string; credentialId?:string; attendanceHash?:string; deviceFingerprint?:string;
 credential:Parameters<ReturnType<typeof nativePasskeyClient>['auth']['passkey']['verifyAuthentication']>[0]['credential'];
}
const actions=new Set(['auth-finish','verify-start','verify-finish','attendance-start','attendance-finish']);
export async function handlePasskeyRequest(req:Request):Promise<Response> {
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 if(req.method!=='POST')return json({success:false,error:'Method not allowed'},405);
 if(!isAllowedOrigin(req.headers.get('origin')??''))return json({success:false,error:'نطاق الموقع غير معتمد.'},403);
 try {
  const body=await readJsonObject(req,65_536) as unknown as PasskeyRequestBody;
  const action=new URL(req.url).searchParams.get('action')??body.action;
  if(!action || !actions.has(action))return json({success:false,error:'Unknown action'},400);
  const env={
   ...(Deno.env.get('APP_SUPABASE_PUBLISHABLE_KEY')?{publishableKeys:{default:Deno.env.get('APP_SUPABASE_PUBLISHABLE_KEY')!}}:{}),
   ...(Deno.env.get('APP_SUPABASE_SECRET_KEY')?{secretKeys:{default:Deno.env.get('APP_SUPABASE_SECRET_KEY')!}}:{}),
  };
  const admin=passkeyAdmin(env),native=nativePasskeyClient(env);
  let userId:string|undefined;
  if(action!=='auth-finish') {
   const {data:context,error}=await createSupabaseContext(req,{auth:'user',env});
   if(error||!context)return json({success:false,error:'يرجى تسجيل الدخول مجددًا.'},401);
   const {data:{user},error:authError}=await context.supabase.auth.getUser();
   if(authError||!user)return json({success:false,error:'يرجى تسجيل الدخول مجددًا.'},401);
   userId=user.id;
  }
  const attendance=action.startsWith('attendance-');
  if(action.endsWith('-start')) {
   const listed=await admin.auth.admin.passkey.listPasskeys({userId:userId!});
   if(listed.error)return json({success:false,error:'تعذر تحميل مفاتيح الدخول.'},503);
   if(!listed.data?.length)return json({success:false,noPasskeyRegistered:true,error:'أضف مفتاح دخول لحسابك أولًا.'});
   if(!attendance && !listed.data.some(key=>key.id===body.credentialId))return json({success:false,error:'المفتاح لا يخص حسابك.'},403);
   if(attendance && (!/^\d{6}$/.test(body.attendanceHash??'') || !/^(?:[a-f0-9]{64}|fb[a-f0-9]{16})$/i.test(body.deviceFingerprint??'')))return json({success:false,error:'راجع رمز الحضور والجهاز.'},400);
   const start=await native.auth.passkey.startAuthentication();
   if(start.error||!start.data)return json({success:false,error:'تعذر بدء التحقق.'},503);
   const inserted=await admin.from('native_passkey_requests').insert({challenge_id:start.data.challenge_id,auth_id:userId,purpose:attendance?'attendance':'verify',attendance_hash:attendance?body.attendanceHash:null,device_fingerprint:attendance?body.deviceFingerprint:null,selected_key:attendance?null:body.credentialId});
   if(inserted.error)return json({success:false,error:'تعذر بدء التحقق.'},503);
   await admin.from('native_passkey_requests').delete().lt('expires_at',new Date().toISOString());
   return json({success:true,challengeId:start.data.challenge_id,options:start.data.options});
  }
  let binding:Record<string,unknown>|undefined;
  if(action!=='auth-finish') {
   const claimed=await admin.from('native_passkey_requests').delete().eq('challenge_id',body.challengeId).eq('auth_id',userId!).eq('purpose',attendance?'attendance':'verify').gt('expires_at',new Date().toISOString()).select('*');
   if(claimed.error||claimed.data?.length!==1)return json({success:false,error:'انتهى طلب التحقق أو استُخدم. أعد المحاولة.'},409);
   binding=claimed.data[0];
   if(attendance && (binding!.attendance_hash!==body.attendanceHash || binding!.device_fingerprint!==body.deviceFingerprint))return json({success:false,error:'تغير رمز الحضور أو الجهاز. أعد التحقق.'},403);
  }
  const encoded=body.credential?.response?.authenticatorData;
  if(typeof encoded!=='string')return json({success:false,error:'Invalid credential'},400);
  let flags=0;
  try {const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=')),c=>c.charCodeAt(0));if(bytes.length>=37)flags=bytes[32];}catch{/* reject below */}
  if(!(flags&1)||!(flags&4))return json({success:false,code:'USER_VERIFICATION_REQUIRED',error:'لم يصل تأكيد هويتك من مفتاح الدخول. أكمل البصمة أو الوجه أو رمز قفل الجهاز.'},403);
  // UV is inside the signed data: changing this bit fails Supabase's signature verification.
  const verified=await native.auth.passkey.verifyAuthentication({challengeId:body.challengeId,credential:body.credential});
  if(verified.error||!verified.data?.session||!verified.data.user)return json({success:false,error:'تعذر التحقق من مفتاح الدخول. أعد المحاولة.'},403);
  if(action==='auth-finish') {
   const profile=await admin.from('users').select('role').eq('auth_id',verified.data.user.id).maybeSingle();
   return json({success:true,session:verified.data.session,user:verified.data.user,role:profile.data?.role??null});
  }
  try {
   if(verified.data.user.id!==userId)return json({success:false,error:'اختر مفتاحًا يخص الحساب الحالي.'},403);
   const key=await admin.rpc('lookup_native_passkey',{p_auth_id:userId,p_credential_id:body.credential.id});
   if(key.error||!key.data||binding!.selected_key && binding!.selected_key!==key.data)return json({success:false,error:'اختر مفتاح الدخول المحدد من حسابك.'},403);
   if(!attendance)return json({success:true,credentialId:key.data});
   const proof=await admin.from('attendance_biometric_proofs').insert({auth_id:userId,credential_id:body.credential.id,attendance_hash:binding!.attendance_hash,device_fingerprint:binding!.device_fingerprint}).select('id').single();
   if(proof.error||!proof.data)return json({success:false,error:'تعذر تأكيد الحضور. أعد التحقق.'},503);
   return json({success:true,proofId:proof.data.id});
  }finally {await native.auth.signOut({scope:'local'});}
 }catch(error) {return json({success:false,error:error instanceof RequestFailure?error.message:'تعذر إكمال التحقق. أعد المحاولة.'},error instanceof RequestFailure?error.status:500);}
}
