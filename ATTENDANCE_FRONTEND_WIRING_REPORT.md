# ATTENDANCE FRONTEND WIRING REPORT

## 1) What Was Connected
- Replaced all stubs in `src/features/attendance/services/attendanceService.ts` with live Supabase integration.
- Added shared Supabase client at `src/lib/supabaseClient.ts` using:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Connected all attendance service methods:
  - `fetchDashboardMetrics`
  - `fetchSessionsByRole`
  - `fetchAttendanceRecords`
  - `fetchTrendData`
  - `fetchSubjectMetrics`
  - `submitAttendance`
- Added normalized error handling with consistent `AttendanceApiResponse<T>` outputs.

## 2) Queries Used

### `fetchDashboardMetrics(role, userId?)`
- Session totals (count query):
  - `from("sessions").select("id", { head: true, count: "exact" })`
  - doctor filter: `.eq("doctor_id", userId)`
  - student filter: `.in("status", ["scheduled", "active"])`
- Active sessions (count query):
  - `from("sessions").select("id", { head: true, count: "exact" }).eq("status", "active")`
  - doctor filter applied when role is doctor.
- Attendance rows for status grouping:
  - `from("attendance").select("id, session_id, student_id, status, submitted_at")`
  - doctor scope: attendance filtered by doctor-owned session IDs
  - student scope: `.eq("student_id", userId)`
- Open sessions for pending calculation:
  - `from("sessions").select("id").in("status", ["scheduled", "active"])`
  - doctor filter applied when role is doctor.
- Owner student count:
  - `from("users").select("id", { head: true, count: "exact" }).eq("role", "student")`

### `fetchSessionsByRole(role, userId?)`
- `from("sessions").select("id, subject_id, doctor_id, starts_at, ends_at, room, latitude, longitude, geofence_radius_meters, status, subjects(name)").order("starts_at", { ascending: false })`
- Role filters:
  - owner: no extra filter
  - doctor: `.eq("doctor_id", userId)`
  - student: `.in("status", ["scheduled", "active"])`

### `fetchAttendanceRecords(role, userId?)`
- `from("attendance").select("id, session_id, student_id, status, submitted_at, ip_address, device_hash, sessions(subject_id, doctor_id, subjects(name)), users!attendance_student_id_fkey(full_name)").order("submitted_at", { ascending: false })`
- Role filters:
  - owner: no extra filter
  - doctor: scoped by doctor session IDs
  - student: `.eq("student_id", userId)`

### `fetchTrendData(role, userId?)`
- `from("attendance").select("status, submitted_at, session_id, student_id, id").order("submitted_at", { ascending: false })`
- Role filters same as attendance records.
- Grouping done in service by date (`YYYY-MM-DD`) and status (`present/late/absent`).

### `fetchSubjectMetrics(role, userId?)`
- `from("sessions").select("id, subject_id, doctor_id, status, subjects(name), attendance(status, student_id)")`
- Role filters:
  - owner: all sessions
  - doctor: `.eq("doctor_id", userId)`
  - student: `.in("status", ["scheduled", "active"])`
- Aggregation in service:
  - grouped by `subject_id`
  - `totalSessions` per subject
  - attendance percentage from joined attendance rows (`present + late` over total rows)

## 3) Edge Functions Invoked
- `submitAttendance` uses:
  - `supabase.functions.invoke("submitAttendance", { body })`
- Payload mapped from frontend camelCase to backend snake_case:
  - `sessionId -> session_id`
  - `rotatingHash -> rotating_hash`
  - `requestNonce -> request_nonce`
  - `timeWindow -> time_window`
  - `deviceHash -> device_hash`
- Response mapped back to frontend model:
  - `attendance_id -> attendanceId`
  - `recorded_at -> recordedAt`
  - `attendance_status -> status`

## 4) Assumptions Made
- Doctor and student scoped queries require an authenticated user ID when `userId` is not passed explicitly.
- Session status `cancelled` is mapped to `ended` in frontend session type mapping because frontend `SessionSummary.status` supports `scheduled | active | ended`.
- Attendance rate is computed from attendance rows visible to the role (`present + late` / total attendance rows).
- Pending submissions are computed from open sessions (`scheduled/active`) minus sessions that already have visible attendance records.
- Existing project-wide lint errors unrelated to attendance wiring remain unchanged.
