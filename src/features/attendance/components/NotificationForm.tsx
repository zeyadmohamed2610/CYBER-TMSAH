import { useState } from "react";
import { BellPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface Props {
  createdBy: string;
  onAdded?: () => void;
}

export function NotificationForm({ createdBy, onAdded }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("exam");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setSubmitting(true);

    const { data: authData } = await supabase.auth.getUser();
    const authId = authData.user?.id;

    if (!authId) {
      toast.error("خطأ: تعذر التعرف على حسابك الحالي لإرسال الإشعار.");
      setSubmitting(false);
      return;
    }

    // Fetch the correct public.users ID to satisfy the foreign key constraint
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .single();

    if (!userData?.id) {
      toast.error("خطأ: لم يتم العثور على ملف المستخدم العام الخاص بك.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      type,
      created_by: userData.id,
      user_id: userData.id,
    };
    if (body) payload.body = body;
    if (subject) payload.subject = subject;
    // Only send date/time if specified (otherwise it's an instant notification)
    if (date) payload.notify_date = date;
    if (time) payload.notify_time = time;

    const { error } = await supabase.from("notifications").insert(payload);

    if (error) {
      toast.error("فشل الإضافة: " + error.message);
    } else {
      toast.success("تم إرسال وتفعيل الإشعار بنجاح!");
      setTitle(""); setBody(""); setDate(""); setTime(""); setSubject("");
      onAdded?.();
    }
    setSubmitting(false);
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellPlus className="h-4 w-4 text-primary" />
          إضافة اشعار منبه
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select id="notification-type" value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">امتحان</SelectItem>
                  <SelectItem value="quiz">كويز</SelectItem>
                  <SelectItem value="reminder">تذكير</SelectItem>
                  <SelectItem value="announcement">اعلان فوري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المادة (اختياري)</Label>
              <Input id="notification-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثال: مبادئ الامن السيبراني" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input id="notification-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: امتحان نصف الفصل" required />
          </div>
          <div className="space-y-2">
            <Label>التفاصيل (اختياري)</Label>
            <textarea id="notification-body" value={body} onChange={e => setBody(e.target.value)} placeholder="مثال: الامتحان يشمل الفصول من 1 الى 5" rows={2}
              className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-primary/5 p-3 border border-primary/20">
            <div className="col-span-full">
              <p className="text-xs text-muted-foreground font-medium mb-1">
                تنبيه: اترك الوقت والتاريخ فارغاً إذا كنت تريد إرسال الإشعار وتفعيل المنبه للطلاب فوراً الآن!
              </p>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الإشعار (اختياري)</Label>
              <Input id="notification-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>وقت المنبه (اختياري)</Label>
              <Input id="notification-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={submitting || !title}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
            {submitting ? "جاري الاضافة" : "اضافة الإشعار الآن"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
