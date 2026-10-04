import { authenticateWithPasskey } from "@/features/auth/passkeys";
import { recordAuditLog } from "@/features/auth/services/auditService";
import { playCyberSuccessChime } from "@/features/auth/utils/cyberAudio";
import { supabase } from "@/shared/api/supabaseClient";
import { useLang } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { checkPwnedPassword } from "@/shared/lib/pwnedPassword";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getDashboardRoute } from "../utils/dashboardRoutes";
type Tab = "login" | "join";
export type JoinRole = "doctor" | "ta" | "student";

const STORAGE_KEY = "attendance_login_attempts";
const REMEMBER_KEY = "cyber_remember_user";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getLockoutRemaining(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { count, firstAttempt } = JSON.parse(raw) as { count: number; firstAttempt: number };
    if (count >= MAX_ATTEMPTS) {
      const remaining = LOCKOUT_MS - (Date.now() - firstAttempt);
      return remaining > 0 ? remaining : 0;
    }
  } catch {
    /**/
  }
  return 0;
}

function recordAttempt(success: boolean): void {
  try {
    if (success) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw
      ? (JSON.parse(raw) as { count: number; firstAttempt: number })
      : { count: 0, firstAttempt: Date.now() };
    const expired = Date.now() - prev.firstAttempt > LOCKOUT_MS;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        expired ? { count: 1, firstAttempt: Date.now() } : { ...prev, count: prev.count + 1 },
      ),
    );
  } catch {
    /**/
  }
}

export function useLoginForm(initialTab?: Tab) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, loading } = useAuth();
  const { t, lang, isRTL, interpolate } = useLang();
  const resolvedInitialTab: Tab = initialTab ?? (location.pathname === "/join" ? "join" : "login");
  const [tab, setTab] = useState<Tab>(resolvedInitialTab);
  const [lockRemaining, setLockRemaining] = useState(getLockoutRemaining);
  const passRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [joinRole, setJoinRole] = useState<JoinRole>("student");
  const [fullName, setFullName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showJoinPass, setShowJoinPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [department, setDepartment] = useState<string>("cybersecurity");
  const [joinDepartments, setJoinDepartments] = useState<string[]>(["cybersecurity"]);
  const [academicYear, setAcademicYear] = useState<string>("1");
  const [sectionNumber, setSectionNumber] = useState("");
  const [joinNationalId, setJoinNationalId] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      /**/
    }
  }, []);
  useEffect(() => {
    if (lockRemaining <= 0) return;
    const id = setInterval(() => {
      const r = getLockoutRemaining();
      setLockRemaining(r);
      if (!r) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockRemaining]);
  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === "join") {
      navigate("/join", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };
  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    } else if (location.pathname === "/join") {
      setTab("join");
    } else if (location.pathname === "/login") {
      setTab("login");
    }
  }, [initialTab, location.pathname]);
  useEffect(() => {
    if (!loading && user && role) navigate(getDashboardRoute(role), { replace: true });
  }, [loading, navigate, role, user]);
  const hasSavedSession =
    typeof window !== "undefined" &&
    Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemaining > 0) return;
    setLoginLoading(true);
    try {
      setLoginError(null);
      const raw = username.trim().replace(/^@+/, "");
      if (/^\d+$/.test(raw) && raw.length !== 14) {
        setLoginError(
          lang === "ar"
            ? "يجب أن يتكون الرقم القومي من 14 رقماً (National ID must be 14 digits)"
            : "National ID must be 14 digits",
        );

        return;
      }
      const response = await supabase.functions.invoke("account-login", {
        body: { identifier: raw, password },
      });
      const session = response.data?.session;
      const authenticated =
        !response.error && session?.access_token && session?.refresh_token
          ? await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            })
          : null;
      const authData = authenticated?.data;
      const error =
        response.error ||
        authenticated?.error ||
        (!authData?.user ? new Error("Invalid credentials") : null);
      if (error) {
        recordAttempt(false);
        setLockRemaining(getLockoutRemaining());
        await recordAuditLog({
          action: "login_failed",
          identifier: raw,
          notes: "authentication_rejected",
        });
        setLoginError(
          lang === "ar"
            ? "بيانات الدخول غير صحيحة أو تعذر الدخول الآن. أعد المحاولة."
            : "Invalid sign-in details or sign-in unavailable. Try again.",
        );
        return;
      }
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, raw);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /**/
      }
      playCyberSuccessChime();
      void recordAuditLog({ action: "login_success", identifier: raw });
      recordAttempt(true);
      await supabase.auth.getSession();
      if (authData?.user) {
        try {
          const { data: profile } = await supabase
            .from("users")
            .select("role")
            .eq("auth_id", authData.user.id)
            .maybeSingle();

          if (profile?.role) {
            const validRoles = ["owner", "coordinator", "doctor", "student", "ta"] as const;
            type ValidRole = (typeof validRoles)[number];
            const safeRole = validRoles.includes(profile.role as ValidRole)
              ? (profile.role as ValidRole)
              : null;
            if (safeRole) {
              navigate(getDashboardRoute(safeRole), { replace: true });

              return;
            }
          }
        } catch {
          // fallback to /attendance
        }
      }
      navigate("/attendance", { replace: true });
    } catch {
      setLoginError(
        lang === "ar"
          ? "تعذر إكمال تسجيل الدخول. أعد المحاولة."
          : "Could not sign in. Please try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };
  const handlePasskeyLogin = async () => {
    if (lockRemaining > 0) return;
    setPasskeyLoading(true);
    setLoginError(null);

    try {
      const result = await authenticateWithPasskey(username.trim());

      if (result.cancelled) {
        setPasskeyLoading(false);
        return;
      }

      if (!result.success || !result.user) {
        setLoginError(
          getFriendlyErrorMessage(
            result.error ||
              (lang === "ar"
                ? "تعذر التحقق من البصمة. تأكد من تفعيل البصمة في حسابك أولاً."
                : "Could not verify your fingerprint. Add your device in your profile first."),
            lang === "ar"
              ? "تعذر إكمال الطلب. أعد المحاولة."
              : "Could not complete your request. Please try again.",
          ),
        );
        setPasskeyLoading(false);
        return;
      }

      playCyberSuccessChime();
      toast.success(
        lang === "ar" ? "✅ تم التحقق من البصمة بنجاح!" : "✅ Fingerprint verified successfully!",
      );
      recordAttempt(true);

      // Ensure JWT session is refreshed in Supabase client
      await supabase.auth.getSession();

      if (result.role) {
        const validRoles = ["owner", "coordinator", "doctor", "student", "ta"] as const;
        type ValidRole = (typeof validRoles)[number];
        const safeRole = validRoles.includes(result.role as ValidRole)
          ? (result.role as ValidRole)
          : null;
        if (safeRole) {
          navigate(getDashboardRoute(safeRole), { replace: true });
          setPasskeyLoading(false);
          return;
        }
      }

      navigate("/attendance", { replace: true });
    } catch (err: unknown) {
      console.error("Passkey login unexpected error:", err);
      setLoginError(
        lang === "ar"
          ? "حدث خطأ غير متوقع أثناء فحص البصمة."
          : "Could not verify your fingerprint. Please try again.",
      );
    } finally {
      setPasskeyLoading(false);
    }
  };
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinLoading(true);
    try {
      const trimmedName = fullName.trim();
      const nameParts = trimmedName.split(/\s+/).filter(Boolean);
      const isEnglishOnly = /^[A-Za-z\s]+$/.test(trimmedName);
      if (!isEnglishOnly || nameParts.length < 3) {
        toast.error(
          lang === "ar"
            ? "يجب كتابة الاسم ثلاثي باللغة الإنجليزية (مثال: Ahmed Mohamed Ali)"
            : "Full name must be at least 3 parts in English (e.g. John David Smith)",
        );

        return;
      }
      const trimmedEmail = joinEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        toast.error(
          lang === "ar" ? "يرجى كتابة بريد إلكتروني صالح" : "Please enter a valid email address",
        );

        return;
      }
      const trimmedUsername = joinUsername.trim().toLowerCase();
      const userRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!userRegex.test(trimmedUsername)) {
        toast.error(
          lang === "ar"
            ? "اسم المستخدم يجب أن يتكون من 3-30 حرفاً إنجليزياً أو رقماً بدون مسافات"
            : "Username must be 3-30 English alphanumeric characters with no spaces",
        );

        return;
      }
      if (!joinPassword || joinPassword.length < 6) {
        toast.error(
          lang === "ar"
            ? "كلمة المرور يجب ألا تقل عن 6 أحرف"
            : "Password must be at least 6 characters",
        );

        return;
      }
      if (joinPassword !== confirmPassword) {
        toast.error(lang === "ar" ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");

        return;
      }
      const pwnedResult = await checkPwnedPassword(joinPassword);
      if (pwnedResult.isPwned) {
        toast.error(
          lang === "ar"
            ? `كلمة المرور هذه غير آمنة (تم تسريبها ${pwnedResult.count.toLocaleString()} مرة في اختراقات سابقة). يرجى اختيار كلمة مرور أكثر أماناً.`
            : `This password is compromised (found ${pwnedResult.count.toLocaleString()} times in previous breaches). Please choose a safer password.`,
        );

        return;
      }
      if (
        !department ||
        ((joinRole === "doctor" || joinRole === "ta") && !joinDepartments.length)
      ) {
        toast.error(lang === "ar" ? "يرجى اختيار القسم" : "Please select your department");

        return;
      }
      let trimmedNID: string | null = null;
      if (joinRole === "student") {
        trimmedNID = joinNationalId.trim();
        if (!trimmedNID || !/^\d{14}$/.test(trimmedNID)) {
          toast.error(
            lang === "ar"
              ? "الرقم القومي إلزامي للطالب ويجب أن يتكون من 14 رقماً بالضبط"
              : "National ID is required for students and must be exactly 14 digits",
          );

          return;
        }

        if (!academicYear || !/^(?:[1-9]|1[0-5])$/.test(sectionNumber)) {
          toast.error(
            lang === "ar"
              ? "اختر الفرقة الدراسية ورقم السكشن من 1 إلى 15."
              : "Choose an academic year and section 1–15.",
          );

          return;
        }
      }
      const { error } = await supabase.from("join_requests").insert({
        full_name: trimmedName,
        email: trimmedEmail,
        username: trimmedUsername,
        password: joinPassword,
        role: joinRole,
        department: joinRole === "doctor" || joinRole === "ta" ? joinDepartments[0] : department,
        departments: joinRole === "doctor" || joinRole === "ta" ? joinDepartments : [department],
        academic_year: joinRole === "student" ? academicYear : null,
        section_number: joinRole === "student" && sectionNumber ? parseInt(sectionNumber) : null,
        national_id: joinRole === "student" ? trimmedNID : null,
      });
      if (error) {
        toast.error(
          getFriendlyErrorMessage(
            lang === "ar" ? `فشل إرسال الطلب: ${error.message}` : "Failed to submit request.",
            lang === "ar"
              ? "تعذر إكمال الطلب. أعد المحاولة."
              : "Could not complete your request. Please try again.",
          ),
        );

        return;
      }
      await recordAuditLog({
        action: "join_request",
        identifier: `${trimmedUsername} | ${trimmedEmail}`,
        role: joinRole,
      });
      setJoinSuccess(true);
      toast.success(t.auth.requestSent);
    } catch {
      toast.error(
        lang === "ar"
          ? "تعذر إرسال الطلب. أعد المحاولة."
          : "Could not submit your request. Please try again.",
      );
    } finally {
      setJoinLoading(false);
    }
  };
  const lockMins = Math.ceil(lockRemaining / 60_000);
  const isStudent = joinRole === "student";
  return {
    user,
    role,
    loading,
    t,
    lang,
    isRTL,
    interpolate,
    tab,
    lockRemaining,
    passRef,
    username,
    setUsername,
    password,
    setPassword,
    showPass,
    setShowPass,
    rememberMe,
    setRememberMe,
    showForgotModal,
    setShowForgotModal,
    loginError,
    loginLoading,
    passkeyLoading,
    isCapsLockOn,
    setIsCapsLockOn,
    joinRole,
    setJoinRole,
    fullName,
    setFullName,
    joinEmail,
    setJoinEmail,
    joinUsername,
    setJoinUsername,
    joinPassword,
    setJoinPassword,
    confirmPassword,
    setConfirmPassword,
    showJoinPass,
    setShowJoinPass,
    showConfirmPass,
    setShowConfirmPass,
    department,
    setDepartment,
    joinDepartments,
    setJoinDepartments,
    academicYear,
    setAcademicYear,
    sectionNumber,
    setSectionNumber,
    joinNationalId,
    setJoinNationalId,
    joinLoading,
    joinSuccess,
    setJoinSuccess,
    handleTabChange,
    hasSavedSession,
    handleLogin,
    handlePasskeyLogin,
    handleJoin,
    lockMins,
    isStudent,
  };
}
