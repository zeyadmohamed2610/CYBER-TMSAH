import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { userService, type CreateUserInput, type CreatedUser } from "../services/userService";
import { supabase } from "@/lib/supabaseClient";

interface Subject { id: string; name: string; doctor_name: string; }
interface UserCreationFormProps { onUserCreated?: (user: CreatedUser) => void; }

export const UserCreationForm = ({ onUserCreated }: UserCreationFormProps) => {
  const { toast } = useToast();
  const [name, setName]             = useState("");
  const [identifier, setIdentifier] = useState(""); // national_id or email depending on role
  const [password, setPassword]     = useState("");
  const [role, setRole]             = useState<"doctor" | "student">("student");
  const [subjectId, setSubjectId]   = useState<string>("");
  const [subjects, setSubjects]     = useState<Subject[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("subjects").select("id, name, doctor_name").order("name")
      .then(({ data }) => {
        if (data) {
          setSubjects(data as Subject[]);
          if (data.length > 0) setSubjectId(data[0].id);
        }
      });
  }, []);

  const isStudent = role === "student";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const input: CreateUserInput = {
      name:        name.trim(),
      national_id: isStudent ? identifier.trim() : undefined,
      email:       isStudent ? undefined : identifier.trim(),
      password,
      role,
      subjectId:   subjectId || null,
    };

    const result = await userService.createUser(input);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل إنشاء المستخدم", description: result.error });
    } else {
      toast({ title: "تم إنشاء المستخدم", description: `تم إنشاء حساب ${isStudent ? "الطالب" : "الدكتور"} ${name}.` });
      setName(""); setIdentifier(""); setPassword("");
      if (onUserCreated && result.data) onUserCreated(result.data);
    }
    setIsSubmitting(false);
  };

  return (
    <Card className="border-primary/30 bg-card/90" dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />إنشاء مستخدم جديد</CardTitle>
        <CardDescription>
          {isStudent ? "يسجل الطالب دخوله بالرقم القومي وكلمة المرور." : "يسجل الدكتور دخوله بالبريد الإلكتروني."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => { setRole(v as "doctor" | "student"); setIdentifier(""); }} disabled={isSubmitting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">طالب</SelectItem>
                <SelectItem value="doctor">دكتور</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الاسم الرباعي</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" required disabled={isSubmitting} />
          </div>

          <div className="space-y-2">
            <Label>{isStudent ? "الرقم القومي (14 رقم)" : "البريد الإلكتروني"}</Label>
            <Input
              type={isStudent ? "text" : "email"}
              inputMode={isStudent ? "numeric" : undefined}
              dir="ltr"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={isStudent ? "رقم قومي 14 رقم" : "example@university.edu"}
              pattern={isStudent ? "\\d{14}" : undefined}
              title={isStudent ? "يجب أن يكون 14 رقماً" : undefined}
              required disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>كلمة المرور</Label>
            <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل" required minLength={8} disabled={isSubmitting} />
          </div>

          <div className="space-y-2">
            <Label>المادة الدراسية</Label>
            {subjects.length > 0 ? (
              <Select value={subjectId} onValueChange={setSubjectId} disabled={isSubmitting}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.doctor_name ? ` — ${s.doctor_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">لا توجد مواد. أنشئ مادة أولاً.</p>
            )}
          </div>

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            <span>{isSubmitting ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
