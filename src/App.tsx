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
import { AuthProvider, useAuth } from "@/contexts/AuthContextSupabase";
import { RequireAuth, RequireOwner, RedirectIfAuth } from "@/components/guards/RouteGuards";

const Index = lazy(() => import("./pages/Index"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Materials = lazy(() => import("./pages/Materials"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));

const StudentDashboard = lazy(() => import("./pages/dashboard/StudentDashboard"));
const DoctorDashboard = lazy(() => import("./pages/dashboard/DoctorDashboard"));
const OwnerDashboard = lazy(() => import("./pages/dashboard/OwnerDashboard"));
const MarkAttendance = lazy(() => import("./pages/attendance/MarkAttendanceSupabase"));

function DashboardRouter() {
  const { role } = useAuth();
  
  if (role === 'owner') {
    return <OwnerDashboard />;
  }
  if (role === 'doctor') {
    return <DoctorDashboard />;
  }
  return <StudentDashboard />;
}

const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  usePerformanceMonitoring();
  return <>{children}</>;
};

const App = () => (
  <HelmetProvider>
    <AuthProvider>
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
            <BrowserRouter>
              <Analytics />
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/materials" element={<Materials />} />
                  <Route path="/materials/:id" element={<SubjectDetail />} />
                  
                  <Route path="/login" element={
                    <RedirectIfAuth>
                      <Login />
                    </RedirectIfAuth>
                  } />
                  
                  <Route path="/register" element={
                    <RedirectIfAuth>
                      <Register />
                    </RedirectIfAuth>
                  } />
                  
                  <Route path="/dashboard" element={
                    <RequireAuth>
                      <DashboardRouter />
                    </RequireAuth>
                  } />
                  
                  <Route path="/attendance/mark" element={<MarkAttendance />} />
                  
                  <Route path="/owner/*" element={
                    <RequireOwner>
                      <OwnerDashboard />
                    </RequireOwner>
                  } />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </ErrorBoundary>
      </AppWrapper>
    </AuthProvider>
  </HelmetProvider>
);

export default App;
