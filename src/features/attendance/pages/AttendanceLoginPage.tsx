import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Hash, Loader2, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";

/** Maps national ID → internal auth email. Hidden from the user. */
const toAuthEmail = (nationalId: string) =>
  `${nationalId.trim()}@nid.local`;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000;
const STORAGE_KEY = "cyber_login_attempts";

function getLockoutRemaining(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { count, firstAttempt } = JSON.parse(raw) as { count: number; firstAttempt: number };
    if (count < MAX_ATTEMPTS) return 0;
    const remaining = LOCKOUT_MS - (Date.now() - firstAttempt);
    return remaining > 0 ? remaining : 0;
  } catch { return 0; }
}

function recordAttempt(success: boolean): void {
  if (success) { localStorage.removeItem(STORAGE_KEY); return; }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw ? JSON.parse(raw) as { count: number; firstAttempt: number } : { count: 0, firstAttempt: Date.now() };
    const nowExpired = Date.now() - prev.firstAttempt > LOCKOUT_MS;
    const entry = nowExpired ? { count: 1, firstAttempt: Date.now() } : { count: prev.count + 1, firstAttempt: prev.firstAttempt };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch { /* ignore */ }
}

const AttendanceLoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(() => getLockoutRemaining());

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      const remaining = getLockoutRemaining();
      setLockRemaining(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  useEffect(() => {
    if (!loading && user && role) {
      navigate(getAttendanceDashboardRoute(role), { replace: true });
    }
  }, [loading, navigate, role, user]);

  if (!loading && user && role) {
    return <Navigate to={getAttendanceDashboardRoute(role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const lockMs = getLockoutRemaining();
    if (lockMs > 0) {
      setLockRemaining(lockMs);
      return;
    }

    setIsSubmitting(true);

    const raw = identifier.trim();
    const isNationalId = /^\d{14}$/.test(raw);
    const authEmail = isNationalId ? toAuthEmail(raw) : raw;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError) {
      recordAttempt(false);
      setLockRemaining(getLockoutRemaining());
      setError("تعذر تسجيل الدخول. تأكد من الرقم القومي / البريد وكلمة المرور ثم حاول مجدداً.");
      setIsSubmitting(false);
      return;
    }

    recordAttempt(true);
    navigate("/attendance", { replace: true });
    setIsSubmitting(false);
  };

  const lockMinutes = Math.ceil(lockRemaining / 60_000);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--gradient-hero)] px-4 py-8 relative overflow-hidden" dir="rtl">
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <Card className="w-full max-w-md border-0 glass-panel shadow-2xl relative z-10 p-2 sm:p-4 animate-fade-up">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 cyber-glow">
            <Hash className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">نظام الحضور السيبراني</CardTitle>
          <CardDescription>
            الطلاب: أدخل رقمك القومي المكون من 14 رقماً<br />
            الدكاترة / الإدارة: أدخل البريد الإلكتروني
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lockRemaining > 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-center">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                تم تجاوز الحد المسموح من المحاولات
              </p>
              <p className="text-xs text-muted-foreground">
                حاول مجدداً بعد {lockMinutes} {lockMinutes === 1 ? "دقيقة" : "دقائق"}
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="attendance-id">الرقم القومي أو البريد الإلكتروني</Label>
                <Input
                  id="attendance-id"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="أدخل الرقم القومي أو البريد الإلكتروني"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-password">كلمة المرور</Label>
                <Input
                  id="attendance-password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button className="w-full h-12 text-lg font-medium rounded-xl btn-cyber shadow-lg" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <LogIn className="h-5 w-5" />}
                <span>تسجيل الدخول للنظام</span>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AttendanceLoginPage;
