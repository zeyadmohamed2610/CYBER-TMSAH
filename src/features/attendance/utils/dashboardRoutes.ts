import type { AttendanceRole } from "../types";

export const attendanceDashboardRoutes: Record<AttendanceRole, string> = {
  owner: "/owner-dashboard",
  coordinator: "/coordinator-dashboard",
  doctor: "/doctor-dashboard",
  student: "/student-panel",
  ta: "/ta-dashboard",
};

export const getAttendanceDashboardRoute = (role: AttendanceRole): string => {
  return attendanceDashboardRoutes[role];
};
