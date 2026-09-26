import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/Loading";
import type { AttendanceRole } from "../types";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";

interface AttendanceRoleGateProps {
  allowedRole: AttendanceRole | AttendanceRole[];
  children: ReactNode;
}

export const AttendanceRoleGate = ({ allowedRole, children }: AttendanceRoleGateProps) => {
  const location = useLocation();
  const { user, role, loading } = useAttendanceAuth();

  // Show loading screen only on cold initial start when no role has been resolved yet
  if (loading && !role) {
    return <LoadingScreen />;
  }

  // Redirect to login only when loading is complete and user/role is definitely absent
  if (!loading && (!user || role === null)) {
    return <Navigate to="/attendance/login" replace state={{ from: location.pathname }} />;
  }

  // If role is active, check permissions
  if (role) {
    const isAllowed = Array.isArray(allowedRole)
      ? allowedRole.includes(role)
      : role === allowedRole;

    if (!isAllowed) {
      return <Navigate to={getAttendanceDashboardRoute(role)} replace />;
    }
  }

  return <>{children}</>;
};
