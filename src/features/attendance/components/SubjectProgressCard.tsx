import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";
import { type SubjectAttendanceMetric } from "../types";

interface SubjectProgressCardProps {
  metric: SubjectAttendanceMetric;
}

export const SubjectProgressCard = ({ metric }: SubjectProgressCardProps) => {
  const rate = metric.attendanceRate;

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{metric.subjectName}</h3>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-primary/10 text-primary">
          {rate.toFixed(1)}%
        </span>
      </div>

      <div className="space-y-2">
        <Progress
          value={rate}
          aria-label={`نسبة الحضور في ${metric.subjectName}`}
          className="h-3 bg-slate-100 dark:bg-slate-800"
          indicatorClassName={cn("transition-all duration-1000 ease-out", "bg-primary")}
        />
        <div className="flex justify-between text-xs tracking-wider font-semibold text-slate-400 dark:text-slate-400">
          <span>{metric.totalSessions} حصة</span>
          <span>نسبة الحضور المسجلة</span>
        </div>
      </div>
    </div>
  );
};
