import { createClient, type Session } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable.");
}

// Capture recovery intent before Auth consumes and removes the URL fragment.
const recoveryLink =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { experimental: { passkey: true } },
});

// An ordinary cached session or a forged URL must not unlock the recovery form.
export const recoverySessionReady = recoveryLink
  ? new Promise<Session | null>((resolve) => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") resolve(session);
      });
      // Unsubscribe after initialization without awaiting Auth calls in its callback.
      void supabase.auth
        .getSession()
        .then(
          () =>
            new Promise<void>((done) => {
              // Auth emits PASSWORD_RECOVERY on the next task after initialization.
              setTimeout(() => {
                resolve(null);
                done();
              }, 0);
            }),
          () => resolve(null),
        )
        .finally(() => subscription.unsubscribe())
        .catch(() => {});
    })
  : Promise.resolve(null);
