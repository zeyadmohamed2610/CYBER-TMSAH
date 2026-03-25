import { useCallback, useEffect, useState } from "react";

const getSecondsRemaining = (expiresAt: string | null | undefined): number | null => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((ms - Date.now()) / 1000));
};

interface UseRotatingHashParams {
  rotatingHash: string | null;
  expiresAt: string | null | undefined;
}

export const useRotatingHash = ({ rotatingHash, expiresAt }: UseRotatingHashParams) => {
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState<number | null>(
    () => getSecondsRemaining(expiresAt),
  );

  useEffect(() => {
    if (!expiresAt) {
      setSecondsUntilExpiry(null);
      return;
    }

    const update = () => setSecondsUntilExpiry(getSecondsRemaining(expiresAt));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const isExpired = secondsUntilExpiry !== null && secondsUntilExpiry <= 0;

  return {
    rotatingHash,
    secondsUntilExpiry,
    isExpired,
  };
};
