import { getDashboardRoute } from "@/features/auth/utils/dashboardRoutes";
import { describe, expect, it } from "vitest";

describe("project smoke checks", () => {
  it("maps attendance roles to stable dashboard routes", () => {
    expect(getDashboardRoute("owner")).toBe("/owner-dashboard");
    expect(getDashboardRoute("doctor")).toBe("/doctor-dashboard");
    expect(getDashboardRoute("student")).toBe("/student-panel");
  });
});
