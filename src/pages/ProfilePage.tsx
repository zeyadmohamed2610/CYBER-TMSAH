import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  KeyRound,
  Shield,
  Building2,
  GraduationCap,
  Mail,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Calendar,
  Sparkles,
  Lock,
  Fingerprint,
  Trash2,
  Key,
  Camera,
  Copy,
  Check,
  LogOut,
  ShieldAlert,
  Smartphone,
  Laptop,
  IdCard,
  Database,
  Cpu,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "@/features/attendance/context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";
import { DEPARTMENTS, ACADEMIC_YEARS } from "@/features/attendance/types";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { checkPwnedPassword } from "@/lib/pwnedPassword";
import Footer from "@/components/Footer";
import AvatarStudioDialog from "@/components/AvatarStudioDialog";
import { saveUserAvatar, deleteUserAvatar } from "@/lib/avatarUtils";
import { registerPasskey, isWebAuthnSupported, clearAllLocalPasskeys } from "@/lib/webauthn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface UserProfileDetails {
  id: string;
  auth_id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  role: string;
  department: string | null;
  academic_year: string | null;
  section_number: number | null;
  subject_name?: string | null;
  created_at: string | null;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, role, fullName, refreshRole, avatarUrl, updateAvatarUrl, signOut } = useAttendanceAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);

  // Active Tab
  const [activeMainTab, setActiveMainTab] = useState<string>("overview");

  // Avatar Studio Dialog
  const [isAvatarStudioOpen, setIsAvatarStudioOpen] = useState(false);

  // Edit Name State
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Passkey (WebAuthn) State
  const [passkeys, setPasskeys] = useState<{ id: string; rawId: string; label: string; createdAt: string }[]>([]);
  const [creatingPasskey, setCreatingPasskey] = useState(false);
  const [testingPasskeyId, setTestingPasskeyId] = useState<string | null>(null);

  // Passkey Re-authentication State (Security enhancement)
  const [isPasskeyAuthModalOpen, setIsPasskeyAuthModalOpen] = useState(false);
  const [passkeyAuthPassword, setPasskeyAuthPassword] = useState("");
  const [showPasskeyAuthPassword, setShowPasskeyAuthPassword] = useState(false);
  const [verifyingPasskeyPassword, setVerifyingPasskeyPassword] = useState(false);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`تم نسخ ${fieldName} بنجاح`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDisplayUsername = (raw?: string | null, fallbackEmail?: string | null): string => {
    if (!raw && !fallbackEmail) return "—";
    let name = (raw || fallbackEmail || "").trim();
    if (name.includes("@")) {
      name = name.split("@")[0];
    }
    return `@${name.replace(/^@+/, "")}`;
  };

  // Load passkeys from database & local storage
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    async function loadUserPasskeys() {
      try {
        const { data, error } = await supabase
          .from("webauthn_credentials")
          .select("id, credential_id, device_name, created_at")
          .eq("auth_id", user?.id);

        if (!error && data && data.length > 0 && isMounted) {
          const mapped = data.map((item) => ({
            id: item.credential_id,
            rawId: item.credential_id,
            label: item.device_name || "مفتاح أمان بيومتري",
            createdAt: item.created_at || new Date().toISOString(),
          }));
          setPasskeys(mapped);
          localStorage.setItem(`cyber_passkeys_${user?.id}`, JSON.stringify(mapped));
          return;
        }
      } catch (err) {
        console.warn("Failed to load passkeys from database:", err);
      }

      try {
        const stored = localStorage.getItem(`cyber_passkeys_${user?.id}`);
        if (stored && isMounted) {
          setPasskeys(JSON.parse(stored));
        } else if (user?.user_metadata?.passkeys && isMounted) {
          setPasskeys(user.user_metadata.passkeys);
        }
      } catch (e) {
        console.error("Failed to load passkeys:", e);
      }
    }

    loadUserPasskeys();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const savePasskeys = (items: { id: string; rawId: string; label: string; createdAt: string }[]) => {
    if (!user?.id) return;
    setPasskeys(items);
    try {
      localStorage.setItem(`cyber_passkeys_${user.id}`, JSON.stringify(items));
      supabase.auth.updateUser({
        data: { passkeys: items },
      }).catch(console.error);
    } catch (e) {
      console.error("Failed to persist passkeys:", e);
    }
  };

  const handleInitiatePasskeyCreation = () => {
    if (!isWebAuthnSupported()) {
      toast.error("متصفحك أو جهازك الحالي لا يدعم تقنية مفاتيح المرور (WebAuthn).");
      return;
    }

    // Enforce 2-passkeys limit per user
    if (passkeys.length >= 2) {
      toast.error("لقد وصلت للحد الأقصى المسموح به لمفاتيح المرور (جهازين فقط). يرجى حذف أحد الأجهزة القديمة لإضافة جهاز جديد.");
      return;
    }

    // Open security re-authentication modal
    setPasskeyAuthPassword("");
    setShowPasskeyAuthPassword(false);
    setIsPasskeyAuthModalOpen(true);
  };

  const handleVerifyPasswordAndCreatePasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passkeyAuthPassword.trim()) {
      toast.error("يرجى إدخال كلمة مرور حسابك للمتابعة.");
      return;
    }

    if (!user?.email) {
      toast.error("تعذر التعرف على البريد الإلكتروني للحساب.");
      return;
    }

    try {
      setVerifyingPasskeyPassword(true);
      // Re-authenticate user credentials with Supabase
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passkeyAuthPassword,
      });

      if (signInErr) {
        toast.error("كلمة المرور غير صحيحة. تم رفض طلب إضافة البصمة لأسباب أمنية.");
        return;
      }

      // Password verified! Close dialog and trigger WebAuthn ceremony
      setIsPasskeyAuthModalOpen(false);
      setPasskeyAuthPassword("");
      await executePasskeyCreation();
    } catch (err: unknown) {
      console.error("Passkey re-auth verification failed:", err);
      toast.error("حدث خطأ أثناء التحقق من كلمة المرور.");
    } finally {
      setVerifyingPasskeyPassword(false);
    }
  };

  const executePasskeyCreation = async () => {
    if (passkeys.length >= 2) {
      toast.error("لقد وصلت للحد الأقصى المسموح به لمفاتيح المرور (جهازين فقط).");
      return;
    }

    try {
      setCreatingPasskey(true);

      const ua = navigator.userAgent;
      const deviceLabel = /iPhone/i.test(ua)
        ? "هاتف iPhone (Face ID / Touch ID)"
        : /iPad/i.test(ua)
        ? "جهاز iPad"
        : /Samsung/i.test(ua)
        ? "هاتف Samsung Galaxy"
        : /Xiaomi|Redmi|POCO/i.test(ua)
        ? "هاتف Xiaomi / Redmi"
        : /Android/i.test(ua)
        ? "هاتف أندرويد (بصمة)"
        : /Windows/i.test(ua)
        ? "جهاز كمبيوتر (Windows Hello)"
        : /Mac/i.test(ua)
        ? "جهاز Mac (Touch ID)"
        : "مفتاح أمان بيومتري";

      const formattedLabel = `${deviceLabel} - ${new Date().toLocaleDateString("ar-EG")}`;
      const result = await registerPasskey(formattedLabel);

      if (result.cancelled) {
        toast.info("تم إلغاء عملية إضافة مفتاح المرور.");
        return;
      }

      if (!result.success || !result.credentialId) {
        toast.error(result.error || "فشل تسجيل مفتاح المرور. تأكد من تفعيل البصمة أو PIN على جهازك.");
        return;
      }

      // Refresh passkeys list from database (server-verified credentials)
      if (user?.id) {
        const { data: dbData } = await supabase
          .from("webauthn_credentials")
          .select("id, credential_id, device_name, created_at")
          .eq("auth_id", user.id);

        if (dbData && dbData.length > 0) {
          const mapped = dbData.map((item) => ({
            id: item.credential_id,
            rawId: item.credential_id,
            label: item.device_name || deviceLabel,
            createdAt: item.created_at || new Date().toISOString(),
          }));
          savePasskeys(mapped);
        } else {
          const newKey = {
            id: result.credentialId,
            rawId: result.credentialId,
            label: formattedLabel,
            createdAt: new Date().toISOString(),
          };
          savePasskeys([...passkeys, newKey]);
        }
      }

      toast.success("✅ تم توثيق وتسجيل مفتاح المرور البيومتري بنجاح!");
    } catch (err: unknown) {
      console.error("Passkey creation unexpected error:", err);
      toast.error("خطأ غير متوقع. الرجاء المحاولة مرة أخرى.");
    } finally {
      setCreatingPasskey(false);
    }
  };



  const handleTestPasskey = async (passkeyId: string) => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("المتصفح لا يدعم WebAuthn.");
      return;
    }

    try {
      setTestingPasskeyId(passkeyId);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const domain = window.location.hostname;

      const ua = navigator.userAgent;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      const isChromium = /Chrome|Chromium|CriOS/i.test(ua) && !/Firefox|OPR|Opera/i.test(ua);

      const reqOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: domain === "localhost" ? "localhost" : domain,
        userVerification: "preferred",
        timeout: 60000,
      };

      if (!isMobile && isChromium) {
        (reqOptions as Record<string, unknown>)["hints"] = ["client-device"];
      }

      const assertion = await navigator.credentials.get({
        publicKey: reqOptions,
      });

      if (assertion) {
        toast.success("تم التحقق بنجاح! يعمل مفتاح المرور البيومتري بكفاءة تامة.");
      }
    } catch (err: unknown) {
      console.error("Passkey test error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.info("تم إلغاء عملية التحقق.");
      } else {
        toast.error("فشل التحقق من مفتاح المرور.");
      }
    } finally {
      setTestingPasskeyId(null);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    const updated = passkeys.filter((p) => p.id !== passkeyId);
    savePasskeys(updated);
    if (user?.id) {
      try {
        await supabase.from("webauthn_credentials").delete().eq("credential_id", passkeyId);
        localStorage.removeItem(`cyber_device_passkey_${passkeyId}`);
        if (localStorage.getItem("cyber_latest_passkey") === passkeyId) {
          localStorage.removeItem("cyber_latest_passkey");
        }
      } catch (err) {
        console.warn("Failed to delete passkey from db:", err);
      }
    }
    toast.success("تم حذف مفتاح المرور.");
  };

  // Fetch full user profile
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch from users table
        const { data: rawData, error: rawError } = await supabase
          .from("users")
          .select(`
            id,
            auth_id,
            full_name,
            username,
            email,
            role,
            department,
            academic_year,
            section_number,
            subject_id,
            created_at
          `)
          .eq("auth_id", user.id)
          .maybeSingle();

        type UserProfile = {
          id: string; auth_id: string; full_name: string | null; username: string | null;
          email: string | null; role: string | null; department: string | null;
          academic_year: string | null; section_number: number | null;
          subject_id: string | null; created_at: string;
        };
        let data: UserProfile | null = rawData as UserProfile | null;

        if (rawError) {
          console.warn("Full profile query failed, attempting standard columns fallback:", rawError);
          const fallback = await supabase
            .from("users")
            .select("id, auth_id, full_name, role, subject_id, created_at")
            .eq("auth_id", user.id)
            .maybeSingle();

          if (fallback.data) {
            data = {
              ...(fallback.data as Partial<UserProfile>),
              username: null,
              email: user.email || null,
              department: null,
              academic_year: null,
              section_number: null,
            } as UserProfile;
          }
        }

        if (data && isMounted) {
          let subjectName: string | null = null;
          if (data.subject_id) {
            const { data: subData } = await supabase
              .from("subjects")
              .select("name")
              .eq("id", data.subject_id)
              .maybeSingle();
            subjectName = subData?.name ?? null;
          }

          setProfile({
            ...data,
            subject_name: subjectName,
            email: data.email || user.email || null,
          });
          setNewName(data.full_name || fullName || "");
        }
      } catch (err) {
        console.error("Failed to load profile details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user, fullName]);

  const getRoleBadge = (userRole?: string) => {
    switch (userRole) {
      case "owner":
        return { label: "المالك العام (Owner)", bg: "bg-purple-500/20 text-purple-300 border-purple-500/30", glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]" };
      case "coordinator":
        return { label: "منسق البرنامج (رئيس القسم)", bg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30", glow: "shadow-[0_0_15px_rgba(99,102,241,0.3)]" };
      case "doctor":
        return { label: "دكتور المادة (محاضر)", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]" };
      case "ta":
        return { label: "معيد السكشن (مساعد تدريس)", bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]" };
      case "student":
        return { label: "طالب أكاديمي", bg: "bg-blue-500/20 text-blue-300 border-blue-500/30", glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]" };
      default:
        return { label: userRole || "مستخدم مسجل", bg: "bg-white/10 text-slate-300 border-white/20", glow: "" };
    }
  };

  const getDepartmentLabel = (deptKey?: string | null) => {
    if (!deptKey) return "غير محدد";
    const found = DEPARTMENTS.find((d) => d.id === deptKey);
    return found ? found.nameAr : deptKey;
  };

  const getAcademicYearLabel = (yearKey?: string | null) => {
    if (!yearKey) return "غير محدد";
    const found = ACADEMIC_YEARS.find((y) => y.id === yearKey);
    return found ? found.nameAr : `الفرقة ${yearKey}`;
  };

  // Handle Save Name
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim().length < 3) {
      toast.error("يجب أن يحتوي الاسم على 3 أحرف على الأقل");
      return;
    }

    try {
      setSavingName(true);
      if (user?.id) {
        const { error } = await supabase
          .from("users")
          .update({ full_name: newName.trim() })
          .eq("auth_id", user.id);

        if (error) throw error;

        // Also update auth user metadata if possible
        await supabase.auth.updateUser({
          data: { full_name: newName.trim() },
        });

        toast.success("تم تحديث الاسم بنجاح");
        if (profile) setProfile({ ...profile, full_name: newName.trim() });
        setEditingName(false);
        refreshRole();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("فشل تحديث الاسم، يرجى المحاولة مرة أخرى");
    } finally {
      setSavingName(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    try {
      setSavingPassword(true);

      // Verify if password was leaked in data breaches (HaveIBeenPwned k-Anonymity)
      const pwned = await checkPwnedPassword(newPassword);
      if (pwned.isPwned) {
        toast.error(`كلمة المرور هذه غير آمنة ومسرّبة سابقاً (${pwned.count.toLocaleString()} مرة) في اختراقات قواعد بيانات عامة. يرجى اختيار كلمة مرور أخرى.`);
        setSavingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("تم تغيير كلمة المرور بنجاح! احتفظ بها في مكان آمن.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "فشل تغيير كلمة المرور";
      toast.error(`حدث خطأ: ${msg}`);
    } finally {
      setSavingPassword(false);
    }
  };


  const handleRemoveAvatarDirect = async () => {
    if (!user?.id) return;
    try {
      await deleteUserAvatar(user.id);
      await updateAvatarUrl(null);
      toast.success("تمت إزالة الصورة الشخصية بنجاح.");
    } catch (err) {
      console.error(err);
      toast.error("فشل حذف الصورة");
    }
  };

  const handleSignOutConfirm = async () => {
    await signOut();
    navigate("/");
  };

  const roleInfo = getRoleBadge(profile?.role || role || "");
  const dashboardPath = role ? getAttendanceDashboardRoute(role) : "/attendance";
  const userInitial = (profile?.full_name || fullName || "U").charAt(0).toUpperCase();

  // Password strength calculation
  const hasMinLength = newPassword.length >= 6;
  const hasNumbers = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordStrengthScore = (hasMinLength ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSpecial ? 1 : 0);

  // Security score
  const securityScore = 70 + (passkeys.length > 0 ? 30 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#050713] text-white selection:bg-purple-500/30 selection:text-purple-200" dir="rtl">
      <Navbar />

      {/* Background ambient decorative glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px]" />
      </div>

      <main id="main-content" className="flex-1 py-8 sm:py-12 section-container relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Hero Header with Glassmorphism & Cyber TMSAH badge */}
          <div className="relative rounded-3xl p-6 sm:p-8 border border-purple-500/25 bg-gradient-to-r from-[#0C1026]/90 via-[#0B0E22]/90 to-[#120B28]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* Ambient decorative elements */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-cyan-500/15 rounded-full blur-2xl" />

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>منظومة الحسابات الموحدة</span>
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>متصل الآن</span>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                  <User className="w-8 h-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400" />
                  <span>الملف الشخصي والحساب</span>
                </h1>

                <p className="text-xs sm:text-sm text-slate-300/80 max-w-xl">
                  تحكم كامل في هويتك الأكاديمية، صورتك الشخصية، ومفاتيح الأمان البيومترية في منصة CYBER TMSAH.
                </p>
              </div>

              {/* Action and security stats */}
              <div className="flex flex-col sm:items-end gap-3 shrink-0">
                <Button
                  onClick={() => navigate(dashboardPath)}
                  variant="outline"
                  className="border-purple-500/30 bg-purple-950/20 hover:bg-purple-600/20 text-white rounded-2xl text-xs sm:text-sm font-bold gap-2.5 h-11 px-5 shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all hover:scale-[1.02] flex items-center"
                >
                  <span>العودة للوحة التحكم</span>
                  <ArrowLeft className="w-4 h-4 text-purple-400" />
                </Button>

                <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-950/30 via-black/50 to-black/60 border border-emerald-500/30 hover:border-emerald-500/50 px-4 py-2 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-md transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>معدل الأمان:</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-24 h-2.5 bg-black/60 border border-white/10 rounded-full overflow-hidden p-[1px]">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-300 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.8)] transition-all duration-700"
                        style={{ width: `${securityScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-300">{securityScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {securityScore === 100 ? "حماية قصوى" : "مستوى جيد"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <p className="text-sm font-medium text-slate-400">جاري تحميل بيانات الحساب...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
              {/* SIDEBAR: Futuristic Identity Card */}
              <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
                <Card className="border border-purple-500/30 bg-[#090D21]/95 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.65)] relative group">
                  {/* Decorative Banner Header */}
                  <div className="h-28 bg-gradient-to-r from-purple-800/60 via-indigo-700/40 to-cyan-900/60 relative border-b border-white/10 overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:16px_16px]" />
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shadow-sm bg-black/60 border-emerald-500/40 text-emerald-400 backdrop-blur-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>نشط ومفعل</span>
                      </span>
                    </div>
                  </div>

                  <CardContent className="pt-0 relative px-6 pb-6 text-center space-y-4">
                    {/* Interactive Avatar with Holographic Glow */}
                    <div className="-mt-14 inline-block relative group/avatar">
                      <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 p-[3px] shadow-[0_0_35px_rgba(168,85,247,0.55)] transition-transform duration-300 group-hover/avatar:scale-105">
                        <div className="w-full h-full bg-[#080B1C] rounded-[21px] overflow-hidden flex items-center justify-center relative">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={profile?.full_name || fullName || "Avatar"}
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-tr from-purple-700 to-indigo-700 flex items-center justify-center text-white font-black text-4xl select-none">
                              {userInitial}
                            </div>
                          )}

                          {/* Hover change button overlay */}
                          <button
                            type="button"
                            onClick={() => setIsAvatarStudioOpen(true)}
                            aria-label="تغيير الصورة الشخصية"
                            className="absolute inset-0 bg-black/65 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]"
                          >
                            <Camera className="w-6 h-6 text-cyan-400 mb-1" />
                            <span className="text-[10px] font-bold">تغيير الصورة</span>
                          </button>
                        </div>
                      </div>

                      {/* Floating edit camera trigger button */}
                      <button
                        type="button"
                        onClick={() => setIsAvatarStudioOpen(true)}
                        aria-label="استوديو الصورة الشخصية"
                        className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 border-2 border-[#090D21] flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 cursor-pointer"
                        title="تعديل الصورة الشخصية"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Name & Username */}
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-white truncate">
                        {profile?.full_name || fullName || "مستخدم مسجل"}
                      </h2>

                      <div className="flex justify-center">
                        <span className="text-xs font-mono font-bold text-purple-300 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 shadow-sm" dir="ltr">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>{formatDisplayUsername(profile?.username, profile?.email || user?.email)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Role Tag */}
                    <div className="flex justify-center">
                      <span className={`px-4 py-1.5 rounded-xl text-xs font-bold border ${roleInfo.bg} ${roleInfo.glow}`}>
                        {roleInfo.label}
                      </span>
                    </div>

                    {/* Quick Avatar Studio Button */}
                    <Button
                      type="button"
                      onClick={() => setIsAvatarStudioOpen(true)}
                      variant="outline"
                      className="w-full border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 text-purple-200 rounded-2xl text-xs font-bold h-10 gap-2 shadow-sm transition-all"
                    >
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>إدارة الصورة الشخصية</span>
                    </Button>

                    {/* Identity Details list */}
                    <div className="pt-3 border-t border-white/10 space-y-2.5 text-start text-xs">
                      {/* Email Card Badge (No Truncation) */}
                      <div className="p-3 rounded-2xl bg-black/50 border border-white/10 hover:border-purple-500/30 transition-all space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5 text-[11px] font-medium">
                            <Mail className="w-3.5 h-3.5 text-purple-400" />
                            <span>البريد الإلكتروني الأساسي:</span>
                          </span>
                          {(profile?.email || user?.email) && (
                            <button
                              onClick={() => copyToClipboard(profile?.email || user?.email || "", "البريد الإلكتروني")}
                              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                              title="نسخ البريد"
                            >
                              {copiedField === "البريد الإلكتروني" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                        <span className="font-mono text-slate-200 text-xs break-all block text-start font-bold" dir="ltr">
                          {profile?.email || user?.email || "—"}
                        </span>
                      </div>

                      {/* Quick Stats for Owner / Coordinator */}
                      {role === "owner" || role === "coordinator" ? (
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div className="p-2.5 rounded-2xl bg-purple-950/20 border border-purple-500/25 space-y-1 text-center">
                            <span className="text-[10px] text-purple-300 block">الأجهزة الموثقة</span>
                            <span className="text-xs font-mono font-bold text-white flex items-center justify-center gap-1">
                              <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{passkeys.length}/2 مفاتيح أمان</span>
                            </span>
                          </div>
                          <div className="p-2.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 space-y-1 text-center">
                            <span className="text-[10px] text-emerald-300 block">حالة الحساب</span>
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>درع FIDO2 نشط</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Department */}
                          {profile?.department && (
                            <div className="flex items-center justify-between text-slate-300 p-2 rounded-xl bg-black/30 border border-white/5">
                              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>القسم:</span>
                              </span>
                              <span className="text-white font-medium text-[11px]">
                                {getDepartmentLabel(profile.department)}
                              </span>
                            </div>
                          )}

                          {/* Academic Year */}
                          {profile?.academic_year && (
                            <div className="flex items-center justify-between text-slate-300 p-2 rounded-xl bg-black/30 border border-white/5">
                              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                                <span>الفرقة:</span>
                              </span>
                              <span className="text-purple-300 font-bold text-[11px]">
                                {getAcademicYearLabel(profile.academic_year)}
                              </span>
                            </div>
                          )}

                          {/* Section */}
                          {profile?.section_number && (
                            <div className="flex items-center justify-between text-slate-300 p-2 rounded-xl bg-black/30 border border-white/5">
                              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                <Shield className="w-3.5 h-3.5 text-slate-500" />
                                <span>السكشن:</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-white/10 text-white font-bold text-[11px]">
                                سكشن {profile.section_number}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Subject */}
                      {profile?.subject_name && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>المادة:</span>
                          </span>
                          <span className="text-purple-200 font-bold truncate max-w-[140px]">
                            {profile.subject_name}
                          </span>
                        </div>
                      )}

                      {/* Joined Date */}
                      {profile?.created_at && (
                        <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-white/5">
                          <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3 h-3" />
                            <span>تاريخ الانضمام:</span>
                          </span>
                          <span className="text-slate-400 text-[11px]" dir="ltr">
                            {new Date(profile.created_at).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sign out action */}
                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleSignOutConfirm}
                        variant="ghost"
                        className="w-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-2xl text-xs h-10 gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>تسجيل الخروج من الحساب</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* MAIN CONTENT: Tabs for Settings & Configuration */}
              <div className="lg:col-span-2 space-y-6">
                <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                  {/* Modern Navigation Tabs Header */}
                  <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 bg-[#090D21]/90 p-1.5 rounded-2xl h-auto border border-purple-500/20 backdrop-blur-xl gap-1">
                    <TabsTrigger
                      value="overview"
                      className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>البيانات الأساسية</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="avatar"
                      className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>الصورة الشخصية</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="security"
                      className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>كلمة المرور</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="passkeys"
                      className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg gap-1.5"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>مفاتيح Passkeys</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: OVERVIEW / PERSONAL INFO */}
                  <TabsContent value="overview" className="space-y-6 mt-6">
                    {/* 1. Name & Display Setting */}
                    <Card className="border border-white/10 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                      <CardHeader className="p-0 pb-5 border-b border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                              <IdCard className="w-5 h-5 text-purple-400" />
                              <span>الاسم والبيانات المعروضة</span>
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-400 mt-1">
                              اسمك الكامل كما يظهر في التقارير الأكاديمية وكشوف الحضور
                            </CardDescription>
                          </div>
                          {!editingName && (
                            <Button
                              onClick={() => setEditingName(true)}
                              variant="outline"
                              size="sm"
                              className="border-purple-500/30 hover:bg-purple-600/15 text-purple-300 rounded-xl text-xs font-bold h-9"
                            >
                              تعديل الاسم
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="p-0 pt-5 space-y-5">
                        {editingName ? (
                          <form onSubmit={handleUpdateName} className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-300">الاسم الكامل (رباعي أو ثلاثي)*</Label>
                              <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-black/60 border-purple-500/30 focus:border-purple-500 text-white rounded-2xl h-12 text-sm px-4"
                                placeholder="أدخل اسمك الكامل"
                                disabled={savingName}
                                required
                              />
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setNewName(profile?.full_name || fullName || "");
                                  setEditingName(false);
                                }}
                                disabled={savingName}
                                className="text-slate-400 hover:text-white rounded-xl text-xs h-10 px-4"
                              >
                                إلغاء
                              </Button>
                              <Button
                                type="submit"
                                disabled={savingName}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs h-10 px-6 gap-2 shadow-md"
                              >
                                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                <span>حفظ التعديل</span>
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Full Name Card */}
                            <div className="p-4 rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/50 border border-white/10 hover:border-purple-500/40 transition-all duration-300 shadow-sm space-y-2 group">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-purple-300/90 font-medium flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-purple-400" />
                                  <span>الاسم المعتمد</span>
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                  معتمد
                                </span>
                              </div>
                              <span className="text-base font-bold text-white block truncate">
                                {profile?.full_name || fullName || "—"}
                              </span>
                            </div>

                            {/* Username Card */}
                            <div className="p-4 rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/50 border border-white/10 hover:border-cyan-500/40 transition-all duration-300 shadow-sm space-y-2 group">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-cyan-300/90 font-medium flex items-center gap-1.5">
                                  <IdCard className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>اسم المستخدم الموحد</span>
                                </span>
                                <span className="text-[10px] font-mono text-cyan-400">@Handle</span>
                              </div>
                              <span className="text-sm font-mono font-bold text-cyan-200 block truncate" dir="ltr">
                                {formatDisplayUsername(profile?.username, profile?.email || user?.email)}
                              </span>
                            </div>

                            {/* Email Card (Full address & copy) */}
                            <div className="p-4 rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/50 border border-white/10 hover:border-emerald-500/40 transition-all duration-300 shadow-sm space-y-2 group">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-emerald-300/90 font-medium flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>البريد الإلكتروني الأساسي</span>
                                </span>
                                {(profile?.email || user?.email) && (
                                  <button
                                    onClick={() => copyToClipboard(profile?.email || user?.email || "", "البريد الإلكتروني")}
                                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                                    title="نسخ البريد"
                                  >
                                    {copiedField === "البريد الإلكتروني" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-200 block truncate" dir="ltr" title={profile?.email || user?.email || ""}>
                                {profile?.email || user?.email || "—"}
                              </span>
                            </div>

                            {/* User ID Card */}
                            <div className="p-4 rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/50 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 shadow-sm space-y-2 group">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-indigo-300/90 font-medium flex items-center gap-1.5">
                                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>معرّف الحساب السيبراني (UUID)</span>
                                </span>
                                {user?.id && (
                                  <button
                                    onClick={() => copyToClipboard(user.id, "معرّف الحساب")}
                                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                                    title="نسخ المعرف"
                                  >
                                    {copiedField === "معرّف الحساب" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              <span className="text-xs font-mono text-slate-400 block truncate" dir="ltr">
                                {user?.id ? user.id : "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 2. Academic / Cyber Clearance Identity Card */}
                    {role === "owner" || role === "coordinator" || role === "doctor" ? (
                      <Card className="border border-purple-500/30 bg-[#090D21]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-xl hover:border-purple-500/50 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                        <CardHeader className="p-0 pb-5 border-b border-white/10 relative z-10">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                                <Shield className="w-5 h-5 text-purple-400" />
                                <span>صلاحيات ومستوى الوصول السيبراني</span>
                              </CardTitle>
                              <CardDescription className="text-xs text-slate-400 mt-1">
                                مستوى التحكم الإداري، تدقيق العمليات المباشر، وتوثيق أجهزة FIDO2 في المنظومة
                              </CardDescription>
                            </div>
                            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                              {role === "owner" ? "صلاحيات المالك (Root Admin)" : role === "coordinator" ? "منسق المنظومة" : "دكتور محاضر"}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-0 pt-5 relative z-10 space-y-4">
                          {/* 4 Cyber Permissions Badges */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/25 hover:border-purple-500/40 transition-all space-y-1">
                              <div className="flex items-center gap-2 text-purple-300">
                                <Database className="w-4 h-4 text-purple-400" />
                                <span className="text-xs font-bold">قاعدة البيانات</span>
                              </div>
                              <span className="text-[11px] text-slate-300 block">وصول كامل للقواعد</span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/25 hover:border-cyan-500/40 transition-all space-y-1">
                              <div className="flex items-center gap-2 text-cyan-300">
                                <KeyRound className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs font-bold">مفاتيح التشفير</span>
                              </div>
                              <span className="text-[11px] text-slate-300 block">إدارة مفاتيح FIDO2</span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/25 hover:border-indigo-500/40 transition-all space-y-1">
                              <div className="flex items-center gap-2 text-indigo-300">
                                <Smartphone className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-bold">أجهزة الحضور</span>
                              </div>
                              <span className="text-[11px] text-slate-300 block">تحكم بالبوابات والسكاشن</span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 hover:border-emerald-500/40 transition-all space-y-1">
                              <div className="flex items-center gap-2 text-emerald-300">
                                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                                <span className="text-xs font-bold">سجلات الأمان</span>
                              </div>
                              <span className="text-[11px] text-emerald-300 block">إشراف وتدقيق 24/7</span>
                            </div>
                          </div>

                          {profile?.department && (
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[11px] text-slate-400 block">القسم الأكاديمي المشرف</span>
                                  <span className="text-sm font-bold text-white">{getDepartmentLabel(profile.department)}</span>
                                </div>
                              </div>
                              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                معتمد
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border border-white/10 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                        <CardHeader className="p-0 pb-5 border-b border-white/5">
                          <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                            <GraduationCap className="w-5 h-5 text-cyan-400" />
                            <span>الهوية الأكاديمية والمقررات</span>
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-400 mt-1">
                            القسم الأكاديمي، الفرقة، ومجموعات السكاشن المرتبطة بالحساب
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="p-0 pt-5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/20 to-black/40 border border-purple-500/20">
                              <span className="text-[11px] text-purple-300/80 block mb-1">القسم الجامعي</span>
                              <span className="text-sm font-bold text-white block">
                                {getDepartmentLabel(profile?.department)}
                              </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-gradient-to-b from-indigo-950/20 to-black/40 border border-indigo-500/20">
                              <span className="text-[11px] text-indigo-300/80 block mb-1">الفرقة الدراسية</span>
                              <span className="text-sm font-bold text-white block">
                                {getAcademicYearLabel(profile?.academic_year)}
                              </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-gradient-to-b from-cyan-950/20 to-black/40 border border-cyan-500/20">
                              <span className="text-[11px] text-cyan-300/80 block mb-1">رقم السكشن</span>
                              <span className="text-sm font-bold text-white block">
                                {profile?.section_number ? `سكشن ${profile.section_number}` : "غير محدد"}
                              </span>
                            </div>
                          </div>

                          {profile?.subject_name && (
                            <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[11px] text-slate-400 block">المادة الموكلة</span>
                                  <span className="text-sm font-bold text-white">{profile.subject_name}</span>
                                </div>
                              </div>
                              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                مادة أساسية
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* TAB 2: AVATAR & APPEARANCE */}
                  <TabsContent value="avatar" className="space-y-6 mt-6">
                    <Card className="border border-purple-500/25 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                      <CardHeader className="p-0 pb-5 border-b border-white/5">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                              <Camera className="w-5 h-5 text-cyan-400" />
                              <span>استوديو الصورة الشخصية</span>
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-400 mt-1">
                              اختر صورتك المخصصة من جهازك أو اختر إحدى الشخصيات الرمزية الجاهزة
                            </CardDescription>
                          </div>

                          <Button
                            type="button"
                            onClick={() => setIsAvatarStudioOpen(true)}
                            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-2xl text-xs h-10 px-5 gap-2 shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-all hover:scale-[1.02]"
                          >
                            <Camera className="w-4 h-4" />
                            <span>فتح نافذة الاستوديو الشامل</span>
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0 pt-6 space-y-6">
                        {/* Current Avatar Highlight Box */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-black/40 border border-white/10">
                          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 p-[3px] shadow-[0_0_25px_rgba(168,85,247,0.4)] shrink-0">
                            <div className="w-full h-full bg-[#080B1C] rounded-[21px] overflow-hidden flex items-center justify-center">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt="Current Avatar"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-tr from-purple-700 to-indigo-700 flex items-center justify-center text-white font-black text-3xl">
                                  {userInitial}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 text-center sm:text-start flex-1">
                            <div className="flex items-center justify-center sm:justify-start gap-2">
                              <span className="text-sm font-bold text-white">الصورة المعتمدة حالياً</span>
                              {avatarUrl ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  صورة مخصصة
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                                  حرف الاسم الافتراضي
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              تظهر صورتك الشخصية لزملائك والمحاضرين في كشوفات الحضور الذكي والتقارير.
                            </p>
                            <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 flex-wrap">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsAvatarStudioOpen(true)}
                                className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-xs h-8 px-3 gap-1.5"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>تغيير الصورة</span>
                              </Button>

                              {avatarUrl && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleRemoveAvatarDirect}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs h-8 px-3 gap-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>إزالة الصورة والعودة للحرف</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 3: SECURITY & PASSWORD */}
                  <TabsContent value="security" className="space-y-6 mt-6">
                    <Card className="border border-purple-500/20 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                      <CardHeader className="p-0 pb-5 border-b border-white/5">
                        <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                          <KeyRound className="w-5 h-5 text-purple-400" />
                          <span>تغيير كلمة المرور</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400 mt-1">
                          قم بتحديث كلمة المرور الخاصة بك بانتظام لحماية حسابك الجامعي
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-0 pt-6">
                        <form onSubmit={handleChangePassword} className="space-y-5">
                          {/* New Password */}
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-300">كلمة المرور الجديدة*</Label>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="أدخل كلمة مرور قوية (6 أحرف على الأقل)"
                                className="bg-black/60 border-purple-500/25 focus:border-purple-500 text-white rounded-2xl h-12 text-sm px-4 pl-12"
                                required
                                disabled={savingPassword}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Password Strength Meter */}
                            {newPassword.length > 0 && (
                              <div className="pt-2 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">قوة كلمة المرور:</span>
                                  <span className={`font-bold ${passwordStrengthScore === 3 ? "text-emerald-400" : passwordStrengthScore === 2 ? "text-amber-400" : "text-rose-400"}`}>
                                    {passwordStrengthScore === 3 ? "قوية جداً" : passwordStrengthScore === 2 ? "متوسطة" : "ضعيفة"}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                                  <div className={`h-full rounded-full transition-all ${passwordStrengthScore >= 1 ? "bg-rose-500" : "bg-white/10"}`} />
                                  <div className={`h-full rounded-full transition-all ${passwordStrengthScore >= 2 ? "bg-amber-500" : "bg-white/10"}`} />
                                  <div className={`h-full rounded-full transition-all ${passwordStrengthScore >= 3 ? "bg-emerald-500" : "bg-white/10"}`} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Confirm Password */}
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-300">تأكيد كلمة المرور الجديدة*</Label>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="أعد إدخال كلمة المرور للتأكيد"
                                className="bg-black/60 border-purple-500/25 focus:border-purple-500 text-white rounded-2xl h-12 text-sm px-4 pl-12"
                                required
                                disabled={savingPassword}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Encryption Guarantee Note */}
                          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3 text-xs text-slate-300">
                            <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="font-bold text-white block">حماية مشفرة لمعلوماتك</span>
                              <span className="text-slate-400 text-[11px] leading-relaxed block">
                                يتم تشفير كلمات المرور باستخدام خوارزميات التجزئة العالمية (Argon2 / bcrypt) بحيث لا يستطيع أي شخص حتى فريق العمل الاطلاع على كلمة مرورك.
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 flex justify-end">
                            <Button
                              type="submit"
                              disabled={savingPassword}
                              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl h-11 px-7 shadow-[0_4px_20px_rgba(124,58,237,0.35)] gap-2 transition-all hover:scale-[1.02]"
                            >
                              {savingPassword ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>جاري التحديث...</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-4 h-4" />
                                  <span>تحديث كلمة المرور</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 4: PASSKEYS / WEBAUTHN */}
                  <TabsContent value="passkeys" className="space-y-6 mt-6">
                    <Card className="border border-purple-500/25 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                      <CardHeader className="p-0 pb-5 border-b border-white/5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                              <Fingerprint className="w-5 h-5 text-purple-400" />
                              <span>مفاتيح المرور البيومترية (Passkeys)</span>
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-400 mt-1">
                              سجل الدخول فورياً باستخدام بصمة الإصبع، التعرف على الوجه، أو Windows Hello دون كلمات مرور
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1 text-[11px] font-bold text-purple-300">
                              معيار FIDO2 / WebAuthn
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${
                              passkeys.length >= 2
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            }`}>
                              {passkeys.length} من 2 أجهزة مسجلة
                            </span>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0 pt-6 space-y-5">
                        {passkeys.length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                              <Fingerprint className="w-7 h-7" />
                            </div>
                            <div>
                              <p className="text-base font-bold text-white">لم تقم بربط مفتاح مرور حتى الآن</p>
                              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                                يمكنك ربط جهازك الحالي لتسجيل الدخول السريع بلمسة بصمة واحدة بأعلى معايير التشفير السيبراني المقاوم للاختراق والتصيد.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {passkeys.map((pk) => (
                              <div
                                key={pk.id}
                                className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-purple-500/40 transition-all flex-wrap sm:flex-nowrap"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-sm">
                                    <Key className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{pk.label}</p>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                                      {new Date(pk.createdAt).toLocaleString("ar-EG")}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 mr-auto sm:mr-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTestPasskey(pk.id)}
                                    disabled={testingPasskeyId === pk.id}
                                    className="border-purple-500/30 hover:bg-purple-500/15 text-purple-300 text-xs h-9 rounded-xl gap-1.5 px-3"
                                  >
                                    {testingPasskeyId === pk.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    )}
                                    <span>اختبار المفتاح</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeletePasskey(pk.id)}
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-9 rounded-xl px-2.5"
                                    title="حذف المفتاح"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                            <span>مفاتيح المرور مشفرة محلياً (الحد الأقصى: جهازين لكل طالب).</span>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            {/* ── Reset local cache button (useful on mobile where DevTools is unavailable) ── */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              title="امسح ذاكرة الجلسة المحلية (لا يحذف البصمة من الجهاز)"
                              onClick={() => {
                                clearAllLocalPasskeys();
                                toast.success("✅ تم مسح ذاكرة الجلسة المحلية. أعد تسجيل الدخول بالبصمة.");
                              }}
                              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 text-xs h-10 rounded-xl gap-1.5 px-3 shrink-0"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">إعادة ضبط Cache</span>
                              <span className="sm:hidden">إعادة ضبط</span>
                            </Button>

                            <Button
                              type="button"
                              onClick={handleInitiatePasskeyCreation}
                              disabled={creatingPasskey || passkeys.length >= 2}
                              className={`flex-1 sm:flex-initial text-white font-bold rounded-2xl h-10 px-6 text-xs gap-2 shrink-0 transition-all ${
                                passkeys.length >= 2
                                  ? "bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed"
                                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:scale-[1.02]"
                              }`}
                            >
                              {creatingPasskey ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>جاري إنشاء المفتاح...</span>
                                </>
                              ) : passkeys.length >= 2 ? (
                                <>
                                  <Lock className="w-4 h-4" />
                                  <span>الحد الأقصى مكتمل (2/2)</span>
                                </>
                              ) : (
                                <>
                                  <Fingerprint className="w-4 h-4" />
                                  <span>إنشاء مفتاح مرور جديد</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Avatar Studio Modal Dialog */}
      {user?.id && (
        <AvatarStudioDialog
          open={isAvatarStudioOpen}
          onOpenChange={setIsAvatarStudioOpen}
          userId={user.id}
          currentAvatarUrl={avatarUrl}
          userInitial={userInitial}
          onAvatarUpdated={(newUrl) => {
            updateAvatarUrl(newUrl);
          }}
        />
      )}

      {/* Passkey Re-authentication Security Modal */}
      <Dialog open={isPasskeyAuthModalOpen} onOpenChange={setIsPasskeyAuthModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0D122B] border border-purple-500/30 text-white rounded-3xl p-6" dir="rtl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto sm:mx-0 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                تأكيد أمني مطلوب لإضافة بصمة
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 mt-1 leading-relaxed">
                لحماية حسابك ومنع أي شخص متطفل من إضافة بصمته لجهازك، يرجى تأكيد كلمة مرور حسابك أولاً:
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleVerifyPasswordAndCreatePasskey} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="passkey-reauth-pass" className="text-xs text-slate-300 font-medium">
                كلمة مرور حسابك الحالية
              </Label>
              <div className="relative">
                <Input
                  id="passkey-reauth-pass"
                  type={showPasskeyAuthPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={passkeyAuthPassword}
                  onChange={(e) => setPasskeyAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-black/50 border-white/10 focus:border-purple-500 text-white text-sm rounded-xl h-11 pr-3 pl-10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasskeyAuthPassword(!showPasskeyAuthPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPasskeyAuthPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPasskeyAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row-reverse gap-2 sm:gap-0 pt-2">
              <Button
                type="submit"
                disabled={verifyingPasskeyPassword || !passkeyAuthPassword.trim()}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl h-10 px-5 text-xs gap-2 shadow-lg"
              >
                {verifyingPasskeyPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>تأكيد ومتابعة البصمة</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPasskeyAuthModalOpen(false)}
                className="w-full sm:w-auto text-slate-400 hover:text-white hover:bg-white/5 rounded-xl h-10 text-xs"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
