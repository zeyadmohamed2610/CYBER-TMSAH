export class PasskeyError extends Error {
  constructor(
    message: string,
    readonly code = "VERIFICATION_FAILED",
    readonly cancelled = false,
    readonly noPasskeyRegistered = false,
  ) {
    super(message);
    this.name = "PasskeyError";
  }
}

export function passkeyFailure(error: unknown) {
  if (error instanceof PasskeyError)
    return {
      success: false as const,
      error: error.message,
      code: error.code,
      cancelled: error.cancelled,
      noPasskeyRegistered: error.noPasskeyRegistered,
    };
  const detail =
    error && typeof error === "object"
      ? (error as { name?: unknown; cause?: unknown; code?: unknown })
      : {};
  const cause =
    detail.cause && typeof detail.cause === "object" ? (detail.cause as { name?: unknown }) : {};
  const name =
    typeof cause.name === "string"
      ? cause.name
      : typeof detail.name === "string"
        ? detail.name
        : "";
  if (name === "NotReadableError")
    return {
      success: false as const,
      code: "CREDENTIAL_MANAGER_UNAVAILABLE",
      error:
        "تعذر التواصل مع مدير مفاتيح الدخول على الجهاز. راجع مدير كلمات المرور المفعّل وحدّث المتصفح وخدمات الجهاز، ثم أعد المحاولة.",
    };
  if (name === "ConstraintError" || name === "NotSupportedError")
    return {
      success: false as const,
      code: "DEVICE_REQUIREMENTS_UNAVAILABLE",
      error:
        "لم يجد المتصفح وسيلة لحفظ مفتاح الدخول مع تأكيد هويتك. فعّل قفل الشاشة ومدير كلمات المرور، ثم أعد المحاولة.",
    };
  if (name === "UnknownError")
    return {
      success: false as const,
      code: "DEVICE_CREATION_FAILED",
      error:
        "تعذر على الجهاز إنشاء مفتاح الدخول. راجع مدير كلمات المرور وقفل الشاشة، ثم أعد المحاولة.",
    };
  if (name === "NotAllowedError" || name === "AbortError")
    return {
      success: false as const,
      cancelled: true,
      error: "لم يكتمل التحقق من الجهاز. أعد المحاولة وأكمل البصمة أو رمز القفل.",
    };
  if (name === "InvalidStateError")
    return { success: false as const, error: "مفتاح الدخول مسجل بالفعل لهذا الحساب." };
  if (name === "SecurityError")
    return { success: false as const, error: "افتح الموقع من رابطه الرسمي لإكمال الدخول بالبصمة." };
  return {
    success: false as const,
    error: "تعذر إكمال هذه الخطوة. أعد المحاولة أو استخدم خيار حفظ آخر.",
  };
}
