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
  Loader2,
  Calendar,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "@/features/attendance/context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";
import { DEPARTMENTS, ACADEMIC_YEARS } from "@/features/attendance/types";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
  const { user, role, fullName, refreshRole } = useAttendanceAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);

  // Edit Name State
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
        const { data, error } = await supabase
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

        if (error) {
          console.error("Error fetching user profile:", error);
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
        return { label: "المالك العام (Owner)", bg: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
      case "coordinator":
        return { label: "منسق البرنامج (رئيس القسم)", bg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" };
      case "doctor":
        return { label: "دكتور المادة (محاضر)", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
      case "ta":
        return { label: "معيد السكشن (مساعد تدريس)", bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" };
      case "student":
        return { label: "طالب", bg: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      default:
        return { label: userRole || "مستخدم", bg: "bg-white/10 text-slate-300 border-white/20" };
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

  const roleInfo = getRoleBadge(profile?.role || role || "");
  const dashboardPath = role ? getAttendanceDashboardRoute(role) : "/attendance";
  const userInitial = (profile?.full_name || fullName || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-[#050711] text-white selection:bg-purple-500/30 selection:text-purple-200" dir="rtl">
      <Navbar />

      <main id="main-content" className="flex-1 py-8 sm:py-12 section-container">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Top Bar with Back Navigation */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                <User className="w-7 h-7 text-purple-400" />
                <span>الملف الشخصي والحساب</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                إدارة بيانات الحساب الأكاديمي، الأمان، وتغيير كلمة المرور
              </p>
            </div>

            <Button
              onClick={() => navigate(dashboardPath)}
              variant="outline"
              className="border-white/10 bg-card/60 hover:bg-white/10 text-white rounded-xl text-xs sm:text-sm font-bold gap-2"
            >
              <span>العودة للوحة التحكم</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm text-slate-400">جاري تحميل بيانات الملف الشخصي...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Account Card Summary */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="border border-purple-500/25 bg-[#0A0E1F]/90 backdrop-blur-xl rounded-3xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
                  <div className="h-24 bg-gradient-to-r from-purple-700/40 via-indigo-700/30 to-purple-900/40 relative border-b border-white/10">
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shadow-sm bg-black/40 border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>نشط ومفعل</span>
                      </span>
                    </div>
                  </div>

                  <CardContent className="pt-0 relative px-6 pb-6 text-center">
                    <div className="-mt-12 mb-4 inline-flex">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 p-0.5 shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                        <div className="w-full h-full bg-[#0A0E1F] rounded-2xl flex items-center justify-center text-white font-black text-3xl">
                          {userInitial}
                        </div>
                      </div>
                    </div>

                    <h2 className="text-lg font-black text-white truncate">
                      {profile?.full_name || fullName || "مستخدم مسجل"}
                    </h2>

                    {profile?.username && (
                      <p className="text-xs font-mono text-purple-300 mt-1" dir="ltr">
                        @{profile.username}
                      </p>
                    )}

                    <div className="mt-3 flex justify-center">
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${roleInfo.bg}`}>
                        {roleInfo.label}
                      </span>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/10 space-y-3 text-start text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>البريد:</span>
                        </span>
                        <span className="font-mono text-slate-200 truncate max-w-[150px]" dir="ltr">
                          {profile?.email || user?.email || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>القسم:</span>
                        </span>
                        <span className="text-white font-medium">
                          {getDepartmentLabel(profile?.department)}
                        </span>
                      </div>

                      {profile?.academic_year && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                            <span>الفرقة:</span>
                          </span>
                          <span className="text-purple-300 font-bold">
                            {getAcademicYearLabel(profile.academic_year)}
                          </span>
                        </div>
                      )}

                      {profile?.section_number && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-slate-500" />
                            <span>السكشن:</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5 text-white font-bold">
                            سكشن {profile.section_number}
                          </span>
                        </div>
                      )}

                      {profile?.subject_name && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>المادة:</span>
                          </span>
                          <span className="text-purple-200 font-bold truncate max-w-[150px]">
                            {profile.subject_name}
                          </span>
                        </div>
                      )}

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
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Actions (Edit info & Change Password) */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Account Details & Name Form */}
                <Card className="border border-white/10 bg-[#0A0E1F]/80 backdrop-blur-xl rounded-3xl p-6 shadow-lg">
                  <CardHeader className="p-0 pb-4">
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <User className="w-5 h-5 text-purple-400" />
                      <span>البيانات الأساسية</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      الاسم المعروض في السجلات والتقارير الأكاديمية
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-0 space-y-4">
                    {editingName ? (
                      <form onSubmit={handleUpdateName} className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-300">الاسم الكامل (رباعي أو ثلاثي)*</Label>
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-black/50 border-white/10 text-white rounded-xl h-11"
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
                            className="text-slate-400 hover:text-white rounded-xl text-xs h-9"
                          >
                            إلغاء
                          </Button>
                          <Button
                            type="submit"
                            disabled={savingName}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs h-9 px-4 gap-1.5"
                          >
                            {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            <span>حفظ التعديل</span>
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">الاسم الحالي</span>
                          <span className="text-base font-bold text-white">
                            {profile?.full_name || fullName || "—"}
                          </span>
                        </div>
                        <Button
                          onClick={() => setEditingName(true)}
                          variant="outline"
                          size="sm"
                          className="border-purple-500/30 hover:bg-purple-600/10 text-purple-300 rounded-xl text-xs font-bold"
                        >
                          تعديل الاسم
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[11px] text-slate-400 block mb-1">اسم المستخدم (@username)</span>
                        <span className="text-sm font-mono font-bold text-purple-300" dir="ltr">
                          {profile?.username ? `@${profile.username}` : "—"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[11px] text-slate-400 block mb-1">البريد الإلكتروني المسجل</span>
                        <span className="text-sm font-mono font-bold text-slate-200 truncate block" dir="ltr">
                          {profile?.email || user?.email || "—"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Change Password Form */}
                <Card className="border border-purple-500/20 bg-[#0A0E1F]/80 backdrop-blur-xl rounded-3xl p-6 shadow-lg">
                  <CardHeader className="p-0 pb-4">
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-purple-400" />
                      <span>تغيير كلمة المرور</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      قم بتحديث كلمة المرور لحماية حسابك والوصول الآمن للنظام
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-0">
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-300">كلمة المرور الجديدة*</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="6 أحرف على الأقل"
                            className="bg-black/50 border-white/10 text-white rounded-xl h-11 pl-10"
                            required
                            disabled={savingPassword}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-300">تأكيد كلمة المرور الجديدة*</Label>
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="أعد إدخال كلمة المرور"
                          className="bg-black/50 border-white/10 text-white rounded-xl h-11"
                          required
                          disabled={savingPassword}
                        />
                      </div>

                      <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/15 flex items-start gap-2.5 text-xs text-slate-300">
                        <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>
                          يتم تشفير كلمات المرور باستخدام خوارزميات أمان متقدمة. تأكد من حفظها جيداً حتى تتمكن من تسجيل الدخول دائماً.
                        </span>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          type="submit"
                          disabled={savingPassword}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl h-11 px-6 shadow-[0_4px_20px_rgba(124,58,237,0.3)] gap-2"
                        >
                          {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-4 h-4" />}
                          <span>تحديث كلمة المرور</span>
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
