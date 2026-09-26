import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/Loading";
import { Analytics } from "@/components/Analytics";
import { usePerformanceMonitoring } from "@/hooks/use-performance";
import { AttendanceAuthProvider } from "@/features/attendance/context/AttendanceAuthContext";
import { AttendanceRoleGate } from "@/features/attendance/components/AttendanceRoleGate";
import { PageTransition } from "@/components/PageTransition";
import { OfflineStatusProvider, OfflineIndicator } from "@/components/OfflineStatus";
import { offlineAttendanceService } from "@/features/attendance/services/offlineAttendanceService";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/i18n";
import { GlobalCursorGlow } from "@/components/GlobalCursorGlow";
import { ErrorModal } from "@/components/ErrorModal";

// ── Auth Entrypoint (Eagerly loaded for instant root page rendering) ──────────
import LoginPage from "./features/auth/pages/LoginPage";

// ── Lazy Pages ────────────────────────────────────────────────────────────────
const ResetPasswordPage   = lazy(() => import("./features/auth/pages/ResetPasswordPage"));
const AttendanceOwnerPage = lazy(() => import("./features/attendance/pages/AttendanceOwnerPage"));
const AttendanceDoctorPage = lazy(() => import("./features/attendance/pages/AttendanceDoctorPage"));
const AttendanceStudentPage = lazy(() => import("./features/attendance/pages/AttendanceStudentPage"));
const AttendanceTAPage    = lazy(() => import("./features/attendance/pages/AttendanceTAPage"));
const ProfilePage         = lazy(() => import("./pages/ProfilePage"));
const HealthCheck         = lazy(() => import("./pages/HealthCheck"));
const NotFound            = lazy(() => import("./pages/NotFound"));

const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  usePerformanceMonitoring();
  return <>{children}</>;
};

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <LanguageProvider>
        <AppWrapper>
          <TooltipProvider delayDuration={200}>
            <Toaster />
            <Sonner
              position="top-center"
              toastOptions={{
                style: {
                  fontFamily: "'Cairo', sans-serif",
                },
              }}
            />
            <OfflineStatusProvider
              syncFunction={offlineAttendanceService.syncPending}
              getPendingCountFunction={offlineAttendanceService.getPendingCount}
            >
              <BrowserRouter>
                <GlobalCursorGlow />
                <ErrorModal />
                <ErrorBoundary>
                  <AttendanceAuthProvider>
                    <Analytics />
                    <Suspense fallback={<LoadingScreen />}>
                      <PageTransition>
                        <Routes>
                          {/* ── Public Auth Routes ───────────────────────────── */}
                          <Route path="/" element={<Navigate to="/login" replace />} />
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/join" element={<LoginPage initialTab="join" />} />
                          <Route path="/reset-password" element={<ResetPasswordPage />} />

                          {/* ── Direct Role Dashboards (Clean URLs without /attendance) ── */}
                          <Route
                            path="/owner-dashboard"
                            element={
                              <AttendanceRoleGate allowedRole="owner">
                                <AttendanceOwnerPage />
                              </AttendanceRoleGate>
                            }
                          />
                          <Route
                            path="/coordinator-dashboard"
                            element={
                              <AttendanceRoleGate allowedRole="coordinator">
                                <AttendanceOwnerPage />
                              </AttendanceRoleGate>
                            }
                          />
                          <Route
                            path="/doctor-dashboard"
                            element={
                              <AttendanceRoleGate allowedRole="doctor">
                                <AttendanceDoctorPage />
                              </AttendanceRoleGate>
                            }
                          />
                          <Route
                            path="/student-panel"
                            element={
                              <AttendanceRoleGate allowedRole="student">
                                <AttendanceStudentPage />
                              </AttendanceRoleGate>
                            }
                          />
                          <Route
                            path="/ta-dashboard"
                            element={
                              <AttendanceRoleGate allowedRole="ta">
                                <AttendanceTAPage />
                              </AttendanceRoleGate>
                            }
                          />

                          {/* ── User Profile & Account Settings ────────────── */}
                          <Route
                            path="/profile"
                            element={
                              <AttendanceRoleGate allowedRole={["owner", "coordinator", "doctor", "ta", "student"]}>
                                <ProfilePage />
                              </AttendanceRoleGate>
                            }
                          />

                          {/* ── System Diagnostics & Health (Secured for Owner/Coordinator) ── */}
                          <Route
                            path="/health"
                            element={
                              <AttendanceRoleGate allowedRole={["owner", "coordinator"]}>
                                <HealthCheck />
                              </AttendanceRoleGate>
                            }
                          />

                          {/* ── Backward Compatibility Redirects ───────────── */}
                          <Route path="/attendance" element={<Navigate to="/login" replace />} />
                          <Route path="/attendance/login" element={<Navigate to="/login" replace />} />
                          <Route path="/attendance/owner-dashboard" element={<Navigate to="/owner-dashboard" replace />} />
                          <Route path="/attendance/doctor-dashboard" element={<Navigate to="/doctor-dashboard" replace />} />
                          <Route path="/attendance/student-panel" element={<Navigate to="/student-panel" replace />} />
                          <Route path="/attendance/ta-dashboard" element={<Navigate to="/ta-dashboard" replace />} />
                          <Route path="/schedule" element={<Navigate to="/login" replace />} />

                          {/* ── 404 ─────────────────────────────────────────── */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </PageTransition>
                    </Suspense>
                  </AttendanceAuthProvider>
                </ErrorBoundary>
              </BrowserRouter>
              <OfflineIndicator />
            </OfflineStatusProvider>
          </TooltipProvider>
        </AppWrapper>
      </LanguageProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
