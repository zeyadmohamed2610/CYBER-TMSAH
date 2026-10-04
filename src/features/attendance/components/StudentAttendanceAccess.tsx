import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { useDeviceLock } from "../hooks/useDeviceLock";

export function StudentAttendanceAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { checking, error, retry, isDeviceLocked, hasDeviceLock, lockDevice, locking } =
    useDeviceLock(user?.id);
  if (checking) return <p role="status">جارٍ التحقق من جهاز الحضور...</p>;
  if (error)
    return (
      <div role="alert" className="rounded-2xl border p-5 space-y-3">
        <p>{error}</p>
        <Button onClick={retry} variant="outline">
          إعادة المحاولة
        </Button>
      </div>
    );
  if (isDeviceLocked) return <>{children}</>;
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Smartphone className="h-5 w-5" />
        جهاز تسجيل الحضور
      </h2>
      <p className="text-muted-foreground">
        {hasDeviceLock
          ? "لتسجيل الحضور، استخدم الجهاز المرتبط بحسابك. عند تغيير هاتفك، اطلب من الإدارة إعادة تعيين جهاز الحضور."
          : "اربط هذا الجهاز بحسابك قبل تسجيل الحضور. تُستخدم البصمة أو رمز قفل الجهاز لتأكيد كل تسجيل."}
      </p>
      <p className="text-sm text-muted-foreground">
        يمكنك الاطلاع على الجدول وموادك وسجل حضورك وطلباتك من التبويبات الأخرى.
      </p>
      {!hasDeviceLock && (
        <Button onClick={() => void lockDevice()} disabled={locking}>
          {locking ? "جارٍ تسجيل الجهاز..." : "قفل هذا الجهاز والمتابعة"}
        </Button>
      )}
    </section>
  );
}
