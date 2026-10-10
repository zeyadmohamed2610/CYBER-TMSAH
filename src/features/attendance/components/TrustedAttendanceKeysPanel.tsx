import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ConfirmAction } from "@/shared/components/ui/confirm-action";
import { Input } from "@/shared/components/ui/input";
import { securityRequest } from "@/shared/lib/passwordService";
import { KeyRound, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
interface TrustedAttendanceKey {
  auth_id: string;
  full_name: string;
  credential_id: string | null;
  trusted_at: string | null;
  friendly_name: string | null;
  last_used_at: string | null;
  credential_exists: boolean;
}
export function TrustedAttendanceKeysPanel() {
  const [devices, setDevices] = useState<TrustedAttendanceKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDevices(
        (
          await securityRequest<{ devices: TrustedAttendanceKey[] }>("trusted-devices", {
            action: "list",
          })
        ).devices,
      );
    } catch {
      setError("تعذر تحميل مفاتيح الحضور المعتمدة. أعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const revoke = async (device: TrustedAttendanceKey) => {
    if (revoking) return;
    setRevoking(device.auth_id);
    try {
      await securityRequest("trusted-devices", { action: "revoke", studentAuthId: device.auth_id });
      toast.success("أُلغي المفتاح السابق. يمكن للطالب اعتماد مفتاح جديد عند تأكيد الحضور.");
      await load();
    } catch {
      toast.error("تعذر إلغاء المفتاح. أعد المحاولة.");
    } finally {
      setRevoking(null);
    }
  };
  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            مفاتيح الحضور الموثوقة
          </CardTitle>
          <Button
            variant="ghost"
            aria-label="تحديث مفاتيح الحضور"
            onClick={() => void load()}
            disabled={loading || !!revoking}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          إدارة مفتاح المرور المعتمد للحضور. الإلغاء يحذف المفتاح السابق من الحساب، ويبطل إثباتات
          حضوره، ويسجل الإجراء. تحقق من هوية الطالب قبل الإلغاء.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor="trusted-key-search" className="sr-only">
          بحث باسم الطالب
        </label>
        <Input
          id="trusted-key-search"
          placeholder="بحث باسم الطالب"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error ? (
          <p role="alert">{error}</p>
        ) : loading ? (
          <p role="status">جارٍ تحميل المفاتيح...</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {devices
              .filter((device) => device.full_name.includes(search.trim()))
              .map((device) => (
                <div
                  key={device.auth_id}
                  className="flex flex-wrap justify-between items-center gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold">{device.full_name}</p>
                    {device.credential_id ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {device.friendly_name || "مفتاح حضور معتمد"}
                          {!device.credential_exists && " — المفتاح محذوف؛ يلزم إعادة الاعتماد"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          اعتمد: {new Date(device.trusted_at!).toLocaleString("ar-EG")} · آخر
                          استخدام:{" "}
                          {device.last_used_at
                            ? new Date(device.last_used_at).toLocaleString("ar-EG")
                            : "لم يسجل بعد"}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        سيعتمد مفتاحه عند أول تأكيد حضور.
                      </p>
                    )}
                  </div>
                  {device.credential_id && (
                    <ConfirmAction
                      title="إلغاء مفتاح الحضور وإعادة الاعتماد"
                      description={`سيُحذف مفتاح ${device.full_name} السابق من حسابه، ويتوقف استخدامه للدخول والحضور. بعد التحقق من هوية الطالب يمكنه إضافة واعتماد مفتاح جديد.`}
                      confirmLabel="إلغاء المفتاح"
                      onConfirm={() => revoke(device)}
                    >
                      {(trigger) => (
                        <Button variant="destructive" onClick={trigger} disabled={!!revoking}>
                          إلغاء المفتاح وإعادة الاعتماد
                        </Button>
                      )}
                    </ConfirmAction>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
