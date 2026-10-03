import { ACADEMIC_YEARS, DEPARTMENTS } from "@/features/academics/types";
import { deleteUserAvatar } from "@/features/accounts/services/avatarService";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getDashboardRoute } from "@/features/auth/utils/dashboardRoutes";
import { supabase } from "@/shared/api/supabaseClient";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { checkPwnedPassword } from "@/shared/lib/pwnedPassword";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { UserProfileDetails } from "../types/profile";
export function useProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role, fullName, refreshRole, avatarUrl, updateAvatarUrl, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<string>(() =>
    ["overview", "avatar", "security", "passkeys"].includes(searchParams.get("section") ?? "")
      ? searchParams.get("section")!
      : "overview",
  );
  const [isAvatarStudioOpen, setIsAvatarStudioOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`تم نسخ ${fieldName} بنجاح`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("تعذر النسخ. أعد المحاولة.");
    }
  };
  const formatDisplayUsername = (raw?: string | null, fallbackEmail?: string | null): string => {
    if (!raw && !fallbackEmail) return "—";
    let name = (raw || fallbackEmail || "").trim();
    if (name.includes("@")) {
      name = name.split("@")[0] ?? "";
    }
    return `@${name.replace(/^@+/, "")}`;
  };
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
          .select(
            `
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
          `,
          )
          .eq("auth_id", user.id)
          .maybeSingle();

        type UserProfile = {
          id: string;
          auth_id: string;
          full_name: string | null;
          username: string | null;
          email: string | null;
          role: string | null;
          department: string | null;
          academic_year: string | null;
          section_number: number | null;
          subject_id: string | null;
          created_at: string;
        };
        let data: UserProfile | null = rawData as UserProfile | null;

        if (rawError) {
          console.warn(
            "Full profile query failed, attempting standard columns fallback:",
            rawError,
          );
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
        return {
          label: "مدير المنصة",
          bg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]",
        };
      case "coordinator":
        return {
          label: "منسق البرنامج (رئيس القسم)",
          bg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
          glow: "shadow-[0_0_15px_rgba(99,102,241,0.3)]",
        };
      case "doctor":
        return {
          label: "دكتور المادة (محاضر)",
          bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
        };
      case "ta":
        return {
          label: "معيد السكشن (مساعد تدريس)",
          bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
          glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",
        };
      case "student":
        return {
          label: "طالب أكاديمي",
          bg: "bg-blue-500/20 text-blue-300 border-blue-500/30",
          glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",
        };
      default:
        return {
          label: userRole || "مستخدم مسجل",
          bg: "bg-white/10 text-slate-300 border-white/20",
          glow: "",
        };
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
        toast.error(
          `كلمة المرور هذه غير آمنة ومسرّبة سابقاً (${pwned.count.toLocaleString()} مرة) في اختراقات قواعد بيانات عامة. يرجى اختيار كلمة مرور أخرى.`,
        );
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
  const dashboardPath = role ? getDashboardRoute(role) : "/attendance";
  const userInitial = (profile?.full_name || fullName || "U").charAt(0).toUpperCase();
  const hasMinLength = newPassword.length >= 6;
  const hasNumbers = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordStrengthScore =
    (hasMinLength ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSpecial ? 1 : 0);
  return {
    navigate,
    dashboardPath,
    loading,
    setIsAvatarStudioOpen,
    avatarUrl,
    profile,
    fullName,
    userInitial,
    roleInfo,
    getDepartmentLabel,
    getAcademicYearLabel,
    handleSignOutConfirm,
    activeMainTab,
    setActiveMainTab,
    editingName,
    setEditingName,
    handleUpdateName,
    newName,
    setNewName,
    savingName,
    formatDisplayUsername,
    user,
    copyToClipboard,
    copiedField,
    handleRemoveAvatarDirect,
    handleChangePassword,
    showPassword,
    newPassword,
    setNewPassword,
    savingPassword,
    setShowPassword,
    passwordStrengthScore,
    showConfirmPassword,
    confirmPassword,
    setConfirmPassword,
    setShowConfirmPassword,
    isAvatarStudioOpen,
    updateAvatarUrl,
  };
}
