import { createSupabaseContext } from "npm:@supabase/server@1.8.0";
import type { PasskeyContext } from "./context.ts";
import { json } from "./support.ts";

/** Change display metadata only; credential ownership and cryptographic data cannot change. */
export async function handleManagement({req, body, admin, serverEnv}: PasskeyContext) {
  const {data: context, error} = await createSupabaseContext(req, {auth: "user", env: serverEnv});
  if (error || !context) return json({success:false,error:'يرجى تسجيل الدخول مجددًا.'},401);
  const {data:{user},error:authError} = await context.supabase.auth.getUser();
  if (authError || !user) return json({success:false,error:'يرجى تسجيل الدخول مجددًا.'},401);
  const name = typeof body.deviceName === 'string' ? body.deviceName.trim() : '';
  if (!name || name.length > 80 || [...name].some(char=>char.charCodeAt(0)<32 || char.charCodeAt(0)===127) || typeof body.credentialId !== 'string') {
    return json({success:false,error:'اكتب اسمًا من 1 إلى 80 حرفًا.'},400);
  }
  const {data,error:updateError} = await admin.from('webauthn_credentials')
    .update({device_name:name}).eq('auth_id',user.id).eq('credential_id',body.credentialId).select('credential_id');
  if (updateError) return json({success:false,error:'تعذر حفظ الاسم. أعد المحاولة.'},503);
  if (data?.length !== 1) return json({success:false,error:'مفتاح الدخول غير موجود في حسابك.'},404);
  return json({success:true,credentialId:body.credentialId});
}
