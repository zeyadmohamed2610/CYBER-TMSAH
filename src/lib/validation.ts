import { z } from "zod";

export const createUserSchema = z.object({
  p_auth_id: z.string().uuid(),
  p_full_name: z.string().min(1, "full_name cannot be empty").max(255),
  p_role: z.enum(["owner", "doctor", "student", "ta"]),
  p_subject_id: z.string().uuid().nullable().optional(),
}).strict();

export const generateRotatingHashSchema = z.object({
  p_subject_id: z.string().uuid(),
  p_duration_minutes: z.number().int().min(1).max(180).default(10),
  p_latitude: z.number().min(-90).max(90).nullable().optional(),
  p_longitude: z.number().min(-180).max(180).nullable().optional(),
  p_radius_meters: z.number().int().min(1).max(10000).default(50),
  p_lecture_id: z.string().uuid().nullable().optional(),
  p_section: z.string().max(100).nullable().optional(),
}).strict();

export const submitAttendanceSchema = z.object({
  p_hash: z.string().min(1, "attendance hash cannot be empty").max(128),
  p_device_fingerprint: z.string().max(128).nullable().optional(),
  p_student_latitude: z.number().min(-90).max(90).nullable().optional(),
  p_student_longitude: z.number().min(-180).max(180).nullable().optional(),
}).strict();

export const refreshSessionHashSchema = z.object({
  p_session_id: z.string().uuid(),
}).strict();

export const stopSessionSchema = z.object({
  p_session_id: z.string().uuid(),
}).strict();

export const setSessionDurationSchema = z.object({
  p_session_id: z.string().uuid(),
  p_duration_minutes: z.number().int().min(1).max(180),
}).strict();

export const deleteStudentDeviceSchema = z.object({
  p_student_id: z.string().uuid(),
}).strict();

export const updateSessionExpirySchema = z.object({
  p_session_id: z.string().uuid(),
  p_expires_at: z.string().datetime(),
}).strict();

export const fetchLecturesSchema = z.object({
  p_subject_id: z.string().uuid().nullable().optional(),
}).strict();

export const createLectureSchema = z.object({
  p_subject_id: z.string().uuid(),
  p_title: z.string().min(1).max(255).default("محاضرة"),
}).strict();

export const getLectureAttendeesSchema = z.object({
  p_lecture_id: z.string().uuid(),
}).strict();

export const endLectureSchema = z.object({
  p_lecture_id: z.string().uuid(),
}).strict();

export const deleteLectureSchema = z.object({
  p_lecture_id: z.string().uuid(),
}).strict();

export const clearSystemLogsSchema = z.object({}).strict();

export const deleteUserByIdSchema = z.object({
  p_user_id: z.string().uuid(),
}).strict();

export const addManualAttendanceSchema = z.object({
  p_student_id: z.string().uuid(),
  p_session_id: z.string().uuid(),
}).strict();

export const updateUserSchema = z.object({
  p_user_id: z.string().uuid(),
  p_full_name: z.string().min(5, "full_name must be at least 5 characters").max(255),
  p_national_id: z.string().regex(/^\d{14}$/, "national_id must be exactly 14 digits").nullable().optional(),
  p_subject_id: z.string().uuid().nullable().optional(),
}).strict();

export const updateSessionDurationSchema = z.object({
  p_session_id: z.string().uuid(),
  p_new_duration_minutes: z.number().int().min(1).max(180),
}).strict();

export const setSessionExpirySchema = z.object({
  p_session_id: z.string().uuid(),
  p_expires_at: z.string().datetime(),
}).strict();

export const gpsDistanceMetersSchema = z.object({
  lat1: z.number().min(-90).max(90),
  lon1: z.number().min(-180).max(180),
  lat2: z.number().min(-90).max(90),
  lon2: z.number().min(-180).max(180),
}).strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type GenerateRotatingHashInput = z.infer<typeof generateRotatingHashSchema>;
export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>;
export type RefreshSessionHashInput = z.infer<typeof refreshSessionHashSchema>;
export type StopSessionInput = z.infer<typeof stopSessionSchema>;
export type SetSessionDurationInput = z.infer<typeof setSessionDurationSchema>;
export type DeleteStudentDeviceInput = z.infer<typeof deleteStudentDeviceSchema>;
export type UpdateSessionExpiryInput = z.infer<typeof updateSessionExpirySchema>;
export type FetchLecturesInput = z.infer<typeof fetchLecturesSchema>;
export type CreateLectureInput = z.infer<typeof createLectureSchema>;
export type GetLectureAttendeesInput = z.infer<typeof getLectureAttendeesSchema>;
export type EndLectureInput = z.infer<typeof endLectureSchema>;
export type DeleteLectureInput = z.infer<typeof deleteLectureSchema>;
export type ClearSystemLogsInput = z.infer<typeof clearSystemLogsSchema>;
export type DeleteUserByIdInput = z.infer<typeof deleteUserByIdSchema>;
export type AddManualAttendanceInput = z.infer<typeof addManualAttendanceSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateSessionDurationInput = z.infer<typeof updateSessionDurationSchema>;
export type SetSessionExpiryInput = z.infer<typeof setSessionExpirySchema>;
export type GpsDistanceMetersInput = z.infer<typeof gpsDistanceMetersSchema>;

export const rpcSchemas = {
  create_user: createUserSchema,
  generate_rotating_hash: generateRotatingHashSchema,
  submit_attendance: submitAttendanceSchema,
  refresh_session_hash: refreshSessionHashSchema,
  stop_session: stopSessionSchema,
  set_session_duration: setSessionDurationSchema,
  delete_student_device: deleteStudentDeviceSchema,
  update_session_expiry: updateSessionExpirySchema,
  fetch_lectures: fetchLecturesSchema,
  create_lecture: createLectureSchema,
  get_lecture_attendees: getLectureAttendeesSchema,
  end_lecture: endLectureSchema,
  delete_lecture: deleteLectureSchema,
  clear_system_logs: clearSystemLogsSchema,
  delete_user_by_id: deleteUserByIdSchema,
  add_manual_attendance: addManualAttendanceSchema,
  update_user: updateUserSchema,
  update_session_duration: updateSessionDurationSchema,
  set_session_expiry: setSessionExpirySchema,
  gps_distance_meters: gpsDistanceMetersSchema,
} as const;

export function validateRpcInput<T extends keyof typeof rpcSchemas>(
  rpcName: T,
  input: unknown
): z.infer<typeof rpcSchemas[T]> {
  const schema = rpcSchemas[rpcName];
  return schema.parse(input);
}

export function safeValidateRpcInput<T extends keyof typeof rpcSchemas>(
  rpcName: T,
  input: unknown
): { success: true; data: z.infer<typeof rpcSchemas[T]> } | { success: false; error: z.ZodError } {
  const schema = rpcSchemas[rpcName];
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}