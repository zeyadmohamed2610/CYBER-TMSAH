import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { reportService } from "../services/reportService";
import type { AttendanceRole, ExportRequest } from "../types";

interface ExportButtonsProps {
  role: AttendanceRole;
}

const EXPORT_FORMATS: ExportRequest["format"][] = ["csv", "xlsx", "pdf"];

export const ExportButtons = ({ role }: ExportButtonsProps) => {
  const { toast } = useToast();

  const handleExport = async (format: ExportRequest["format"]) => {
    const result = await reportService.requestExport({ format, role });
    if (result.error) {
      toast({
        variant: "destructive",
        title: `فشل تصدير ${format.toUpperCase()}`,
        description: result.error,
      });
      return;
    }

    toast({
      title: `تم تصدير ${format.toUpperCase()}`,
      description: "تم إنشاء الملف وتنزيله على جهازك.",
    });
  };

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">تصدير التقارير</CardTitle>
        <CardDescription>تصدير مباشر من بيانات الحضور الحالية بصيغ CSV وExcel المتوافق وPDF.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {EXPORT_FORMATS.map((format) => (
          <Button key={format} variant="outline" onClick={() => void handleExport(format)}>
            <Download className="h-4 w-4" />
            {format.toUpperCase()}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};
