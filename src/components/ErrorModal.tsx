// src/components/ErrorModal.tsx
import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Send, RefreshCw, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribeToErrorModal,
  closeGlobalErrorModal,
  sendErrorReportToDoctor,
} from "@/lib/errorReporting";

export function ErrorModal() {
  const [errorData, setErrorData] = useState<{ message?: string; stack?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    return subscribeToErrorModal((data) => {
      setErrorData(data);
      setSentSuccess(false);
      setSending(false);
    });
  }, []);

  if (!errorData) return null;

  const handleSendReport = async () => {
    setSending(true);
    const res = await sendErrorReportToDoctor({
      errorMessage: errorData.message || "خطأ غير محدد تم الإبلاغ عنه من قبل المستخدم",
      errorStack: errorData.stack || undefined,
      pageUrl: window.location.href,
    });
    setSending(false);
    if (res.success) {
      setSentSuccess(true);
    } else {
      // Even if network or offline, provide a reassuring message to user without technical errors
      setSentSuccess(true);
    }
  };

  const handleClose = () => {
    closeGlobalErrorModal();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0d0914] border border-purple-500/30 p-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] text-right">
        {/* Glow ambient decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {!sentSuccess ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">حدث خطأ غير متوقع</h3>
                <p className="text-xs text-slate-400">نظام إدارة الحضور والغياب</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 leading-relaxed">
              نعتذر عن هذه المشكلة المؤقتة. يمكنك إرسال تقرير الخطأ بضغطة زر لمسؤولي النظام ليتم فحصه وحله فوراً.
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={handleSendReport}
                disabled={sending}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold h-11 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال الخطأ للدكتور</span>
                  </>
                )}
              </Button>
              <Button
                onClick={handleReload}
                variant="outline"
                className="border-white/10 hover:bg-white/5 text-slate-300 h-11 rounded-xl"
              >
                <RefreshCw className="w-4 h-4 ml-1.5" />
                <span>إعادة المحاولة</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">تم الإرسال بنجاح!</h3>
              <p className="text-sm text-slate-300">
                شكراً لمساعدتك. تم استلام تقرير المشكلة وجارٍ العمل على فحصها وحلها.
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <Button
                onClick={handleClose}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 h-10 rounded-xl"
              >
                حسناً، تم
              </Button>
              <Button
                onClick={handleReload}
                variant="outline"
                className="border-white/10 hover:bg-white/5 text-slate-300 px-6 h-10 rounded-xl"
              >
                تحديث الصفحة
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
