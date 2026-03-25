import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Hash, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";

/** Maps national ID → internal auth email. Hidden from the user. */
const toAuthEmail = (nationalId: string) =>
  `${nationalId.trim()}@nid.local`;

const AttendanceLoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();

  const [identifier, setIdentifier] = useState(""); // national_id or email
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && role) navigate("/attendance", { replace: true });
  }, [loading, navigate, role, user]);

  if (!loading && user && role) return <Navigate to="/attendance" replace />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const raw = identifier.trim();
    // Students: 14-digit national ID → convert to internal email
    // Doctors / owner: real email address
    const isNationalId = /^\d{14}$/.test(raw);
    const authEmail = isNationalId ? toAuthEmail(raw) : raw;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError) {
      setError("تعذر تسجيل الدخول. تأكد من الرقم القومي / البريد وكلمة المرور ثم حاول مجدداً.");
      setIsSubmitting(false);
      return;
    }

    navigate("/attendance", { replace: true });
    setIsSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8" dir="rtl">
      <Card className="w-full max-w-md border-primary/30 bg-card/90 shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Hash className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">نظام الحضور الجامعي</CardTitle>
          <CardDescription>
            الطلاب: أدخل رقمك القومي المكون من 14 رقماً<br />
            الدكاترة / الإدارة: أدخل البريد الإلكتروني
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <LogIn className="h-4 w-4" />}
              <span>تسجيل الدخول</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default AttendanceLoginPage;
