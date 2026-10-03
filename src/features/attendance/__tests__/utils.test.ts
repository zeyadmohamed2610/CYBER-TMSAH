import { describe, expect, it } from "vitest";
import { formatDateTime } from "../utils/rotatingSession";

describe("formatDateTime", () => {
  it("should format ISO date to readable string", () => {
    const result = formatDateTime("2026-03-27T14:30:00Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result).not.toBe("2026-03-27T14:30:00Z");
  });

  it("should return original value for invalid date", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("")).toBe("");
  });
});

describe("dashboardRoutes", () => {
  it("should return correct route for each role", async () => {
    const { getDashboardRoute } = await import("../../auth/utils/dashboardRoutes");
    expect(getDashboardRoute("owner")).toBe("/owner-dashboard");
    expect(getDashboardRoute("doctor")).toBe("/doctor-dashboard");
    expect(getDashboardRoute("student")).toBe("/student-panel");
  });
});
