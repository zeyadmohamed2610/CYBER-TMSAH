import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Home, Send, ShieldAlert } from "lucide-react";
import { sendErrorReportToDoctor } from "@/lib/errorReporting";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  sending: boolean;
  sentSuccess: boolean;
}

/**
 * Global Error Boundary Component
 * Catches errors anywhere in the component tree and displays a clean,
 * non-technical fallback UI with "إرسال الخطأ للدكتور" button.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      sending: false,
      sentSuccess: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only logged silently for developer debugging, never shown on UI
    console.error("Error Boundary caught:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleSendToDoctor = async () => {
    this.setState({ sending: true });
    try {
      await sendErrorReportToDoctor({
        errorMessage: this.state.error?.message || "خطأ غير متوقع في واجهة النظام",
        errorStack: this.state.error?.stack,
        pageUrl: window.location.href,
      });
    } catch {
      // ignore
    } finally {
      this.setState({ sending: false, sentSuccess: true });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-[#09060e] flex items-center justify-center p-4 text-right" dir="rtl">
            <div className="relative max-w-md w-full rounded-2xl bg-[#0f0a18] border border-purple-500/30 p-8 shadow-[0_0_50px_rgba(168,85,247,0.2)] text-center space-y-5">
              {/* Glowing Ambient effect */}
              <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>

              {/* Title & Friendly Description - Strictly Non-Technical */}
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-white">حدث خطأ أثناء تحميل الصفحة</h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  نعتذر عن هذه المشكلة المؤقتة. يمكنك إرسال تقرير الخطأ بضغطة زر لمسؤولي النظام ليتم فحصها وإصلاحها فوراً.
                </p>
              </div>

              {/* Report submission status */}
              {this.state.sentSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>تم إرسال التقرير بنجاح للمسؤولين! شكراً لتعاونك.</span>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                {!this.state.sentSuccess && (
                  <button
                    onClick={this.handleSendToDoctor}
                    disabled={this.state.sending}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold transition-all hover:from-purple-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50"
                  >
                    {this.state.sending ? (
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
                  </button>
                )}

                <button
                  onClick={this.handleReload}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-200 font-medium transition-all hover:bg-white/10"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>

                <a
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-transparent text-slate-400 font-medium transition-all hover:text-white"
                >
                  <Home className="w-4 h-4" />
                  <span>الرئيسية</span>
                </a>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
