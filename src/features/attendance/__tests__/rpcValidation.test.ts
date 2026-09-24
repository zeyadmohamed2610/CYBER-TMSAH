import { describe, it, expect } from "vitest";
import {
  validateRpcInput,
  generateRotatingHashSchema,
  submitAttendanceSchema,
  createUserSchema,
  createLectureSchema,
  updateSessionExpirySchema,
  fetchLecturesSchema,
  getLectureAttendeesSchema,
  endLectureSchema,
  deleteLectureSchema,
  addManualAttendanceSchema,
  updateUserSchema,
  deleteStudentDeviceSchema,
  setSessionDurationSchema,
  refreshSessionHashSchema,
  stopSessionSchema,
} from "../utils/rpcValidation";

describe("rpcValidation", () => {
  describe("generateRotatingHashSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
        p_duration_minutes: 10,
        p_latitude: 30.0444,
        p_longitude: 31.2357,
        p_radius_meters: 50,
        p_lecture_id: "123e4567-e89b-12d3-a456-426614174001",
        p_section: "A",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.p_duration_minutes).toBe(10);
        expect(result.data.p_radius_meters).toBe(50);
      }
    });

    it("should use defaults for optional fields", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.p_duration_minutes).toBe(10);
        expect(result.data.p_radius_meters).toBe(50);
      }
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject duration out of bounds", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
        p_duration_minutes: 200,
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid latitude", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
        p_latitude: 100,
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid longitude", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
        p_longitude: -200,
      });
      expect(result.success).toBe(false);
    });

    it("should reject radius out of bounds", () => {
      const result = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
        p_radius_meters: 10000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("submitAttendanceSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(submitAttendanceSchema, {
        p_hash: "abc123",
        p_device_fingerprint: "fp123",
        p_student_latitude: 30.0444,
        p_student_longitude: 31.2357,
      });
      expect(result.success).toBe(true);
    });

    it("should validate with minimal input", () => {
      const result = validateRpcInput(submitAttendanceSchema, {
        p_hash: "short",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty hash", () => {
      const result = validateRpcInput(submitAttendanceSchema, {
        p_hash: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject hash too long", () => {
      const result = validateRpcInput(submitAttendanceSchema, {
        p_hash: "a".repeat(129),
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid latitude", () => {
      const result = validateRpcInput(submitAttendanceSchema, {
        p_hash: "abc123",
        p_student_latitude: 100,
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid longitude", () => {
      const result = validateRpcInput(submitAttendanceSchema, {
        p_hash: "abc123",
        p_student_longitude: -200,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createUserSchema", () => {
    it("should validate valid input for owner", () => {
      const result = validateRpcInput(createUserSchema, {
        p_auth_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "John Doe",
        p_role: "owner",
      });
      expect(result.success).toBe(true);
    });

    it("should validate valid input for doctor with subject", () => {
      const result = validateRpcInput(createUserSchema, {
        p_auth_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "Dr. Smith",
        p_role: "doctor",
        p_subject_id: "123e4567-e89b-12d3-a456-426614174001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = validateRpcInput(createUserSchema, {
        p_auth_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "",
        p_role: "owner",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid role", () => {
      const result = validateRpcInput(createUserSchema, {
        p_auth_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "John Doe",
        p_role: "admin",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid auth_id", () => {
      const result = validateRpcInput(createUserSchema, {
        p_auth_id: "not-a-uuid",
        p_full_name: "John Doe",
        p_role: "owner",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createLectureSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(createLectureSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
        p_title: "Lecture 1",
      });
      expect(result.success).toBe(true);
    });

    it("should use default title", () => {
      const result = validateRpcInput(createLectureSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.p_title).toBe("محاضرة");
      }
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(createLectureSchema, {
        p_subject_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateSessionExpirySchema", () => {
    it("should validate valid ISO datetime", () => {
      const result = validateRpcInput(updateSessionExpirySchema, {
        p_session_id: "123e4567-e89b-12d3-a456-426614174000",
        p_expires_at: "2026-03-27T14:30:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid datetime format", () => {
      const result = validateRpcInput(updateSessionExpirySchema, {
        p_session_id: "123e4567-e89b-12d3-a456-426614174000",
        p_expires_at: "not-a-date",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid session UUID", () => {
      const result = validateRpcInput(updateSessionExpirySchema, {
        p_session_id: "not-a-uuid",
        p_expires_at: "2026-03-27T14:30:00Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("fetchLecturesSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(fetchLecturesSchema, {
        p_subject_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should allow null subject_id", () => {
      const result = validateRpcInput(fetchLecturesSchema, {
        p_subject_id: null,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(fetchLecturesSchema, {
        p_subject_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getLectureAttendeesSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(getLectureAttendeesSchema, {
        p_lecture_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(getLectureAttendeesSchema, {
        p_lecture_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("endLectureSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(endLectureSchema, {
        p_lecture_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(endLectureSchema, {
        p_lecture_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("deleteLectureSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(deleteLectureSchema, {
        p_lecture_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(deleteLectureSchema, {
        p_lecture_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("addManualAttendanceSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(addManualAttendanceSchema, {
        p_student_id: "123e4567-e89b-12d3-a456-426614174000",
        p_session_id: "123e4567-e89b-12d3-a456-426614174001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid student UUID", () => {
      const result = validateRpcInput(addManualAttendanceSchema, {
        p_student_id: "not-a-uuid",
        p_session_id: "123e4567-e89b-12d3-a456-426614174001",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid session UUID", () => {
      const result = validateRpcInput(addManualAttendanceSchema, {
        p_student_id: "123e4567-e89b-12d3-a456-426614174000",
        p_session_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateUserSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(updateUserSchema, {
        p_user_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "Updated Name",
        p_national_id: "12345678901234",
        p_subject_id: "123e4567-e89b-12d3-a456-426614174001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject name too short", () => {
      const result = validateRpcInput(updateUserSchema, {
        p_user_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "John",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid national_id format", () => {
      const result = validateRpcInput(updateUserSchema, {
        p_user_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "Updated Name",
        p_national_id: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("should allow null national_id", () => {
      const result = validateRpcInput(updateUserSchema, {
        p_user_id: "123e4567-e89b-12d3-a456-426614174000",
        p_full_name: "Updated Name",
        p_national_id: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteStudentDeviceSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(deleteStudentDeviceSchema, {
        p_student_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(deleteStudentDeviceSchema, {
        p_student_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("setSessionDurationSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(setSessionDurationSchema, {
        p_session_id: "123e4567-e89b-12d3-a456-426614174000",
        p_duration_minutes: 30,
      });
      expect(result.success).toBe(true);
    });

    it("should reject duration out of bounds", () => {
      const result = validateRpcInput(setSessionDurationSchema, {
        p_session_id: "123e4567-e89b-12d3-a456-426614174000",
        p_duration_minutes: 200,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("refreshSessionHashSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(refreshSessionHashSchema, {
        p_session_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(refreshSessionHashSchema, {
        p_session_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("stopSessionSchema", () => {
    it("should validate valid input", () => {
      const result = validateRpcInput(stopSessionSchema, {
        p_session_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = validateRpcInput(stopSessionSchema, {
        p_session_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });
});