import { useState } from "react";
import { Link2, Loader2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { googleSheetsService } from "../services/googleSheetsService";
import { toast } from "sonner";

interface Props {
  onConnected?: () => void;
}

export function GoogleSheetsConnector({ onConnected }: Props) {
  const [url, setUrl] = useState(googleSheetsService.getSheetUrl() || "");
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleTest = async () => {
    if (!url) return;
    setTesting(true);
    setStatus("idle");
    setErrorMsg("");

    const { rows, error } = await googleSheetsService.fetchAndParse(url);
    setTesting(false);

    if (error) {
      setStatus("error");
      setErrorMsg(error);
      return;
    }

    setStatus("ok");
    googleSheetsService.setSheetUrl(url);
    toast.success(`تم الاتصال بنجاح! تم استيراد ${rows.length} صف`);
    onConnected?.();
  };

  const handleDisconnect = () => {
    googleSheetsService.clearSheetUrl();
    setUrl("");
    setStatus("idle");
    setErrorMsg("");
    toast.info("تم فصل الاتصال مع Google Sheets");
  };

  const isConnected = !!googleSheetsService.getSheetUrl();

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" />
          ربط الجدول بـ Google Sheets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && status !== "error" && (
          <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-sm text-green-400 font-medium">الجدول مربوط بنجاح</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span className="text-sm text-destructive">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label>رابط Google Sheet</Label>
          <Input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setStatus("idle"); }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            dir="ltr"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            انسخ رابط الجدول من المتصفح والصقه هنا. الجدول يجب أن يكون مشاراً (Anyone with the link → Viewer).
          </p>
        </div>

        <div className="space-y-2">
          <Label>تنسيق الجدول المطلوب</Label>
          <div className="rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <p className="font-bold text-foreground mb-2">الجدول على شكل شبكة (Grid):</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>الصف الأول: عنوان الجدول</li>
              <li>الصف الثاني: أسماء الأيام (السبت إلى الخميس) — كل يوم يمتد على 8 أعمدة</li>
              <li>الصف الثالث: أرقام الفترات (1 إلى 8) لكل يوم</li>
              <li>الصف الرابع: أوقات البداية (9:00, 10:05, ...)</li>
              <li>الصف الخامس: أوقات النهاية (10:00, 11:05, ...)</li>
              <li>من الصف السادس: بيانات السكاشن</li>
            </ul>
            <p className="mt-2 font-bold text-foreground">كل خلية تحتوي على 3 أسطر:</p>
            <p>السطر 1: اسم المادة</p>
            <p>السطر 2: اسم المحاضر</p>
            <p>السطر 3: رقم القاعة</p>
            <p className="mt-2 text-[10px] text-primary">العمود B يحتوي رقم السكشن</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={!url || testing} className="flex-1 gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {testing ? "جاري الاتصال..." : isConnected ? "تحديث الاتصال" : "اتصال واختبار"}
          </Button>
          {isConnected && (
            <Button variant="destructive" size="icon" onClick={handleDisconnect}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
