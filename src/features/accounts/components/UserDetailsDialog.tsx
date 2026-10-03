import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Calendar, Check, Copy, Edit2, X } from "lucide-react";
import type { useUserManagement } from "../hooks/useUserManagement";

interface Props {
  model: ReturnType<typeof useUserManagement>;
}
export function UserDetailsDialog({ model }: Props) {
  const {
    selectedUserForDetails,
    setSelectedUserForDetails,
    getRoleLabel,
    getDepartmentLabel,
    handleCopyText,
    copiedField,
    userSubjects,
    startEdit,
  } = model;
  return (
    <Dialog
      open={Boolean(selectedUserForDetails)}
      onOpenChange={(open) => {
        if (!open) setSelectedUserForDetails(null);
      }}
    >
      <DialogContent
        className="max-w-md bg-[#0A0E1F]/98 border border-purple-500/30 text-white rounded-3xl p-6 shadow-[0_25px_70px_rgba(0,0,0,0.9)] max-h-[88vh] flex flex-col overflow-hidden [&>button:last-child]:hidden"
        dir="rtl"
      >
        {selectedUserForDetails && (
          <>
            {/* Header / Avatar */}
            <DialogHeader className="text-start pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-400 flex items-center justify-center text-white font-black text-xl shadow-[0_0_25px_rgba(168,85,247,0.4)] shrink-0">
                    {selectedUserForDetails.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-lg font-black text-white truncate">
                      {selectedUserForDetails.full_name}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {getRoleLabel(selectedUserForDetails.role)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                        {getDepartmentLabel(selectedUserForDetails.department)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Close button top-left in RTL */}
                <button
                  type="button"
                  onClick={() => setSelectedUserForDetails(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-all cursor-pointer shrink-0"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </DialogHeader>

            {/* Scrollable Info Body */}
            <div className="space-y-4 py-2 overflow-y-auto custom-scrollbar flex-1 pr-1 text-xs">
              {/* Info Grid */}
              <div className="space-y-2.5">
                {/* Username */}
                {selectedUserForDetails.username && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">اسم المستخدم</span>
                      <span className="font-mono font-bold text-purple-300 text-xs" dir="ltr">
                        @{selectedUserForDetails.username}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyText(`@${selectedUserForDetails.username}`, "اسم المستخدم")
                      }
                      className="h-8 px-2 text-slate-400 hover:text-white"
                    >
                      {copiedField === "اسم المستخدم" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Email */}
                {selectedUserForDetails.email && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-400 block text-[10px] mb-0.5">
                        البريد الإلكتروني
                      </span>
                      <span className="font-mono text-slate-200 text-xs truncate block" dir="ltr">
                        {selectedUserForDetails.email}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyText(selectedUserForDetails.email!, "البريد الإلكتروني")
                      }
                      className="h-8 px-2 text-slate-400 hover:text-white"
                    >
                      {copiedField === "البريد الإلكتروني" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Academic info if student */}
                {selectedUserForDetails.role === "student" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                      <span className="text-slate-400 block text-[10px] mb-0.5">
                        الفرقة الدراسية
                      </span>
                      <span className="font-bold text-white">
                        الفرقة {selectedUserForDetails.academic_year || "1"}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                      <span className="text-slate-400 block text-[10px] mb-0.5">رقم السكشن</span>
                      <span className="font-bold text-purple-300">
                        سكشن {selectedUserForDetails.section_number || "1"}
                      </span>
                    </div>
                  </div>
                )}

                {/* National ID if student */}
                {selectedUserForDetails.role === "student" && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">الرقم القومي</span>
                      <span className="font-mono font-bold text-amber-300 text-xs" dir="ltr">
                        {selectedUserForDetails.national_id || "غير مسجل"}
                      </span>
                    </div>
                    {selectedUserForDetails.national_id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleCopyText(selectedUserForDetails.national_id!, "الرقم القومي")
                        }
                        className="h-8 px-2 text-slate-400 hover:text-white"
                      >
                        {copiedField === "الرقم القومي" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {/* Subject if Doctor / TA / Coordinator */}
                {(selectedUserForDetails.role === "doctor" ||
                  selectedUserForDetails.role === "ta" ||
                  selectedUserForDetails.role === "coordinator") && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                    <span className="text-slate-400 block text-[10px] mb-1.5">المواد المسندة</span>
                    {(userSubjects[selectedUserForDetails.id] ?? []).length === 0 ? (
                      <span className="text-slate-500 text-xs">لم تُسند له مواد بعد</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(userSubjects[selectedUserForDetails.id] ?? []).map((s) => (
                          <span
                            key={s.id}
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Created At */}
                {selectedUserForDetails.created_at && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>تاريخ التسجيل:</span>
                    </span>
                    <span className="text-slate-300 font-mono text-[11px]" dir="ltr">
                      {new Date(selectedUserForDetails.created_at).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedUserForDetails(null)}
                className="flex-1 border-white/10 hover:bg-white/10 text-slate-200 text-xs font-bold rounded-xl h-10"
              >
                إغلاق
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const target = selectedUserForDetails;
                  setSelectedUserForDetails(null);
                  startEdit(target);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl h-10 px-4 gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل هذا الحساب</span>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
