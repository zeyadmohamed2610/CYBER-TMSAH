/**
 * CreateSessionForm — lets owner or doctor pick a subject and duration,
 * then creates a live attendance session with GPS location.
 */
import { useEffect, useState } from "react";
import { MapPin, Play, Timer } from "lucide-react";
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
  onSessionCreated: (
    subjectId: string,
    durationMinutes: number,
    latitude?: number | null,
    longitude?: number | null,
    radiusMeters?: number,
  ) => void;
  creating: boolean;
  error: string | null;
}

export function CreateSessionForm({ fixedSubjectId, onSessionCreated, creating, error }: Props) {
  const [subjects, setSubjects]       = useState<Subject[]>([]);
  const [selectedId, setSelectedId]   = useState(fixedSubjectId ?? "");
  const [duration, setDuration]       = useState(10);
  const [gpsCoords, setGpsCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError]       = useState<string | null>(null);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [radius, setRadius]           = useState(50);

  useEffect(() => {
    if (fixedSubjectId) return;
    supabase.from("subjects").select("id, name, doctor_name").order("name")
      .then(({ data }) => { if (data) setSubjects(data); });
  }, [fixedSubjectId]);

  useEffect(() => {
    if (fixedSubjectId) setSelectedId(fixedSubjectId);
  }, [fixedSubjectId]);

  // Auto-capture GPS when form loads
  useEffect(() => {
    captureGps();
  }, []);

  const captureGps = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!("geolocation" in navigator)) {
      setGpsError("متصفحك لا يدعم خدمة الموقع");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.message === "User denied Geolocation prompt"
          ? "يجب تفعيل خدمة الموقع"
          : "فشل تحديد الموقع — حاول مرة أخرى");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    onSessionCreated(
      selectedId,
      duration,
      gpsCoords?.lat,
      gpsCoords?.lng,
      radius,
    );
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
          {/* Subject selector */}
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
          </div>

          {/* GPS Status */}
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                موقع الجلسة GPS
              </Label>
              {gpsCoords && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ تم التحديد</span>
              )}
            </div>

            {gpsLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse">جاري تحديد الموقع...</p>
            ) : gpsCoords ? (
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-destructive">{gpsError}</p>
                <Button type="button" variant="outline" size="sm" onClick={captureGps} className="gap-1">
                  <MapPin className="h-3 w-3" />
                  إعادة المحاولة
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Label htmlFor="radius" className="text-xs whitespace-nowrap">نصف القطر:</Label>
              <Input
                id="radius"
                type="number"
                min={10}
                max={500}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-20 h-7 text-center text-xs"
                dir="ltr"
              />
              <span className="text-xs text-muted-foreground">متر</span>
            </div>
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
