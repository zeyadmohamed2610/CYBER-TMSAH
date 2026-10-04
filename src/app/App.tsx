import { offlineAttendanceService } from "@/features/attendance/services/offlineAttendanceService";
import { RoleGate } from "@/features/auth/components/RoleGate";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { Analytics } from "@/shared/components/Analytics";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import { ErrorModal } from "@/shared/components/ErrorModal";
import { GlobalCursorGlow } from "@/shared/components/GlobalCursorGlow";
import { LoadingScreen } from "@/shared/components/Loading";
import { OfflineIndicator, OfflineStatusProvider } from "@/shared/components/OfflineStatus";
import { PageTransition } from "@/shared/components/PageTransition";
import SEO from "@/shared/components/SEO";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { usePerformanceMonitoring } from "@/shared/hooks/use-performance";
import { LanguageProvider } from "@/shared/i18n";
import { ThemeProvider } from "@/shared/providers/ThemeContext";
import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// ── Auth Entrypoint (Eagerly loaded for instant root page rendering) ──────────
import LoginPage from "../features/auth/pages/LoginPage";

// ── Lazy Pages ────────────────────────────────────────────────────────────────
const ResetPasswordPage = lazy(() => import("../features/auth/pages/ResetPasswordPage"));
const AttendanceOwnerPage = lazy(() => import("../features/dashboards/pages/AttendanceOwnerPage"));
const AttendanceDoctorPage = lazy(
  () => import("../features/dashboards/pages/AttendanceDoctorPage"),
);
const AttendanceStudentPage = lazy(
  () => import("../features/dashboards/pages/AttendanceStudentPage"),
);
const AttendanceTAPage = lazy(() => import("../features/dashboards/pages/AttendanceTAPage"));
const AttendancePage = lazy(() => import("../features/dashboards/pages/AttendancePage"));
const ProfilePage = lazy(() => import("../features/accounts/pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));

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
                <SEO />
                <GlobalCursorGlow />
                <ErrorModal />
                <ErrorBoundary>
                  <AuthProvider>
                    <Analytics />
                    <Suspense fallback={<LoadingScreen />}>
                      <PageTransition>
                        <Routes>
                          {/* ── Public Auth Routes ───────────────────────────── */}
                          <Route path="/" element={<LoginPage />} />
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/join" element={<LoginPage initialTab="join" />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/reset-password" element={<ResetPasswordPage />} />

                          {/* ── Direct Role Dashboards (Clean URLs without /attendance) ── */}
                          <Route
                            path="/owner-dashboard"
                            element={
                              <RoleGate allowedRole="owner">
                                <AttendanceOwnerPage />
                              </RoleGate>
                            }
                          />
                          <Route
                            path="/coordinator-dashboard"
                            element={
                              <RoleGate allowedRole="coordinator">
                                <AttendanceOwnerPage />
                              </RoleGate>
                            }
                          />
                          <Route
                            path="/doctor-dashboard"
                            element={
                              <RoleGate allowedRole="doctor">
                                <AttendanceDoctorPage />
                              </RoleGate>
                            }
                          />
                          <Route
                            path="/student-panel"
                            element={
                              <RoleGate allowedRole="student">
                                <AttendanceStudentPage />
                              </RoleGate>
                            }
                          />
                          <Route
                            path="/ta-dashboard"
                            element={
                              <RoleGate allowedRole="ta">
                                <AttendanceTAPage />
                              </RoleGate>
                            }
                          />

                          {/* ── User Profile & Account Settings ────────────── */}
                          <Route
                            path="/profile"
                            element={
                              <RoleGate
                                allowedRole={["owner", "coordinator", "doctor", "ta", "student"]}
                              >
                                <ProfilePage />
                              </RoleGate>
                            }
                          />

                          {/* ── Backward Compatibility Redirects ───────────── */}
                          <Route path="/attendance" element={<AttendancePage />} />
                          <Route
                            path="/attendance/login"
                            element={<Navigate to="/login" replace />}
                          />
                          <Route
                            path="/attendance/owner-dashboard"
                            element={<Navigate to="/owner-dashboard" replace />}
                          />
                          <Route
                            path="/attendance/doctor-dashboard"
                            element={<Navigate to="/doctor-dashboard" replace />}
                          />
                          <Route
                            path="/attendance/student-panel"
                            element={<Navigate to="/student-panel" replace />}
                          />
                          <Route
                            path="/attendance/ta-dashboard"
                            element={<Navigate to="/ta-dashboard" replace />}
                          />
                          <Route path="/schedule" element={<Navigate to="/login" replace />} />

                          {/* ── 404 ─────────────────────────────────────────── */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </PageTransition>
                    </Suspense>
                  </AuthProvider>
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
