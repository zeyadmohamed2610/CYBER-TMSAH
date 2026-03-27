import { MapPin, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGps } from "../context/GpsContext";

interface Props {
  children: React.ReactNode;
}

export function LocationGuard({ children }: Props) {
  const { status, retry } = useGps();

  if (status === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/30">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="relative">
              <MapPin className="h-12 w-12 text-primary animate-pulse" />
              <div className="absolute -inset-3 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
            <h2 className="text-lg font-bold text-center">جاري تحديد موقعك...</h2>
            <p className="text-sm text-muted-foreground text-center">
              يرجى السماح بالوصول إلى الموقع عند ظهور الطلب
            </p>
            <div className="h-1 w-48 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-1/2 bg-primary rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <ShieldAlert className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-bold text-center text-destructive">خدمة الموقع غير متاحة</h2>
            <p className="text-sm text-muted-foreground text-center">
              متصفحك لا يدعم خدمة تحديد الموقع. يرجى استخدام متصفح حديث يدعم GPS.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <ShieldAlert className="h-14 w-14 text-red-600 dark:text-red-400" />
            <h2 className="text-lg font-bold text-center text-red-700 dark:text-red-300">
              يجب تفعيل الموقع GPS
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400 text-center max-w-xs">
              نظام الحضور يتتبع موقعك للتأكد من تواجدك في القاعة.
              يرجى تفعيل خدمة الموقع من إعدادات المتصفح والضغط على المحاولة مرة أخرى.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground text-center bg-background rounded-lg p-4 border">
              <p className="font-medium">كيفية تفعيل الموقع:</p>
              <p>1. اضغط على أيقونة القفل 🔒 بجانب رابط الموقع</p>
              <p>2. اختر &quot;السماح&quot; لخدمة الموقع</p>
              <p>3. أعد تحميل الصفحة أو اضغط الزر أدناه</p>
            </div>
            <Button onClick={retry} className="gap-2 mt-2">
              <RefreshCw className="h-4 w-4" />
              محاولة مرة أخرى
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Granted — render children with GPS available
  return <>{children}</>;
}
