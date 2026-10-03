import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Loader2, Plus, Search, Users, X } from "lucide-react";
import { useUserManagement } from "../hooks/useUserManagement";
import { CreateUserForm } from "./CreateUserForm";
import { UserDetailsDialog } from "./UserDetailsDialog";
import { UserRow } from "./UserRow";
export function UserList({
  role: initialRole = "all",
  title = "المستخدمون",
}: {
  role?: string;
  title?: string;
}) {
  const model = useUserManagement(initialRole);
  const {
    users,
    setShowCreate,
    showCreate,
    allowedRoles,
    getRoleLabel,
    filterRole,
    setFilterRole,
    setEditingId,
    setDeleteConfirm,
    search,
    setSearch,
    loading,
    filteredUsers,
    currentPage,
    totalPages,
    setPageNumber,
  } = model;
  return (
    <Card
      className="bg-card/70 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl"
      dir="rtl"
    >
      <CardHeader className="p-5 border-b border-white/10 bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                {title}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {users.length}
                </span>
              </CardTitle>
              <p className="text-xs text-slate-400">
                كل الحسابات في قائمة واحدة؛ اختر الرتبة أو ابحث عن الحساب.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className={`gap-2 rounded-xl font-bold transition-all ${
              showCreate
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            }`}
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "إغلاق النموذج" : "إضافة حساب يدوياً"}
          </Button>
        </div>
      </CardHeader>

      <div
        className="flex flex-wrap gap-2 p-4"
        role="group"
        aria-label="تصفية المستخدمين حسب الرتبة"
      >
        {[
          { id: "all", label: "الكل" },
          ...allowedRoles.map((id) => ({ id, label: getRoleLabel(id) })),
        ].map((item) => (
          <Button
            key={item.id}
            variant={filterRole === item.id ? "default" : "outline"}
            aria-pressed={filterRole === item.id}
            className="min-h-11"
            onClick={() => {
              setFilterRole(item.id);
              setEditingId(null);
              setDeleteConfirm(null);
            }}
          >
            {item.label}{" "}
            <span className="mr-2 text-xs">
              {users.filter((account) => item.id === "all" || account.role === item.id).length}
            </span>
          </Button>
        ))}
      </div>
      <CardContent className="p-5 space-y-5">
        {/* Manual Creation Form */}
        {showCreate && <CreateUserForm model={model} />}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="بحث بالاسم أو اسم المستخدم أو البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-black/40 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
          />
        </div>

        {/* Users List */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              <span>جارٍ تحميل المستخدمين...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white/[0.02] border border-white/5 rounded-2xl">
              <Users className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-300">
                {search
                  ? "لا توجد نتائج مطابقة لبحثك."
                  : `لا يوجد مستخدمون مسجلون في قائمة ${title} بعد.`}
              </p>
            </div>
          ) : (
            filteredUsers
              .slice((currentPage - 1) * 25, currentPage * 25)
              .map((user, idx) => <UserRow model={model} user={user} idx={idx} key={user.id} />)
          )}
        </div>
      </CardContent>

      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
          <span>
            {filteredUsers.length} حساب · صفحة {currentPage} من {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setPageNumber(currentPage - 1)}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setPageNumber(currentPage + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}

      {/* User Details Modal (rendered via Radix Dialog for perfect viewport centering) */}
      <UserDetailsDialog model={model} />
    </Card>
  );
}
