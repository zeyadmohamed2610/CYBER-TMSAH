import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/Loading";
import { Analytics } from "@/components/Analytics";
import { usePerformanceMonitoring } from "@/hooks/use-performance";
import { AttendanceAuthProvider } from "@/features/attendance/context/AttendanceAuthContext";
import { AttendanceRoleGate } from "@/features/attendance/components/AttendanceRoleGate";
import { PageTransition } from "@/components/PageTransition";
import { OfflineStatusProvider, OfflineIndicator } from "@/components/OfflineStatus";
import { offlineAttendanceService } from "@/features/attendance/services/offlineAttendanceService";

const Index = lazy(() => import("./pages/Index"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Materials = lazy(() => import("./pages/Materials"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AttendancePage = lazy(() => import("./features/attendance/pages/AttendancePage"));
const AttendanceLoginPage = lazy(() => import("./features/attendance/pages/AttendanceLoginPage"));
const AttendanceOwnerPage = lazy(() => import("./features/attendance/pages/AttendanceOwnerPage"));
const AttendanceDoctorPage = lazy(() => import("./features/attendance/pages/AttendanceDoctorPage"));
const AttendanceStudentPage = lazy(() => import("./features/attendance/pages/AttendanceStudentPage"));
const AttendanceTAPage = lazy(() => import("./features/attendance/pages/AttendanceTAPage"));

const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  usePerformanceMonitoring();
  return <>{children}</>;
};

const App = () => (
  <HelmetProvider>
    <AppWrapper>
      <ErrorBoundary>
        <TooltipProvider delayDuration={200}>
          <Toaster />
          <Sonner
            position="top-center"
            toastOptions={{
              style: {
                direction: "rtl",
                fontFamily: "'Cairo', sans-serif",
              },
            }}
          />
          <OfflineStatusProvider
            syncFunction={offlineAttendanceService.syncPending}
            getPendingCountFunction={offlineAttendanceService.getPendingCount}
          >
            <AttendanceAuthProvider>
              <BrowserRouter>
                <Analytics />
                <Suspense fallback={<LoadingScreen />}>
                  <PageTransition>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/materials" element={<Materials />} />
                      <Route path="/materials/:id" element={<SubjectDetail />} />
                      <Route path="/attendance/login" element={<AttendanceLoginPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      <Route
                        path="/attendance/owner-dashboard"
                        element={
                          <AttendanceRoleGate allowedRole="owner">
                            <AttendanceOwnerPage />
                          </AttendanceRoleGate>
                        }
                      />
                      <Route
                        path="/attendance/doctor-dashboard"
                        element={
                          <AttendanceRoleGate allowedRole="doctor">
                            <AttendanceDoctorPage />
                          </AttendanceRoleGate>
                        }
                      />
                      <Route
                        path="/attendance/student-panel"
                        element={
                          <AttendanceRoleGate allowedRole="student">
                            <AttendanceStudentPage />
                          </AttendanceRoleGate>
                        }
                      />
                      <Route
                        path="/attendance/ta-dashboard"
                        element={
                          <AttendanceRoleGate allowedRole="ta">
                            <AttendanceTAPage />
                          </AttendanceRoleGate>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </PageTransition>
                </Suspense>
              </BrowserRouter>
            </AttendanceAuthProvider>
            <OfflineIndicator />
          </OfflineStatusProvider>
        </TooltipProvider>
      </ErrorBoundary>
    </AppWrapper>
  </HelmetProvider>
);

export default App;
