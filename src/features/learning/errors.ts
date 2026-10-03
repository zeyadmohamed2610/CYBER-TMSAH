import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";

export function learningError(cause: unknown): string {
  const message =
    typeof cause === "string"
      ? cause
      : cause && typeof cause === "object" && "message" in cause
        ? String(cause.message)
        : "";
  const translations: Record<string, string> = {
    pending_cases: "راجع الطلبات المعلقة قبل إغلاق الفصل الدراسي.",
    term_closed: "هذا الفصل مؤرشف ولا يمكن تعديل سجلاته.",
    case_changed: "تغيّر الطلب أثناء مراجعته. حدّث الصفحة وراجع حالته الحالية.",
    schedule_changed: "تغيّر الجدول. حدّث الصفحة قبل اعتماد النسخة.",
    permission_denied: "لا تملك صلاحية تنفيذ هذا الإجراء.",
    validation_error: "راجع البيانات المدخلة. اترك الحقول غير المطلوبة فارغة.",
  };
  for (const [code, copy] of Object.entries(translations))
    if (message.startsWith(code)) return copy;
  return getFriendlyErrorMessage(message);
}
