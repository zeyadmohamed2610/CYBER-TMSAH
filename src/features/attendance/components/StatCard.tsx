import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  className?: string;
  colorScheme?: "purple" | "cyan" | "emerald" | "amber" | "rose" | "blue" | "default";
  badge?: string | number;
  onClick?: () => void;
}

const colorMap = {
  purple: {
    iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    glow: "hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    valColor: "text-purple-300",
  },
  cyan: {
    iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    glow: "hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    valColor: "text-cyan-300",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    glow: "hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    valColor: "text-emerald-300",
  },
  amber: {
    iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    glow: "hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    valColor: "text-amber-300",
  },
  rose: {
    iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    glow: "hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    valColor: "text-rose-300",
  },
  blue: {
    iconBg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    glow: "hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    valColor: "text-blue-300",
  },
  default: {
    iconBg: "bg-primary/10 text-primary border-primary/30",
    glow: "hover:border-primary/40 hover:shadow-[0_0_20px_rgba(147,51,234,0.15)]",
    valColor: "text-white",
  },
};

export const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  className = "",
  colorScheme = "default",
  badge,
  onClick,
}: StatCardProps) => {
  const scheme = colorMap[colorScheme] || colorMap.default;

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 sm:p-4 transition-all duration-300 ${
        scheme.glow
      } ${
        onClick
          ? "cursor-pointer active:scale-[0.98] hover:bg-white/[0.06]"
          : "hover:bg-white/[0.05]"
      } ${className}`}
      dir="rtl"
    >
      {/* Background soft ambient gradient */}
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/[0.02] blur-xl pointer-events-none transition-all group-hover:scale-150" />

      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate">
              {title}
            </p>
            {badge !== undefined && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                {badge}
              </span>
            )}
          </div>
          <p
            className={`text-xl sm:text-2xl font-black tracking-tight ${scheme.valColor}`}
          >
            {value}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-400/80 truncate">
            {description}
          </p>
        </div>

        <div
          className={`shrink-0 rounded-xl border p-2 sm:p-2.5 transition-transform duration-300 group-hover:scale-110 ${scheme.iconBg}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
};
