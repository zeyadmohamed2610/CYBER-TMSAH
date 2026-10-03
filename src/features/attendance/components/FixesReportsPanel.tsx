import { getFriendlyErrorMessage } from "@/lib/academicCopy";
// src/features/attendance/components/FixesReportsPanel.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  User,
  ShieldAlert,
  Check,
  Building2,
  GraduationCap,
  History,
  Timer,
  CalendarCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

interface ErrorReport {
  id: string;
  user_name: string | null;
  user_role: string | null;
  department: string | null;
  academic_year: string | null;
  section_number: number | null;
  page_url: string | null;
  error_message: string;
  error_stack: string | null;
  status: "pending" | "resolved";
  created_at: string;
  resolved_at?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "المالك العام",
  coordinator: "رئيس قسم",
  doctor: "دكتور",
  ta: "معيد",
  student: "طالب",
};

/**
 * Calculates human-readable turnaround time between creation and resolution
 */
function formatResolutionDuration(createdAt: string, resolvedAt?: string | null): string {
  if (!resolvedAt) return "";
  const diffMs = new Date(resolvedAt).getTime() - new Date(createdAt).getTime();
  if (diffMs <= 0) return "فوراً";
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "خلال أقل من دقيقة";
  if (diffMinutes < 60) return `خلال ${diffMinutes} دقيقة`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMins = diffMinutes % 60;
  if (diffHours < 24) {
    return remainingMins > 0 ? `خلال ${diffHours} س و ${remainingMins} د` : `خلال ${diffHours} ساعة`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `خلال ${diffDays} يوم`;
}

export function FixesReportsPanel() {
  const [allReports, setAllReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Read saved filter from localStorage, defaulting to "all" so resolved items never disappear on refresh!
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">(() => {
    try {
      const saved = localStorage.getItem("cyber_fixes_reports_filter");
      if (saved === "all" || saved === "pending" || saved === "resolved") return saved;
    } catch {
      // ignore localStorage errors
    }
    return "all";
  });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  // Report history dialog
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);

  const handleFilterChange = (newFilter: "all" | "pending" | "resolved") => {
    setFilter(newFilter);
    try {
      localStorage.setItem("cyber_fixes_reports_filter", newFilter);
    } catch {
      // ignore
    }
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch all reports so counters and history stay 100% accurate regardless of active tab
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading error reports:", error);
        toast.error("فشل تحميل سجل الإصلاحات");
        setAllReports([]);
      } else {
        setAllReports((data as ErrorReport[]) || []);
      }
    } catch (err) {
      console.error(err);
      setAllReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  // Global counts that NEVER reset on tab change or refresh
  const pendingCount = useMemo(() => allReports.filter((r) => r.status === "pending").length, [allReports]);
  const resolvedCount = useMemo(() => allReports.filter((r) => r.status === "resolved").length, [allReports]);
  const totalCount = allReports.length;

  // Filtered reports for current view
  const filteredReports = useMemo(() => {
    return allReports.filter((report) => {
      if (filter !== "all" && report.status !== filter) return false;
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase();
        const matchName = (report.user_name || "").toLowerCase().includes(query);
        const matchMsg = (report.error_message || "").toLowerCase().includes(query);
        const matchPage = (report.page_url || "").toLowerCase().includes(query);
        const matchRole = (report.user_role || "").toLowerCase().includes(query);
        if (!matchName && !matchMsg && !matchPage && !matchRole) return false;
      }
      return true;
    });
  }, [allReports, filter, debouncedSearch]);

  const handleToggleStatus = async (report: ErrorReport) => {
    const newStatus = report.status === "pending" ? "resolved" : "pending";
    const resolvedTimestamp = newStatus === "resolved" ? new Date().toISOString() : null;

    // Optimistic UI update
    setAllReports((prev) =>
      prev.map((r) =>
        r.id === report.id
          ? {
              ...r,
              status: newStatus,
              resolved_at: resolvedTimestamp,
            }
          : r
      )
    );

    const { error } = await supabase
      .from("error_reports")
      .update({
        status: newStatus,
        resolved_at: resolvedTimestamp,
      })
      .eq("id", report.id);

    if (error) {
      toast.error("حدث خطأ أثناء حفظ حالة التقرير");
      void loadReports(); // Revert on error
    } else {
      toast.success(
        newStatus === "resolved"
          ? "✅ تم حفظ التقرير كـ 'تم الإصلاح' وتوثيق تاريخ الحل بنجاح"
          : "تمت إعادة المشكلة إلى 'قيد المراجعة'"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا التقرير نهائياً من السجل؟")) return;

    setAllReports((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from("error_reports").delete().eq("id", id);
    if (error) {
      toast.error("تعذر حذف البلاغ. أعد المحاولة.");
      void loadReports();
    } else {
      toast.success("تم حذف التقرير بنجاح");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              لوحة الإصلاحات وتقارير الأعطال
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                {totalCount} تقرير مسجل
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              أرشيف تاريخي متكامل لحفظ وتوثيق جميع المشكلات والأخطاء وتواريخ إصلاحها
            </p>
          </div>
        </div>

        <Button
          onClick={() => loadReports()}
          variant="outline"
          size="sm"
          className="border-white/10 hover:bg-white/5 text-slate-300 gap-2 rounded-xl"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          تحديث السجل
        </Button>
      </div>

      {/* Stats and Filter Bar - Persistent & Globally Accurate */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Pending Card */}
        <button
          onClick={() => handleFilterChange("pending")}
          className={`p-4 rounded-xl border text-right transition-all ${
            filter === "pending"
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              : "bg-card/40 border-white/5 text-slate-400 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">قيد المراجعة</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black mt-2 text-white">{pendingCount}</div>
        </button>

        {/* Resolved Card */}
        <button
          onClick={() => handleFilterChange("resolved")}
          className={`p-4 rounded-xl border text-right transition-all ${
            filter === "resolved"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              : "bg-card/40 border-white/5 text-slate-400 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">تم الإصلاح (الأرشيف)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black mt-2 text-white">{resolvedCount}</div>
        </button>

        {/* All Reports Card */}
        <button
          onClick={() => handleFilterChange("all")}
          className={`p-4 rounded-xl border text-right transition-all ${
            filter === "all"
              ? "bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
              : "bg-card/40 border-white/5 text-slate-400 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">جميع البلاغات</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black mt-2 text-white">{totalCount}</div>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم الطالب أو صاحب الحساب أو نوع المشكلة..."
          className="pr-10 bg-card/60 border-white/10 text-white placeholder:text-slate-400 rounded-xl h-11"
        />
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>جارٍ تحميل سجل البلاغات والتاريخ المحفوظ...</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card/30 border border-white/5 text-slate-400 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto" />
          <h3 className="text-base font-bold text-white">لا توجد بلاغات تطابق الفلتر الحالي</h3>
          <p className="text-xs text-slate-400">
            {filter === "pending"
              ? "لا توجد مشاكل معلقة قيد المراجعة. يمكنك الضغط على 'تم الإصلاح' أو 'جميع البلاغات' لعرض تاريخ المشاكل السابقة."
              : "لا توجد سجلات أخطاء مسجلة تطابق عملية البحث."}
          </p>
          {filter !== "all" && (
            <Button
              onClick={() => handleFilterChange("all")}
              variant="outline"
              size="sm"
              className="mt-3 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs rounded-xl"
            >
              عرض جميع البلاغات ({totalCount})
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => (
            <Card
              key={report.id}
              className={`border transition-all duration-200 overflow-hidden ${
                report.status === "pending"
                  ? "bg-card/70 border-amber-500/30 hover:border-amber-500/50"
                  : "bg-card/40 border-emerald-500/20 hover:border-emerald-500/40"
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        {report.user_name || "مستخدم مجهول"}
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {ROLE_LABELS[report.user_role || ""] || report.user_role || "مستخدم"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        {report.department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {report.department}
                          </span>
                        )}
                        {report.academic_year && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-400" />
                            {report.academic_year}
                          </span>
                        )}
                        {report.section_number && (
                          <span>سكشن {report.section_number}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Created Timestamp */}
                  <div className="flex items-center gap-2 text-left">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        report.status === "pending"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {report.status === "pending" ? "قيد المراجعة" : "تم الإصلاح"}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1" title="تاريخ ووقت حدوث المشكلة">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(report.created_at).toLocaleString("ar-EG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Issue Description (Clear & clean for owner) */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <div className="text-xs text-slate-400 font-semibold">تفاصيل المشكلة التي واجهت المستخدم:</div>
                  <div className="text-sm font-medium text-slate-200 leading-relaxed font-mono">
                    {getFriendlyErrorMessage(report.error_message, "واجه المستخدم مشكلة أثناء استخدام المنصة.")}
                  </div>
                  {report.page_url && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 truncate">
                      <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                      <span>الصفحة: {report.page_url}</span>
                    </div>
                  )}
                </div>

                {/* ── Documented Resolution History Banner ────────────────── */}
                {report.status === "resolved" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                      <CalendarCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        تاريخ حل المشكلة:{" "}
                        {report.resolved_at
                          ? new Date(report.resolved_at).toLocaleString("ar-EG", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "تم الحل بدون توثيق دقيق"}
                      </span>
                    </div>
                    {report.resolved_at && (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-bold">
                        <Timer className="w-3.5 h-3.5 text-emerald-300" />
                        {formatResolutionDuration(report.created_at, report.resolved_at)}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleToggleStatus(report)}
                      size="sm"
                      className={`rounded-xl text-xs font-bold gap-1.5 transition-all ${
                        report.status === "pending"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_12px_rgba(16,185,129,0.3)]"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {report.status === "pending" ? "تحديد كـ تم الإصلاح" : "إعادة للانتظار"}
                    </Button>

                      <Button
                        onClick={() => setSelectedReport(report)}
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-white/10 hover:bg-white/5 text-slate-300 text-xs gap-1.5"
                      >
                        <History className="w-3.5 h-3.5 text-purple-400" />
                        متابعة البلاغ
                      </Button>
                  </div>

                  <Button
                    onClick={() => handleDelete(report.id)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl text-xs gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report history dialog */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-2xl bg-[#0e0a16] border border-purple-500/30 text-right text-white">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                متابعة البلاغ
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                تاريخ تقديم البلاغ وحالة معالجته.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* Timeline Info Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">وقت الإبلاغ الأولي:</span>
                  <span className="font-semibold text-slate-200">
                    {new Date(selectedReport.created_at).toLocaleString("ar-EG", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">تاريخ ووقت الإنجاز:</span>
                  <span className="font-semibold text-emerald-300">
                    {selectedReport.resolved_at
                      ? new Date(selectedReport.resolved_at).toLocaleString("ar-EG", {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        })
                      : "لا يزال قيد المراجعة"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/60 border border-white/10 text-xs text-slate-300">
                <span className="font-bold text-white block mb-1">وصف المشكلة:</span>
                {getFriendlyErrorMessage(selectedReport.error_message, "واجه المستخدم مشكلة أثناء استخدام المنصة.")}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
