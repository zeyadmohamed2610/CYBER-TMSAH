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
import {
  getLoginDestination,
  hasStoredSession,
  normalizeDigits,
  normalizeIdentifier,
} from "../utils/loginInput";
type Tab = "login" | "join";
export type JoinRole = "coordinator" | "doctor" | "ta" | "student";
export type JoinField =
  | "j-name"
  | "j-email"
  | "j-user"
  | "j-pass"
  | "j-confirm-pass"
  | "j-role"
  | "j-dept"
  | "j-departments"
  | "j-national-id"
  | "j-year"
  | "j-sec";

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
  const { user, role, loading, sessionExpired } = useAuth();
  const { t, lang, isRTL, interpolate } = useLang();
  const resolvedInitialTab: Tab = initialTab ?? (location.pathname === "/join" ? "join" : "login");
  const [tab, setTab] = useState<Tab>(resolvedInitialTab);
  const [lockRemaining, setLockRemaining] = useState(getLockoutRemaining);
  const passRef = useRef<HTMLInputElement>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const requestPending = useRef(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMeState] = useState(false);
  const setRememberMe = (checked: boolean) => {
    setRememberMeState(checked);
    if (!checked) {
      try {
        localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* Storage may be disabled. */
      }
    }
  };
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginErrorField, setLoginErrorField] = useState<"identifier" | "password" | null>(null);
  const reportLoginError = (message: string, field: "identifier" | "password" | null = null) => {
    setLoginError(message);
    setLoginErrorField(field);
    if (field === "identifier") identifierRef.current?.focus();
    if (field === "password") passRef.current?.focus();
  };
  const clearLoginError = () => {
    setLoginError(null);
    setLoginErrorField(null);
  };
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
  const [joinError, setJoinError] = useState<{ field: JoinField | null; message: string } | null>(
    null,
  );
  const clearJoinError = (field?: JoinField) => {
    setJoinError((previous) =>
      !field || previous?.field === field || previous?.field === null ? null : previous,
    );
  };
  const reportJoinError = (message: string, field: JoinField | null = null) => {
    setJoinError({ field, message });
  };
  useEffect(() => {
    if (!joinLoading && joinError?.field) document.getElementById(joinError.field)?.focus();
  }, [joinError, joinLoading]);
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
    if (requestPending.current) return;
    clearLoginError();
    setTab(newTab);
    if (newTab === "join") {
      navigate("/join", { replace: true, state: location.state });
    } else {
      navigate("/login", { replace: true, state: location.state });
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
    if (!loading && user && role)
      navigate(getLoginDestination(role, location.state?.from), { replace: true });
  }, [loading, navigate, role, user, location.state]);
  const hasSavedSession = hasStoredSession();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemaining > 0 || requestPending.current) return;
    requestPending.current = true;
    setLoginLoading(true);
    try {
      clearLoginError();
      const raw = normalizeIdentifier(username);
      if (!raw) {
        reportLoginError("أدخل اسم المستخدم أو البريد أو الرقم القومي.", "identifier");
        return;
      }
      if (/^\d+$/.test(raw) && raw.length !== 14) {
        reportLoginError("يجب أن يتكون الرقم القومي من 14 رقمًا.", "identifier");

        return;
      }
      if (!password) {
        reportLoginError("أدخل كلمة المرور.", "password");
        return;
      }
      if (!navigator.onLine) {
        reportLoginError("الاتصال بالإنترنت مقطوع. احتفظنا ببياناتك؛ اتصل ثم أعد المحاولة.");
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
        const status =
          response.error?.context instanceof Response ? response.error.context.status : undefined;
        if (
          response.error?.name === "FunctionsFetchError" ||
          response.error?.name === "FunctionsRelayError" ||
          authenticated?.error?.name === "AuthRetryableFetchError" ||
          (status && status >= 500)
        ) {
          reportLoginError("تعذر الاتصال بخدمة الدخول. احتفظنا ببياناتك؛ أعد المحاولة بعد قليل.");
          return;
        }
        if (status === 429) {
          reportLoginError("طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.");
          return;
        }
        recordAttempt(false);
        setLockRemaining(getLockoutRemaining());
        void recordAuditLog({
          action: "login_failed",
          identifier: raw,
          notes: "authentication_rejected",
        });
        reportLoginError("بيانات الدخول غير صحيحة. راجع الحساب وكلمة المرور.", "password");
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
              navigate(getLoginDestination(safeRole, location.state?.from), { replace: true });

              return;
            }
          }
        } catch {
          // fallback to /attendance
        }
      }
      navigate("/attendance", { replace: true });
    } catch {
      reportLoginError("تعذر الاتصال بخدمة الدخول. احتفظنا ببياناتك؛ أعد المحاولة.");
    } finally {
      setLoginLoading(false);
      requestPending.current = false;
    }
  };
  const handlePasskeyLogin = async () => {
    if (lockRemaining > 0 || requestPending.current) return;
    requestPending.current = true;
    setPasskeyLoading(true);
    clearLoginError();

    try {
      const result = await authenticateWithPasskey(normalizeIdentifier(username));

      if (result.cancelled) {
        setPasskeyLoading(false);
        return;
      }

      if (!result.success || !result.user) {
        reportLoginError(
          getFriendlyErrorMessage(
            result.error ||
              (lang === "ar"
                ? "تعذر التحقق من مفتاح الدخول. تأكد من إضافته إلى حسابك أولًا."
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
        lang === "ar" ? "تم التحقق من مفتاح الدخول بنجاح." : "Passkey verified successfully!",
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
          navigate(getLoginDestination(safeRole, location.state?.from), { replace: true });
          setPasskeyLoading(false);
          return;
        }
      }

      navigate("/attendance", { replace: true });
    } catch (err: unknown) {
      console.error("Passkey login unexpected error:", err);
      reportLoginError(
        lang === "ar"
          ? "تعذر التحقق من مفتاح الدخول. أعد المحاولة."
          : "Could not verify your fingerprint. Please try again.",
      );
    } finally {
      setPasskeyLoading(false);
      requestPending.current = false;
    }
  };
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setJoinLoading(true);
    clearJoinError();
    try {
      const trimmedName = fullName.trim();
      if (
        !/^[A-Za-z\s]+$/.test(trimmedName) ||
        trimmedName.split(/\s+/).filter(Boolean).length < 3
      ) {
        reportJoinError("اكتب اسمك ثلاثيًا بالإنجليزية، example: Ahmed Mohamed Ali.", "j-name");
        return;
      }
      const trimmedEmail = joinEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        reportJoinError("اكتب بريدًا إلكترونيًا صالحًا.", "j-email");
        return;
      }
      const trimmedUsername = joinUsername.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
        reportJoinError(
          "استخدم من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية (_) دون مسافات.",
          "j-user",
        );
        return;
      }
      const passwordError = newPasswordError(joinPassword);
      if (passwordError) {
        reportJoinError(passwordError, "j-pass");
        return;
      }
      if (joinPassword !== confirmPassword) {
        reportJoinError("تأكيد كلمة المرور لا يطابق كلمة المرور.", "j-confirm-pass");
        return;
      }
      if (!["coordinator", "doctor", "ta", "student"].includes(joinRole)) {
        reportJoinError("اختر الرتبة المطلوبة لاعتماد حسابك.", "j-role");
        return;
      }
      const isFaculty = joinRole === "doctor" || joinRole === "ta";
      if (isFaculty ? !joinDepartments.length : !department) {
        reportJoinError("اختر قسمًا واحدًا على الأقل.", isFaculty ? "j-departments" : "j-dept");
        return;
      }
      const trimmedNID = joinRole === "student" ? normalizeDigits(joinNationalId.trim()) : null;
      if (joinRole === "student") {
        if (!trimmedNID || !/^\d{14}$/.test(trimmedNID)) {
          reportJoinError("الرقم القومي للطالب يجب أن يتكون من 14 رقمًا.", "j-national-id");
          return;
        }
        if (!/^[1-4]$/.test(academicYear)) {
          reportJoinError("اختر الفرقة الدراسية من الأولى إلى الرابعة.", "j-year");
          return;
        }
        if (!/^(?:[1-9]|1[0-5])$/.test(normalizeDigits(sectionNumber))) {
          reportJoinError("اكتب رقم السكشن من 1 إلى 15.", "j-sec");
          return;
        }
      }
      const pwnedResult = await checkPwnedPassword(joinPassword);
      if (pwnedResult.isPwned) {
        reportJoinError("ظهرت كلمة المرور في تسريبات سابقة. اختر كلمة مرور أخرى.", "j-pass");
        return;
      }
      const { error } = await supabase.from("join_requests").insert({
        full_name: trimmedName,
        email: trimmedEmail,
        username: trimmedUsername,
        password: joinPassword,
        role: joinRole,
        department: isFaculty ? joinDepartments[0] : department,
        departments: isFaculty ? joinDepartments : [department],
        academic_year: joinRole === "student" ? academicYear : null,
        section_number: joinRole === "student" ? parseInt(normalizeDigits(sectionNumber)) : null,
        national_id: trimmedNID,
      });
      if (error) {
        reportJoinError(
          error.code === "23505"
            ? "يوجد حساب أو طلب سابق بهذه البيانات. راجع اسم المستخدم والبريد أو تواصل مع الإدارة."
            : "تعذر إرسال الطلب. احتفظنا ببياناتك؛ تحقق من الاتصال ثم أعد المحاولة.",
        );
        return;
      }
      void recordAuditLog({
        action: "join_request",
        identifier: `${trimmedUsername} | ${trimmedEmail}`,
        role: joinRole,
      });
      setJoinSuccess(true);
      setJoinPassword("");
      setConfirmPassword("");
      toast.success(t.auth.requestSent);
    } catch {
      reportJoinError("تعذر إرسال الطلب. احتفظنا ببياناتك؛ تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setJoinLoading(false);
      requestPending.current = false;
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
    identifierRef,
    loginErrorField,
    clearLoginError,
    authBusy: loginLoading || passkeyLoading || joinLoading,
    sessionExpired: sessionExpired || location.state?.sessionExpired === true,
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
    joinError,
    clearJoinError,
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
import { newPasswordError } from "@/shared/lib/passwordPolicy";
