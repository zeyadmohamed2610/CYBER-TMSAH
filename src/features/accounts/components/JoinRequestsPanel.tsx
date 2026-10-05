import { DEPARTMENTS } from "@/features/academics/types";
import { supabase } from "@/shared/api/supabaseClient";
import { useLang } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { CheckCircle2, Clock, Loader2, RefreshCw, Users, UserX, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh } from "@/shared/hooks/useLiveRefresh";
import { toast } from "sonner";

interface JoinRequest {
  id: string;
  full_name: string;
  email?: string | null;
  username: string;
  role: "coordinator" | "doctor" | "ta" | "student";
  department?: string | null;
  departments?: string[];
  academic_year?: string | null;
  section_number?: number | null;
  national_id?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_note: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  coordinator: "منسق البرنامج (رئيس قسم)",
  doctor: "دكتور",
  ta: "معيد",
  student: "طالب",
};

const ROLE_LABELS_EN: Record<string, string> = {
  coordinator: "Program Coordinator",
  doctor: "Doctor",
  ta: "Teaching Assistant",
  student: "Student",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  rejected: "text-red-400 bg-red-400/10 border-red-400/20",
};

export function JoinRequestsPanel() {
  const { lang } = useLang();

  // Join Requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingJoin, setLoadingJoin] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<{ id: string; note: string } | null>(null);
  const [joinFilter, setJoinFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending",
  );

  // Counts for badges
  const [pendingJoinCount, setPendingJoinCount] = useState(0);

  const requestVersion = useRef(0);

  // Load join requests
  const loadJoinRequests = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!navigator.onLine) {
      setLoadingJoin(false);
      return false;
    }
    setLoadingJoin(true);
    try {
      let query = supabase
        .from("join_requests")
        .select(
          "id, full_name, email, username, role, department, departments, academic_year, section_number, national_id, status, created_at, rejection_note",
          { count: "exact" },
        )
        .order("created_at", { ascending: false });
      if (joinFilter !== "all") query = query.eq("status", joinFilter);
      const [list, pending] = await Promise.all([
        query,
        joinFilter === "pending"
          ? Promise.resolve(null)
          : supabase
              .from("join_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending"),
      ]);
      if (version !== requestVersion.current) return;
      if (list.error || pending?.error) {
        toast.error(
          lang === "ar"
            ? "تعذر تحديث طلبات الانضمام. احتفظنا بآخر بيانات ناجحة؛ تحقق من الاتصال."
            : "Could not refresh join requests. Previous data retained.",
        );
      }
      if (!list.error) setJoinRequests((list.data ?? []) as JoinRequest[]);
      const count = joinFilter === "pending" ? list : pending;
      if (count && !count.error && count.count !== null) setPendingJoinCount(count.count);
      return !list.error && !pending?.error;
    } catch {
      if (version === requestVersion.current)
        toast.error("تعذر الاتصال. احتفظنا بآخر بيانات ناجحة.");
      return false;
    } finally {
      if (version === requestVersion.current) setLoadingJoin(false);
    }
  }, [joinFilter, lang]);

  useEffect(() => {
    void loadJoinRequests();
    const versionRef = requestVersion;
    return () => {
      versionRef.current++;
    };
  }, [loadJoinRequests]);
  useLiveRefresh(loadJoinRequests, ["join_requests"]);

  // ── Join Requests Actions ──────────────────────────────────────────────────
  const handleApprove = async (req: JoinRequest) => {
    setProcessingId(req.id);
    try {
      const { error } = await supabase.rpc("approve_join_request", {
        p_request_id: req.id,
      });

      if (error) throw error;

      toast.success(
        lang === "ar"
          ? `تمت الموافقة على طلب ${req.full_name}`
          : `Approved ${req.full_name}'s request`,
      );
      void loadJoinRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(
        getFriendlyErrorMessage(
          lang === "ar" ? `فشل الموافقة: ${msg}` : `Approval failed: ${msg}`,
          lang === "ar"
            ? "تعذر إكمال الطلب. أعد المحاولة."
            : "Could not complete your request. Please try again.",
        ),
      );
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string, note?: string) => {
    setProcessingId(id);
    const { error } = await supabase.rpc("reject_join_request", {
      p_request_id: id,
      p_note: note ?? null,
    });
    if (error) {
      toast.error(lang === "ar" ? "فشل الرفض" : "Rejection failed");
    } else {
      toast.success(lang === "ar" ? "تم رفض الطلب" : "Request rejected");
      setRejectNote(null);
      void loadJoinRequests();
    }
    setProcessingId(null);
  };

  const joinFilters: { value: typeof joinFilter; label: string }[] = [
    { value: "pending", label: lang === "ar" ? "قيد الانتظار" : "Pending" },
    { value: "approved", label: lang === "ar" ? "المقبولة" : "Approved" },
    { value: "rejected", label: lang === "ar" ? "المرفوضة" : "Rejected" },
    { value: "all", label: lang === "ar" ? "الكل" : "All" },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      <div className="space-y-4 animate-fade-up">
        {/* Sub Header & Filters */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">
              {lang === "ar" ? `طلبات الانضمام (${pendingJoinCount})` : "Account Creation Requests"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
              {joinFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setJoinFilter(f.value)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    joinFilter === f.value
                      ? "bg-purple-600 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={loadJoinRequests}
              disabled={loadingJoin}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title={lang === "ar" ? "تحديث" : "Refresh"}
            >
              <RefreshCw className={`w-4 h-4 ${loadingJoin ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Join List */}
        {loadingJoin ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : joinRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-5 text-center text-muted-foreground">
            <Clock className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {lang === "ar" ? "لا توجد طلبات انضمام حالياً." : "No join requests found."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {joinRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 text-purple-400 font-bold text-sm">
                    {req.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">{req.full_name}</span>
                      <span className="text-xs text-muted-foreground">@{req.username}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[req.status]}`}
                      >
                        {req.status === "pending"
                          ? lang === "ar"
                            ? "قيد الانتظار"
                            : "Pending"
                          : req.status === "approved"
                            ? lang === "ar"
                              ? "مقبول"
                              : "Approved"
                            : lang === "ar"
                              ? "مرفوض"
                              : "Rejected"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="text-purple-400 font-semibold">
                        {lang === "ar" ? ROLE_LABELS[req.role] : ROLE_LABELS_EN[req.role]}
                      </span>
                      {req.email && <span className="text-cyan-400">{req.email}</span>}
                      {req.national_id && (
                        <span className="font-mono text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          {lang === "ar"
                            ? `الرقم القومي: ${req.national_id}`
                            : `NID: ${req.national_id}`}
                        </span>
                      )}
                      {req.department && (
                        <span className="text-indigo-300">
                          {lang === "ar"
                            ? `الأقسام: ${(req.departments?.length ? req.departments : [req.department]).map((id) => DEPARTMENTS.find((d) => d.id === id)?.nameAr ?? id).join("، ")}`
                            : `Dept: ${req.department}`}
                        </span>
                      )}
                      {req.academic_year && (
                        <span>
                          {lang === "ar"
                            ? `الفرقة ${req.academic_year}`
                            : `Year ${req.academic_year}`}
                        </span>
                      )}
                      {req.section_number && (
                        <span>
                          {lang === "ar"
                            ? `سكشن ${req.section_number}`
                            : `Section ${req.section_number}`}
                        </span>
                      )}
                      <span className="text-xs opacity-60">
                        {new Date(req.created_at).toLocaleDateString(
                          lang === "ar" ? "ar-EG" : "en-US",
                        )}
                      </span>
                    </div>

                    {req.rejection_note && (
                      <p className="text-xs text-red-400 mt-1">
                        {lang === "ar" ? "سبب الرفض:" : "Rejection note:"} {req.rejection_note}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {req.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      {rejectNote?.id === req.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={rejectNote.note}
                            onChange={(e) => setRejectNote({ id: req.id, note: e.target.value })}
                            placeholder={
                              lang === "ar" ? "سبب الرفض (اختياري)" : "Rejection note (optional)"
                            }
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-foreground w-40"
                          />
                          <button
                            onClick={() => handleReject(req.id, rejectNote.note)}
                            disabled={processingId === req.id}
                            className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-semibold cursor-pointer"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : lang === "ar" ? (
                              "تأكيد"
                            ) : (
                              "Confirm"
                            )}
                          </button>
                          <button
                            onClick={() => setRejectNote(null)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={processingId === req.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors font-semibold cursor-pointer"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {lang === "ar" ? "قبول" : "Approve"}
                          </button>
                          <button
                            onClick={() => setRejectNote({ id: req.id, note: "" })}
                            disabled={processingId === req.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors font-semibold cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            {lang === "ar" ? "رفض" : "Reject"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
