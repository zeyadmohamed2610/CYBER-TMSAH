import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      state: "joined",
    })),
    removeChannel: vi.fn(),
  },
}));

import { attendanceService } from "../services/attendanceService";
import { supabase } from "@/lib/supabaseClient";

describe("attendanceService - RPC validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateRotatingHash - input validation", () => {
    it("should reject invalid subject UUID", async () => {
      const result = await attendanceService.generateRotatingHash("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject duration > 180", async () => {
      const result = await attendanceService.generateRotatingHash(
        "123e4567-e89b-12d3-a456-426614174000",
        "Test",
        200
      );
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid latitude", async () => {
      const result = await attendanceService.generateRotatingHash(
        "123e4567-e89b-12d3-a456-426614174000",
        "Test",
        10,
        100
      );
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid longitude", async () => {
      const result = await attendanceService.generateRotatingHash(
        "123e4567-e89b-12d3-a456-426614174000",
        "Test",
        10,
        30,
        200
      );
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("submitAttendance - input validation", () => {
    it("should reject empty hash", async () => {
      const result = await attendanceService.submitAttendance("");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject hash too long", async () => {
      const result = await attendanceService.submitAttendance("a".repeat(129));
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid latitude", async () => {
      const result = await attendanceService.submitAttendance("hash123", 100);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid longitude", async () => {
      const result = await attendanceService.submitAttendance("hash123", 30, -200);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("createLecture - input validation", () => {
    it("should reject invalid subject UUID", async () => {
      const result = await attendanceService.createLecture("not-a-uuid", "Lecture");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("updateSessionExpiry - input validation", () => {
    it("should reject invalid session UUID", async () => {
      const result = await attendanceService.updateSessionExpiry("not-a-uuid", "2026-03-27T14:30:00Z");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid datetime", async () => {
      const result = await attendanceService.updateSessionExpiry("123e4567-e89b-12d3-a456-426614174000", "not-a-date");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("fetchLectures - input validation", () => {
    it("should reject invalid subject UUID", async () => {
      const result = await attendanceService.fetchLectures("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("getLectureAttendees - input validation", () => {
    it("should reject invalid lecture UUID", async () => {
      const result = await attendanceService.getLectureAttendees("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("endLecture - input validation", () => {
    it("should reject invalid lecture UUID", async () => {
      const result = await attendanceService.endLecture("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("deleteLecture - input validation", () => {
    it("should reject invalid lecture UUID", async () => {
      const result = await attendanceService.deleteLecture("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("addManualAttendance - input validation", () => {
    it("should reject invalid student UUID", async () => {
      const result = await attendanceService.addManualAttendance("not-a-uuid", "123e4567-e89b-12d3-a456-426614174001");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid session UUID", async () => {
      const result = await attendanceService.addManualAttendance("123e4567-e89b-12d3-a456-426614174000", "not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("updateUser - input validation", () => {
    it("should reject invalid user UUID", async () => {
      const result = await attendanceService.updateUser("not-a-uuid", "John Doe");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject name too short", async () => {
      const result = await attendanceService.updateUser("123e4567-e89b-12d3-a456-426614174000", "Jo");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject invalid national ID format", async () => {
      const result = await attendanceService.updateUser("123e4567-e89b-12d3-a456-426614174000", "John Doe", "123");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("deleteStudentDevice - input validation", () => {
    it("should reject invalid student UUID", async () => {
      const result = await attendanceService.deleteStudentDevice("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("setSessionDuration - input validation", () => {
    it("should reject invalid session UUID", async () => {
      const result = await attendanceService.setSessionDuration("not-a-uuid", 30);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject duration > 180", async () => {
      const result = await attendanceService.setSessionDuration("123e4567-e89b-12d3-a456-426614174000", 200);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });

    it("should reject duration < 1", async () => {
      const result = await attendanceService.setSessionDuration("123e4567-e89b-12d3-a456-426614174000", 0);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("refreshSessionHash - input validation", () => {
    it("should reject invalid session UUID", async () => {
      const result = await attendanceService.refreshSessionHash("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("stopSession - input validation", () => {
    it("should reject invalid session UUID", async () => {
      const result = await attendanceService.stopSession("not-a-uuid");
      expect(result.error).toBeTruthy();
      expect(result.error).toContain("Validation failed");
    });
  });
});

describe("attendanceService - RPC success/error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateRotatingHash", () => {
    it("should return error on RPC failure", async () => {
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "Permission denied" },
      });

      const result = await attendanceService.generateRotatingHash(
        "123e4567-e89b-12d3-a456-426614174000"
      );
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it("should return data on success", async () => {
      const mockSession = {
        id: "123e4567-e89b-12d3-a456-426614174002",
        subject_id: "123e4567-e89b-12d3-a456-426614174000",
        rotating_hash: "abc123",
        short_code: "123456",
        expires_at: "2026-03-27T15:00:00Z",
        created_at: "2026-03-27T14:00:00Z",
        latitude: 30.0444,
        longitude: 31.2357,
        radius_meters: 50,
        lecture_id: null,
        section: null,
        subjects: { name: "Test Subject" },
      };

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const result = await attendanceService.generateRotatingHash(
        "123e4567-e89b-12d3-a456-426614174000",
        "Test Subject"
      );
      expect(result.error).toBeNull();
      expect(result.data).toBeTruthy();
      if (result.data) {
        expect(result.data.id).toBe(mockSession.id);
        expect(result.data.subjectName).toBe("Test Subject");
      }
    });
  });

  describe("submitAttendance", () => {
    it("should return error on RPC failure", async () => {
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "Invalid hash" },
      });

      const result = await attendanceService.submitAttendance("invalid-hash");
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it("should return data on success", async () => {
      const mockAttendance = {
        id: "123e4567-e89b-12d3-a456-426614174003",
        created_at: "2026-03-27T14:30:00Z",
      };

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockAttendance,
        error: null,
      });

      const result = await attendanceService.submitAttendance("valid-hash");
      expect(result.error).toBeNull();
      expect(result.data).toBeTruthy();
      if (result.data) {
        expect(result.data.attendanceId).toBe(mockAttendance.id);
      }
    });
  });

  describe("fetchLectures", () => {
    it("should return error on RPC failure", async () => {
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const result = await attendanceService.fetchLectures();
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it("should return lectures on success", async () => {
      const mockLectures = [
        {
          id: "123e4567-e89b-12d3-a456-426614174004",
          subject_id: "123e4567-e89b-12d3-a456-426614174000",
          title: "Lecture 1",
          lecture_date: "2026-03-27",
          created_by: "123e4567-e89b-12d3-a456-426614174001",
          created_at: "2026-03-27T10:00:00Z",
          subject_name: "Test Subject",
          session_count: 2,
          attendee_count: 10,
          is_ended: false,
        },
      ];

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockLectures,
        error: null,
      });

      const result = await attendanceService.fetchLectures();
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      if (result.data) {
        expect(result.data[0].title).toBe("Lecture 1");
      }
    });
  });

  describe("createLecture", () => {
    it("should return error on RPC failure", async () => {
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "Permission denied" },
      });

      const result = await attendanceService.createLecture(
        "123e4567-e89b-12d3-a456-426614174000",
        "New Lecture"
      );
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it("should return lecture on success", async () => {
      const mockLecture = {
        id: "123e4567-e89b-12d3-a456-426614174005",
        subject_id: "123e4567-e89b-12d3-a456-426614174000",
        title: "New Lecture",
        lecture_date: "2026-03-28",
        created_by: "123e4567-e89b-12d3-a456-426614174001",
        created_at: "2026-03-27T10:00:00Z",
      };

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockLecture,
        error: null,
      });

      const result = await attendanceService.createLecture(
        "123e4567-e89b-12d3-a456-426614174000",
        "New Lecture"
      );
      expect(result.error).toBeNull();
      expect(result.data).toBeTruthy();
      if (result.data) {
        expect(result.data.title).toBe("New Lecture");
      }
    });
  });
});