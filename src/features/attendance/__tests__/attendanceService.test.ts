import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
    auth: {
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

describe("attendanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeTrendData", () => {
    it("should return empty array for empty records", () => {
      const result = attendanceService.computeTrendData([]);
      expect(result).toEqual([]);
    });

    it("should group records by date", () => {
      const records = [
        { id: "1", sessionId: "s1", studentId: "st1", submittedAt: "2026-03-27T10:00:00Z" },
        { id: "2", sessionId: "s1", studentId: "st2", submittedAt: "2026-03-27T11:00:00Z" },
        { id: "3", sessionId: "s2", studentId: "st3", submittedAt: "2026-03-26T09:00:00Z" },
      ];
      const result = attendanceService.computeTrendData(records);
      expect(result.length).toBe(2);
      expect(result.find((p) => p.date === "2026-03-27")?.count).toBe(2);
      expect(result.find((p) => p.date === "2026-03-26")?.count).toBe(1);
    });

    it("should sort results by date ascending", () => {
      const records = [
        { id: "1", sessionId: "s1", studentId: "st1", submittedAt: "2026-03-27T10:00:00Z" },
        { id: "2", sessionId: "s1", studentId: "st2", submittedAt: "2026-03-25T10:00:00Z" },
      ];
      const result = attendanceService.computeTrendData(records);
      expect(result[0].date).toBe("2026-03-25");
      expect(result[1].date).toBe("2026-03-27");
    });

    it("should handle many date entries", () => {
      const records = Array.from({ length: 30 }, (_, i) => ({
        id: String(i),
        sessionId: "s1",
        studentId: "st1",
        submittedAt: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      }));
      const result = attendanceService.computeTrendData(records);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("fetchDashboardMetrics", () => {
    it("should return error on database failure", async () => {
      const { supabase } = await import("@/lib/supabaseClient");
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
        }),
      });

      const result = await attendanceService.fetchDashboardMetrics("owner");
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });
  });
});
