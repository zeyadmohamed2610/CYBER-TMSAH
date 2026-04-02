import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

interface Subject { id: string; name: string; }

// Zod validation schemas
const studentSchema = z.object({
  name: z.string().min(5, "الاسم يجب أن يكون 5 أحرف على الأقل"),
  nationalId: z.string().regex(/^\d{14}$/, "الرقم القومي يجب أن يكون 14 رقم"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

const doctorSchema = z.object({
  name: z.string().min(5, "الاسم يجب أن يكون 5 أحرف على الأقل"),
  email: z.string().email("يرجى إدخال بريد إلكتروني صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  subjectId: z.string().min(1, "يرجى اختيار مادة"),
});

type StudentFormData = z.infer<typeof studentSchema>;
type DoctorFormData = z.infer<typeof doctorSchema>;

export const UserCreationForm = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // React Hook Form for Student
  const studentForm = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", nationalId: "", password: "" },
  });

  // React Hook Form for Doctor
  const doctorForm = useForm<DoctorFormData>({
    resolver: zodResolver(doctorSchema),
    defaultValues: { name: "", email: "", password: "", subjectId: "" },
  });
  const { setValue } = doctorForm;

  useEffect(() => {
    supabase.from("subjects").select("id, name")
      .then(({ data }) => {
        if (data) {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
          setSubjects(sorted as Subject[]);
          if (sorted.length > 0) setValue("subjectId", sorted[0].id);
        }
      });
  }, [setValue]);

  /* ─── Student submit ─── */
  const onStudentSubmit = async (data: StudentFormData) => {
    setSubmitting(true);
    const res = await userService.createUser({
      name: data.name, national_id: data.nationalId.trim(), password: data.password,
      role: "student", subjectId: null,
    });
    if (res.error) toast({ variant: "destructive", title: "فشل الإنشاء", description: res.error });
    else {
      toast({ title: "تم إضافة الطالب ✓", description: `تم إضافة ${data.name} بنجاح.` });
      studentForm.reset();
    }
    setSubmitting(false);
  };

  /* ─── Doctor submit ─── */
  const onDoctorSubmit = async (data: DoctorFormData) => {
    setSubmitting(true);
    const res = await userService.createUser({
      name: data.name, email: data.email.trim(), password: data.password,
      role: "doctor", subjectId: data.subjectId || null,
    });
    if (res.error) toast({ variant: "destructive", title: "فشل الإنشاء", description: res.error });
    else {
      toast({ title: "تم إضافة الدكتور ✓", description: `تم إضافة ${data.name} وربطه بمادته.` });
      doctorForm.reset();
      // Refresh subjects to reflect updated doctor_name
      supabase.from("subjects").select("id, name, doctor_name")
        .then(({ data }) => { 
          if (data) {
            const sorted = data.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            setSubjects(sorted as Subject[]); 
          }
        });
    }
    setSubmitting(false);
  };

  const studentErrors = studentForm.formState.errors;
  const doctorErrors = doctorForm.formState.errors;

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
            <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-name">الاسم الرباعي</Label>
                <Input
                  id="student-name"
                  {...studentForm.register("name")}
                  placeholder="الاسم الكامل"
                  disabled={submitting}
                />
                {studentErrors.name && (
                  <p className="text-xs text-destructive">{studentErrors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-national-id">الرقم القومي (14 رقم)</Label>
                <Input
                  id="student-national-id"
                  {...studentForm.register("nationalId")}
                  placeholder="14 رقم"
                  inputMode="numeric"
                  dir="ltr"
                  disabled={submitting}
                />
                {studentErrors.nationalId && (
                  <p className="text-xs text-destructive">{studentErrors.nationalId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-password">كلمة المرور</Label>
                <Input
                  id="student-password"
                  type="password"
                  dir="ltr"
                  {...studentForm.register("password")}
                  placeholder="8 أحرف على الأقل"
                  disabled={submitting}
                />
                {studentErrors.password && (
                  <p className="text-xs text-destructive">{studentErrors.password.message}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                الطالب يحضر جميع المواد — لا يحتاج تحديد مادة.
              </p>
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                <span>إضافة الطالب</span>
              </Button>
            </form>
          </TabsContent>

          {/* ══ Doctor Tab — subject required ══ */}
          <TabsContent value="doctor">
            <form onSubmit={doctorForm.handleSubmit(onDoctorSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doctor-name">اسم الدكتور</Label>
                <Input
                  id="doctor-name"
                  {...doctorForm.register("name")}
                  placeholder="الاسم الكامل"
                  disabled={submitting}
                />
                {doctorErrors.name && (
                  <p className="text-xs text-destructive">{doctorErrors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-email">البريد الإلكتروني</Label>
                <Input
                  id="doctor-email"
                  type="email"
                  dir="ltr"
                  {...doctorForm.register("email")}
                  placeholder="doctor@university.edu"
                  disabled={submitting}
                />
                {doctorErrors.email && (
                  <p className="text-xs text-destructive">{doctorErrors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-password">كلمة المرور</Label>
                <Input
                  id="doctor-password"
                  type="password"
                  dir="ltr"
                  {...doctorForm.register("password")}
                  placeholder="8 أحرف على الأقل"
                  disabled={submitting}
                />
                {doctorErrors.password && (
                  <p className="text-xs text-destructive">{doctorErrors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-subject">المادة المُسندة</Label>
                {subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookMinus className="h-3 w-3" />
                    أضف مادة أولاً من تبويب المواد
                  </p>
                ) : (
                  <Select
                    id="doctor-subject"
                    value={doctorForm.watch("subjectId")}
                    onValueChange={(val) => doctorForm.setValue("subjectId", val)}
                    disabled={submitting}
                  >
                    <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {doctorErrors.subjectId && (
                  <p className="text-xs text-destructive">{doctorErrors.subjectId.message}</p>
                )}
              </div>
              <Button className="w-full" type="submit" disabled={submitting}>
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
