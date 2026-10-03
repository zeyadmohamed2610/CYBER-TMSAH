import { computeFingerprint } from '@/features/attendance/utils/fingerprint';
import { supabase } from '../supabaseClient';
import { createPasskey, getPasskeyAssertion, isWebAuthnSupported, logPasskeyVerification } from './browser';
import { PasskeyError, passkeyFailure } from './errors';
import { currentPasskeySession, passkeyRequest } from './service';
import { clearAllLocalPasskeys } from './legacyHints';

let inProgress = false;
export interface PasskeyResult {
  success:boolean;
  error?:string;
  code?:string;
  cancelled?:boolean;
  noPasskeyRegistered?:boolean;
  credentialId?:string;
  user?:unknown;
  role?:string|null;
}
async function ceremony(work:()=>Promise<PasskeyResult>):Promise<PasskeyResult> {
  if (inProgress) return passkeyFailure(new PasskeyError('أكمل طلب البصمة الحالي أولًا.','CEREMONY_IN_PROGRESS'));
  if (!isWebAuthnSupported()) return passkeyFailure(new PasskeyError('الدخول بالبصمة غير متاح في هذا المتصفح.','UNSUPPORTED_BROWSER'));
  inProgress = true;
  clearAllLocalPasskeys();
  try { return await work(); } catch(error) { return passkeyFailure(error); } finally { inProgress = false; }
}

export function registerPasskey(deviceName?:string) {
  return ceremony(async()=>{
    const token = await currentPasskeySession();
    if (!token) throw new PasskeyError('يرجى تسجيل الدخول مجددًا.');
    const start = await supabase.auth.passkey.startRegistration();
    if(start.error || !start.data)throw new PasskeyError('تعذر إضافة مفتاح الدخول. تأكد من تسجيل الدخول وتأكيد بريدك الإلكتروني.');
    const credential = await createPasskey(start.data.options);
    const finish = await supabase.auth.passkey.verifyRegistration({challengeId:start.data.challenge_id,credential});
    if(finish.error || !finish.data?.id)throw new PasskeyError('تعذر حفظ مفتاح الدخول. قد يكون مسجلًا من قبل أو وصلت للحد المسموح.');
    if(deviceName) await supabase.auth.passkey.update({passkeyId:finish.data.id,friendlyName:deviceName});
    return {success:true as const,credentialId:finish.data.id};
  });
}

type Purpose = 'login'|'verify'|'attendance';
async function assertionCeremony(purpose: Purpose, input: {identifier?:string;credentialId?:string;attendanceHash?:string}) {
  const token = purpose === 'login' ? undefined : await currentPasskeySession();
  const prefix = purpose === 'login' ? 'auth' : purpose === 'verify' ? 'verify' : 'attendance';
  const fingerprint=purpose==='attendance' ? await computeFingerprint() : undefined;
  const nativeStart=purpose==='login' ? await supabase.auth.passkey.startAuthentication() : null;
  if(nativeStart?.error)throw new PasskeyError('تعذر بدء الدخول بمفتاحك. أعد المحاولة.');
  const start = purpose==='login' ? {options:nativeStart?.data?.options,challengeId:nativeStart?.data?.challenge_id} : await passkeyRequest(purpose==='verify' ? 'verify-start' : 'attendance-start',{
    ...(purpose === 'verify' ? {credentialId:input.credentialId} : {}),
    ...(purpose === 'attendance' ? {attendanceHash:input.attendanceHash,deviceFingerprint:fingerprint} : {}),
  },token);
  const credential = await getPasskeyAssertion(start.options);
  try {
    const finish = await passkeyRequest(`${prefix}-finish`,{
      credential,
      challengeId:start.challengeId,
      ...(purpose === 'attendance' ? {attendanceHash:input.attendanceHash,deviceFingerprint:fingerprint} : {}),
    },token);
    return finish;
  } catch(error) {
    if (error instanceof PasskeyError && error.code === 'USER_VERIFICATION_REQUIRED') logPasskeyVerification(`${prefix}-finish`,credential.response.authenticatorData);
    throw error;
  }
}

export function authenticateWithPasskey(identifier?:string,verificationCredentialId?:string) {
  return ceremony(async()=>{
    if (verificationCredentialId) {
      await assertionCeremony('verify',{credentialId:verificationCredentialId});
      return {success:true as const};
    }
    const finish = await assertionCeremony('login',{...(identifier ? {identifier} : {})});
    if (!finish.session?.access_token || !finish.session.refresh_token) throw new PasskeyError('تعذر إنشاء جلسة الدخول. أعد المحاولة.','INVALID_RESPONSE');
    const {data,error} = await supabase.auth.setSession({access_token:finish.session.access_token,refresh_token:finish.session.refresh_token});
    if (error || !data.session || !data.user) throw new PasskeyError('تعذر إكمال تسجيل الدخول. أعد المحاولة.','SESSION_EXCHANGE_FAILED');
    return {success:true as const,user:data.user,role:finish.role ?? null};
  });
}

export function verifyPasskeyForCurrentUser(attendanceHash:string) {
  return ceremony(async()=>{
    if (!/^\d{6}$/.test(attendanceHash)) throw new PasskeyError('أدخل رمز الحضور المكوّن من ستة أرقام.','INVALID_ATTENDANCE_CODE');
    const finish = await assertionCeremony('attendance',{attendanceHash});
    if (!finish.proofId) throw new PasskeyError('تعذر تأكيد الحضور. أعد التحقق.','INVALID_RESPONSE');
    return {success:true as const,credentialId:finish.proofId};
  });
}
