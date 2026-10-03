import { LoadingScreen } from "@/shared/components/Loading";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import AttendanceForbiddenPage from "../../auth/pages/ForbiddenPage";
import { getDashboardRoute } from "../../auth/utils/dashboardRoutes";

/**
 * Main attendance landing page - routes users to their appropriate dashboard
 *
 * Phase 3: Stabilized routing to prevent flash redirect loops:
 * - Shows loading screen until auth state is fully resolved
 * - Blocks navigation until role is confirmed
 * - Prevents flash between login and dashboard
 */
const AttendancePage = () => {
  const { user, role, loading } = useAuth();

  // Phase 3: Block render until loading is complete and role is resolved
  // This prevents the flash of wrong content before redirect
  if (loading) {
    return <LoadingScreen />;
  }

  // Prevent dashboard access before role is confirmed
  if (!user || role === null) {
    return <Navigate to="/login" replace />;
  }

  if (
    role === "owner" ||
    role === "coordinator" ||
    role === "doctor" ||
    role === "student" ||
    role === "ta"
  ) {
    return <Navigate to={getDashboardRoute(role)} replace />;
  }

  return <AttendanceForbiddenPage />;
};

export default AttendancePage;
