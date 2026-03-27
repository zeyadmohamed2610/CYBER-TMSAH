import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { AttendanceRole } from "../types";

interface AttendanceAuthContextValue {
  user: User | null;
  role: AttendanceRole | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<{ error: string | null }>;
}

const AttendanceAuthContext = createContext<AttendanceAuthContextValue | undefined>(undefined);

const isAttendanceRole = (value: unknown): value is AttendanceRole => {
  return value === "owner" || value === "doctor" || value === "student";
};

/** Fetch role from database — single source of truth. */
const fetchUserRole = async (authId: string): Promise<AttendanceRole> => {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) throw error;

  if (!isAttendanceRole(data?.role)) {
    throw new Error("Unable to resolve user role from public.users.");
  }

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const applySession = async (sessionUser: User | null) => {
      if (!active) return;

      if (!sessionUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUser(sessionUser);

      try {
        const nextRole = await withTimeout(
          fetchUserRole(sessionUser.id),
          10_000,
          "fetchUserRole",
        );
        if (!active) return;
        setRole(nextRole);
      } catch (err) {
        if (!active) return;
        console.error("Failed to fetch attendance role:", err);
        setRole(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          8_000,
          "getSession",
        );
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshRole = useCallback(async (): Promise<void> => {
    if (!user) return;
    setLoading(true);
    try {
      const nextRole = await withTimeout(fetchUserRole(user.id), 10_000, "refreshRole");
      setRole(nextRole);
    } catch (error) {
      console.error("Failed to refresh attendance role:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const signOut = useCallback(async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    setUser(null);
    setRole(null);
    return { error: null };
  }, []);

  const value = useMemo<AttendanceAuthContextValue>(
    () => ({ user, role, loading, refreshRole, signOut }),
    [loading, role, user, refreshRole, signOut],
  );

  return <AttendanceAuthContext.Provider value={value}>{children}</AttendanceAuthContext.Provider>;
};

export const useAttendanceAuth = () => {
  const context = useContext(AttendanceAuthContext);
  if (!context) {
    throw new Error("useAttendanceAuth must be used inside AttendanceAuthProvider.");
  }
  return context;
};
