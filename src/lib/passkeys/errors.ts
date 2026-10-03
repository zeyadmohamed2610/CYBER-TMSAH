export class PasskeyError extends Error {
  constructor(message: string, readonly code = 'VERIFICATION_FAILED', readonly cancelled = false, readonly noPasskeyRegistered = false) {
    super(message);
    this.name = 'PasskeyError';
  }
}

export function passkeyFailure(error: unknown) {
  if (error instanceof PasskeyError) return {success:false as const,error:error.message,code:error.code,cancelled:error.cancelled,noPasskeyRegistered:error.noPasskeyRegistered};
  const cause = error instanceof Error && 'cause' in error ? error.cause : null;
  const name = cause instanceof Error ? cause.name : error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'AbortError') return {success:false as const,cancelled:true,error:'لم يكتمل التحقق من الجهاز. أعد المحاولة وأكمل البصمة أو رمز القفل.'};
  if (name === 'InvalidStateError') return {success:false as const,error:'مفتاح الدخول مسجل بالفعل لهذا الحساب.'};
  if (name === 'SecurityError') return {success:false as const,error:'افتح الموقع من رابطه الرسمي لإكمال الدخول بالبصمة.'};
  return {success:false as const,error:'تعذر إكمال التحقق. راجع اتصالك وأعد المحاولة.'};
}
