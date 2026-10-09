import { supabase } from "@/shared/api/supabaseClient";

export async function securityRequest<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const result = await supabase.functions.invoke(functionName, { body });
  if (result.error) {
    let code: string | undefined;
    const response = (result.error as { context?: Response }).context;
    try {
      code = (await response?.json())?.error;
    } catch {
      /* generic error below */
    }
    const messages: Record<string, string> = {
      PASSWORD_POLICY: "استخدم 8 أحرف على الأقل، بحرف كبير وصغير ورقم ورمز.",
      PASSWORD_COMPROMISED: "كلمة المرور ظهرت في تسريبات. اختر كلمة مرور جديدة مختلفة.",
      PASSWORD_CHECK_UNAVAILABLE: "تعذر فحص أمان كلمة المرور الآن. لم تُحفظ؛ أعد المحاولة لاحقًا.",
      PASSWORD_SAME: "لا يمكن استخدام كلمة المرور القديمة. اختر كلمة مرور جديدة مختلفة عنها.",
      RECENT_AUTH_REQUIRED:
        "سجّل الدخول مجددًا أو افتح رابط استعادة جديد، ثم غيّر كلمة المرور خلال خمس دقائق.",
    };
    throw Object.assign(
      new Error(
        messages[code ?? ""] ?? "تعذر إكمال العملية. احتفظنا ببياناتك؛ راجعها وأعد المحاولة.",
      ),
      { code },
    );
  }
  return result.data as T;
}
