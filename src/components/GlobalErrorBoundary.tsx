// src/components/GlobalErrorBoundary.tsx
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { triggerGlobalErrorModal } from "@/lib/errorReporting";
import { ShieldAlert, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GlobalErrorBoundary caught an error:", error, errorInfo);
    triggerGlobalErrorModal({
      message: error.message || "حدث خطأ غير متوقع في واجهة النظام",
      stack: errorInfo.componentStack || error.stack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleOpenReport = () => {
    triggerGlobalErrorModal({
      message: this.state.error?.message || "حدث خطأ غير متوقع في واجهة النظام",
      stack: this.state.error?.stack,
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0710] text-right" dir="rtl">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0f0a18] border border-purple-500/30 p-8 shadow-[0_0_50px_rgba(168,85,247,0.2)] text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">حدث خطأ أثناء عرض الصفحة</h2>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                نعتذر عن الإزعاج. فريق العمل جاهز للمساعدة، يمكنك إرسال تقرير عن هذا الخطأ للدكتور والمسؤولين لمعالجته فوراً.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Button
                onClick={this.handleOpenReport}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>إرسال الخطأ للدكتور</span>
              </Button>
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="border-white/10 hover:bg-white/5 text-slate-300 h-11 px-6 rounded-xl flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 ml-1" />
                <span>إعادة تحميل الصفحة</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
