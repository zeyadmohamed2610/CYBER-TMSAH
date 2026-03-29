import { useEffect, useState } from "react";
import { LogOut, ShieldOff, Smartphone, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Layout from "@/components/Layout";
import { StudentDashboard } from "./StudentDashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { GpsProvider } from "../context/GpsContext";
import { NotificationCenter } from "../components/NotificationCenter";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

async function computeFingerprint(): Promise<string> {
  try {
    const raw = [navigator.userAgent, navigator.language, navigator.platform, String(screen.width), String(screen.height), String(navigator.hardwareConcurrency ?? 0), Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.vendor].join("|");
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return "no-fp"; }
}

const AttendanceStudentPage = () => {
  const { signOut, user } = useAttendanceAuth();
  const [checking, setChecking] = useState(true);
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [wrongDevice, setWrongDevice] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }

    const check = async () => {
      const { data: lock } = await supabase.from("device_locks").select("device_fingerprint").eq("student_auth_id", user.id).maybeSingle();

      if (lock) {
        const currentFp = await computeFingerprint();
        if (currentFp !== lock.device_fingerprint) {
          setWrongDevice(true);
          setChecking(false);
          return;
        }
        setDeviceLocked(true);
      }

      setChecking(false);
    };

    check();
  }, [user]);

  const handleLockDevice = async () => {
    if (!user) return;
    setLocking(true);
    try {
      const fp = await computeFingerprint();
      const ua = navigator.userAgent;
      const label = ua.includes("Mobile") ? "هاتف محمول" : "جهاز محمول";
      const { error } = await supabase.from("device_locks").upsert({
        student_auth_id: user.id,
        device_fingerprint: fp,
        device_label: label + " - " + new Date().toLocaleDateString("ar-EG"),
      });
      if (error) throw error;
      setDeviceLocked(true);
      toast.success("تم قفل جهازك بنجاح");
    } catch { toast.error("فشل قفل الجهاز"); }
    setLocking(false);
  };

  if (checking) return null;

  if (wrongDevice) {
    return (
      <Layout>
        <section className="section-container py-20">
          <div className="max-w-md mx-auto text-center space-y-4">
            <ShieldOff className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-bold text-foreground">جهازك مغلق</h2>
            <p className="text-muted-foreground">حسابك مربوط بجهاز آخر. يمكنك فقط تسجيل الحضور من الجهاز المربوط.</p>
            <p className="text-sm text-muted-foreground">لو غيرت هاتفك، تواصل مع رئيس المنصة لإلغاء القفل.</p>
            <Button variant="outline" onClick={signOut}>تسجيل الخروج</Button>
          </div>
        </section>
      </Layout>
    );
  }

  if (!deviceLocked) {
    return (
      <Layout>
        <section className="section-container py-20">
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">قفل جهازك مطلوب</h2>
            <p className="text-muted-foreground">
              يجب قفل حسابك على هذا الجهاز قبل استخدام نظام الحضور.
              هذا يحمي حسابك من الاستخدام على أجهزة أخرى.
            </p>
            <div className="bg-card rounded-xl border p-4 text-sm text-muted-foreground text-right">
              <p className="font-bold text-foreground mb-2">ملاحظات مهمة:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>بعد القفل، يمكنك فقط تسجيل الحضور من هذا الجهاز</li>
                <li>لو غيرت هاتفك، تواصل مع رئيس المنصة</li>
                <li>القفل يعمل مرة واحدة فقط</li>
              </ul>
            </div>
            <Button onClick={handleLockDevice} disabled={locking} className="gap-2" size="lg">
              <Smartphone className="h-5 w-5" />
              {locking ? "جاري القفل..." : "قفل هذا الجهاز"}
            </Button>
            <div>
              <Button variant="ghost" size="sm" onClick={signOut}>تسجيل الخروج</Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <GpsProvider>
      <Layout>
        <section className="section-container py-10 md:py-14">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">بوابة الطالب</p>
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">مركز الحضور — الطالب</h1>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <NotificationCenter />
              <Button variant="outline" size="sm" onClick={signOut} className="shrink-0 gap-1.5">
                <LogOut className="h-4 w-4" /><span>تسجيل الخروج</span>
              </Button>
            </div>
          </div>
          <StudentDashboard />
        </section>
      </Layout>
    </GpsProvider>
  );
};

export default AttendanceStudentPage;
