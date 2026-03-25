import { useState } from "react";
import { BookPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { subjectService } from "../services/subjectService";
import type { Subject } from "../types";

interface SubjectCreationFormProps {
  onSubjectCreated?: (subject: Subject) => void;
}

export const SubjectCreationForm = ({ onSubjectCreated }: SubjectCreationFormProps) => {
  const { toast } = useToast();
  const [name, setName]             = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName   = name.trim();
    const trimmedDoctor = doctorName.trim();
    if (!trimmedName || !trimmedDoctor) return;

    setIsSubmitting(true);
    const result = await subjectService.createSubject(trimmedName, trimmedDoctor);

    if (result.error) {
      toast({ variant: "destructive", title: "فشل إنشاء المادة", description: result.error });
    } else {
      toast({ title: "تم إنشاء المادة", description: `تمت إضافة "${trimmedName}" بنجاح.` });
      setName(""); setDoctorName("");
      if (result.data && onSubjectCreated) onSubjectCreated(result.data);
    }
    setIsSubmitting(false);
  };

  return (
    <Card className="border-primary/30 bg-card/90" dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookPlus className="h-5 w-5" />إضافة مادة جديدة</CardTitle>
        <CardDescription>أنشئ مادة جديدة مع اسم الدكتور المسؤول عنها.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="subject-name">اسم المادة</Label>
            <Input id="subject-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مبادئ الأمن السيبراني" required disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-doctor">اسم الدكتور</Label>
            <Input id="subject-doctor" value={doctorName} onChange={(e) => setDoctorName(e.target.value)}
              placeholder="مثال: دكتور سامح مصطفي" required disabled={isSubmitting} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || !name.trim() || !doctorName.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookPlus className="h-4 w-4" />}
            إنشاء المادة
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
