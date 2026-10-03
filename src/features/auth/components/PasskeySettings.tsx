import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  Loader2,
  Lock,
  Shield,
  Trash2,
} from "lucide-react";
import { MAX_PASSKEYS, type usePasskeySettings } from "../hooks/usePasskeySettings";

interface Props {
  model: ReturnType<typeof usePasskeySettings>;
  username: string | null;
}
export function PasskeySettings({ model, username }: Props) {
  const {
    passkeys,
    loadingPasskeys,
    passkeysLoadFailed,
    setPasskeysRefresh,
    deletingPasskeyId,
    renamingPasskey,
    setRenamingPasskey,
    passkeyName,
    setPasskeyName,
    savingPasskeyName,
    creatingPasskey,
    passkeyDestination,
    preparedPasskey,
    testingPasskeyId,
    isPasskeyAuthModalOpen,
    setIsPasskeyAuthModalOpen,
    passkeyAuthPassword,
    setPasskeyAuthPassword,
    showPasskeyAuthPassword,
    setShowPasskeyAuthPassword,
    verifyingPasskeyPassword,
    handleInitiatePasskeyCreation,
    handleVerifyPasswordAndCreatePasskey,
    handleTestPasskey,
    handleDeletePasskey,
    handleRenamePasskey,
    user,
  } = model;
  return (
    <>
      <Card className="border border-purple-500/25 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-4 sm:p-7 shadow-lg">
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
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${
                  passkeys.length >= MAX_PASSKEYS
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {passkeys.length} من {MAX_PASSKEYS} مفاتيح مسجلة
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-6 space-y-5">
          {loadingPasskeys ? (
            <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل مفاتيح الدخول...
            </p>
          ) : passkeysLoadFailed ? (
            <div role="alert" className="space-y-3 py-4">
              <p className="text-sm text-slate-300">تعذر تحميل مفاتيح الدخول.</p>
              <Button variant="outline" onClick={() => setPasskeysRefresh((value) => value + 1)}>
                إعادة المحاولة
              </Button>
            </div>
          ) : passkeys.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                <Fingerprint className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-bold text-white">لا توجد مفاتيح دخول بعد</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  أضف مفتاحًا لتسجيل الدخول بالبصمة أو الوجه أو رمز قفل جهازك.
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
                      <p className="text-xs text-slate-400 mt-1">
                        آخر استخدام:{" "}
                        {pk.lastUsedAt
                          ? new Date(pk.lastUsedAt).toLocaleString("ar-EG")
                          : "لم يُستخدم بعد"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mr-auto sm:mr-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 text-xs"
                      onClick={() => {
                        setRenamingPasskey(pk);
                        setPasskeyName(pk.label);
                      }}
                    >
                      تعديل الاسم
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestPasskey(pk.id)}
                      disabled={
                        testingPasskeyId !== null || deletingPasskeyId !== null || creatingPasskey
                      }
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
                      disabled={
                        deletingPasskeyId !== null || testingPasskeyId !== null || creatingPasskey
                      }
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs min-h-11 min-w-11 rounded-xl px-2.5"
                      title="إزالة الجهاز"
                      aria-label="إزالة الجهاز"
                    >
                      {deletingPasskeyId === pk.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-purple-400 shrink-0" />
              <span>يمكنك إضافة أكثر من مفتاح لحسابك.</span>
            </div>

            <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto">
              <Button
                type="button"
                onClick={() => handleInitiatePasskeyCreation("device")}
                disabled={
                  loadingPasskeys ||
                  passkeysLoadFailed ||
                  creatingPasskey ||
                  deletingPasskeyId !== null ||
                  passkeys.length >= MAX_PASSKEYS
                }
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
                    <span>إضافة مفتاح دخول</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-xs text-slate-300 whitespace-normal"
                disabled={
                  loadingPasskeys ||
                  passkeysLoadFailed ||
                  creatingPasskey ||
                  deletingPasskeyId !== null ||
                  passkeys.length >= MAX_PASSKEYS
                }
                onClick={() => handleInitiatePasskeyCreation("any")}
              >
                جهاز آخر أو مفتاح أمان
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPasskeyAuthModalOpen} onOpenChange={setIsPasskeyAuthModalOpen}>
        <DialogContent
          className="sm:max-w-md bg-[#0D122B] border border-purple-500/30 text-white rounded-3xl p-6"
          dir="rtl"
        >
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto sm:mx-0 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                تأكيد إضافة مفتاح الدخول
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 mt-1 leading-relaxed">
                {passkeyDestination === "device"
                  ? "سيُحفظ المفتاح على جهازك الحالي أو في مدير كلمات المرور المتاح عليه."
                  : "ستختار مكان حفظ المفتاح من خيارات المتصفح، بما فيها جهاز آخر أو مفتاح أمان."}{" "}
                أكّد كلمة مرور حسابك للمتابعة.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleVerifyPasswordAndCreatePasskey} className="space-y-4 pt-2">
            {/* Hidden username input for browser accessibility and password manager compliance */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user?.email || username || ""}
              readOnly
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />

            {!preparedPasskey ? (
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
                    {showPasskeyAuthPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p
                role="status"
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm leading-7 text-emerald-200"
              >
                تم تأكيد كلمة المرور. اضغط الآن لفتح نافذة جهازك وحفظ مفتاح الدخول.
              </p>
            )}

            <DialogFooter className="flex-col sm:flex-row-reverse gap-2 sm:gap-0 pt-2">
              <Button
                type="submit"
                disabled={
                  verifyingPasskeyPassword ||
                  creatingPasskey ||
                  (!preparedPasskey && !passkeyAuthPassword.trim())
                }
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
                    <span>
                      {preparedPasskey
                        ? passkeyDestination === "device"
                          ? "حفظ على هذا الجهاز"
                          : "اختيار مكان الحفظ"
                        : "تأكيد ومتابعة البصمة"}
                    </span>
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
      <Dialog
        open={Boolean(renamingPasskey)}
        onOpenChange={(open) => {
          if (!open && !savingPasskeyName) setRenamingPasskey(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>اسم مفتاح الدخول</DialogTitle>
            <DialogDescription>اختر اسمًا يساعدك على تمييز هذا المفتاح.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenamePasskey} className="space-y-4">
            <Label htmlFor="passkey-name">الاسم</Label>
            <Input
              id="passkey-name"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              maxLength={80}
              required
              autoFocus
            />
            <Button type="submit" disabled={savingPasskeyName || !passkeyName.trim()}>
              {savingPasskeyName ? "جارٍ الحفظ…" : "حفظ الاسم"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
