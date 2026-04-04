import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export const LoadingSpinner = ({ size = "md", text, className = "" }: LoadingSpinnerProps) => (
  <div className={`flex items-center justify-center gap-3 ${className}`}>
    <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
    {text && <span className="text-muted-foreground text-sm font-medium">{text}</span>}
  </div>
);

export const LoadingOverlay = ({ text = "جاري التحميل..." }: { text?: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card/90 border border-border shadow-2xl">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <span className="text-lg font-semibold text-foreground">{text}</span>
    </div>
  </div>
);

export const InlineLoader = ({ text }: { text?: string }) => (
  <span className="inline-flex items-center gap-2 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin text-primary" />
    {text && <span className="text-sm">{text}</span>}
  </span>
);