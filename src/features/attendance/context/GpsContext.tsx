import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface GpsCoords {
  lat: number;
  lng: number;
}

interface GpsContextValue {
  coords: GpsCoords | null;
  status: "checking" | "granted" | "denied" | "unavailable";
  requestFresh: () => Promise<GpsCoords>;
  retry: () => void;
}

const GpsContext = createContext<GpsContextValue | undefined>(undefined);

export function GpsProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [status, setStatus] = useState<GpsContextValue["status"]>("checking");

  const acquire = useCallback(() => {
    setStatus("checking");

    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    acquire();
  }, [acquire]);

  const requestFresh = useCallback((): Promise<GpsCoords> => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation not available"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setStatus("granted");
          resolve(c);
        },
        (err) => reject(new Error(err.message)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, []);

  const value = useMemo<GpsContextValue>(
    () => ({ coords, status, requestFresh, retry: acquire }),
    [coords, status, requestFresh, acquire],
  );

  return <GpsContext.Provider value={value}>{children}</GpsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGps(): GpsContextValue {
  const ctx = useContext(GpsContext);
  if (!ctx) throw new Error("useGps must be used inside <GpsProvider>.");
  return ctx;
}
