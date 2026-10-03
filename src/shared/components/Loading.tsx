import { LoaderCircle } from "lucide-react";

/**
 * Loading Screen Component
 * Displayed while the app is loading or during lazy loading
 */
interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

/**
 * Loading Screen Component
 * Displayed during authentication verification, secure transitions, or lazy chunk loading.
 */
export const LoadingScreen = ({
  message = "جارٍ تحميل المنصة...",
  submessage = "CYBER TMSAH · منصتك الأكاديمية",
}: LoadingScreenProps) => {
  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
        <LoaderCircle
          aria-hidden="true"
          className="h-7 w-7 animate-spin motion-reduce:animate-none text-primary"
        />
      </div>
      <p className="font-semibold text-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{submessage}</p>
    </div>
  );
};

/**
 * Skeleton Loader for Cards
 */
export const CardSkeleton = () => {
  return (
    <div className="rounded-xl bg-card border border-border p-6 animate-pulse motion-reduce:animate-none">
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
        <div
          key={i}
          className="rounded-xl bg-card border border-border p-5 animate-pulse motion-reduce:animate-none"
        >
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
    <div className="relative overflow-hidden py-28 md:py-40 animate-pulse motion-reduce:animate-none">
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
    <div
      className="space-y-6 animate-pulse motion-reduce:animate-none"
      role="status"
      aria-label="جاري تحميل بيانات الحضور"
    >
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
