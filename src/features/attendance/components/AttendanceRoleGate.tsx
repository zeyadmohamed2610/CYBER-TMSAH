import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/Loading";
import type { AttendanceRole } from "../types";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";

interface AttendanceRoleGateProps {
  allowedRole: AttendanceRole;
  children: ReactNode;
}

export const AttendanceRoleGate = ({ allowedRole, children }: AttendanceRoleGateProps) => {
  const location = useLocation();
  const { user, role, loading } = useAttendanceAuth();

  // Phase 3: Block render until role is resolved to prevent flash
  // Show loading screen while authentication is being resolved
  if (loading) {
    return <LoadingScreen />;
  }

  // Prevent dashboard access before role is confirmed
  if (!user || role === null) {
    return <Navigate to="/attendance/login" replace state={{ from: location.pathname }} />;
  }

  // Check if user has the required role
  if (role !== allowedRole) {
    return <Navigate to={getAttendanceDashboardRoute(role)} replace />;
  }

  return <>{children}</>;
};
