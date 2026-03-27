import { useEffect, useState } from "react";
import { Smartphone, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface StudentDevice {
  student_id: string;
  full_name: string;
  national_id: string | null;
  device_fingerprint: string | null;
  ip_address: string | null;
  bound_at: string | null;
}

export function StudentDevicesPanel() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Fetch students
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, national_id")
        .eq("role", "student")
        .order("full_name");

      if (usersError) throw usersError;

      // Fetch devices separately (avoids nested select RLS issues)
      const { data: devicesData, error: devicesError } = await supabase
        .from("student_devices")
        .select("student_id, device_fingerprint, ip_address, bound_at");

      if (devicesError) throw devicesError;

      // Merge in JS
      const deviceMap = new Map(
        (devicesData ?? []).map((d) => [d.student_id, d]),
      );

      setStudents(
        (usersData ?? []).map((u) => {
          const device = deviceMap.get(u.id);
          return {
            student_id: u.id,
            full_name: u.full_name,
            national_id: u.national_id,
            device_fingerprint: device?.device_fingerprint ?? null,
            ip_address: device?.ip_address ?? null,
            bound_at: device?.bound_at ?? null,
          };
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load devices";
      setErrorMessage(msg);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleClear = async (studentId: string, name: string) => {
    setClearing(studentId);
    const { error } = await supabase.rpc("delete_student_device", { p_student_id: studentId });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Cleared", description: `Device unlinked from ${name}. They can now login from a new device.` });
      void load();
    }
    setClearing(null);
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" />
          Student Device Bindings
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="mr-auto">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : errorMessage ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li
                key={s.student_id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.national_id ?? "\u2014"}</p>
                  {s.device_fingerprint ? (
                    <p className="text-xs text-muted-foreground">
                      IP: {s.ip_address ?? "\u2014"} &middot; Bound:{" "}
                      {s.bound_at ? new Date(s.bound_at).toLocaleDateString("en-GB") : "\u2014"}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.device_fingerprint ? (
                    <>
                      <Badge variant="default" className="text-xs">
                        Bound
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={clearing === s.student_id}
                        onClick={() => handleClear(s.student_id, s.full_name)}
                        title="Unlink device"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Not Bound
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
