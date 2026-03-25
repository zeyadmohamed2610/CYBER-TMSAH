/**
 * CreateSessionForm — lets owner or doctor pick a subject and duration,
 * then creates a live attendance session.
 */
import { useEffect, useState } from "react";
import { Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";

interface Subject {
  id: string;
  name: string;
  doctor_name: string;
}

interface Props {
  /** If provided (doctor), only their subject is available */
  fixedSubjectId?: string;
  onSessionCreated: (subjectId: string, durationMinutes: number) => void;
  creating: boolean;
  error: string | null;
}

export function CreateSessionForm({ fixedSubjectId, onSessionCreated, creating, error }: Props) {
  const [subjects, setSubjects]       = useState<Subject[]>([]);
  const [selectedId, setSelectedId]   = useState(fixedSubjectId ?? "");
  const [duration, setDuration]       = useState(10);

  useEffect(() => {
    if (fixedSubjectId) return; // doctor: no need to fetch all subjects
    supabase.from("subjects").select("id, name, doctor_name").order("name")
      .then(({ data }) => { if (data) setSubjects(data); });
  }, [fixedSubjectId]);

  useEffect(() => {
    if (fixedSubjectId) setSelectedId(fixedSubjectId);
  }, [fixedSubjectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    onSessionCreated(selectedId, duration);
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="h-4 w-4 text-primary" />
          إنشاء جلسة حضور جديدة
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Subject selector — hidden for doctors (only one subject) */}
          {!fixedSubjectId && (
            <div className="space-y-2">
              <Label>المادة الدراسية</Label>
              <Select value={selectedId} onValueChange={setSelectedId} required>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المادة..." />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.doctor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="session-duration">
              <Timer className="inline h-3 w-3 ml-1" />
              مدة التسجيل (بالدقائق)
            </Label>
            <Input
              id="session-duration"
              type="number"
              min={1}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-32"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              الحد الأقصى 180 دقيقة — الكود والـ QR يتجددان كل دقيقة تلقائياً
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full gap-2" disabled={creating || !selectedId}>
            <Play className="h-4 w-4" />
            {creating ? "جاري الإنشاء..." : "بدء الجلسة"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
