import { describe, expect, it } from "vitest";
import { subjects } from "@/data/materialsData";
import { getSectionSchedule, sections } from "@/data/scheduleData";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";

describe("project smoke checks", () => {
  it("exposes study content for the public pages", () => {
    expect(subjects.length).toBeGreaterThan(0);
    expect(sections.length).toBeGreaterThan(0);
  });

  it("builds a full weekly schedule for a section", () => {
    expect(getSectionSchedule(sections[0])).toHaveLength(7);
  });

  it("maps attendance roles to stable dashboard routes", () => {
    expect(getAttendanceDashboardRoute("owner")).toBe("/attendance/owner-dashboard");
    expect(getAttendanceDashboardRoute("doctor")).toBe("/attendance/doctor-dashboard");
    expect(getAttendanceDashboardRoute("student")).toBe("/attendance/student-panel");
  });
});
