import { useState, useEffect } from "react";
import { Search, Trash2, UserPlus, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface UserRecord {
  id: string;
  full_name: string;
  role: string;
  national_id?: string;
  email?: string;
  created_at: string;
}

export function UserList({ role, title, onCreateClick }: { role: string; title: string; onCreateClick?: () => void }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    let query = supabase
      .from("users")
      .select("id, full_name, role, national_id, auth_id, created_at")
      .eq("role", role)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,national_id.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      setUsers((data ?? []) as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(timer);
  }, [search, role]);

  const handleDelete = async (userId: string, name: string) => {
    const { error } = await supabase.rpc("delete_user_by_id", { p_user_id: userId });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم الحذف", description: `تم حذف "${name}" نهائياً.` });
      loadUsers();
    }
  };

  return (
    <Card className="bg-card/90">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {title} ({users.length})
          </CardTitle>
          {onCreateClick && (
            <Button size="sm" onClick={onCreateClick} className="gap-1">
              <UserPlus className="h-4 w-4" /> إضافة جديد
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الرقم القومي..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
          {loading && users.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين بهذا المعيار.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                    {user.national_id || user.id.split("-")[0]}
                  </p>
                </div>
                <ConfirmAction
                  title="تأكيد الحذف"
                  description={`هل تريد حذف "${user.full_name}"؟ لا يمكن التراجع.`}
                  onConfirm={() => handleDelete(user.id, user.full_name)}
                >
                  {(trigger) => (
                    <Button variant="ghost" size="icon" onClick={trigger} className="text-destructive h-8 w-8 hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </ConfirmAction>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
