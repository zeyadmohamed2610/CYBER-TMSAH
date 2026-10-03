import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { TabsContent } from "@/shared/components/ui/tabs";
import { Camera, Trash2 } from "lucide-react";
import type { useProfile } from "../hooks/useProfile";
export function ProfileAvatar({ model }: { model: ReturnType<typeof useProfile> }) {
  const { setIsAvatarStudioOpen, avatarUrl, userInitial, handleRemoveAvatarDirect } = model;
  return (
    <TabsContent value="avatar" className="space-y-6 mt-6">
      <Card className="border border-purple-500/25 bg-[#090D21]/80 backdrop-blur-xl rounded-3xl p-4 sm:p-7 shadow-lg">
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
  );
}
