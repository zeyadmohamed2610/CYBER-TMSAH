const ATTENDANCE_ORIGIN = "https://www.cyber-tmsah.site";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function attendanceLink(sessionId: string): string {
  if (!uuid.test(sessionId)) throw new Error("Invalid attendance session");
  return `${ATTENDANCE_ORIGIN}/student-panel?tab=checkin#attendance=${sessionId}`;
}
/** A QR identifies a session; it never grants attendance or bypasses account/GPS checks. */
export function readAttendanceLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      ![ATTENDANCE_ORIGIN, "https://cyber-tmsah.site"].includes(url.origin) ||
      url.pathname !== "/student-panel" ||
      url.username ||
      url.password
    )
      return null;
    const id = new URLSearchParams(url.hash.slice(1)).get("attendance");
    return id && uuid.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function attendanceSessionFromHash(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, "")).get("attendance");
  return id && uuid.test(id) ? id : null;
}
