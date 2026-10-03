import { createAdminClient, createContextClient } from "npm:@supabase/server@1.8.0/core";
export interface PasskeyEnvironment {publishableKeys?:Record<string,string>;secretKeys?:Record<string,string>}
export function passkeyAdmin(env:PasskeyEnvironment) { return createAdminClient({env,supabaseOptions:{auth:{experimental:{passkey:true}}}}); }
export function nativePasskeyClient(env:PasskeyEnvironment) {return createContextClient({env,supabaseOptions:{auth:{experimental:{passkey:true}}}});}
