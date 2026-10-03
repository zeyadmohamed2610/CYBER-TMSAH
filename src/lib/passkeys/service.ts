import { supabase } from '../supabaseClient';
import { PasskeyError } from './errors';

export type PasskeyAction = 'register-start'|'register-finish'|'auth-start'|'auth-finish'|'verify-start'|'verify-finish'|'attendance-start'|'attendance-finish';
export interface PasskeyResponse {
  success: boolean;
  options?: unknown;
  credentialId?: string;
  proofId?: string;
  hashed_token?: string;
  role?: string;
  error?: string;
  code?: string;
  noPasskeyRegistered?: boolean;
}

export async function currentPasskeySession() {
  const {data,error} = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new PasskeyError('يرجى تسجيل الدخول مجددًا.','SESSION_REQUIRED');
  return data.session.access_token;
}

export async function passkeyRequest(action: PasskeyAction, body: Record<string,unknown>, token?: string): Promise<PasskeyResponse> {
  const {data,error} = await supabase.functions.invoke(`passkey-login?action=${action}`, {
    body:{action,...body},
    headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},
  });
  let response = data as PasskeyResponse | null;
  // Preserve an authenticated error response even when the function uses a 4xx status.
  if (error && error.context instanceof Response) {
    response = await error.context.clone().json().catch(()=>null) as PasskeyResponse | null;
  }
  if (error || response?.success !== true) {
    const failure = new PasskeyError(response?.error ?? 'تعذر الاتصال بخدمة الدخول. أعد المحاولة.',response?.code ?? 'VERIFICATION_FAILED',false,response?.noPasskeyRegistered === true);
    console.error(`[WebAuthn] ${action} failed:`,failure.code,failure.message);
    throw failure;
  }
  return response;
}
