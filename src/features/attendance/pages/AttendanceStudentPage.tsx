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
        <section className="section-container py-12 sm:py-20">
          <div className="max-w-md mx-auto text-center space-y-4 glass-panel p-6 sm:p-8 rounded-3xl">
            <ShieldOff className="h-16 w-16 mx-auto text-destructive animate-pulse" />
            <h2 className="text-2xl font-bold text-foreground">جهازك مغلق</h2>
            <p className="text-muted-foreground leading-relaxed">حسابك مربوط بجهاز آخر. يمكنك فقط تسجيل الحضور من الجهاز المربوط لحماية هويتك.</p>
            <p className="text-sm font-semibold text-destructive/80">لو غيرت هاتفك، تواصل مع الدعم لإلغاء القفل.</p>
            <Button variant="outline" className="w-full mt-4 h-12 rounded-xl" onClick={signOut}>تسجيل الخروج</Button>
          </div>
        </section>
      </Layout>
    );
  }

  if (!deviceLocked) {
    return (
      <Layout>
        <section className="section-container py-12 sm:py-20">
          <div className="max-w-md mx-auto text-center space-y-6 glass-panel p-6 sm:p-8 rounded-3xl">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto cyber-glow">
              <Lock className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">الخطوة الأخيرة: قفل الجهاز</h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              لضمان أعلى درجات الأمان، يجب ربط حسابك بهذا الجهاز. 
              لن يُسمح بتسجيل الحضور من أي جهاز آخر منعاً للتلاعب.
            </p>
            <div className="bg-background/50 rounded-2xl border border-primary/20 p-5 text-sm text-muted-foreground text-right shadow-inner">
              <p className="font-bold text-primary mb-3">⚠️ إرشادات هامة:</p>
              <ul className="space-y-2 list-disc list-inside marker:text-primary">
                <li>بعد القفل، يُسمح بالحضور من هذا الجهاز فقط.</li>
                <li>تتم العملية لمرة واحدة فقط طوال الفصل الدراسي.</li>
                <li>عند فقدان أو تغيير الجهاز، يرجى مراجعة إدارة الكلية.</li>
              </ul>
            </div>
            <Button onClick={handleLockDevice} disabled={locking} className="w-full gap-2 h-14 rounded-xl text-lg btn-cyber" size="lg">
              <Smartphone className="h-6 w-6" />
              {locking ? "جاري التشفير والقفل..." : "قفل هذا الجهاز والمتابعة"}
            </Button>
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground/70 hover:text-white">تسجيل الخروج</Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <GpsProvider>
      <Layout>
        <section className="section-container py-6 sm:py-10 md:py-14 animate-fade-up">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold tracking-wide text-primary shadow-[0_0_10px_rgba(0,0,0,0.1)] shadow-primary/20 backdrop-blur-sm">بوابة الطالب الخاصة</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground md:text-4xl tracking-tight">مركز الحضور السيبراني</h1>
            </div>
            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0">
              <NotificationCenter />
              <Button variant="destructive" size="sm" onClick={signOut} className="h-10 px-4 rounded-xl shadow-md transition-all hover:scale-105 shrink-0 gap-2 font-medium">
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
