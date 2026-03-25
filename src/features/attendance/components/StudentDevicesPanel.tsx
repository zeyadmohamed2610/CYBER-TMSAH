/**
 * StudentDevicesPanel — Owner-only.
 * Shows all students with device binding status.
 * Owner can clear a student's device binding (not delete the account).
 */
import { useEffect, useState } from "react";
import { Smartphone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface StudentDevice {
  student_id: string;
  full_name: string;
  national_id: string | null;
  device_fingerprint: string | null;
  ip_address: string | null;
  bound_at: string | null;
}

export function StudentDevicesPanel() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentDevice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    // Join users (students) with student_devices (left join — some may not have device bound)
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        full_name,
        national_id,
        student_devices (device_fingerprint, ip_address, bound_at)
      `)
      .eq("role", "student")
      .order("full_name");

    if (error) { setLoading(false); return; }

    setStudents(
      (data ?? []).map((u: { id: string; full_name: string; national_id: string | null; student_devices: { device_fingerprint: string; ip_address: string; bound_at: string }[] }) => ({
        student_id:         u.id,
        full_name:          u.full_name,
        national_id:        u.national_id,
        device_fingerprint: u.student_devices?.[0]?.device_fingerprint ?? null,
        ip_address:         u.student_devices?.[0]?.ip_address ?? null,
        bound_at:           u.student_devices?.[0]?.bound_at ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleClear = async (studentId: string, name: string) => {
    setClearing(studentId);
    const { error } = await supabase.rpc("delete_student_device", { p_student_id: studentId });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم المسح", description: `تم إلغاء ربط جهاز ${name}. يمكنه الآن تسجيل دخول من جهاز جديد.` });
      void load();
    }
    setClearing(null);
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" />
          ربط أجهزة الطلاب
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s.student_id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.national_id ?? "—"}</p>
                  {s.device_fingerprint ? (
                    <p className="text-xs text-muted-foreground">
                      IP: {s.ip_address ?? "—"} &middot; ربط: {new Date(s.bound_at!).toLocaleDateString("ar-EG")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.device_fingerprint ? (
                    <>
                      <Badge variant="default" className="text-xs">مرتبط</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={clearing === s.student_id}
                        onClick={() => handleClear(s.student_id, s.full_name)}
                        title="إلغاء ربط الجهاز"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs">غير مرتبط</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
