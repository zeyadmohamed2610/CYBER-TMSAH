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

const Index = lazy(() => import("./pages/Index"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Materials = lazy(() => import("./pages/Materials"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
          <BrowserRouter>
            <Analytics />
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/materials" element={<Materials />} />
                <Route path="/materials/:id" element={<SubjectDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ErrorBoundary>
    </AppWrapper>
  </HelmetProvider>
);

export default App;
