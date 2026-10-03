import { createAdminClient } from "npm:@supabase/server@1.8.0/core";
export interface PasskeyEnvironment {publishableKeys?:Record<string,string>;secretKeys?:Record<string,string>}
export function passkeyAdmin(env:PasskeyEnvironment) { return createAdminClient({env}); }
export interface PasskeyContext {
  req: Request;
  body: Record<string,unknown>;
  action: string;
  admin: ReturnType<typeof passkeyAdmin>;
  serverEnv: PasskeyEnvironment;
}
