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
  const { user, role, loading, sessionExpired } = useAuth();

  // Keep the requested URL while a cold start resolves its session and role.
  if (loading && (!user || !role)) {
    return <LoadingScreen />;
  }

  // A protected page needs both a signed-in user and a resolved, trusted role.
  if (!user || !role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}`, sessionExpired }}
      />
    );
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
