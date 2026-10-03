import { getFriendlyErrorMessage } from "@/lib/academicCopy";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { User, KeyRound, Shield, Mail, CheckCircle2, Eye, EyeOff, ArrowLeft, Loader2, Calendar, Lock, Fingerprint, Trash2, Key, Camera, Copy, Check, LogOut, IdCard } from "lucide-react";
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
import { deleteUserAvatar } from "@/lib/avatarUtils";
import { registerPasskey, preparePasskeyRegistration, authenticateWithPasskey, isWebAuthnSupported, checkLocalPasskeyAvailability, type PreparedPasskeyRegistration } from "@/lib/webauthn";
import { passkeyFailure } from '@/lib/passkeys/errors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ManagedPasskey { id:string; rawId:string; label:string; createdAt:string; lastUsedAt?:string|null|undefined }
const MAX_PASSKEYS = 10;
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
  const [searchParams] = useSearchParams();
  const { user, role, fullName, refreshRole, avatarUrl, updateAvatarUrl, signOut } = useAttendanceAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);

  // Active Tab
  const [activeMainTab, setActiveMainTab] = useState<string>(() => ['overview', 'avatar', 'security', 'passkeys'].includes(searchParams.get('section') ?? '') ? searchParams.get('section')! : 'overview');

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
  const [passkeys, setPasskeys] = useState<ManagedPasskey[]>([]);
  const [renamingPasskey, setRenamingPasskey] = useState<ManagedPasskey|null>(null);
  const [passkeyName, setPasskeyName] = useState('');
  const [savingPasskeyName, setSavingPasskeyName] = useState(false);
  const [creatingPasskey, setCreatingPasskey] = useState(false);
  const [passkeyDestination, setPasskeyDestination] = useState<'device'|'any'>('device');
  const [preparedPasskey, setPreparedPasskey] = useState<PreparedPasskeyRegistration|null>(null);
  const [checkingPasskeyDevice, setCheckingPasskeyDevice] = useState(false);
  const [passkeyDeviceCheck, setPasskeyDeviceCheck] = useState<string|null>(null);
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
      name = name.split("@")[0] ?? "";
    }
    return `@${name.replace(/^@+/, "")}`;
  };

  // The verified server list is the only source of registered devices.
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    async function loadUserPasskeys() {
      try {
        const { data, error } = await supabase.auth.passkey.list();

        if (error) throw error;
        if (!isMounted) return;
        const mapped = (data ?? []).map(item => ({ id: item.id, rawId: item.id, label: item.friendly_name || "مفتاح دخول", createdAt: item.created_at, lastUsedAt:item.last_used_at }));
        setPasskeys(mapped);
      } catch (err) {
        console.error("Failed to load verified passkeys", err);
        if (isMounted) { setPasskeys([]); toast.error("تعذر تحميل أجهزة الدخول المعتمدة."); }
      }
    }

    loadUserPasskeys();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const savePasskeys = (items: ManagedPasskey[]) => {
    if (!user?.id) return;
    setPasskeys(items);
  };

  const handleInitiatePasskeyCreation = (destination:'device'|'any'='device') => {
    if (!isWebAuthnSupported()) {
      toast.error("الدخول بالبصمة غير متاح على جهازك أو متصفحك الحالي.");
      return;
    }

    if (passkeys.length >= MAX_PASSKEYS) {
      toast.error("يمكنك حفظ 10 مفاتيح دخول. احذف مفتاحًا قديمًا لإضافة آخر.");
      return;
    }

    // Open security re-authentication modal
    setPasskeyDestination(destination);
    setPreparedPasskey(null);
    setPasskeyAuthPassword("");
    setShowPasskeyAuthPassword(false);
    setIsPasskeyAuthModalOpen(true);
  };

  const handleVerifyPasswordAndCreatePasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if(preparedPasskey){await executePasskeyCreation();return;}
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

      // Prepare the server request, then wait for a fresh click to open the native prompt.
      const prepared=await preparePasskeyRegistration();
      setPreparedPasskey(prepared);
      setPasskeyAuthPassword("");
    } catch (err: unknown) {
      toast.error(passkeyFailure(err).error ?? 'تعذر تجهيز طلب الإضافة. أعد المحاولة.');
    } finally {
      setVerifyingPasskeyPassword(false);
    }
  };

  const executePasskeyCreation = async () => {
    const prepared=preparedPasskey;
    if(!prepared)return;
    if (passkeys.length >= MAX_PASSKEYS) {
      toast.error("يمكنك حفظ 10 مفاتيح دخول. احذف مفتاحًا قديمًا لإضافة آخر.");
      return;
    }

    try {
      setCreatingPasskey(true);
      setIsPasskeyAuthModalOpen(false);

      // A phone may create a security key or cloud credential; do not infer its provider from this browser.
      const deviceLabel = "مفتاح دخول";

      const formattedLabel = `${deviceLabel} - ${new Date().toLocaleDateString("ar-EG")}`;
      const result = await registerPasskey(formattedLabel,passkeyDestination,prepared);

      if (result.cancelled) {
        toast.info(passkeyDestination==='device' ? "لم تكتمل الإضافة على هذا الجهاز. إذا لم يظهر خيار الحفظ، راجع مدير كلمات المرور وقفل الشاشة في إعدادات جهازك." : "تم إلغاء عملية إضافة جهاز الدخول.");
        return;
      }

      if (!result.success || !result.credentialId) {
        toast.error(getFriendlyErrorMessage(result.error || "فشل تسجيل جهاز الدخول. تأكد من تفعيل البصمة أو رمز قفل الجهاز على جهازك."));
        return;
      }

      // Refresh passkeys list from database (server-verified credentials)
      if (user?.id) {
        const { data: dbData } = await supabase.auth.passkey.list();

        if (dbData && dbData.length > 0) {
          const mapped = dbData.map((item) => ({
            id: item.id,
            rawId: item.id,
            label: item.friendly_name || deviceLabel,
            createdAt: item.created_at || new Date().toISOString(),
            lastUsedAt:item.last_used_at,
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

      toast.success("تم حفظ مفتاح الدخول بنجاح.");
    } catch (err: unknown) {
      console.error("Passkey creation unexpected error:", err);
      toast.error("خطأ غير متوقع. الرجاء المحاولة مرة أخرى.");
    } finally {
      setCreatingPasskey(false);
      setPreparedPasskey(null);
    }
  };

  const handleCheckPasskeyDevice=async()=>{
    setCheckingPasskeyDevice(true);
    try {
      const available=await checkLocalPasskeyAvailability();
      setPasskeyDeviceCheck(available===true ? 'المتصفح يكتشف وسيلة لتأكيد هويتك على هذا الجهاز. يمكنك تجربة الإضافة.' : available===false ? 'المتصفح لم يكتشف وسيلة لحفظ المفتاح مع تأكيد هويتك على هذا الجهاز. راجع قفل الشاشة ومدير كلمات المرور في إعدادات الهاتف، وحدّث المتصفح.' : 'لم يستطع المتصفح تحديد توفر الحفظ على الجهاز. يمكنك تجربة الإضافة أو اختيار مكان حفظ آخر.');
    }finally {setCheckingPasskeyDevice(false);}
  };



  const handleTestPasskey = async (passkeyId: string) => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("الدخول بالبصمة غير متاح في هذا المتصفح.");
      return;
    }

    try {
      setTestingPasskeyId(passkeyId);
      const result = await authenticateWithPasskey(undefined, passkeyId);
      if (!result.success) { toast.error(getFriendlyErrorMessage(result.error || "تعذر تأكيد مفتاح الدخول")); return; }
      toast.success("تم تأكيد جهاز الدخول بنجاح.");
      setPasskeys(items=>items.map(item=>item.id===passkeyId ? {...item,lastUsedAt:new Date().toISOString()} : item));
    } catch (err: unknown) {
      console.error("Passkey test error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.info("تم إلغاء عملية التحقق.");
      } else {
        toast.error("فشل التحقق من جهاز الدخول.");
      }
    } finally {
      setTestingPasskeyId(null);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    if (!user?.id) return;
    const result = await supabase.auth.passkey.delete({passkeyId});
    if (result.error) { toast.error("تعذر حذف جهاز الدخول. لم يتغير المفتاح المعتمد."); return; }
    savePasskeys(passkeys.filter(p => p.id !== passkeyId));
    toast.success("تم إلغاء اعتماد المفتاح على المنصة. يمكنك حذفه من مدير مفاتيح جهازك أيضًا.");
  };

  const handleRenamePasskey = async (event:React.FormEvent) => {
    event.preventDefault();
    if (!renamingPasskey || savingPasskeyName) return;
    setSavingPasskeyName(true);
    try {
      const renamed=await supabase.auth.passkey.update({passkeyId:renamingPasskey.id,friendlyName:passkeyName.trim()});
      if(renamed.error)throw renamed.error;
      setPasskeys(items=>items.map(item=>item.id===renamingPasskey.id ? {...item,label:passkeyName.trim()} : item));
      setRenamingPasskey(null);
      toast.success('تم حفظ اسم مفتاح الدخول.');
    } catch(error) { toast.error(error instanceof Error ? error.message : 'تعذر حفظ الاسم.'); }
    finally { setSavingPasskeyName(false); }
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
            full_name: data.full_name ?? fullName ?? "",
            role: data.role ?? role ?? "student",
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
  }, [user, fullName, role]);

  const getRoleBadge = (userRole?: string) => {
    switch (userRole) {
      case "owner":
        return { label: "مدير المنصة", bg: "bg-purple-500/20 text-purple-300 border-purple-500/30", glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]" };
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
      toast.error(getFriendlyErrorMessage(`حدث خطأ: ${msg}`));
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
        <div className="max-w-4xl mx-auto space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">الملف الشخصي والحساب</h1><p className="text-sm text-muted-foreground mt-1">بياناتك وصورتك وإعدادات الدخول.</p></div><Button onClick={() => navigate(dashboardPath)} variant="outline" className="min-h-11 gap-2"><ArrowLeft className="h-4 w-4" />العودة للوحة التحكم</Button></header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <p className="text-sm font-medium text-slate-400">جاري تحميل بيانات الحساب...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="ملخص الحساب">
                <button type="button" aria-label="تغيير الصورة الشخصية" className="relative h-20 w-20 shrink-0 rounded-2xl overflow-hidden bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setIsAvatarStudioOpen(true)}>
                  {avatarUrl ? <img src={avatarUrl} alt={profile?.full_name || fullName || 'الصورة الشخصية'} className="h-full w-full object-cover" /> : <span className="text-3xl font-bold text-primary">{userInitial}</span>}
                  <span className="absolute bottom-0 inset-x-0 bg-black/65 py-1 flex justify-center"><Camera className="h-4 w-4" /></span>
                </button>
                <div className="flex-1 min-w-[160px] space-y-1"><h2 className="text-lg font-bold break-words">{profile?.full_name || fullName}</h2><p className="text-sm text-muted-foreground">{roleInfo.label}{profile?.department ? ` · ${getDepartmentLabel(profile.department)}` : ''}</p>{profile?.academic_year && <p className="text-sm text-muted-foreground">{getAcademicYearLabel(profile.academic_year)}{profile.section_number ? ` · سكشن ${profile.section_number}` : ''}</p>}</div>
                <Button type="button" variant="ghost" onClick={handleSignOutConfirm} className="basis-full sm:basis-auto text-rose-400 min-h-11 gap-2 justify-start sm:justify-center"><LogOut className="h-4 w-4" />تسجيل الخروج</Button>
              </section>

              {/* MAIN CONTENT: Tabs for Settings & Configuration */}
              <div className="space-y-6">
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
                      <span>الدخول بالبصمة</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: OVERVIEW / PERSONAL INFO */}
                  <TabsContent value="overview" className="space-y-6 mt-6">
                    {/* 1. Name & Display Setting */}
                    <Card className="border border-white/10 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                      <CardHeader className="p-0 pb-5 border-b border-white/5">
                        <div className="flex flex-wrap gap-3 items-center justify-between">
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
                                  <span>اسم المستخدم</span>
                                </span>
                                <span className="text-[10px] font-mono text-cyan-400">اسم الدخول</span>
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

                            {/* Account membership date */}
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                تاريخ الانضمام
                              </span>
                              <span className="text-sm text-slate-200 block">
                                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ar-EG") : "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </TabsContent>

                  {/* TAB 2: AVATAR & APPEARANCE */}
                  <TabsContent value="avatar" className="space-y-6 mt-6">
                    <Card className="border border-purple-500/25 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-lg">
                      <CardHeader className="p-0 pb-5 border-b border-white/5">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
                              <Camera className="w-5 h-5 text-cyan-400" />
                              <span>الصورة الشخصية</span>
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
                            <span>اختيار صورة</span>
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
                              تظهر صورتك الشخصية لزملائك والمحاضرين في كشوفات الحضور والتقارير.
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
                          {/* Hidden username input for browser accessibility and password manager compliance */}
                          <input
                            type="text"
                            name="username"
                            autoComplete="username"
                            value={user?.email || profile?.username || ""}
                            readOnly
                            className="sr-only"
                            aria-hidden="true"
                            tabIndex={-1}
                          />

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
                              <span className="font-bold text-white block">خصوصية حسابك</span>
                              <span className="text-slate-400 text-[11px] leading-relaxed block">
                                اختر كلمة مرور قوية ولا تشاركها مع الآخرين.
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
                              <span>الدخول بالبصمة</span>
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-400 mt-1">
                              سجّل الدخول باستخدام بصمة الإصبع أو الوجه أو رمز قفل جهازك.
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1 text-[11px] font-bold text-purple-300">
                              دخول سهل
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${
                              passkeys.length >= MAX_PASSKEYS
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            }`}>
                              {passkeys.length} من {MAX_PASSKEYS} مفاتيح مسجلة
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
                              <p className="text-base font-bold text-white">لم تضف جهازاً للدخول بالبصمة بعد</p>
                              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                                أضف جهازك لتسجيل الدخول بسهولة باستخدام بصمة الإصبع أو الوجه.
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
                                    <p className="text-xs text-slate-400 mt-1">آخر استخدام: {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleString('ar-EG') : 'لم يُستخدم بعد'}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 mr-auto sm:mr-0">
                                  <Button size="sm" variant="ghost" className="min-h-11 text-xs" onClick={()=>{setRenamingPasskey(pk);setPasskeyName(pk.label);}}>تعديل الاسم</Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTestPasskey(pk.id)}
                                    disabled={testingPasskeyId === pk.id}
                                    className="border-purple-500/30 hover:bg-purple-500/15 text-purple-300 text-xs min-h-11 rounded-xl gap-1.5 px-3"
                                  >
                                    {testingPasskeyId === pk.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    )}
                                    <span>تجربة الدخول</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeletePasskey(pk.id)}
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs min-h-11 min-w-11 rounded-xl px-2.5"
                                    title="إزالة الجهاز"
                                    aria-label="إزالة الجهاز"
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
                            <span>الإضافة الأساسية تحفظ المفتاح على جهازك الحالي. يختار جهازك البصمة أو الوجه أو رمز القفل لتأكيد هويتك.</span>
                          </div>

                          <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto">


                            <Button
                              type="button"
                              onClick={()=>handleInitiatePasskeyCreation('device')}
                              disabled={creatingPasskey || passkeys.length >= MAX_PASSKEYS}
                              className={`flex-1 sm:flex-initial text-white font-bold rounded-2xl h-10 px-6 text-xs gap-2 shrink-0 transition-all ${
                                passkeys.length >= MAX_PASSKEYS
                                  ? "bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed"
                                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:scale-[1.02]"
                              }`}
                            >
                              {creatingPasskey ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>جاري إضافة الجهاز...</span>
                                </>
                              ) : passkeys.length >= MAX_PASSKEYS ? (
                                <>
                                  <Lock className="w-4 h-4" />
                                  <span>الحد الأقصى مكتمل (10/10)</span>
                                </>
                              ) : (
                                <>
                                  <Fingerprint className="w-4 h-4" />
                                  <span>إضافة جهاز للدخول بالبصمة</span>
                                </>
                              )}
                            </Button>
                            <Button type="button" variant="ghost" className="min-h-11 text-xs text-slate-300 whitespace-normal" disabled={creatingPasskey || passkeys.length>=MAX_PASSKEYS} onClick={()=>handleInitiatePasskeyCreation('any')}>جهاز آخر أو مفتاح أمان</Button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-6">إذا لم يظهر خيار الحفظ على جهازك، افتح الموقع مباشرة في متصفح محدث، وفعّل مدير كلمات المرور وقفل الشاشة من إعدادات الجهاز.</p>
                        <Button type="button" variant="outline" className="min-h-11 text-xs" disabled={checkingPasskeyDevice || creatingPasskey} onClick={handleCheckPasskeyDevice}>{checkingPasskeyDevice ? 'جارٍ فحص الجهاز...' : 'فحص جاهزية الجهاز'}</Button>
                        {passkeyDeviceCheck && <p role="status" className="text-sm leading-7 rounded-xl border border-white/10 bg-white/5 p-3 text-slate-200">{passkeyDeviceCheck}</p>}
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
                تأكيد إضافة مفتاح الدخول
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 mt-1 leading-relaxed">
                {passkeyDestination==='device' ? 'سيُحفظ المفتاح على جهازك الحالي أو في مدير كلمات المرور المتاح عليه.' : 'ستختار مكان حفظ المفتاح من خيارات المتصفح، بما فيها جهاز آخر أو مفتاح أمان.'} أكّد كلمة مرور حسابك للمتابعة.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleVerifyPasswordAndCreatePasskey} className="space-y-4 pt-2">
            {/* Hidden username input for browser accessibility and password manager compliance */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user?.email || profile?.username || ""}
              readOnly
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />

            {!preparedPasskey ? <div className="space-y-2">
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
            </div> : <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm leading-7 text-emerald-200">تم تأكيد كلمة المرور. اضغط الآن لفتح نافذة جهازك وحفظ مفتاح الدخول.</p>}

            <DialogFooter className="flex-col sm:flex-row-reverse gap-2 sm:gap-0 pt-2">
              <Button
                type="submit"
                disabled={verifyingPasskeyPassword || creatingPasskey || (!preparedPasskey && !passkeyAuthPassword.trim())}
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
                    <span>{preparedPasskey ? passkeyDestination==='device' ? 'حفظ على هذا الجهاز' : 'اختيار مكان الحفظ' : 'تأكيد ومتابعة البصمة'}</span>
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
      <Dialog open={Boolean(renamingPasskey)} onOpenChange={open=>{if(!open && !savingPasskeyName)setRenamingPasskey(null);}}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>اسم مفتاح الدخول</DialogTitle><DialogDescription>اختر اسمًا يساعدك على تمييز هذا المفتاح.</DialogDescription></DialogHeader>
          <form onSubmit={handleRenamePasskey} className="space-y-4">
            <Label htmlFor="passkey-name">الاسم</Label>
            <Input id="passkey-name" value={passkeyName} onChange={event=>setPasskeyName(event.target.value)} maxLength={80} required autoFocus />
            <Button type="submit" disabled={savingPasskeyName || !passkeyName.trim()}>{savingPasskeyName ? 'جارٍ الحفظ…' : 'حفظ الاسم'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
