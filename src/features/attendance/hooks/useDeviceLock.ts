import { supabase } from "@/shared/api/supabaseClient";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { computeFingerprint } from "../../../shared/lib/deviceFingerprint";

export function useDeviceLock(userId: string | undefined) {
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [lockLabel, setLockLabel] = useState("");
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    supabase
      .from("device_locks")
      .select("device_label, device_fingerprint")
      .eq("student_auth_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn("[useDeviceLock] Select check warning:", error.message);
          return;
        }
        if (data) {
          setIsDeviceLocked(true);
          setLockLabel(data.device_label || "هذا الجهاز");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const lockDevice = useCallback(async () => {
    if (!userId) return;
    setLocking(true);
    try {
      const fp = await computeFingerprint();
      const ua = navigator.userAgent;
      const label =
        (ua.includes("Mobile") ? "هاتف محمول" : "جهاز كمبيوتر") +
        " - " +
        new Date().toLocaleDateString("ar-EG");

      // 1. Try secure RPC function first (bypasses RLS / permission edge-cases)
      const { data: rpcData, error: rpcError } = await supabase.rpc("lock_student_device", {
        p_fingerprint: fp,
        p_label: label,
      });

      if (!rpcError && rpcData?.success) {
        setIsDeviceLocked(true);
        setLockLabel(label);
        toast.success("تم قفل وتوثيق هذا الجهاز بنجاح");
        setLocking(false);
        return;
      }

      // 2. Fallback to direct table operations if RPC not present yet
      // Check if row already exists
      const { data: existing } = await supabase
        .from("device_locks")
        .select("device_fingerprint, device_label")
        .eq("student_auth_id", userId)
        .maybeSingle();

      if (existing) {
        if (existing.device_fingerprint === fp) {
          setIsDeviceLocked(true);
          setLockLabel(existing.device_label || label);
          toast.success("الجهاز موثق بالفعل لهذا الحساب");
          setLocking(false);
          return;
        } else {
          toast.error("الحساب مقترن بالفعل بجهاز آخر. راجع إدارة الكلية لإلغاء القفل.");
          setLocking(false);
          return;
        }
      }

      // Try insert first (standard INSERT only requires INSERT permission)
      const { error: insertError } = await supabase.from("device_locks").insert({
        student_auth_id: userId,
        device_fingerprint: fp,
        device_label: label,
      });

      if (insertError) {
        // If insert failed because of upsert / conflict, try upsert
        console.warn("[useDeviceLock] Insert fallback to upsert:", insertError.message);
        const { error: upsertError } = await supabase.from("device_locks").upsert({
          student_auth_id: userId,
          device_fingerprint: fp,
          device_label: label,
        });
        if (upsertError) {
          console.error("[useDeviceLock] Upsert error:", upsertError);
          throw upsertError;
        }
      }

      setIsDeviceLocked(true);
      setLockLabel(label);
      toast.success("تم قفل هذا الجهاز بنجاح");
    } catch (err: unknown) {
      console.error("[useDeviceLock] Failed to lock device:", err);
      toast.error("تعذر تسجيل هذا الجهاز للحضور. أعد المحاولة أو تواصل مع إدارة المنصة.");
    } finally {
      setLocking(false);
    }
  }, [userId]);

  return { isDeviceLocked, lockLabel, locking, lockDevice };
}
