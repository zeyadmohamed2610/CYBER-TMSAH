import type { SubjectAttendanceMetric } from "../types";
import { Progress } from "@/components/ui/progress";

interface SubjectProgressCardProps {
    metric: SubjectAttendanceMetric;
}

export const SubjectProgressCard = ({ metric }: SubjectProgressCardProps) => {
    const rate = metric.attendanceRate;
    const isGood = rate >= 70;
    const isWarning = rate >= 50 && rate < 70;
    const isDanger = rate < 50;

    const getColorClass = () => {
        if (isGood) return "bg-green-500";
        if (isWarning) return "bg-yellow-500";
        return "bg-red-500";
    };

    return (
        <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <span className="font-medium">{metric.subjectName}</span>
                    <span
                        className={`text-sm font-bold ${isGood
                                ? "text-green-600"
                                : isWarning
                                    ? "text-yellow-600"
                                    : "text-red-600"
                            }`}
                    >
                        {rate.toFixed(1)}%
                    </span>
                </div>
                <div className="mt-2">
                    <Progress
                        value={rate}
                        className="h-2"
                        indicatorClassName={getColorClass()}
                    />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    {metric.totalSessions} جلسة/{metric.attendanceRate >= 70 ? "ممتاز" : "تحسين مطلوب"}
                </p>
            </div>
        </div>
    );
};
