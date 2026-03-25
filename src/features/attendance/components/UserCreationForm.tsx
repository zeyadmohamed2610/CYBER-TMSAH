import { useEffect, useState } from "react";
import { BookMinus, GraduationCap, Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { userService } from "../services/userService";
import { supabase } from "@/lib/supabaseClient";

interface Subject { id: string; name: string; doctor_name: string; }

export const UserCreationForm = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Student fields — NO subject selection (students attend all subjects)
  const [sName, setSName] = useState("");
  const [sNid,  setSNid]  = useState("");
  const [sPass, setSPass] = useState("");

  // Doctor fields
  const [dName,    setDName]    = useState("");
  const [dEmail,   setDEmail]   = useState("");
  const [dPass,    setDPass]    = useState("");
  const [dSubject, setDSubject] = useState("");

  useEffect(() => {
    supabase.from("subjects").select("id, name, doctor_name").order("name")
      .then(({ data }) => {
        if (data) {
          setSubjects(data as Subject[]);
          if (data.length > 0) setDSubject(data[0].id);
        }
      });
  }, []);

  /* ─── Student submit ─── */
  const handleStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{14}$/.test(sNid.trim())) {
      toast({ variant: "destructive", title: "خطأ", description: "الرقم القومي يجب أن يكون 14 رقم." });
      return;
    }
    setSubmitting(true);
    const res = await userService.createUser({
      name: sName, national_id: sNid.trim(), password: sPass,
      role: "student", subjectId: null,   // students attend all subjects
    });
    if (res.error) toast({ variant: "destructive", title: "فشل الإنشاء", description: res.error });
    else {
      toast({ title: "تم إضافة الطالب ✓", description: `تم إضافة ${sName} بنجاح.` });
      setSName(""); setSNid(""); setSPass("");
    }
    setSubmitting(false);
  };

  /* ─── Doctor submit ─── */
  const handleDoctor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await userService.createUser({
      name: dName, email: dEmail.trim(), password: dPass,
      role: "doctor", subjectId: dSubject || null,
    });
    if (res.error) toast({ variant: "destructive", title: "فشل الإنشاء", description: res.error });
    else {
      toast({ title: "تم إضافة الدكتور ✓", description: `تم إضافة ${dName} وربطه بمادته.` });
      setDName(""); setDEmail(""); setDPass("");
      // Refresh subjects to reflect updated doctor_name
      supabase.from("subjects").select("id, name, doctor_name").order("name")
        .then(({ data }) => { if (data) setSubjects(data as Subject[]); });
    }
    setSubmitting(false);
  };

  return (
    <Card className="border-primary/30 bg-card/90" dir="rtl">
      <CardHeader>
        <CardTitle>إنشاء مستخدم جديد</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="student">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="student" className="gap-2">
              <GraduationCap className="h-4 w-4" />طالب
            </TabsTrigger>
            <TabsTrigger value="doctor" className="gap-2">
              <Stethoscope className="h-4 w-4" />دكتور
            </TabsTrigger>
          </TabsList>

          {/* ══ Student Tab — no subject required ══ */}
          <TabsContent value="student">
            <form onSubmit={handleStudent} className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم الرباعي</Label>
                <Input value={sName} onChange={e => setSName(e.target.value)}
                  placeholder="الاسم الكامل" required disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label>الرقم القومي (14 رقم)</Label>
                <Input value={sNid} onChange={e => setSNid(e.target.value)}
                  placeholder="14 رقم" inputMode="numeric" pattern="\d{14}"
                  dir="ltr" required disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input type="password" dir="ltr" value={sPass} onChange={e => setSPass(e.target.value)}
                  placeholder="6 أحرف على الأقل" required minLength={6} disabled={submitting} />
              </div>
              <p className="text-xs text-muted-foreground">
                الطالب يحضر جميع المواد — لا يحتاج تحديد مادة.
              </p>
              <Button className="w-full" type="submit" disabled={submitting || !sName || !sNid || !sPass}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                <span>إضافة الطالب</span>
              </Button>
            </form>
          </TabsContent>

          {/* ══ Doctor Tab — subject required ══ */}
          <TabsContent value="doctor">
            <form onSubmit={handleDoctor} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم الدكتور</Label>
                <Input value={dName} onChange={e => setDName(e.target.value)}
                  placeholder="الاسم الكامل" required disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" dir="ltr" value={dEmail} onChange={e => setDEmail(e.target.value)}
                  placeholder="doctor@university.edu" required disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input type="password" dir="ltr" value={dPass} onChange={e => setDPass(e.target.value)}
                  placeholder="6 أحرف على الأقل" required minLength={6} disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label>المادة المُسندة</Label>
                {subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookMinus className="h-3 w-3" />
                    أضف مادة أولاً من تبويب المواد
                  </p>
                ) : (
                  <Select value={dSubject} onValueChange={setDSubject} disabled={submitting}>
                    <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.doctor_name ? ` — ${s.doctor_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button className="w-full" type="submit"
                disabled={submitting || !dName || !dEmail || !dPass || !dSubject}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                <span>إضافة الدكتور</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
