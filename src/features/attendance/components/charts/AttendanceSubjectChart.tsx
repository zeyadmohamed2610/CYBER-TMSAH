import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubjectAttendanceMetric } from "../../types";
import "./chartRegistry";

interface AttendanceSubjectChartProps {
  metrics: SubjectAttendanceMetric[];
}

const PALETTE = ["#2DD4BF", "#38BDF8", "#A78BFA", "#F59E0B", "#EF4444", "#22C55E", "#F97316", "#06B6D4"];

export const AttendanceSubjectChart = ({ metrics }: AttendanceSubjectChartProps) => {
  const chartData = useMemo(() => {
    return {
      labels: metrics.map((entry) => entry.subjectName),
      datasets: [
        {
          label: "معدل الحضور",
          data: metrics.map((entry) => Number(entry.attendanceRate.toFixed(2))),
          backgroundColor: metrics.map((_, index) => PALETTE[index % PALETTE.length]),
          borderColor: "#0F172A",
          borderWidth: 2,
        },
      ],
    };
  }, [metrics]);

  const hasData = metrics.length > 0;

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">الحضور حسب المادة</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {hasData ? (
          <Doughnut
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "bottom",
                  labels: {
                    color: "#CBD5E1",
                  },
                },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            ستظهر نسب الحضور لكل مادة هنا بعد توفر بيانات كافية.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
