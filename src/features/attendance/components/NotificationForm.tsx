import { useState } from "react";
import { BellPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notificationService } from "../services/notificationService";
import { toast } from "sonner";

interface Props {
  createdBy: string;
  onAdded?: () => void;
}

export function NotificationForm({ createdBy, onAdded }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"exam" | "quiz" | "reminder" | "announcement">("exam");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) return;

    setSubmitting(true);
    notificationService.add({
      title,
      body,
      type,
      date,
      time,
      subject: subject || undefined,
      createdBy,
    });

    toast.success("تمت إضافة الإشعار بنجاح");
    setTitle("");
    setBody("");
    setDate("");
    setTime("");
    setSubject("");
    setSubmitting(false);
    onAdded?.();
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellPlus className="h-4 w-4 text-primary" />
          إضافة إشعار جديد
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>نوع الإشعار</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">📝 امتحان</SelectItem>
                  <SelectItem value="quiz">❓ كويز</SelectItem>
                  <SelectItem value="reminder">⏰ تذكير</SelectItem>
                  <SelectItem value="announcement">📢 إعلان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المادة (اختياري)</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: مبادئ الأمن السيبراني"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: امتحان نصف الفصل"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>التفاصيل (اختياري)</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="مثال: الامتحان يشمل الفصول من 1 إلى 5"
              rows={3}
              className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>الوقت</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={submitting || !title || !date || !time}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
            {submitting ? "جاري الإضافة..." : "إضافة الإشعار"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
