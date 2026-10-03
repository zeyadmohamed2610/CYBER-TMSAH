import { type AppRole } from "@/features/auth/types";
import { LoadingScreen } from "@/shared/components/Loading";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardRoute } from "../utils/dashboardRoutes";

interface RoleGateProps {
  allowedRole: AppRole | AppRole[];
  children: ReactNode;
}

export const RoleGate = ({ allowedRole, children }: RoleGateProps) => {
  const location = useLocation();
  const { user, role, loading } = useAuth();

  // Show loading screen only on cold initial start when no role has been resolved yet
  if (loading && !role) {
    return <LoadingScreen />;
  }

  // Redirect to login only when loading is complete and both user and role are definitely absent
  if (!loading && !user && !role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // If role is active, check permissions
  if (role) {
    const isAllowed = Array.isArray(allowedRole)
      ? allowedRole.includes(role)
      : role === allowedRole;

    if (!isAllowed) {
      return <Navigate to={getDashboardRoute(role)} replace />;
    }
  }

  return <>{children}</>;
};
