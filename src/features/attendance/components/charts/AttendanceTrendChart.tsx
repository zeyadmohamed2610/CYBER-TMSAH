import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceTrendPoint } from "../../types";
import "./chartRegistry";

interface AttendanceTrendChartProps {
  points: AttendanceTrendPoint[];
}

export const AttendanceTrendChart = ({ points }: AttendanceTrendChartProps) => {
  const chartData = useMemo(() => {
    return {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: "تسجيلات الحضور",
          data: points.map((point) => point.count),
          borderColor: "#2DD4BF",
          backgroundColor: "rgba(45, 212, 191, 0.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [points]);

  const hasData = points.length > 0;

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">اتجاه الحضور</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {hasData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { color: "#CBD5E1" } },
              },
              scales: {
                x: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148, 163, 184, 0.15)" } },
                y: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148, 163, 184, 0.15)" }, beginAtZero: true },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            ستظهر بيانات الاتجاه هنا بعد التسجيل.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
