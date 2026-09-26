// src/features/attendance/components/JoinRequestsPanel.tsx
import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, Clock, Loader2, UserX, XCircle, RefreshCw,
  Users, KeyRound, Mail, Send, Copy, Ban, Check, Phone, ExternalLink, MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/i18n";

interface JoinRequest {
  id: string;
  full_name: string;
  email?: string | null;
  username: string;
  role: "coordinator" | "doctor" | "ta" | "student";
  department?: string | null;
  academic_year?: string | null;
  section_number?: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_note: string | null;
}

interface PasswordResetRequest {
  id: string;
  email: string;
  phone: string | null;
  status: "pending" | "resolved" | "dismissed";
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
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
  resolved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  dismissed: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

export function JoinRequestsPanel() {
  const { lang } = useLang();

  // Main Section: 'join' | 'password_reset'
  const [activeTab, setActiveTab] = useState<"join" | "password_reset">("join");

  // Join Requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingJoin, setLoadingJoin] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<{ id: string; note: string } | null>(null);
  const [joinFilter, setJoinFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  // Password Reset Requests state
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [loadingReset, setLoadingReset] = useState(true);
  const [resetFilter, setResetFilter] = useState<"pending" | "resolved" | "dismissed" | "all">("pending");
  const [processingResetId, setProcessingResetId] = useState<string | null>(null);

  // Counts for badges
  const [pendingJoinCount, setPendingJoinCount] = useState(0);
  const [pendingResetCount, setPendingResetCount] = useState(0);

  // Load join requests
  const loadJoinRequests = useCallback(async () => {
    setLoadingJoin(true);
    const query = supabase
      .from("join_requests")
      .select("*")
      .order("created_at", { ascending: false });

    let finalJoinQuery = query;
    if (joinFilter !== "all") finalJoinQuery = query.eq("status", joinFilter);


    const { data, error } = await finalJoinQuery;
    if (error) {
      toast.error(lang === "ar" ? "فشل تحميل طلبات الانضمام" : "Failed to load join requests");
    } else {
      setJoinRequests((data ?? []) as JoinRequest[]);
    }
    setLoadingJoin(false);

    // Get pending count
    const { count } = await supabase
      .from("join_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingJoinCount(count ?? 0);
  }, [joinFilter, lang]);

  // Load password reset requests
  const loadResetRequests = useCallback(async () => {
    setLoadingReset(true);
    const query = supabase
      .from("password_reset_requests")
      .select("*")
      .order("created_at", { ascending: false });

    let finalResetQuery = query;
    if (resetFilter !== "all") finalResetQuery = query.eq("status", resetFilter);


    const { data, error } = await finalResetQuery;
    if (error) {
      toast.error(lang === "ar" ? "فشل تحميل طلبات استعادة المرور" : "Failed to load password reset requests");
    } else {
      setResetRequests((data ?? []) as PasswordResetRequest[]);
    }
    setLoadingReset(false);

    // Get pending count
    const { count } = await supabase
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingResetCount(count ?? 0);
  }, [resetFilter, lang]);

  useEffect(() => {
    void loadJoinRequests();
    void loadResetRequests();
  }, [loadJoinRequests, loadResetRequests]);

  // ── Join Requests Actions ──────────────────────────────────────────────────
  const handleApprove = async (req: JoinRequest) => {
    setProcessingId(req.id);
    try {
      const { error } = await supabase.rpc("approve_join_request", {
        p_request_id: req.id,
      });

      if (error) throw error;

      toast.success(lang === "ar"
        ? `تمت الموافقة على طلب ${req.full_name}`
        : `Approved ${req.full_name}'s request`
      );
      void loadJoinRequests();
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
      void loadJoinRequests();
    }
    setProcessingId(null);
  };

  // ── Password Reset Requests Actions ────────────────────────────────────────
  const handleResolveReset = async (id: string) => {
    setProcessingResetId(id);
    const { error } = await supabase
      .from("password_reset_requests")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error(lang === "ar" ? "تعذر تحديث حالة الطلب" : "Failed to update status");
    } else {
      toast.success(lang === "ar" ? "تم تحديد الطلب كـ منتهي/تم التعامل" : "Request marked as resolved");
      void loadResetRequests();
    }
    setProcessingResetId(null);
  };

  const handleSendResetEmail = async (id: string, email: string) => {
    setProcessingResetId(id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      // Mark as resolved
      await supabase
        .from("password_reset_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          notes: "تم إرسال رابط الاستعادة إلى البريد",
        })
        .eq("id", id);

      toast.success(lang === "ar" ? `تم إرسال رابط إعادة التعيين إلى ${email}` : `Reset link dispatched to ${email}`);
      void loadResetRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error sending link";
      toast.error(lang === "ar" ? `فشل إرسال الرابط: ${msg}` : `Failed: ${msg}`);
    } finally {
      setProcessingResetId(null);
    }
  };

  const handleDismissReset = async (id: string) => {
    setProcessingResetId(id);
    const { error } = await supabase
      .from("password_reset_requests")
      .update({
        status: "dismissed",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error(lang === "ar" ? "تعذر تجاهل الطلب" : "Failed to dismiss");
    } else {
      toast.success(lang === "ar" ? "تم تجاهل الطلب" : "Request dismissed");
      void loadResetRequests();
    }
    setProcessingResetId(null);
  };

  const joinFilters: { value: typeof joinFilter; label: string }[] = [
    { value: "pending",  label: lang === "ar" ? "قيد الانتظار" : "Pending" },
    { value: "approved", label: lang === "ar" ? "المقبولة" : "Approved" },
    { value: "rejected", label: lang === "ar" ? "المرفوضة" : "Rejected" },
    { value: "all",      label: lang === "ar" ? "الكل" : "All" },
  ];

  const resetFilters: { value: typeof resetFilter; label: string }[] = [
    { value: "pending",   label: lang === "ar" ? "قيد الانتظار" : "Pending" },
    { value: "resolved",  label: lang === "ar" ? "تم الحل" : "Resolved" },
    { value: "dismissed", label: lang === "ar" ? "تم التجاهل" : "Dismissed" },
    { value: "all",       label: lang === "ar" ? "الكل" : "All" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Top Level Section Tabs (Join vs Password Reset) ──────────────── */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("join")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "join"
              ? "bg-purple-600 text-white shadow-[0_4px_16px_rgba(147,51,234,0.35)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{lang === "ar" ? "طلبات الانضمام" : "Join Requests"}</span>
          {pendingJoinCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-400/20 text-amber-300 font-black border border-amber-400/30">
              {pendingJoinCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password_reset")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "password_reset"
              ? "bg-purple-600 text-white shadow-[0_4px_16px_rgba(147,51,234,0.35)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>{lang === "ar" ? "استعادة كلمة المرور" : "Password Reset Requests"}</span>
          {pendingResetCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-400/25 text-purple-200 font-black border border-purple-400/40">
              {pendingResetCount}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. JOIN REQUESTS SUB-PANEL                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "join" && (
        <div className="space-y-4 animate-fade-up">
          {/* Sub Header & Filters */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">
                {lang === "ar" ? "قائمة طلبات إنشاء الحسابات" : "Account Creation Requests"}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter tabs */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
                {joinFilters.map(f => (
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : joinRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <Clock className="w-10 h-10 opacity-30" />
              <p className="text-sm">{lang === "ar" ? "لا توجد طلبات انضمام حالياً." : "No join requests found."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {joinRequests.map(req => (
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
                        <span className="text-purple-400 font-semibold">{lang === "ar" ? ROLE_LABELS[req.role] : ROLE_LABELS_EN[req.role]}</span>
                        {req.email && <span className="text-cyan-400">{req.email}</span>}
                        {req.department && <span className="text-indigo-300">{lang === "ar" ? `القسم: ${req.department}` : `Dept: ${req.department}`}</span>}
                        {req.academic_year && <span>{lang === "ar" ? `الفرقة ${req.academic_year}` : `Year ${req.academic_year}`}</span>}
                        {req.section_number && <span>{lang === "ar" ? `سكشن ${req.section_number}` : `Section ${req.section_number}`}</span>}
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
                              className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-semibold cursor-pointer"
                            >
                              {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "تأكيد" : "Confirm")}
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
                              {processingId === req.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3.5 h-3.5" />
                              }
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
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. PASSWORD RESET REQUESTS SUB-PANEL                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "password_reset" && (
        <div className="space-y-4 animate-fade-up">
          {/* Sub Header & Filters */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">
                {lang === "ar" ? "طلبات استعادة كلمة المرور عبر Gmail" : "Gmail Password Recovery Requests"}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter tabs */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
                {resetFilters.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setResetFilter(f.value)}
                    className={`px-3 py-1.5 font-semibold transition-colors ${
                      resetFilter === f.value
                        ? "bg-purple-600 text-white"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={loadResetRequests}
                disabled={loadingReset}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                title={lang === "ar" ? "تحديث" : "Refresh"}
              >
                <RefreshCw className={`w-4 h-4 ${loadingReset ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Guide Banner for Admin Workflow */}
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3 text-xs text-purple-200">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-300 font-bold mt-0.5">
              💡
            </div>
            <div className="leading-relaxed">
              <span className="font-bold text-white block mb-0.5">
                {lang === "ar" ? "خطوات استعادة وتعيين كلمة المرور للمستخدمين:" : "Password Recovery Workflow:"}
              </span>
              {lang === "ar"
                ? "١. توجه لتبويب 'إدارة المستخدمين' أو 'الطلاب/المعيدين/الدكاترة' وعدّل كلمة مرور الحساب بالباسوورد الجديد وانسخه. ٢. اضغط زر 'مراسلة واتساب' بالأسفل لإرسال البيانات الجديدة للشخص فوراً. ٣. أو اضغط 'إرسال الرابط' إذا كان المستخدم يفضل التعيين الذاتي عبر البريد."
                : "1. Go to the Users list, set a new password, copy it. 2. Click 'WhatsApp' below to send credentials directly. 3. Or click 'Send Link' for automated reset."}
            </div>
          </div>

          {/* Reset List */}
          {loadingReset ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : resetRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <KeyRound className="w-10 h-10 opacity-30" />
              <p className="text-sm">{lang === "ar" ? "لا توجد طلبات استعادة كلمة مرور حالياً." : "No password reset requests found."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resetRequests.map(req => {
                const rawDigits = (req.phone || "").replace(/\D/g, "");
                const waDigits = rawDigits.startsWith("01")
                  ? "2" + rawDigits
                  : rawDigits.startsWith("20")
                  ? rawDigits
                  : rawDigits.length > 0
                  ? "20" + rawDigits
                  : "";
                const waMessage = encodeURIComponent(
                  `مرحباً بك في منصة CYBER TMSAH 🐊\nبخصوص طلبك لاستعادة الحساب:\nالبريد: ${req.email}\nكلمة المرور الجديدة المؤقتة: \n\n(يرجى تسجيل الدخول وتغييرها من ملفك الشخصي فوراً)`
                );
                const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${waMessage}` : null;

                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {/* User info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 text-purple-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white select-all" dir="ltr">
                              {req.email}
                            </span>
                            {req.phone && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" dir="ltr">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                {req.phone}
                              </span>
                            )}
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[req.status]}`}>
                              {req.status === "pending"
                                ? (lang === "ar" ? "قيد الانتظار" : "Pending")
                                : req.status === "resolved"
                                  ? (lang === "ar" ? "تم الحل" : "Resolved")
                                  : (lang === "ar" ? "تم التجاهل" : "Dismissed")
                              }
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{new Date(req.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                            {req.notes && (
                              <span className="text-purple-300">({req.notes})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* 1-Click WhatsApp Direct Chat */}
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold transition-all shadow-[0_2px_10px_rgba(16,185,129,0.3)] cursor-pointer"
                            title={lang === "ar" ? "مراسلة المستخدم عبر واتساب بالبيانات الجديدة" : "Message user on WhatsApp"}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{lang === "ar" ? "مراسلة واتساب" : "WhatsApp"}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        )}

                        {/* Copy email */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(req.email);
                            toast.success(lang === "ar" ? "تم نسخ البريد" : "Email copied");
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                          title={lang === "ar" ? "نسخ الإيميل" : "Copy email"}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{lang === "ar" ? "نسخ البريد" : "Copy Email"}</span>
                        </button>

                        {/* Copy phone if exists */}
                        {req.phone && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(req.phone || "");
                              toast.success(lang === "ar" ? "تم نسخ رقم الهاتف" : "Phone copied");
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                            title={lang === "ar" ? "نسخ رقم الواتساب" : "Copy phone"}
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">{lang === "ar" ? "نسخ الهاتف" : "Copy Phone"}</span>
                          </button>
                        )}

                        {req.status === "pending" && (
                          <>
                            {/* Send Reset Email directly (Option 2) */}
                            <button
                              type="button"
                              disabled={processingResetId === req.id}
                              onClick={() => handleSendResetEmail(req.id, req.email)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-500 font-semibold transition-all shadow-[0_2px_8px_rgba(147,51,234,0.3)] cursor-pointer disabled:opacity-50"
                              title={lang === "ar" ? "إرسال رابط استعادة إلى البريد تلقائياً" : "Dispatch reset link"}
                            >
                              {processingResetId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>{lang === "ar" ? "إرسال الرابط" : "Send Link"}</span>
                            </button>

                            {/* Mark Resolved */}
                            <button
                              type="button"
                              disabled={processingResetId === req.id}
                              onClick={() => handleResolveReset(req.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                              title={lang === "ar" ? "تحديد كـ تم الحل بعد مراسلة المستخدم" : "Mark resolved"}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "تم الحل" : "Resolved"}</span>
                            </button>

                            {/* Dismiss */}
                            <button
                              type="button"
                              disabled={processingResetId === req.id}
                              onClick={() => handleDismissReset(req.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                              title={lang === "ar" ? "تجاهل الطلب" : "Dismiss"}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "تجاهل" : "Dismiss"}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
