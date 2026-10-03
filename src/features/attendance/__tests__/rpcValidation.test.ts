import { describe, expect, it } from "vitest";
import {
  addManualAttendanceSchema,
  createLectureSchema,
  deleteLectureSchema,
  endLectureSchema,
  fetchLecturesSchema,
  generateRotatingHashSchema,
  getLectureAttendeesSchema,
  refreshSessionHashSchema,
  setSessionDurationSchema,
  stopSessionSchema,
  submitAttendanceSchema,
  updateSessionExpirySchema,
  validateRpcInput,
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
