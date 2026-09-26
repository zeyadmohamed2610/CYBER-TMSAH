// src/features/attendance/components/FixesReportsPanel.tsx
import { useState, useEffect, useCallback } from "react";
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
  Code,
  Check,
  Building2,
  GraduationCap
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
  user_name: string;
  user_role: string;
  department: string | null;
  academic_year: string | null;
  section_number: number | null;
  page_url: string | null;
  error_message: string;
  error_stack: string | null;
  status: "pending" | "resolved";
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "المالك العام",
  coordinator: "رئيس قسم",
  doctor: "دكتور",
  ta: "معيد",
  student: "طالب",
};

export function FixesReportsPanel() {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Technical details dialog
  const [selectedTechReport, setSelectedTechReport] = useState<ErrorReport | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("error_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      if (debouncedSearch) {
        query = query.or(`user_name.ilike.%${debouncedSearch}%,error_message.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading error reports:", error);
        toast.error("فشل تحميل سجل الإصلاحات");
        setReports([]);
      } else {
        setReports((data as ErrorReport[]) || []);
      }
    } catch (err) {
      console.error(err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleToggleStatus = async (report: ErrorReport) => {
    const newStatus = report.status === "pending" ? "resolved" : "pending";
    const { error } = await supabase
      .from("error_reports")
      .update({
        status: newStatus,
        resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", report.id);

    if (error) {
      toast.error("حدث خطأ أثناء تحديث حالة التقرير");
    } else {
      toast.success(newStatus === "resolved" ? "تم تحديد المشكلة كـ تم الإصلاح ✓" : "تمت إعادة المشكلة إلى قيد المراجعة");
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: newStatus } : r))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("error_reports").delete().eq("id", id);
    if (error) {
      toast.error("فشل حذف التقرير");
    } else {
      toast.success("تم حذف التقرير بنجاح");
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

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
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {reports.length} تقرير
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              متابعة جميع المشكلات والأخطاء التي يرسلها الطلاب والدكاترة والمعيدون
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

      {/* Stats and Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setFilter("pending")}
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

        <button
          onClick={() => setFilter("resolved")}
          className={`p-4 rounded-xl border text-right transition-all ${
            filter === "resolved"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              : "bg-card/40 border-white/5 text-slate-400 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">تم الإصلاح</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black mt-2 text-white">{resolvedCount}</div>
        </button>

        <button
          onClick={() => setFilter("all")}
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
          <div className="text-2xl font-black mt-2 text-white">{reports.length}</div>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم الطالب أو صاحب الحساب أو نوع المشكلة..."
          className="pr-10 bg-card/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
        />
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>جارٍ تحميل سجل البلاغات...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card/30 border border-white/5 text-slate-400 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto" />
          <h3 className="text-base font-bold text-white">لا توجد بلاغات أخطاء حالياً</h3>
          <p className="text-xs text-slate-500">النظام يعمل بكفاءة تامة دون أي مشاكل معلقة.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className={`border transition-all duration-200 overflow-hidden ${
                report.status === "pending"
                  ? "bg-card/70 border-amber-500/30 hover:border-amber-500/50"
                  : "bg-card/40 border-white/5 opacity-80"
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
                          {ROLE_LABELS[report.user_role] || report.user_role || "مستخدم"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        {report.department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {report.department}
                          </span>
                        )}
                        {report.academic_year && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-500" />
                            {report.academic_year}
                          </span>
                        )}
                        {report.section_number && (
                          <span>سكشن {report.section_number}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Timestamp */}
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
                    <span className="text-[11px] text-slate-500">
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
                  <div className="text-sm font-medium text-slate-200 leading-relaxed">
                    {report.error_message}
                  </div>
                  {report.page_url && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span>الصفحة: {report.page_url}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleToggleStatus(report)}
                      size="sm"
                      className={`rounded-xl text-xs font-bold gap-1.5 ${
                        report.status === "pending"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {report.status === "pending" ? "تحديد كـ تم الإصلاح" : "إعادة للانتظار"}
                    </Button>

                    {report.error_stack && (
                      <Button
                        onClick={() => setSelectedTechReport(report)}
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-white/10 hover:bg-white/5 text-slate-300 text-xs gap-1.5"
                      >
                        <Code className="w-3.5 h-3.5 text-purple-400" />
                        التفاصيل التقنية (للمطور)
                      </Button>
                    )}
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

      {/* Technical Details Modal for Owner */}
      {selectedTechReport && (
        <Dialog open={!!selectedTechReport} onOpenChange={() => setSelectedTechReport(null)}>
          <DialogContent className="max-w-2xl bg-[#0e0a16] border border-purple-500/30 text-right text-white">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-400" />
                التقرير التقني للأعطال (Stack Trace)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                هذه التفاصيل مخصصة للمطور وتساعد في العثور على موضع الخلل بدقة.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-black/60 border border-white/10 text-xs text-slate-300">
                <span className="font-bold text-white block mb-1">رسالة الخطأ الأصلية:</span>
                {selectedTechReport.error_message}
              </div>

              {selectedTechReport.error_stack && (
                <div className="p-3 rounded-lg bg-black/80 border border-purple-500/20 max-h-60 overflow-y-auto font-mono text-[11px] text-purple-300/90 whitespace-pre-wrap dir-ltr text-left">
                  {selectedTechReport.error_stack}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
