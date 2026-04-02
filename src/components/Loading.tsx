import { Shield } from "lucide-react";

/**
 * Loading Screen Component
 * Displayed while the app is loading or during lazy loading
 */
export const LoadingScreen = () => {
  return (
    <div 
      className="min-h-screen bg-background flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="جاري التحميل"
    >
      {/* Loading Animation */}
      <div className="relative">
        {/* Outer Ring */}
        <div className="w-20 h-20 rounded-full border-4 border-muted animate-spin" 
          style={{ borderTopColor: "hsl(var(--primary))" }}
        />
        
        {/* Inner Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </div>
      
      {/* Loading Text */}
      <p className="mt-6 text-muted-foreground text-sm animate-pulse">
        جاري التحميل...
      </p>
    </div>
  );
};

/**
 * Skeleton Loader for Cards
 */
export const CardSkeleton = () => {
  return (
    <div className="rounded-xl bg-card border border-border p-6 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4 mb-4" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  );
};

/**
 * Skeleton Loader for Schedule Items
 */
export const ScheduleSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-card border border-border p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-muted rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton Loader for Hero Section
 */
export const HeroSkeleton = () => {
  return (
    <div className="relative overflow-hidden py-28 md:py-40 animate-pulse">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-4 bg-muted rounded w-48 mx-auto mb-8" />
          <div className="h-16 bg-muted rounded w-3/4 mx-auto mb-4" />
          <div className="h-12 bg-muted rounded w-1/2 mx-auto mb-8" />
          <div className="h-4 bg-muted rounded w-2/3 mx-auto mb-10" />
          <div className="flex justify-center gap-4">
            <div className="h-12 bg-muted rounded w-40" />
            <div className="h-12 bg-muted rounded w-40" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for Attendance Dashboard
 */
export const AttendanceSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="جاري تحميل بيانات الحضور">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-5 bg-muted rounded-full w-32" />
          <div className="h-8 bg-muted rounded w-64" />
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-9 bg-muted rounded-lg" />
          <div className="h-9 bg-muted rounded-xl w-28" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-7 bg-muted rounded w-16" />
                <div className="h-2 bg-muted rounded w-24" />
              </div>
              <div className="w-9 h-9 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="h-5 bg-muted rounded w-40" />
        <div className="flex gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-2xl w-40 shrink-0" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded w-full mb-2" />
        ))}
      </div>
    </div>
  );
};

export default LoadingScreen;
