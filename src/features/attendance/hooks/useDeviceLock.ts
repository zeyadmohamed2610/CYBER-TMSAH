import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { computeFingerprint } from "../utils/fingerprint";
import { toast } from "sonner";

export function useDeviceLock(userId: string | undefined) {
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [lockLabel, setLockLabel] = useState("");
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("device_locks")
      .select("device_label")
      .eq("student_auth_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsDeviceLocked(true);
          setLockLabel(data.device_label);
        }
      });
  }, [userId]);

  const lockDevice = useCallback(async () => {
    if (!userId) return;
    setLocking(true);
    try {
      const fp = await computeFingerprint();
      const ua = navigator.userAgent;
      const label = ua.includes("Mobile") ? "هاتف محمول" : "جهاز كمبيوتر";
      const { error } = await supabase.from("device_locks").upsert({
        student_auth_id: userId,
        device_fingerprint: fp,
        device_label: label + " - " + new Date().toLocaleDateString("ar-EG"),
      });
      if (error) throw error;
      setIsDeviceLocked(true);
      setLockLabel(label);
      toast.success("تم قفل هذا الجهاز بنجاح");
    } catch {
      toast.error("فشل قفل الجهاز");
    }
    setLocking(false);
  }, [userId]);

  return { isDeviceLocked, lockLabel, locking, lockDevice };
}
