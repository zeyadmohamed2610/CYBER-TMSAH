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
import { Calendar, Check, Copy, IdCard, Loader2, Mail, User } from "lucide-react";
import type { useProfile } from "../hooks/useProfile";
export function ProfileOverview({ model }: { model: ReturnType<typeof useProfile> }) {
  const {
    editingName,
    setEditingName,
    handleUpdateName,
    newName,
    setNewName,
    savingName,
    profile,
    fullName,
    formatDisplayUsername,
    user,
    copyToClipboard,
    copiedField,
  } = model;
  return (
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
                <Label className="text-xs font-bold text-slate-300">
                  الاسم الكامل (رباعي أو ثلاثي)*
                </Label>
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
                  {savingName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
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
                <span
                  className="text-sm font-mono font-bold text-cyan-200 block truncate"
                  dir="ltr"
                >
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
                      onClick={() =>
                        copyToClipboard(profile?.email || user?.email || "", "البريد الإلكتروني")
                      }
                      className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                      title="نسخ البريد"
                    >
                      {copiedField === "البريد الإلكتروني" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <span
                  className="text-xs font-mono font-bold text-slate-200 block truncate"
                  dir="ltr"
                  title={profile?.email || user?.email || ""}
                >
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
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("ar-EG")
                    : "—"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
