import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { TabsContent } from "@/shared/components/ui/tabs";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Shield } from "lucide-react";
import type { useProfile } from "../hooks/useProfile";
export function ProfilePassword({ model }: { model: ReturnType<typeof useProfile> }) {
  const {
    handleChangePassword,
    user,
    profile,
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
  } = model;
  return (
    <TabsContent value="security" className="space-y-6 mt-6">
      <Card className="border border-purple-500/20 bg-[#090D21]/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-sm">
        <CardHeader className="p-0 pb-5 border-b border-white/5">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-purple-400" />
            <span>تغيير كلمة المرور</span>
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
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
                  placeholder="أدخل كلمة مرور قوية (8 أحرف على الأقل)"
                  className="bg-black/60 border-purple-500/25 focus:border-purple-500 text-white rounded-2xl h-12 text-sm px-4 pl-12"
                  required
                  disabled={savingPassword}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">قوة كلمة المرور:</span>
                    <span
                      className={`font-bold ${passwordStrengthScore === 3 ? "text-emerald-400" : passwordStrengthScore === 2 ? "text-amber-400" : "text-rose-400"}`}
                    >
                      {passwordStrengthScore === 3
                        ? "قوية جداً"
                        : passwordStrengthScore === 2
                          ? "متوسطة"
                          : "ضعيفة"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                    <div
                      className={`h-full rounded-full transition-all ${passwordStrengthScore >= 1 ? "bg-rose-500" : "bg-white/10"}`}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${passwordStrengthScore >= 2 ? "bg-amber-500" : "bg-white/10"}`}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${passwordStrengthScore >= 3 ? "bg-emerald-500" : "bg-white/10"}`}
                    />
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
                  aria-label={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
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
  );
}
