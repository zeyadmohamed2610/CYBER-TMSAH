import { useEffect, useState } from "react";
import { Smartphone, Trash2, RefreshCw, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { deviceWhitelistService, type WhitelistedDevice } from "../services/deviceWhitelistService";

interface StudentDevice {
  student_id: string;
  full_name: string;
  national_id: string | null;
  auth_id: string | null;
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

  // Bind device form state
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [binding, setBinding] = useState(false);

  // Local whitelisted devices
  const [whitelistedDevices, setWhitelistedDevices] = useState<WhitelistedDevice[]>([]);

  const loadWhitelistedDevices = () => {
    setWhitelistedDevices(deviceWhitelistService.getWhitelistedDevices());
  };

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, national_id, auth_id")
        .eq("role", "student")
        .order("full_name");

      if (usersError) throw usersError;

      const { data: devicesData, error: devicesError } = await supabase
        .from("student_devices")
        .select("student_id, device_fingerprint, ip_address, bound_at");

      if (devicesError) throw devicesError;

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
            auth_id: u.auth_id,
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
    loadWhitelistedDevices();
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

  const handleBindDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !deviceLabel.trim()) return;

    const student = students.find((s) => s.student_id === selectedStudentId);
    if (!student?.auth_id) {
      toast({ variant: "destructive", title: "خطأ", description: "لم يتم العثور على معرف المصادقة للطالب." });
      return;
    }

    setBinding(true);
    try {
      await deviceWhitelistService.addDevice(student.auth_id, deviceLabel.trim());
      loadWhitelistedDevices();
      setSelectedStudentId("");
      setDeviceLabel("");
      toast({ title: "تم الربط", description: `تم ربط الجهاز بالطالب ${student.full_name} بنجاح.` });
    } catch (err) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل في ربط الجهاز." });
    }
    setBinding(false);
  };

  const handleRemoveWhitelisted = (authId: string, label: string) => {
    deviceWhitelistService.removeDevice(authId);
    loadWhitelistedDevices();
    toast({ title: "تمت الإزالة", description: `تم إزالة الجهاز "${label}" من القائمة البيضاء.` });
  };

  const whitelistedAuthIds = new Set(whitelistedDevices.map((w) => w.student_auth_id));

  return (
    <div className="space-y-6">
      {/* Bind New Device Card */}
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" />
            ربط جهاز جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBindDevice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bind-student">الطالب</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger id="bind-student">
                  <SelectValue placeholder="اختر طالباً..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.student_id} value={s.student_id}>
                      {s.full_name} {s.national_id ? `(${s.national_id})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bind-label">تسمية الجهاز</Label>
              <Input
                id="bind-label"
                placeholder="مثال: لابتوب المعمل ٣"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={binding || !selectedStudentId || !deviceLabel.trim()}>
              {binding ? "جارٍ الربط..." : "ربط الجهاز"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Whitelisted Devices Card */}
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-primary" />
            الأجهزة المربوطة (قائمة بيضاء)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {whitelistedDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد أجهزة مربوطة حالياً.</p>
          ) : (
            <ul className="space-y-2">
              {whitelistedDevices.map((w) => {
                const student = students.find((s) => s.auth_id === w.student_auth_id);
                return (
                  <li
                    key={w.student_auth_id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{student?.full_name ?? w.student_auth_id}</p>
                      <p className="text-xs text-muted-foreground">الجهاز: {w.device_label}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {w.device_fingerprint.slice(0, 16)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        تاريخ الربط: {new Date(w.added_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default" className="text-xs">
                        مربوط
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveWhitelisted(w.student_auth_id, w.device_label)}
                        title="إزالة من القائمة البيضاء"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Existing Device Bindings Card */}
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-primary" />
            Student Device Bindings (Server)
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
                    <p className="font-medium">
                      {s.full_name}
                      {s.auth_id && whitelistedAuthIds.has(s.auth_id) && (
                        <Badge variant="outline" className="mr-2 text-xs">قائمة بيضاء</Badge>
                      )}
                    </p>
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
    </div>
  );
}
