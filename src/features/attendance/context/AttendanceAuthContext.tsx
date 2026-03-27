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

const isAttendanceRole = (value: unknown): value is AttendanceRole => {
  return value === "owner" || value === "doctor" || value === "student" || value === "ta";
};

/** Fetch role from database */
const fetchUserRole = async (authId: string): Promise<AttendanceRole> => {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  if (!isAttendanceRole(data?.role)) throw new Error("Unable to resolve user role.");
  return data.role;
};

/** Wrap a promise with a timeout */
const withTimeout = <T extends unknown>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
};

export const AttendanceAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AttendanceRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    let active = true;

    /** Full apply — fetches role, shows loading ONLY on first call */
    const applySession = async (sessionUser: User | null, silent = false) => {
      if (!active) return;

      if (!sessionUser) {
        setUser(null);
        setRole(null);
        setFullName(null);
        setLoading(false);
        return;
      }

      // Only show loading spinner on first init, not on token refresh
      if (!silent) setLoading(true);
      setUser(sessionUser);

      try {
        const { data, error } = await supabase
          .from("users")
          .select("role, full_name")
          .eq("auth_id", sessionUser.id)
          .maybeSingle();

        if (error) throw error;
        if (!isAttendanceRole(data?.role)) throw new Error("Unable to resolve user role.");
        if (!active) return;

        setRole(data.role);
        setFullName(data.full_name ?? null);
      } catch (err) {
        if (!active) return;
        console.error("Failed to fetch attendance role:", err);
        setRole(null);
        setFullName(null);
      } finally {
        if (active && !silent) setLoading(false);
        initializedRef.current = true;
      }
    };

    const initializeAuth = async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), 8_000, "getSession");
        if (error) throw error;
        await applySession(data.session?.user ?? null);
      } catch (err) {
        if (!active) return;
        console.error("Failed to initialize attendance auth session:", err);
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      // SIGNED_OUT: clear everything
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole(null);
        setLoading(false);
        initializedRef.current = false;
        return;
      }

      // After init, token refreshes and user updates should be SILENT
      // They must NOT set loading=true (which would unmount the dashboard)
      const isSilent = initializedRef.current &&
        (event === "TOKEN_REFRESHED" || event === "USER_UPDATED");

      void applySession(session?.user ?? null, isSilent);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshRole = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const nextRole = await withTimeout(fetchUserRole(user.id), 10_000, "refreshRole");
      setRole(nextRole);
    } catch (error) {
      console.error("Failed to refresh attendance role:", error);
    }
  }, [user]);

  const signOut = useCallback(async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    setUser(null);
    setRole(null);
    setFullName(null);
    return { error: null };
  }, []);

  const value = useMemo<AttendanceAuthContextValue>(
    () => ({ user, role, fullName, loading, refreshRole, signOut }),
    [loading, role, fullName, user, refreshRole, signOut],
  );

  return <AttendanceAuthContext.Provider value={value}>{children}</AttendanceAuthContext.Provider>;
};

export const useAttendanceAuth = () => {
  const context = useContext(AttendanceAuthContext);
  if (!context) throw new Error("useAttendanceAuth must be used inside AttendanceAuthProvider.");
  return context;
};
