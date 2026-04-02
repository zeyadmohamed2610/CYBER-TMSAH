import type { SubjectAttendanceMetric } from "../types";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SubjectProgressCardProps {
    metric: SubjectAttendanceMetric;
}

export const SubjectProgressCard = ({ metric }: SubjectProgressCardProps) => {
    const rate = metric.attendanceRate;
    const isGood = rate >= 70;
    const isWarning = rate >= 50 && rate < 70;

    const getStatusColor = () => {
        if (isGood) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900";
        if (isWarning) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
        return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900";
    };

    const getGradientClass = () => {
        if (isGood) return "bg-gradient-to-r from-emerald-400 to-emerald-600";
        if (isWarning) return "bg-gradient-to-r from-amber-400 to-amber-600";
        return "bg-gradient-to-r from-rose-400 to-rose-600";
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{metric.subjectName}</h3>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", getStatusColor())}>
                    {rate.toFixed(1)}%
                </span>
            </div>
            
            <div className="space-y-2">
                <Progress
                    value={rate}
                    className="h-3 bg-slate-100 dark:bg-slate-800"
                    indicatorClassName={cn("transition-all duration-1000 ease-out", getGradientClass())}
                />
                <div className="flex justify-between text-[10px] tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                    <span>{metric.totalSessions} محاضرة</span>
                    <span>{isGood ? "على المسار الصحيح" : "يحتاج اهتمام"}</span>
                </div>
            </div>
        </div>
    );
};
