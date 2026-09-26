import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { AttendanceRole } from "../types";

interface AttendanceAuthContextValue {
  user: User | null;
  role: AttendanceRole | null;
  fullName: string | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<{ error: string | null }>;
}

const AttendanceAuthContext = createContext<AttendanceAuthContextValue | undefined>(undefined);

const ROLE_STORAGE_KEY = "cyber_cached_role";
const NAME_STORAGE_KEY = "cyber_cached_fullname";
const USERID_STORAGE_KEY = "cyber_cached_userid";

const isAttendanceRole = (value: unknown): value is AttendanceRole => {
  return value === "owner" || value === "coordinator" || value === "doctor" || value === "student" || value === "ta";
};

/** Fetch role and full_name from database */
const fetchUserProfile = async (authId: string): Promise<{ role: AttendanceRole; fullName: string | null }> => {
  const { data, error } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) throw error;
  if (!isAttendanceRole(data?.role)) throw new Error("Unable to resolve user role.");
  return { role: data.role, fullName: data.full_name ?? null };
};

/** Wrap a promise with a timeout */
const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
};

export const AttendanceAuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with cached credentials from sessionStorage if available to avoid unneeded loading screens
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AttendanceRole | null>(() => {
    try {
      const cached = sessionStorage.getItem(ROLE_STORAGE_KEY) || localStorage.getItem(ROLE_STORAGE_KEY);
      return isAttendanceRole(cached) ? cached : null;
    } catch {
      return null;
    }
  });
  const [fullName, setFullName] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(NAME_STORAGE_KEY) || localStorage.getItem(NAME_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  // If we already have a cached role in storage, start with loading=false so the view doesn't flash or unmount
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = sessionStorage.getItem(ROLE_STORAGE_KEY) || localStorage.getItem(ROLE_STORAGE_KEY);
      return !isAttendanceRole(cached);
    } catch {
      return true;
    }
  });

  const initializedRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);

  useEffect(() => {
    let active = true;

    /** Full apply — fetches role silently if already initialized to prevent unmounting active forms */
    const applySession = async (sessionUser: User | null, silent = false) => {
      if (!active) return;

      if (!sessionUser) {
        setUser(null);
        setRole(null);
        setFullName(null);
        setLoading(false);
        currentUserRef.current = null;
        try {
          sessionStorage.removeItem(ROLE_STORAGE_KEY);
          sessionStorage.removeItem(NAME_STORAGE_KEY);
          sessionStorage.removeItem(USERID_STORAGE_KEY);
          localStorage.removeItem(ROLE_STORAGE_KEY);
          localStorage.removeItem(NAME_STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }

      // If user is already loaded and same id, NEVER show loading spinner!
      const isSameUser = currentUserRef.current?.id === sessionUser.id;
      if (!silent && !isSameUser && !initializedRef.current) {
        setLoading(true);
      }

      setUser(sessionUser);
      currentUserRef.current = sessionUser;

      try {
        const profile = await withTimeout(fetchUserProfile(sessionUser.id), 8_000, "fetchUserProfile");
        if (!active) return;

        setRole(profile.role);
        setFullName(profile.fullName);

        // Cache role and name
        try {
          sessionStorage.setItem(ROLE_STORAGE_KEY, profile.role);
          if (profile.fullName) sessionStorage.setItem(NAME_STORAGE_KEY, profile.fullName);
          sessionStorage.setItem(USERID_STORAGE_KEY, sessionUser.id);
          localStorage.setItem(ROLE_STORAGE_KEY, profile.role);
          if (profile.fullName) localStorage.setItem(NAME_STORAGE_KEY, profile.fullName);
        } catch {
          // ignore
        }
      } catch (err) {
        if (!active) return;
        console.warn("Could not refresh role in background, keeping current cached role:", err);
        // CRITICAL: DO NOT set role to null if a background query fails while app is in use!
        // Doing so would eject the user to the login page during tab switches.
      } finally {
        if (active) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    };

    const initializeAuth = async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), 8_000, "getSession");
        if (error) throw error;
        await applySession(data.session?.user ?? null, initializedRef.current);
      } catch (err) {
        if (!active) return;
        console.warn("Session check fallback:", err);
        setLoading(false);
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      // SIGNED_OUT: only here do we clear the user session
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        setFullName(null);
        setLoading(false);
        initializedRef.current = false;
        currentUserRef.current = null;
        try {
          sessionStorage.removeItem(ROLE_STORAGE_KEY);
          sessionStorage.removeItem(NAME_STORAGE_KEY);
          sessionStorage.removeItem(USERID_STORAGE_KEY);
          localStorage.removeItem(ROLE_STORAGE_KEY);
          localStorage.removeItem(NAME_STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }

      // CRITICAL UX FIX:
      // Once initialized, ANY auth event (TOKEN_REFRESHED, SIGNED_IN from tab refocus, USER_UPDATED)
      // MUST BE STRICTLY SILENT!
      // This prevents the page from unmounting or reloading when the user switches to WhatsApp and returns.
      const isSilent = initializedRef.current || (session?.user && currentUserRef.current?.id === session.user.id);

      void applySession(session?.user ?? null, Boolean(isSilent));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshRole = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const profile = await withTimeout(fetchUserProfile(user.id), 10_000, "refreshRole");
      setRole(profile.role);
      setFullName(profile.fullName);
      try {
        sessionStorage.setItem(ROLE_STORAGE_KEY, profile.role);
        if (profile.fullName) sessionStorage.setItem(NAME_STORAGE_KEY, profile.fullName);
      } catch {
        // ignore
      }
    } catch (error) {
      console.warn("Failed to manually refresh attendance role:", error);
    }
  }, [user]);

  const signOut = useCallback(async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setFullName(null);
    currentUserRef.current = null;
    try {
      sessionStorage.removeItem(ROLE_STORAGE_KEY);
      sessionStorage.removeItem(NAME_STORAGE_KEY);
      sessionStorage.removeItem(USERID_STORAGE_KEY);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      localStorage.removeItem(NAME_STORAGE_KEY);
    } catch {
      // ignore
    }
    return { error: error ? error.message : null };
  }, []);

  const value = useMemo<AttendanceAuthContextValue>(
    () => ({ user, role, fullName, loading, refreshRole, signOut }),
    [loading, role, fullName, user, refreshRole, signOut],
  );

  return <AttendanceAuthContext.Provider value={value}>{children}</AttendanceAuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAttendanceAuth = () => {
  const context = useContext(AttendanceAuthContext);
  if (!context) throw new Error("useAttendanceAuth must be used inside AttendanceAuthProvider.");
  return context;
};
