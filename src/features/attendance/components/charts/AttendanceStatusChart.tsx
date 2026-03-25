import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceRecord } from "../../types";
import "./chartRegistry";

interface AttendanceStatusChartProps {
  records: AttendanceRecord[];
}

export const AttendanceStatusChart = ({ records }: AttendanceStatusChartProps) => {
  const chartData = useMemo(() => {
    // Real schema has no status field — just show total submissions per subject
    const bySubject: Record<string, number> = {};
    for (const row of records) {
      const key = row.subjectName ?? "Unknown";
      bySubject[key] = (bySubject[key] ?? 0) + 1;
    }
    const labels = Object.keys(bySubject);
    const values = Object.values(bySubject);

    return {
      labels,
      datasets: [
        {
          label: "مسجلون",
          data: values,
          backgroundColor: "rgba(45, 212, 191, 0.75)",
          borderColor: "#2DD4BF",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    };
  }, [records]);

  const hasData = records.length > 0;

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">الحضور حسب المادة</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {hasData ? (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148, 163, 184, 0.1)" } },
                y: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148, 163, 184, 0.1)" }, beginAtZero: true },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            ستظهر بيانات الحضور هنا بعد التسجيل.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
