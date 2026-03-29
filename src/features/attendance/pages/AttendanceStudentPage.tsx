import { useEffect, useState } from "react";
import { LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Layout from "@/components/Layout";
import { useIsDesktopDevice } from "../hooks/useIsDesktopDevice";
import { StudentDashboard } from "./StudentDashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { GpsProvider } from "../context/GpsContext";
import { NotificationCenter } from "../components/NotificationCenter";
import { supabase } from "@/lib/supabaseClient";

const DESKTOP_ALLOWED_KEY = "cyber_desktop_allowed";

function isDesktopAllowed(authId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(DESKTOP_ALLOWED_KEY) || "[]") as string[]).includes(authId); }
  catch { return false; }
}

async function computeFingerprint(): Promise<string> {
  try {
    const raw = [navigator.userAgent, navigator.language, navigator.platform, String(screen.width), String(screen.height), String(navigator.hardwareConcurrency ?? 0), Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.vendor].join("|");
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return "no-fp"; }
}

const AttendanceStudentPage = () => {
  const isDesktop = useIsDesktopDevice();
  const { signOut, user } = useAttendanceAuth();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");

  useEffect(() => {
    if (!user) { setChecking(false); return; }

    const check = async () => {
      // Check device lock
      const { data: lock } = await supabase.from("device_locks").select("device_fingerprint").eq("student_auth_id", user.id).maybeSingle();

      if (lock) {
        // Device is locked - verify fingerprint
        const currentFp = await computeFingerprint();
        if (currentFp !== lock.device_fingerprint) {
          setBlocked(true);
          setBlockedReason("جهازك مغلق. يمكنك فقط تسجيل الحضور من الجهاز المربوط.");
          setChecking(false);
          return;
        }
      }

      // Check desktop restriction
      if (isDesktop && !isDesktopAllowed(user.id)) {
        // Desktop not allowed
      }

      setChecking(false);
    };

    check();
  }, [user, isDesktop]);

  if (checking) return null;

  if (blocked) {
    return (
      <Layout>
        <section className="section-container py-20">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <ShieldOff className="h-5 w-5" />
            <AlertTitle>تم قفل حسابك على جهاز آخر</AlertTitle>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
          <div className="text-center mt-6">
            <Button variant="outline" onClick={signOut}>تسجيل الخروج</Button>
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
