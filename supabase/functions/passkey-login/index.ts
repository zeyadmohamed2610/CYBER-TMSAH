/** Passkey HTTP boundary. Crypto ceremonies and platform policy live in focused modules. */
import { passkeyAdmin } from "./context.ts";
import { handleRegistration } from "./registration.ts";
import { handleAuthentication } from "./authentication.ts";
import { corsHeaders, json } from "./support.ts";

const actions = new Set(['register-start','register-finish','auth-start','auth-finish','verify-start','verify-finish','attendance-start','attendance-finish']);
export async function handlePasskeyRequest(req:Request):Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null,{headers:corsHeaders});
  if (req.method !== 'POST') return json({success:false,error:'Method not allowed'},405);
  try {
    const body:unknown = await req.json().catch(()=>null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({success:false,error:'Invalid request'},400);
    const payload = body as Record<string,unknown>;
    const action = new URL(req.url).searchParams.get('action') ?? payload.action;
    if (typeof action !== 'string' || !actions.has(action)) return json({success:false,error:'Unknown action'},400);
    const serverEnv = {
      ...(Deno.env.get('APP_SUPABASE_PUBLISHABLE_KEY') ? {publishableKeys:{default:Deno.env.get('APP_SUPABASE_PUBLISHABLE_KEY')!}} : {}),
      ...(Deno.env.get('APP_SUPABASE_SECRET_KEY') ? {secretKeys:{default:Deno.env.get('APP_SUPABASE_SECRET_KEY')!}} : {}),
    };
    const context={req,body:payload,action,admin:passkeyAdmin(serverEnv),serverEnv};
    return await (action.startsWith('register-') ? handleRegistration(context) : handleAuthentication(context)) ?? json({success:false,error:'Unknown action'},400);
  } catch(error) {
    console.error('[passkey-login] request failed:',error instanceof Error ? error.message : 'Unknown error');
    return json({success:false,error:'تعذر إكمال التحقق. أعد المحاولة.',code:'INTERNAL_ERROR'},500);
  }
}
if (typeof Deno !== 'undefined') Deno.serve(handlePasskeyRequest);
