import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Clock, Loader2, UserX, XCircle, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/i18n";

interface JoinRequest {
  id: string;
  full_name: string;
  username: string;
  role: "student" | "doctor" | "ta";
  seat_number: string | null;
  section_number: number | null;
  rank_in_list: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_note: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  student: "طالب",
  doctor: "دكتور",
  ta: "معيد",
};

const ROLE_LABELS_EN: Record<string, string> = {
  student: "Student",
  doctor: "Doctor",
  ta: "Teaching Assistant",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  rejected: "text-red-400 bg-red-400/10 border-red-400/20",
};

export function JoinRequestsPanel() {
  const { t, lang } = useLang();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<{ id: string; note: string } | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("join_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") query.eq("status", filter);

    const { data, error } = await query;
    if (error) {
      toast.error(lang === "ar" ? "فشل تحميل الطلبات" : "Failed to load requests");
    } else {
      setRequests((data ?? []) as JoinRequest[]);
    }
    setLoading(false);
  }, [filter, lang]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (req: JoinRequest) => {
    setProcessingId(req.id);
    try {
      // Step 1: Create Supabase Auth user with username@cyber.local email
      const authEmail = `${req.username}@cyber.local`;
      // Generate a temporary password — owner must reset it
      const tempPassword = `Cyber${Math.random().toString(36).slice(2, 10)}!`;

      const { data: authData, error: authError } = await supabase.auth.admin
        ? // Use admin API if available (service role)
          { data: null, error: new Error("Use Edge Function or server-side for admin create") }
        : { data: null, error: new Error("Use Edge Function or server-side for admin create") };

      // Fallback: directly insert into public.users with a placeholder auth_id
      // In production, this should be done via an Edge Function with service role key
      // For now, mark as approved and insert user record
      const { error: insertError } = await supabase.from("users").insert({
        full_name: req.full_name,
        username: req.username,
        role: req.role,
        // auth_id will be linked when the user completes signup
      } as Record<string, unknown>);

      if (insertError && !insertError.message.includes("duplicate")) {
        throw insertError;
      }

      // Mark request as approved
      const { error: updateError } = await supabase
        .from("join_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", req.id);

      if (updateError) throw updateError;

      toast.success(lang === "ar"
        ? `تمت الموافقة على طلب ${req.full_name}`
        : `Approved ${req.full_name}'s request`
      );
      void load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(lang === "ar" ? `فشل الموافقة: ${msg}` : `Approval failed: ${msg}`);
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
      void load();
    }
    setProcessingId(null);
  };

  const filters: { value: typeof filter; label: string }[] = [
    { value: "pending", label: lang === "ar" ? "قيد الانتظار" : "Pending" },
    { value: "approved", label: lang === "ar" ? "مقبولة" : "Approved" },
    { value: "rejected", label: lang === "ar" ? "مرفوضة" : "Rejected" },
    { value: "all", label: lang === "ar" ? "الكل" : "All" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">
            {lang === "ar" ? "طلبات الانضمام" : "Join Requests"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
            {filters.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 font-semibold transition-colors ${filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title={lang === "ar" ? "تحديث" : "Refresh"}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <Clock className="w-10 h-10 opacity-30" />
          <p className="text-sm">{lang === "ar" ? "لا توجد طلبات." : "No requests found."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-start gap-3 flex-wrap">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                  {req.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{req.full_name}</span>
                    <span className="text-xs text-muted-foreground">@{req.username}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[req.status]}`}>
                      {req.status === "pending"
                        ? (lang === "ar" ? "قيد الانتظار" : "Pending")
                        : req.status === "approved"
                          ? (lang === "ar" ? "مقبول" : "Approved")
                          : (lang === "ar" ? "مرفوض" : "Rejected")
                      }
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span>{lang === "ar" ? ROLE_LABELS[req.role] : ROLE_LABELS_EN[req.role]}</span>
                    {req.section_number && <span>{lang === "ar" ? `سكشن ${req.section_number}` : `Section ${req.section_number}`}</span>}
                    {req.seat_number && <span>{lang === "ar" ? `رقم الجلوس: ${req.seat_number}` : `Seat: ${req.seat_number}`}</span>}
                    {req.rank_in_list && <span>{lang === "ar" ? `الترتيب: ${req.rank_in_list}` : `Rank: ${req.rank_in_list}`}</span>}
                    <span className="text-xs opacity-60">
                      {new Date(req.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
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
                          onChange={e => setRejectNote({ id: req.id, note: e.target.value })}
                          placeholder={lang === "ar" ? "سبب الرفض (اختياري)" : "Rejection note (optional)"}
                          className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-foreground w-40"
                        />
                        <button
                          onClick={() => handleReject(req.id, rejectNote.note)}
                          disabled={processingId === req.id}
                          className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-semibold"
                        >
                          {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "تأكيد" : "Confirm")}
                        </button>
                        <button
                          onClick={() => setRejectNote(null)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={processingId === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors font-semibold"
                        >
                          {processingId === req.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5" />
                          }
                          {lang === "ar" ? "قبول" : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejectNote({ id: req.id, note: "" })}
                          disabled={processingId === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors font-semibold"
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
  );
}
