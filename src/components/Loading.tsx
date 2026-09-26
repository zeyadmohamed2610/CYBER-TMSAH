import { Shield } from "lucide-react";

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
  message = "جاري تأمين الاتصال والتحقق...", 
  submessage = "نظام CYBER-TMSAH لإدارة الحضور الذكي" 
}: LoadingScreenProps) => {
  return (
    <div 
      className="min-h-screen bg-[#060A14] flex flex-col items-center justify-center relative overflow-hidden px-4"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Ambient background glow */}
      <div 
        className="absolute w-96 h-96 rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" 
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <div 
        className="absolute w-64 h-64 rounded-full bg-fuchsia-600/5 blur-[80px] pointer-events-none"
        style={{ top: '45%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />

      {/* Cyber Loader Container */}
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer Ring 1: Clockwise Dash */}
        <div 
          className="w-24 h-24 rounded-full border-2 border-purple-500/20 border-t-purple-500 border-r-fuchsia-500 animate-spin" 
          style={{ animationDuration: "1.6s" }}
        />

        {/* Outer Ring 2: Counter-Clockwise Dash */}
        <div 
          className="absolute w-20 h-20 rounded-full border-2 border-dashed border-purple-400/30 border-b-purple-400 animate-spin" 
          style={{ animationDuration: "2.4s", animationDirection: "reverse" }}
        />

        {/* Pulsing Core with Shield */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-purple-950/60 border border-purple-500/40 shadow-[0_0_20px_rgba(147,51,234,0.35)]">
            <Shield className="w-6 h-6 text-purple-400 animate-pulse" />
          </div>
        </div>

        {/* Orbiting Neon Dot */}
        <div 
          className="absolute w-28 h-28 rounded-full animate-spin"
          style={{ animationDuration: "3s" }}
        >
          <div className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_#e879f9]" />
        </div>
      </div>
      
      {/* Brand & Loading Text */}
      <div className="text-center z-10 space-y-2">
        <h3 className="text-white font-bold text-base tracking-wide flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          {message}
        </h3>
        <p className="text-purple-300/60 text-xs font-mono tracking-wider">
          {submessage}
        </p>
      </div>

      {/* Bottom Subtle Bar Indicator */}
      <div className="mt-8 w-48 h-1 bg-purple-950/80 rounded-full overflow-hidden border border-purple-900/30">
        <div className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-600 rounded-full w-full animate-pulse" />
      </div>
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
