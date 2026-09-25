import { describe, expect, it } from "vitest";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";

describe("project smoke checks", () => {
  it("maps attendance roles to stable dashboard routes", () => {
    expect(getAttendanceDashboardRoute("owner")).toBe("/attendance/owner-dashboard");
    expect(getAttendanceDashboardRoute("doctor")).toBe("/attendance/doctor-dashboard");
    expect(getAttendanceDashboardRoute("student")).toBe("/attendance/student-panel");
  });
});
