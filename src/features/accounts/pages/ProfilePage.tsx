import Footer from "@/app/layouts/Footer";
import Navbar from "@/app/layouts/Navbar";
import AvatarStudioDialog from "@/features/accounts/components/AvatarStudioDialog";
import { PasskeySettings } from "@/features/auth/components/PasskeySettings";
import { usePasskeySettings } from "@/features/auth/hooks/usePasskeySettings";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ArrowLeft, Camera, Fingerprint, KeyRound, Loader2, LogOut, User } from "lucide-react";
import { ProfileOverview } from "../components/ProfileOverview";
import { ProfilePassword } from "../components/ProfilePassword";
import { useProfile } from "../hooks/useProfile";
export default function ProfilePage() {
  const model = useProfile();
  const passkeySettings = usePasskeySettings();
  const {
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
    user,
    isAvatarStudioOpen,
    updateAvatarUrl,
  } = model;
  return (
    <div
      className="min-h-screen flex flex-col bg-[#050713] text-white selection:bg-purple-500/30 selection:text-purple-200"
      dir="rtl"
    >
      <Navbar />

      <main id="main-content" className="flex-1 py-6 sm:py-10 section-container relative z-10">
        <div className="max-w-5xl mx-auto space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">الملف الشخصي والحساب</h1>
              <p className="text-sm text-muted-foreground mt-1">بياناتك وصورتك وإعدادات الدخول.</p>
            </div>
            <Button
              onClick={() => navigate(dashboardPath)}
              variant="outline"
              className="min-h-11 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              العودة للوحة التحكم
            </Button>
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <p className="text-sm font-medium text-slate-400">جاري تحميل بيانات الحساب...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <section
                className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 sm:p-5"
                aria-label="ملخص الحساب"
              >
                <button
                  type="button"
                  aria-label="تغيير الصورة الشخصية"
                  className="relative h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => setIsAvatarStudioOpen(true)}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile?.full_name || fullName || "الصورة الشخصية"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-primary">{userInitial}</span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-black/65 py-1 flex justify-center">
                    <Camera className="h-4 w-4" />
                  </span>
                </button>
                <div className="flex-1 min-w-[160px] space-y-1">
                  <h2 className="text-lg font-bold break-words">
                    {profile?.full_name || fullName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {roleInfo.label}
                    {profile?.department
                      ? ` · ${(profile.departments?.length ? profile.departments : [profile.department]).map((d) => getDepartmentLabel(d)).join("، ")}`
                      : ""}
                  </p>
                  {profile?.academic_year && (
                    <p className="text-sm text-muted-foreground">
                      {getAcademicYearLabel(profile.academic_year)}
                      {profile.section_number ? ` · سكشن ${profile.section_number}` : ""}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSignOutConfirm}
                  className="sm:basis-auto text-rose-400 min-h-11 gap-2 justify-start sm:justify-center"
                >
                  <LogOut className="h-4 w-4" />
                  تسجيل الخروج
                </Button>
              </section>

              {/* MAIN CONTENT: Tabs for Settings & Configuration */}
              <div className="space-y-6">
                <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                  {/* Modern Navigation Tabs Header */}
                  <TabsList className="w-full grid grid-cols-1 min-[400px]:grid-cols-3 bg-card p-1.5 rounded-2xl h-auto border border-border gap-1">
                    <TabsTrigger
                      value="overview"
                      className="rounded-xl text-sm font-semibold py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>البيانات الأساسية</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="security"
                      className="rounded-xl text-sm font-semibold py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>كلمة المرور</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="passkeys"
                      className="rounded-xl text-sm font-semibold py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none gap-1.5"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>الدخول بالبصمة</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: OVERVIEW / PERSONAL INFO */}
                  <ProfileOverview model={model} />

                  {/* TAB 3: SECURITY & PASSWORD */}
                  <ProfilePassword model={model} />

                  {/* TAB 4: PASSKEYS / WEBAUTHN */}
                  <TabsContent value="passkeys" className="mt-0">
                    <PasskeySettings model={passkeySettings} username={profile?.username ?? null} />
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

      <Footer />
    </div>
  );
}
