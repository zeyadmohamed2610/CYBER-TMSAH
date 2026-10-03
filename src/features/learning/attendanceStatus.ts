import type { Result } from "./types";

/** No configured rule means no warning. An alert never imposes an academic penalty. */
export function attendanceStatus(result: Result): "unset" | "normal" | "warning" | "limit" {
  const rule = result.rule_snapshot;
  if (result.excused > 0 && rule?.excuse_mode == null) return "unset";
  if (
    !rule ||
    [rule.max_absences, rule.warning_absences, rule.max_percent, rule.warning_percent].every(
      (value) => value == null,
    )
  )
    return "unset";
  const absent = result.absent + (rule.excuse_mode === "count_absent" ? result.excused : 0);
  const total = result.total - (rule.excuse_mode === "exclude" ? result.excused : 0);
  const percent = total > 0 ? (absent / total) * 100 : 0;
  if (
    (rule.max_absences != null && absent >= rule.max_absences) ||
    (total > 0 && rule.max_percent != null && percent >= rule.max_percent)
  )
    return "limit";
  if (
    (rule.warning_absences != null && absent >= rule.warning_absences) ||
    (total > 0 && rule.warning_percent != null && percent >= rule.warning_percent)
  )
    return "warning";
  return "normal";
}
