import { supabase } from "@/shared/api/supabaseClient";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { computeFingerprint } from "../../../shared/lib/deviceFingerprint";

export function useDeviceLock(userId: string | undefined) {
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [hasDeviceLock, setHasDeviceLock] = useState(false);
  const [lockLabel, setLockLabel] = useState("");
  const [locking, setLocking] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setIsDeviceLocked(false);
    setHasDeviceLock(false);
    setLockLabel("");
    setChecking(true);
    setError("");
    const check = async () => {
      if (!userId) return;
      const { data, error: failure } = await supabase
        .from("device_locks")
        .select("device_label, device_fingerprint")
        .eq("student_auth_id", userId)
        .maybeSingle();
      if (failure) throw failure;
      const matches = data ? data.device_fingerprint === (await computeFingerprint()) : false;
      if (active) {
        setHasDeviceLock(Boolean(data));
        setIsDeviceLocked(matches);
        setLockLabel(data?.device_label || "");
      }
    };
    void check()
      .catch(() => {
        if (active) setError("تعذر التحقق من جهاز الحضور. أعد المحاولة.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [userId, revision]);

  const lockDevice = useCallback(async () => {
    if (!userId || locking) return;
    setLocking(true);
    try {
      const fingerprint = await computeFingerprint();
      const label =
        (navigator.userAgent.includes("Mobile") ? "هاتف محمول" : "جهاز كمبيوتر") +
        " - " +
        new Date().toLocaleDateString("ar-EG");
      const { data, error: failure } = await supabase.rpc("lock_student_device", {
        p_fingerprint: fingerprint,
        p_label: label,
      });
      if (failure || !data?.success) throw failure ?? new Error("Device registration rejected");
      toast.success("تم تسجيل جهاز الحضور بنجاح");
      retry();
    } catch {
      toast.error("تعذر تسجيل هذا الجهاز للحضور. أعد المحاولة أو تواصل مع إدارة المنصة.");
    } finally {
      setLocking(false);
    }
  }, [userId, locking, retry]);

  return { isDeviceLocked, hasDeviceLock, lockLabel, locking, lockDevice, checking, error, retry };
}
