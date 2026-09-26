import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

const AttendanceForbiddenPage = () => {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-destructive/40 bg-card/90 p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">403</h1>
        <p className="mt-2 text-lg font-semibold text-foreground">غير مصرح لك بالدخول إلى هذه الصفحة</p>
        <p className="mt-2 text-sm text-muted-foreground">
          صلاحيات هذا الحساب لا تسمح بالوصول إلى لوحة الحضور المطلوبة.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/attendance">العودة إلى بوابة الحضور</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">تسجيل الدخول بحساب آخر</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceForbiddenPage;
