import { z } from "zod";

export const generateRotatingHashSchema = z.object({
  p_subject_id: z.string().uuid("Invalid subject ID"),
  p_duration_minutes: z.number().int().min(1).max(180).default(10),
  p_latitude: z.number().min(-90).max(90).nullable().optional(),
  p_longitude: z.number().min(-180).max(180).nullable().optional(),
  p_radius_meters: z.number().int().min(1).max(5000).default(50),
  p_lecture_id: z.string().uuid().nullable().optional(),
  p_section: z.string().max(50).nullable().optional(),
});

export const submitAttendanceSchema = z.object({
  p_hash: z.string().min(1, "Attendance hash cannot be empty").max(128),
  p_device_fingerprint: z.string().max(128).nullable().optional(),
  p_student_latitude: z.number().min(-90).max(90).nullable().optional(),
  p_student_longitude: z.number().min(-180).max(180).nullable().optional(),
  p_biometric_credential_id: z.string().max(512).nullable().optional(),
});

export const createLectureSchema = z.object({
  p_subject_id: z.string().uuid("Invalid subject ID"),
  p_title: z.string().min(1).max(200).default("محاضرة"),
  p_kind: z.enum(["lecture", "section"]).optional(),
  p_section: z
    .string()
    .regex(/^(?:[1-9]|1[0-5])$/)
    .nullable()
    .optional(),
});

export const updateSessionExpirySchema = z.object({
  p_session_id: z.string().uuid("Invalid session ID"),
  p_expires_at: z.string().datetime({ offset: true }),
});

export const fetchLecturesSchema = z.object({
  p_subject_id: z.string().uuid().nullable().optional(),
});

export const getLectureAttendeesSchema = z.object({
  p_lecture_id: z.string().uuid("Invalid lecture ID"),
});

export const endLectureSchema = z.object({
  p_lecture_id: z.string().uuid("Invalid lecture ID"),
});

export const deleteLectureSchema = z.object({
  p_lecture_id: z.string().uuid("Invalid lecture ID"),
});

export const addManualAttendanceSchema = z.object({
  p_student_id: z.string().uuid("Invalid student ID"),
  p_session_id: z.string().uuid("Invalid session ID"),
});

export const setSessionDurationSchema = z.object({
  p_session_id: z.string().uuid("Invalid session ID"),
  p_duration_minutes: z.number().int().min(1).max(180),
});

export const refreshSessionHashSchema = z.object({
  p_session_id: z.string().uuid("Invalid session ID"),
});

export const stopSessionSchema = z.object({
  p_session_id: z.string().uuid("Invalid session ID"),
});

export function validateRpcInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Zod v4 format: result.error is a ZodError with .issues array
    const issues =
      (result.error as { issues?: Array<{ path: (string | number)[]; message: string }> }).issues ??
      [];
    const errors = issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return { success: false, error: `Validation failed: ${errors}` };
  }
  return { success: true, data: result.data };
}
