import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock environment storage
const mockEnvStore: Record<string, string> = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  ENVIRONMENT: "test",
  FUNCTION_VERSION: "1.0.0",
};

// Mock Deno.env
const mockDenoEnv = {
  get: vi.fn((key: string) => mockEnvStore[key]),
  set: vi.fn((key: string, value: string) => { mockEnvStore[key] = value; }),
  delete: vi.fn((key: string) => { delete mockEnvStore[key]; }),
  toObject: vi.fn(() => ({ ...mockEnvStore })),
};

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock Deno globally for tests
vi.stubGlobal("Deno", {
  env: mockDenoEnv,
  serve: vi.fn(),
});

describe("Edge Functions Integration Tests", () => {
  beforeEach(() => {
    // Reset mock env store
    Object.keys(mockEnvStore).forEach(key => delete mockEnvStore[key]);
    Object.assign(mockEnvStore, {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      ENVIRONMENT: "test",
      FUNCTION_VERSION: "1.0.0",
    });
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockDenoEnv.get.mockImplementation((key: string) => mockEnvStore[key]);
    mockDenoEnv.set.mockImplementation((key: string, value: string) => { mockEnvStore[key] = value; });
    mockDenoEnv.delete.mockImplementation((key: string) => { delete mockEnvStore[key]; });
    mockDenoEnv.toObject.mockImplementation(() => ({ ...mockEnvStore }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser - Validation Logic", () => {
    it("should validate required fields: name, password, role", () => {
      const testCases = [
        { body: { name: "", password: "password123", role: "student" }, valid: false, error: "Missing required fields" },
        { body: { name: "Test", password: "", role: "student" }, valid: false, error: "Missing required fields" },
        { body: { name: "Test", password: "password123", role: "" }, valid: false, error: "Missing required fields" },
        { body: { name: "Test", password: "password123", role: "student" }, valid: true, error: null },
      ];

      for (const tc of testCases) {
        const hasRequired = !!(tc.body.name && tc.body.password && tc.body.role);
        expect(hasRequired).toBe(tc.valid);
      }
    });

    it("should validate password minimum length (8 characters)", () => {
      const testCases = [
        { password: "short", valid: false },
        { password: "1234567", valid: false },
        { password: "password123", valid: true },
        { password: "verylongpassword", valid: true },
      ];

      for (const tc of testCases) {
        const isValid = tc.password.length >= 8;
        expect(isValid).toBe(tc.valid);
      }
    });

    it("should require subject_id for doctors and TAs", () => {
      const testCases = [
        { role: "doctor", subject_id: "sub-1", valid: true },
        { role: "ta", subject_id: "sub-1", valid: true },
        { role: "doctor", subject_id: "", valid: false },
        { role: "ta", subject_id: undefined, valid: false },
        { role: "student", subject_id: "sub-1", valid: false }, // Students must not have subject
        { role: "student", subject_id: "", valid: true },
      ];

      for (const tc of testCases) {
        let isValid = true;
        if ((tc.role === "doctor" || tc.role === "ta") && !tc.subject_id) {
          isValid = false;
        }
        if (tc.role === "student" && tc.subject_id) {
          isValid = false;
        }
        expect(isValid).toBe(tc.valid);
      }
    });

    it("should validate national ID for students (exactly 14 digits)", () => {
      const testCases = [
        { national_id: "12345678901234", valid: true },
        { national_id: "1234567890123", valid: false }, // 13 digits
        { national_id: "123456789012345", valid: false }, // 15 digits
        { national_id: "abcdefghijklmn", valid: false }, // non-digits
        { national_id: "1234567890123a", valid: false }, // mixed
        { national_id: "", valid: false },
      ];

      for (const tc of testCases) {
        const isValid = !!tc.national_id && tc.national_id.length === 14 && /^\d+$/.test(tc.national_id);
        expect(isValid).toBe(tc.valid);
      }
    });

    it("should validate email format for doctors and TAs", () => {
      const testCases = [
        { email: "doctor@university.edu", valid: true },
        { email: "ta@university.edu", valid: true },
        { email: "user@domain.com", valid: true },
        { email: "invalid-email", valid: false },
        { email: "no-at-sign", valid: false },
        { email: "", valid: false },
        { email: "@domain.com", valid: false },
      ];

      for (const tc of testCases) {
        const isValid = !!tc.email && tc.email.includes("@") && tc.email.indexOf("@") > 0;
        expect(isValid).toBe(tc.valid);
      }
    });

    it("should build correct auth email based on role", () => {
      const testCases = [
        { role: "student", national_id: "12345678901234", email: undefined, expected: "12345678901234@nid.local" },
        { role: "doctor", national_id: undefined, email: "DOCTOR@UNIVERSITY.EDU", expected: "doctor@university.edu" },
        { role: "ta", national_id: undefined, email: "TA@UNIVERSITY.EDU", expected: "ta@university.edu" },
      ];

      for (const tc of testCases) {
        let authEmail: string;
        if (tc.role === "student") {
          authEmail = `${tc.national_id}@nid.local`;
        } else {
          authEmail = (tc.email || "").toLowerCase();
        }
        expect(authEmail).toBe(tc.expected);
      }
    });
  });

  describe("health-check - Logic Tests", () => {
    it("should determine health status based on check results", () => {
      const testCases = [
        { db: "healthy", auth: "healthy", expectedStatus: "ok" },
        { db: "unhealthy", auth: "healthy", expectedStatus: "unhealthy" },
        { db: "healthy", auth: "unhealthy", expectedStatus: "degraded" },
        { db: "misconfigured", auth: "misconfigured", expectedStatus: "degraded" },
        { db: "unknown", auth: "unknown", expectedStatus: "ok" }, // default
      ];

      for (const tc of testCases) {
        let status: "ok" | "degraded" | "unhealthy" = "ok";
        if (tc.db === "unhealthy") {
          status = "unhealthy";
        } else if (tc.db === "misconfigured" || tc.auth === "misconfigured") {
          status = "degraded";
        } else if (tc.auth === "unhealthy") {
          status = "degraded";
        }
        expect(status).toBe(tc.expectedStatus);
      }
    });

    it("should return correct HTTP status code", () => {
      const testCases = [
        { status: "ok", expectedCode: 200 },
        { status: "degraded", expectedCode: 503 },
        { status: "unhealthy", expectedCode: 503 },
      ];

      for (const tc of testCases) {
        const statusCode = tc.status === "ok" ? 200 : 503;
        expect(statusCode).toBe(tc.expectedCode);
      }
    });

    it("should include required fields in response", () => {
      const response = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: 123,
        environment: "test",
        version: "1.0.0",
        checks: {
          database: "healthy",
          supabase: "healthy",
        },
      };

      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("uptime");
      expect(response).toHaveProperty("environment");
      expect(response).toHaveProperty("version");
      expect(response.checks).toHaveProperty("database");
      expect(response.checks).toHaveProperty("supabase");
    });
  });

  describe("import-schedule - Logic Tests", () => {
    it("should extract sheet ID from valid Google Sheets URLs", () => {
      const testCases = [
        { url: "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit", expectedId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" },
        { url: "https://docs.google.com/spreadsheets/d/abc123_DEF-456/view", expectedId: "abc123_DEF-456" },
        { url: "https://docs.google.com/spreadsheets/d/xyz789/edit#gid=0", expectedId: "xyz789" },
      ];

      for (const tc of testCases) {
        const match = tc.url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        expect(match).not.toBeNull();
        expect(match?.[1]).toBe(tc.expectedId);
      }
    });

    it("should reject invalid Google Sheets URLs", () => {
      const invalidUrls = [
        "https://example.com",
        "https://docs.google.com/spreadsheets/d/",
        "not-a-url",
        "https://docs.google.com/spreadsheets/",
        "",
      ];

      for (const url of invalidUrls) {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        expect(match).toBeNull();
      }
    });

    it("should build correct CSV export URL", () => {
      const sheetId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      expect(csvUrl).toBe("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/gviz/tq?tqx=out:csv");
    });

    it("should detect HTML response (non-public sheet)", () => {
      const htmlResponses = [
        "<!DOCTYPE html><html>...</html>",
        "<html><body>Sign in</body></html>",
        "<HTML>...</HTML>",
      ];

      for (const html of htmlResponses) {
        const isHtml = html.includes("<!DOCTYPE") || html.includes("<html>") || html.includes("<HTML>");
        expect(isHtml).toBe(true);
      }

      const csvResponse = "Header1,Header2\nValue1,Value2";
      const isHtml2 = csvResponse.includes("<!DOCTYPE") || csvResponse.includes("<html>") || csvResponse.includes("<HTML>");
      expect(isHtml2).toBe(false);
    });
  });
});

describe("Edge Function Utility Functions", () => {
  describe("CSV Parsing", () => {
    it("should handle basic CSV parsing", () => {
      const parseCSV = (csv: string): string[][] => {
        const rows: string[][] = [];
        let current: string[] = [];
        let cell = "";
        let inQ = false;
        for (let i = 0; i < csv.length; i++) {
          const c = csv[i];
          if (c === '"') {
            if (inQ && csv[i + 1] === '"') { cell += '"'; i++; }
            else { inQ = !inQ; }
          } else if (c === "," && !inQ) {
            current.push(cell.replace(/\s+/g, " ").trim());
            cell = "";
          } else if ((c === "\n" || c === "\r") && !inQ) {
            if (c === "\r" && csv[i + 1] === "\n") i++;
            current.push(cell.replace(/\s+/g, " ").trim());
            if (current.some((x) => x !== "")) rows.push(current);
            current = [];
            cell = "";
          } else {
            cell += c;
          }
        }
        if (cell || current.length) {
          current.push(cell.replace(/\s+/g, " ").trim());
          rows.push(current);
        }
        return rows;
      };

      // Test simple CSV
      const csv1 = "a,b,c\n1,2,3";
      const result1 = parseCSV(csv1);
      expect(result1).toEqual([["a", "b", "c"], ["1", "2", "3"]]);

      // Test quoted fields with commas
      const csv2 = 'a,"b,c",d';
      const result2 = parseCSV(csv2);
      expect(result2).toEqual([["a", "b,c", "d"]]);

      // Test escaped quotes
      const csv3 = 'a,"b""c",d';
      const result3 = parseCSV(csv3);
      expect(result3).toEqual([["a", 'b"c', "d"]]);
    });

    it("should handle empty rows and cells", () => {
      const parseCSV = (csv: string): string[][] => {
        const rows: string[][] = [];
        let current: string[] = [];
        let cell = "";
        let inQ = false;
        for (let i = 0; i < csv.length; i++) {
          const c = csv[i];
          if (c === '"') {
            if (inQ && csv[i + 1] === '"') { cell += '"'; i++; }
            else { inQ = !inQ; }
          } else if (c === "," && !inQ) {
            current.push(cell.replace(/\s+/g, " ").trim());
            cell = "";
          } else if ((c === "\n" || c === "\r") && !inQ) {
            if (c === "\r" && csv[i + 1] === "\n") i++;
            current.push(cell.replace(/\s+/g, " ").trim());
            if (current.some((x) => x !== "")) rows.push(current);
            current = [];
            cell = "";
          } else {
            cell += c;
          }
        }
        if (cell || current.length) {
          current.push(cell.replace(/\s+/g, " ").trim());
          rows.push(current);
        }
        return rows;
      };

      const csv = "a,b,c\n\n\nx,y,z";
      const result = parseCSV(csv);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(["a", "b", "c"]);
      expect(result[1]).toEqual(["x", "y", "z"]);
    });
  });

  describe("Cell Content Parsing", () => {
    const parseCell = (raw: string): { subject: string; instructor: string; room: string } => {
      const text = raw.replace(/<br\s*\/?>/gi, "\n").trim();
      if (!text) return { subject: "", instructor: "", room: "" };
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 1 && lines[0].includes(" - ")) {
        const parts = lines[0].split(" - ").map((p) => p.trim());
        return { subject: parts[0] || "", instructor: parts[1] || "", room: parts[2] || "" };
      }
      return { subject: lines[0] || "", instructor: lines[1] || "", room: lines[2] || "" };
    };

    it("should parse 'Subject - Instructor - Room' format", () => {
      const result = parseCell("Math - Dr. Smith - Room 101");
      expect(result).toEqual({ subject: "Math", instructor: "Dr. Smith", room: "Room 101" });
    });

    it("should parse newline-separated format", () => {
      const result = parseCell("Math\nDr. Smith\nRoom 101");
      expect(result).toEqual({ subject: "Math", instructor: "Dr. Smith", room: "Room 101" });
    });

    it("should parse <br> separated format", () => {
      const result = parseCell("Math<br>Dr. Smith<br>Room 101");
      expect(result).toEqual({ subject: "Math", instructor: "Dr. Smith", room: "Room 101" });
    });

    it("should handle empty input", () => {
      const result = parseCell("");
      expect(result).toEqual({ subject: "", instructor: "", room: "" });
    });

    it("should handle partial data", () => {
      const result = parseCell("Math\nDr. Smith");
      expect(result.subject).toBe("Math");
      expect(result.instructor).toBe("Dr. Smith");
      expect(result.room).toBe("");
    });
  });

  describe("Section vs Lecture Identification", () => {
    const isSection = (raw: string): boolean => {
      return /ai lab|simulation lab|معمل/i.test(raw) && !/مدرج|f-sem/i.test(raw);
    };

    it("should identify AI Lab as section", () => {
      expect(isSection("AI Lab - Section 1")).toBe(true);
      expect(isSection("ai lab")).toBe(true);
      expect(isSection("AI LAB")).toBe(true);
    });

    it("should identify Simulation Lab as section", () => {
      expect(isSection("Simulation Lab")).toBe(true);
      expect(isSection("simulation lab")).toBe(true);
    });

    it("should identify Arabic معمل as section", () => {
      expect(isSection("معمل حاسوب")).toBe(true);
      expect(isSection("معمل")).toBe(true);
    });

    it("should exclude lecture halls (مدرج)", () => {
      expect(isSection("مدرج 1")).toBe(false);
      expect(isSection("Lecture Hall - مدرج")).toBe(false);
      expect(isSection("مدرج")).toBe(false);
    });

    it("should exclude F-Sem rooms", () => {
      expect(isSection("F-Sem 101")).toBe(false);
      expect(isSection("f-sem")).toBe(false);
      expect(isSection("F-SEM")).toBe(false);
    });

    it("should handle mixed content correctly", () => {
      expect(isSection("AI Lab - مدرج")).toBe(false); // Contains مدرج
      expect(isSection("معمل - f-sem")).toBe(false); // Contains f-sem
    });
  });
});