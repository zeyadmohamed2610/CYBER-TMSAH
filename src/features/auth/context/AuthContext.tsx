import { type AppRole } from "@/features/auth/types";
import { supabase } from "@/shared/api/supabaseClient";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface AuthContextValue {
  user: User | null;
  role: AppRole | null;
  fullName: string | null;
  department: string | null;
  avatarUrl: string | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
  updateAvatarUrl: (url: string | null) => Promise<void>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_STORAGE_KEY = "cyber_cached_role";
const NAME_STORAGE_KEY = "cyber_cached_fullname";
const DEPT_STORAGE_KEY = "cyber_cached_department";
const USERID_STORAGE_KEY = "cyber_cached_userid";
const AVATAR_STORAGE_KEY = "cyber_cached_avatar";

const isAppRole = (value: unknown): value is AppRole => {
  return (
    value === "owner" ||
    value === "coordinator" ||
    value === "doctor" ||
    value === "student" ||
    value === "ta"
  );
};

/** Fetch role, full_name, department and avatar_url from database */
const fetchUserProfile = async (
  authId: string,
): Promise<{
  role: AppRole;
  fullName: string | null;
  department: string | null;
  avatarUrl: string | null;
}> => {
  // 1. Try fetching full profile with department & avatar_url
  let { data, error } = await supabase
    .from("users")
    .select("role, full_name, department, avatar_url")
    .eq("auth_id", authId)
    .maybeSingle();

  // 2. If column error or schema cache error, fallback gracefully
  if (error) {
    const fallback = await supabase
      .from("users")
      .select("role, full_name")
      .eq("auth_id", authId)
      .maybeSingle();

    if (!fallback.error && fallback.data) {
      data = { ...fallback.data, department: null, avatar_url: null };
      error = null;
    }
  }

  if (error) throw error;
  if (!isAppRole(data?.role)) throw new Error("ACCOUNT_PROFILE_UNAVAILABLE");
  const typedData = data as {
    role: AppRole;
    full_name: string | null;
    department?: string | null;
    avatar_url?: string | null;
  };
  return {
    role: typedData.role,
    fullName: typedData.full_name ?? null,
    department: typedData.department ?? null,
    avatarUrl: typedData.avatar_url ?? null,
  };
};

/** Wrap a promise with a timeout */
const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with cached credentials from sessionStorage if available to avoid unneeded loading screens
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(() => {
    try {
      const cached =
        sessionStorage.getItem(ROLE_STORAGE_KEY) || localStorage.getItem(ROLE_STORAGE_KEY);
      return isAppRole(cached) ? cached : null;
    } catch {
      return null;
    }
  });
  const [fullName, setFullName] = useState<string | null>(() => {
    try {
      return (
        sessionStorage.getItem(NAME_STORAGE_KEY) || localStorage.getItem(NAME_STORAGE_KEY) || null
      );
    } catch {
      return null;
    }
  });
  const [department, setDepartment] = useState<string | null>(() => {
    try {
      return (
        sessionStorage.getItem(DEPT_STORAGE_KEY) || localStorage.getItem(DEPT_STORAGE_KEY) || null
      );
    } catch {
      return null;
    }
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return (
        sessionStorage.getItem(AVATAR_STORAGE_KEY) ||
        localStorage.getItem(AVATAR_STORAGE_KEY) ||
        null
      );
    } catch {
      return null;
    }
  });

  // Browser cache cannot establish a session. Resolve it before routing a cold start.
  const [loading, setLoading] = useState(true);

  const initializedRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);
  const roleRef = useRef<AppRole | null>(role);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    let active = true;
    let authRevision = 0;

    /** Full apply — fetches role silently if already initialized to prevent unmounting active forms */
    const applySession = async (sessionUser: User | null, silent = false) => {
      if (!active) return;

      if (!sessionUser) {
        // If we were already authenticated, do NOT wipe user state on transient background events
        if (initializedRef.current && currentUserRef.current) {
          return;
        }

        setUser(null);
        setRole(null);
        setFullName(null);
        setDepartment(null);
        setAvatarUrl(null);
        setLoading(false);
        currentUserRef.current = null;
        try {
          sessionStorage.removeItem(ROLE_STORAGE_KEY);
          sessionStorage.removeItem(NAME_STORAGE_KEY);
          sessionStorage.removeItem(DEPT_STORAGE_KEY);
          sessionStorage.removeItem(USERID_STORAGE_KEY);
          sessionStorage.removeItem(AVATAR_STORAGE_KEY);
          localStorage.removeItem(ROLE_STORAGE_KEY);
          localStorage.removeItem(NAME_STORAGE_KEY);
          localStorage.removeItem(DEPT_STORAGE_KEY);
          localStorage.removeItem(AVATAR_STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }

      // FAST PATH: If user is already loaded and same id, and role is already known,
      // NEVER show loading spinner and NEVER re-fetch profile from database on app switch!
      const isSameUser = currentUserRef.current?.id === sessionUser.id;
      if (isSameUser && roleRef.current) {
        currentUserRef.current = sessionUser;
        setUser(sessionUser);
        setLoading(false);
        initializedRef.current = true;
        return;
      }

      if (!silent && !isSameUser && !initializedRef.current) {
        setLoading(true);
      }

      setUser(sessionUser);
      currentUserRef.current = sessionUser;
      if (!isSameUser) {
        roleRef.current = null;
        setRole(null);
        setFullName(null);
        setDepartment(null);
        setLoading(true);
      }

      const userAvatar =
        (sessionUser.user_metadata?.avatar_url as string | undefined) ||
        localStorage.getItem(`cyber_avatar_${sessionUser.id}`) ||
        (isSameUser ? localStorage.getItem(AVATAR_STORAGE_KEY) : null) ||
        null;
      setAvatarUrl(userAvatar);
      if (userAvatar) {
        try {
          sessionStorage.setItem(AVATAR_STORAGE_KEY, userAvatar);
          localStorage.setItem(AVATAR_STORAGE_KEY, userAvatar);
        } catch {
          // ignore
        }
      }

      try {
        const profile = await withTimeout(
          fetchUserProfile(sessionUser.id),
          8_000,
          "fetchUserProfile",
        );
        if (!active || currentUserRef.current?.id !== sessionUser.id) return;

        setRole(profile.role);
        setFullName(profile.fullName);
        setDepartment(profile.department);
        if (profile.avatarUrl) {
          setAvatarUrl(profile.avatarUrl);
          try {
            sessionStorage.setItem(AVATAR_STORAGE_KEY, profile.avatarUrl);
            localStorage.setItem(AVATAR_STORAGE_KEY, profile.avatarUrl);
            localStorage.setItem(`cyber_avatar_${sessionUser.id}`, profile.avatarUrl);
          } catch {
            // ignore
          }
        }

        // Cache role, name, department
        try {
          sessionStorage.setItem(ROLE_STORAGE_KEY, profile.role);
          if (profile.fullName) sessionStorage.setItem(NAME_STORAGE_KEY, profile.fullName);
          if (profile.department) sessionStorage.setItem(DEPT_STORAGE_KEY, profile.department);
          sessionStorage.setItem(USERID_STORAGE_KEY, sessionUser.id);
          localStorage.setItem(ROLE_STORAGE_KEY, profile.role);
          if (profile.fullName) localStorage.setItem(NAME_STORAGE_KEY, profile.fullName);
          if (profile.department) localStorage.setItem(DEPT_STORAGE_KEY, profile.department);
        } catch {
          // ignore
        }
      } catch (err) {
        if (!active || currentUserRef.current?.id !== sessionUser.id) return;
        if (err instanceof Error && err.message === "ACCOUNT_PROFILE_UNAVAILABLE") {
          roleRef.current = null;
          setRole(null);
          return;
        }
        console.warn("Could not refresh role in background, keeping current cached role:", err);
        // CRITICAL: DO NOT set role to null if a background query fails while app is in use!
        // A saved browser value is not an authority for account permissions.
        if (!roleRef.current) {
          const metaRole = sessionUser.app_metadata?.role;
          if (!roleRef.current && isAppRole(metaRole)) {
            setRole(metaRole);
            const metaName =
              sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;
            if (metaName) setFullName(metaName);
          }
        }
      } finally {
        if (active && currentUserRef.current?.id === sessionUser.id) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    };

    const initializeAuth = async () => {
      const revision = authRevision;
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), 8_000, "getSession");
        if (!active || revision !== authRevision) return;
        if (error) throw error;
        await applySession(data.session?.user ?? null, initializedRef.current);
      } catch (err) {
        if (!active || revision !== authRevision) return;
        console.warn("Session check fallback:", err);
        setLoading(false);
        initializedRef.current = true;
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authRevision += 1;

      // SIGNED_OUT: only here do we clear the user session
      if (event === "SIGNED_OUT") {
        roleRef.current = null;
        setUser(null);
        setRole(null);
        setFullName(null);
        setDepartment(null);
        setAvatarUrl(null);
        setLoading(false);
        initializedRef.current = false;
        currentUserRef.current = null;
        try {
          sessionStorage.removeItem(ROLE_STORAGE_KEY);
          sessionStorage.removeItem(NAME_STORAGE_KEY);
          sessionStorage.removeItem(DEPT_STORAGE_KEY);
          sessionStorage.removeItem(USERID_STORAGE_KEY);
          sessionStorage.removeItem(AVATAR_STORAGE_KEY);
          localStorage.removeItem(ROLE_STORAGE_KEY);
          localStorage.removeItem(NAME_STORAGE_KEY);
          localStorage.removeItem(DEPT_STORAGE_KEY);
          localStorage.removeItem(AVATAR_STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }

      // CRITICAL UX FIX:
      // Once initialized, ANY auth event (TOKEN_REFRESHED, SIGNED_IN from tab refocus, USER_UPDATED)
      // MUST BE STRICTLY SILENT!
      // This prevents the page from unmounting or reloading when the user switches to WhatsApp and returns.
      const isSilent =
        initializedRef.current || (session?.user && currentUserRef.current?.id === session.user.id);

      if (session?.user) {
        void applySession(session.user, Boolean(isSilent));
      } else if (event === "INITIAL_SESSION") {
        void applySession(null, false);
      }
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
      if (currentUserRef.current?.id !== user.id) return;
      roleRef.current = profile.role;
      setRole(profile.role);
      setFullName(profile.fullName);
      setDepartment(profile.department);
      try {
        sessionStorage.setItem(ROLE_STORAGE_KEY, profile.role);
        if (profile.fullName) sessionStorage.setItem(NAME_STORAGE_KEY, profile.fullName);
        if (profile.department) sessionStorage.setItem(DEPT_STORAGE_KEY, profile.department);
      } catch {
        // ignore
      }
    } catch (error) {
      if (
        currentUserRef.current?.id === user.id &&
        error instanceof Error &&
        error.message === "ACCOUNT_PROFILE_UNAVAILABLE"
      ) {
        roleRef.current = null;
        setRole(null);
        return;
      }
      console.warn("Failed to manually refresh attendance role:", error);
    }
  }, [user]);

  // Refresh permissions silently after an administrator changes a role or department.
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshRole();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, refreshRole]);

  const signOut = useCallback(async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setFullName(null);
    setDepartment(null);
    setAvatarUrl(null);
    currentUserRef.current = null;
    roleRef.current = null;
    try {
      sessionStorage.removeItem(ROLE_STORAGE_KEY);
      sessionStorage.removeItem(NAME_STORAGE_KEY);
      sessionStorage.removeItem(DEPT_STORAGE_KEY);
      sessionStorage.removeItem(USERID_STORAGE_KEY);
      sessionStorage.removeItem(AVATAR_STORAGE_KEY);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      localStorage.removeItem(NAME_STORAGE_KEY);
      localStorage.removeItem(DEPT_STORAGE_KEY);
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    } catch {
      // ignore
    }
    return { error: error ? error.message : null };
  }, []);

  const updateAvatarUrl = useCallback(
    async (newUrl: string | null): Promise<void> => {
      setAvatarUrl(newUrl);
      try {
        if (newUrl) {
          sessionStorage.setItem(AVATAR_STORAGE_KEY, newUrl);
          localStorage.setItem(AVATAR_STORAGE_KEY, newUrl);
        } else {
          sessionStorage.removeItem(AVATAR_STORAGE_KEY);
          localStorage.removeItem(AVATAR_STORAGE_KEY);
        }
        if (user?.id) {
          if (newUrl) {
            localStorage.setItem(`cyber_avatar_${user.id}`, newUrl);
          } else {
            localStorage.removeItem(`cyber_avatar_${user.id}`);
          }
          const isHttpUrl = Boolean(
            newUrl && (newUrl.startsWith("http://") || newUrl.startsWith("https://")),
          );
          // NEVER store base64 data URLs in user_metadata because they bloat the JWT
          // beyond Envoy/Kong's max header buffer limit (8KB), causing 400 Bad Request on all REST endpoints!
          try {
            await supabase.auth.updateUser({
              data: { avatar_url: isHttpUrl ? newUrl : null },
            });
          } catch (authErr) {
            console.warn("Failed to persist avatar_url to auth metadata:", authErr);
          }

          try {
            await supabase
              .from("users")
              .update({ avatar_url: newUrl } as Record<string, unknown>)
              .eq("auth_id", user.id);
          } catch (dbErr) {
            console.warn("Failed to persist avatar_url to users table:", dbErr);
          }
        }
      } catch (err) {
        console.warn("Failed to update avatar URL in storage:", err);
      }
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      fullName,
      department,
      avatarUrl,
      loading,
      refreshRole,
      updateAvatarUrl,
      signOut,
    }),
    [loading, role, fullName, department, avatarUrl, user, refreshRole, updateAvatarUrl, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
};
