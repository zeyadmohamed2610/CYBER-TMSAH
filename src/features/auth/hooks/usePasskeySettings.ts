import { useAuth } from "@/features/auth/context/AuthContext";
import {
  authenticateWithPasskey,
  isWebAuthnSupported,
  preparePasskeyRegistration,
  registerPasskey,
  type PreparedPasskeyRegistration,
} from "@/features/auth/passkeys";
import { passkeyFailure } from "@/features/auth/passkeys/errors";
import { supabase } from "@/shared/api/supabaseClient";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface ManagedPasskey {
  id: string;
  rawId: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string | null | undefined;
}
export const MAX_PASSKEYS = 10;

export function usePasskeySettings() {
  const { user } = useAuth();
  // Passkey (WebAuthn) State
  const [passkeys, setPasskeys] = useState<ManagedPasskey[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [passkeysLoadFailed, setPasskeysLoadFailed] = useState(false);
  const [passkeysRefresh, setPasskeysRefresh] = useState(0);
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(null);
  const [renamingPasskey, setRenamingPasskey] = useState<ManagedPasskey | null>(null);
  const [passkeyName, setPasskeyName] = useState("");
  const [savingPasskeyName, setSavingPasskeyName] = useState(false);
  const [creatingPasskey, setCreatingPasskey] = useState(false);
  const [passkeyDestination, setPasskeyDestination] = useState<"device" | "any">("device");
  const [preparedPasskey, setPreparedPasskey] = useState<PreparedPasskeyRegistration | null>(null);
  const [testingPasskeyId, setTestingPasskeyId] = useState<string | null>(null);

  // Passkey Re-authentication State (Security enhancement)
  const [isPasskeyAuthModalOpen, setIsPasskeyAuthModalOpen] = useState(false);
  const [passkeyAuthPassword, setPasskeyAuthPassword] = useState("");
  const [showPasskeyAuthPassword, setShowPasskeyAuthPassword] = useState(false);
  const [verifyingPasskeyPassword, setVerifyingPasskeyPassword] = useState(false);

  // The verified server list is the only source of registered devices.
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    async function loadUserPasskeys() {
      setLoadingPasskeys(true);
      setPasskeysLoadFailed(false);
      try {
        const { data, error } = await supabase.auth.passkey.list();

        if (error) throw error;
        if (!isMounted) return;
        const mapped = (data ?? []).map((item) => ({
          id: item.id,
          rawId: item.id,
          label: item.friendly_name || "مفتاح دخول",
          createdAt: item.created_at,
          lastUsedAt: item.last_used_at,
        }));
        setPasskeys(mapped);
      } catch (err) {
        console.error("Failed to load verified passkeys", err);
        if (isMounted) setPasskeysLoadFailed(true);
      } finally {
        if (isMounted) setLoadingPasskeys(false);
      }
    }

    loadUserPasskeys();
    return () => {
      isMounted = false;
    };
  }, [user?.id, passkeysRefresh]);

  const savePasskeys = (items: ManagedPasskey[]) => {
    if (!user?.id) return;
    setPasskeys(items);
  };

  const handleInitiatePasskeyCreation = (destination: "device" | "any" = "device") => {
    if (loadingPasskeys || passkeysLoadFailed || creatingPasskey || deletingPasskeyId) return;
    if (!isWebAuthnSupported()) {
      toast.error("الدخول بالبصمة غير متاح على جهازك أو متصفحك الحالي.");
      return;
    }

    if (passkeys.length >= MAX_PASSKEYS) {
      toast.error("يمكنك حفظ 10 مفاتيح دخول. احذف مفتاحًا قديمًا لإضافة آخر.");
      return;
    }

    // Open security re-authentication modal
    setPasskeyDestination(destination);
    setPreparedPasskey(null);
    setPasskeyAuthPassword("");
    setShowPasskeyAuthPassword(false);
    setIsPasskeyAuthModalOpen(true);
  };

  const handleVerifyPasswordAndCreatePasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (preparedPasskey) {
      await executePasskeyCreation();
      return;
    }
    if (!passkeyAuthPassword.trim()) {
      toast.error("يرجى إدخال كلمة مرور حسابك للمتابعة.");
      return;
    }

    if (!user?.email) {
      toast.error("تعذر التعرف على البريد الإلكتروني للحساب.");
      return;
    }

    try {
      setVerifyingPasskeyPassword(true);
      // Re-authenticate user credentials with Supabase
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passkeyAuthPassword,
      });

      if (signInErr) {
        toast.error("كلمة المرور غير صحيحة. تم رفض طلب إضافة البصمة لأسباب أمنية.");
        return;
      }

      // Prepare the server request, then wait for a fresh click to open the native prompt.
      const prepared = await preparePasskeyRegistration();
      setPreparedPasskey(prepared);
      setPasskeyAuthPassword("");
    } catch (err: unknown) {
      toast.error(passkeyFailure(err).error ?? "تعذر تجهيز طلب الإضافة. أعد المحاولة.");
    } finally {
      setVerifyingPasskeyPassword(false);
    }
  };

  const executePasskeyCreation = async () => {
    const prepared = preparedPasskey;
    if (!prepared) return;
    if (passkeys.length >= MAX_PASSKEYS) {
      toast.error("يمكنك حفظ 10 مفاتيح دخول. احذف مفتاحًا قديمًا لإضافة آخر.");
      return;
    }

    try {
      setCreatingPasskey(true);
      setIsPasskeyAuthModalOpen(false);

      // A phone may create a security key or cloud credential; do not infer its provider from this browser.
      const deviceLabel = "مفتاح دخول";

      const formattedLabel = `${deviceLabel} - ${new Date().toLocaleDateString("ar-EG")}`;
      const result = await registerPasskey(formattedLabel, passkeyDestination, prepared);

      if (result.cancelled) {
        toast.info(
          passkeyDestination === "device"
            ? "لم تكتمل الإضافة على هذا الجهاز. إذا لم يظهر خيار الحفظ، راجع مدير كلمات المرور وقفل الشاشة في إعدادات جهازك."
            : "تم إلغاء عملية إضافة جهاز الدخول.",
        );
        return;
      }

      if (!result.success || !result.credentialId) {
        toast.error(
          getFriendlyErrorMessage(
            result.error ||
              "فشل تسجيل جهاز الدخول. تأكد من تفعيل البصمة أو رمز قفل الجهاز على جهازك.",
          ),
        );
        return;
      }

      // Refresh passkeys list from database (server-verified credentials)
      if (user?.id) {
        const { data: dbData, error: listError } = await supabase.auth.passkey.list();

        if (!listError && dbData) {
          const mapped = dbData.map((item) => ({
            id: item.id,
            rawId: item.id,
            label: item.friendly_name || deviceLabel,
            createdAt: item.created_at || new Date().toISOString(),
            lastUsedAt: item.last_used_at,
          }));
          savePasskeys(mapped);
        } else {
          setPasskeysLoadFailed(true);
          toast.info("تم حفظ المفتاح. أعد تحميل القائمة لعرضه.");
          return;
        }
      }

      toast.success("تم حفظ مفتاح الدخول بنجاح.");
    } catch (err: unknown) {
      console.error("Passkey creation unexpected error:", err);
      toast.error("خطأ غير متوقع. الرجاء المحاولة مرة أخرى.");
    } finally {
      setCreatingPasskey(false);
      setPreparedPasskey(null);
    }
  };

  const handleTestPasskey = async (passkeyId: string) => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("الدخول بالبصمة غير متاح في هذا المتصفح.");
      return;
    }

    try {
      setTestingPasskeyId(passkeyId);
      const result = await authenticateWithPasskey(undefined, passkeyId);
      if (!result.success) {
        toast.error(getFriendlyErrorMessage(result.error || "تعذر تأكيد مفتاح الدخول"));
        return;
      }
      toast.success("تم تأكيد جهاز الدخول بنجاح.");
      setPasskeys((items) =>
        items.map((item) =>
          item.id === passkeyId ? { ...item, lastUsedAt: new Date().toISOString() } : item,
        ),
      );
    } catch (err: unknown) {
      console.error("Passkey test error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.info("تم إلغاء عملية التحقق.");
      } else {
        toast.error("فشل التحقق من جهاز الدخول.");
      }
    } finally {
      setTestingPasskeyId(null);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    if (!user?.id || deletingPasskeyId) return;
    setDeletingPasskeyId(passkeyId);
    try {
      const result = await supabase.auth.passkey.delete({ passkeyId });
      if (result.error) throw result.error;
      setPasskeys((items) => items.filter((p) => p.id !== passkeyId));
      toast.success("تم حذف مفتاح الدخول من حسابك.");
    } catch {
      toast.error("تعذر حذف مفتاح الدخول. أعد المحاولة.");
    } finally {
      setDeletingPasskeyId(null);
    }
  };

  const handleRenamePasskey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!renamingPasskey || savingPasskeyName) return;
    setSavingPasskeyName(true);
    try {
      const renamed = await supabase.auth.passkey.update({
        passkeyId: renamingPasskey.id,
        friendlyName: passkeyName.trim(),
      });
      if (renamed.error) throw renamed.error;
      setPasskeys((items) =>
        items.map((item) =>
          item.id === renamingPasskey.id ? { ...item, label: passkeyName.trim() } : item,
        ),
      );
      setRenamingPasskey(null);
      toast.success("تم حفظ اسم مفتاح الدخول.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الاسم.");
    } finally {
      setSavingPasskeyName(false);
    }
  };

  return {
    passkeys,
    loadingPasskeys,
    passkeysLoadFailed,
    setPasskeysRefresh,
    deletingPasskeyId,
    renamingPasskey,
    setRenamingPasskey,
    passkeyName,
    setPasskeyName,
    savingPasskeyName,
    creatingPasskey,
    passkeyDestination,
    preparedPasskey,
    testingPasskeyId,
    isPasskeyAuthModalOpen,
    setIsPasskeyAuthModalOpen,
    passkeyAuthPassword,
    setPasskeyAuthPassword,
    showPasskeyAuthPassword,
    setShowPasskeyAuthPassword,
    verifyingPasskeyPassword,
    handleInitiatePasskeyCreation,
    handleVerifyPasswordAndCreatePasskey,
    handleTestPasskey,
    handleDeletePasskey,
    handleRenamePasskey,
    user,
  };
}
