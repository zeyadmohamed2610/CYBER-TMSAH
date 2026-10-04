import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: unknown) => void),
  recovery: false,
  unsubscribe: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (callback: typeof mocks.callback) => {
        mocks.callback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
      getSession: () => {
        if (mocks.recovery)
          setTimeout(() => mocks.callback?.("PASSWORD_RECOVERY", { user: { id: "verified" } }), 0);
        return Promise.resolve({ data: { session: { user: { id: "cached" } } } });
      },
    },
  }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.callback = null;
  mocks.recovery = false;
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "publishable-test");
  window.history.replaceState({}, "", "/reset-password#type=recovery");
});
afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});
it("waits for the deferred PASSWORD_RECOVERY event before releasing the listener", async () => {
  mocks.recovery = true;
  const { recoverySessionReady } = await import("./supabaseClient");
  expect(await recoverySessionReady).toMatchObject({ user: { id: "verified" } });
  await new Promise((done) => setTimeout(done, 5));
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
it("rejects a forged recovery URL even when an ordinary cached session exists", async () => {
  const { recoverySessionReady } = await import("./supabaseClient");
  expect(await recoverySessionReady).toBeNull();
});
it("does not treat a plain reset page as a recovery session", async () => {
  window.history.replaceState({}, "", "/reset-password");
  const { recoverySessionReady } = await import("./supabaseClient");
  expect(await recoverySessionReady).toBeNull();
  expect(mocks.callback).toBeNull();
});
