/** Keep implementation details out of messages displayed in the academic interface. */
export function getFriendlyErrorMessage(
  message: unknown,
  fallback = "تعذر إكمال الطلب. أعد المحاولة.",
): string {
  if (typeof message !== "string" || !/[\u0600-\u06ff]/.test(message)) return fallback;
  const technicalTerms =
    /[a-z_]{3,}|\b\d{3,}\b|سيبران|بيومتر|بيومتري|تشفير|مشفر|خوارزم|قاعدة البيانات|قواعد البيانات|خادم|سيرفر|توكن|هاش|بروتوكول|تقني|validation_error|https?:\/\//i;
  return technicalTerms.test(message) ? fallback : message;
}

/** Saved device names may contain labels from older versions of the interface. */
export function getDeviceDisplayName(label: string): string {
  if (/iPad|tablet|لوحي/i.test(label)) return "جهاز لوحي للدخول بالبصمة";
  if (/iPhone|Samsung|Xiaomi|Redmi|Android|هاتف/i.test(label)) return "هاتف للدخول بالبصمة";
  if (/Windows|Mac|كمبيوتر/i.test(label)) return "كمبيوتر للدخول بالبصمة";
  return "جهاز للدخول بالبصمة";
}
