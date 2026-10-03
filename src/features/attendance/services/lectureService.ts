import { type Lecture, type LectureAttendee } from "@/features/attendance/types";
import {
  createLectureSchema,
  deleteLectureSchema,
  endLectureSchema,
  fetchLecturesSchema,
  getLectureAttendeesSchema,
  validateRpcInput,
} from "@/features/attendance/utils/rpcValidation";
import { fail, ok } from "@/shared/api/result";
import { supabase } from "@/shared/api/supabaseClient";
import { type ApiResponse } from "@/shared/api/types";
export const lectureService = {
  async fetchLectures(subjectId?: string): Promise<ApiResponse<Lecture[]>> {
    const operation = "lectureService.fetchLectures";
    try {
      const validation = validateRpcInput(fetchLecturesSchema, {
        p_subject_id: subjectId ?? null,
      });
      if (!validation.success) {
        return fail<Lecture[]>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("fetch_lectures", validation.data);
      if (error) throw error;

      const lectures: Lecture[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        subject_id: row.subject_id as string,
        title: row.title as string,
        lecture_date: row.lecture_date as string,
        created_by: (row.created_by as string) ?? null,
        created_at: row.created_at as string,
        subject_name: (row.subject_name as string) ?? "غير معروف",
        session_count: Number(row.session_count ?? 0),
        attendee_count: Number(row.attendee_count ?? 0),
        is_ended: (row.is_ended as boolean) ?? false,
        kind: row.kind === "section" ? "section" : "lecture",
        section: (row.section as string | null) ?? null,
        duration_minutes: Number(row.duration_minutes ?? 60),
      }));

      return ok<Lecture[]>(lectures);
    } catch (error) {
      return fail<Lecture[]>(operation, error);
    }
  },
  async createLecture(
    subjectId: string,
    title: string,
    kind?: "lecture" | "section",
    section?: string | null,
  ): Promise<ApiResponse<Lecture>> {
    const operation = "lectureService.createLecture";
    try {
      const validation = validateRpcInput(createLectureSchema, {
        p_subject_id: subjectId,
        p_title: title,
        ...(kind ? { p_kind: kind, p_section: section ?? null } : {}),
      });
      if (!validation.success) {
        return fail<Lecture>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("create_lecture", validation.data);
      if (error) throw error;

      const row = data as Lecture;
      return ok<Lecture>({
        id: row.id,
        subject_id: row.subject_id,
        title: row.title,
        lecture_date: row.lecture_date,
        created_by: row.created_by,
        created_at: row.created_at,
        kind: row.kind ?? "lecture",
        section: row.section ?? null,
        duration_minutes: row.duration_minutes ?? 60,
      });
    } catch (error) {
      return fail<Lecture>(operation, error);
    }
  },
  async getLectureAttendees(lectureId: string): Promise<ApiResponse<LectureAttendee[]>> {
    const operation = "lectureService.getLectureAttendees";
    try {
      const validation = validateRpcInput(getLectureAttendeesSchema, {
        p_lecture_id: lectureId,
      });
      if (!validation.success) {
        return fail<LectureAttendee[]>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("get_lecture_attendees", validation.data);
      if (error) throw error;

      const attendees: LectureAttendee[] = (data ?? []).map((row: Record<string, unknown>) => ({
        attendance_id: (row.attendance_id as string) ?? (row.id as string),
        student_name: (row.student_name as string) ?? (row.full_name as string),
        national_id: (row.national_id as string) ?? null,
        session_id: row.session_id as string,
        short_code: (row.short_code as string) ?? null,
        submitted_at: (row.submitted_at as string) ?? (row.created_at as string),
        ip_address: row.ip_address != null ? String(row.ip_address) : null,
        student_latitude: (row.student_latitude as number) ?? null,
        student_longitude: (row.student_longitude as number) ?? null,
      }));

      return ok<LectureAttendee[]>(attendees);
    } catch (error) {
      return fail<LectureAttendee[]>(operation, error);
    }
  },
  async endLecture(lectureId: string): Promise<ApiResponse<null>> {
    const operation = "lectureService.endLecture";
    try {
      const validation = validateRpcInput(endLectureSchema, {
        p_lecture_id: lectureId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("end_lecture", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
  async deleteLecture(lectureId: string): Promise<ApiResponse<null>> {
    const operation = "lectureService.deleteLecture";
    try {
      const validation = validateRpcInput(deleteLectureSchema, {
        p_lecture_id: lectureId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("delete_lecture", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
};
