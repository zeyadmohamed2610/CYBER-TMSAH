const COOLDOWN_KEY = "cyber_reset_retry_at";

export function readRecoveryCooldown(): number {
  try {
    const deadline = Number(sessionStorage.getItem(COOLDOWN_KEY));
    return Number.isFinite(deadline) ? deadline : 0;
  } catch {
    return 0;
  }
}

export function startRecoveryCooldown(): number {
  const deadline = Date.now() + 60_000;
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(deadline));
  } catch {
    // The caller also keeps the deadline in memory when storage is unavailable.
  }
  return deadline;
}

export function recoveryEmailError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, status } = error as { code?: string; status?: number };
  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "وصلت خدمة البريد إلى حد الإرسال. انتظر قبل المحاولة مجددًا؛ إذا استمرت المشكلة، يلزم مراجعة إعدادات البريد مع الإدارة. تكرار الضغط لن يرسل الرسالة.";
  }
  if (code === "email_address_not_authorized") {
    return "خدمة البريد الحالية لا تسمح بالإرسال لهذا العنوان. يلزم إعداد مزود بريد مخصص لدى الإدارة.";
  }
  return null;
}
