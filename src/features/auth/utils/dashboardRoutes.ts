import { type AppRole } from "@/features/auth/types";

export const dashboardRoutes: Record<AppRole, string> = {
  owner: "/owner-dashboard",
  coordinator: "/coordinator-dashboard",
  doctor: "/doctor-dashboard",
  student: "/student-panel",
  ta: "/ta-dashboard",
};

export const getDashboardRoute = (role: AppRole): string => {
  return dashboardRoutes[role];
};
