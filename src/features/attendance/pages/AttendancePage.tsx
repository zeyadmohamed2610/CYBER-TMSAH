import { Navigate } from "react-router-dom";
import { LoadingScreen } from "@/components/Loading";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";
import AttendanceForbiddenPage from "./AttendanceForbiddenPage";

/**
 * Main attendance landing page - routes users to their appropriate dashboard
 * 
 * Phase 3: Stabilized routing to prevent flash redirect loops:
 * - Shows loading screen until auth state is fully resolved
 * - Blocks navigation until role is confirmed
 * - Prevents flash between login and dashboard
 */
const AttendancePage = () => {
  const { user, role, loading } = useAttendanceAuth();

  // Phase 3: Block render until loading is complete and role is resolved
  // This prevents the flash of wrong content before redirect
  if (loading) {
    return <LoadingScreen />;
  }

  // Prevent dashboard access before role is confirmed
  if (!user || role === null) {
    return <Navigate to="/attendance/login" replace />;
  }

  if (role === "owner" || role === "doctor" || role === "student" || role === "ta") {
    return <Navigate to={getAttendanceDashboardRoute(role)} replace />;
  }

  return <AttendanceForbiddenPage />;
};

export default AttendancePage;
