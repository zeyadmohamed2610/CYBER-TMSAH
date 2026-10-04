import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../context/AuthContext";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  signOut: vi.fn(),
  onChange: vi.fn(),
}));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      onAuthStateChange: (callback: unknown) => {
        mocks.onChange(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  },
}));

let root: Root;
let container: HTMLDivElement;
let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  const { role, loading } = useAuth();
  return <div>{loading ? "loading" : (role ?? "none")}</div>;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("profile unavailable") });
});

it("explains expiration when an established session is signed out unexpectedly", async () => {
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "student" } } },
    error: null,
  });
  mocks.maybeSingle.mockResolvedValue({ data: { role: "student" }, error: null });
  await act(async () =>
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    ),
  );
  const callback = mocks.onChange.mock.calls[0]![0];
  await act(async () => callback("SIGNED_OUT", null));
  expect(auth.user).toBeNull();
  expect(auth.sessionExpired).toBe(true);
});

it("does not describe intentional logout or a first visit as expiration", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  await act(async () =>
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    ),
  );
  expect(auth.sessionExpired).toBe(false);
  const callback = mocks.onChange.mock.calls[0]![0];
  mocks.signOut.mockImplementation(async () => {
    callback("SIGNED_OUT", null);
    return { error: null };
  });
  await act(async () => auth.signOut());
  expect(auth.sessionExpired).toBe(false);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it("does not fall back to stale privileged metadata when the account profile no longer exists", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "deleted", app_metadata: { role: "owner" } } } },
    error: null,
  });
  await act(async () =>
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    ),
  );
  expect(container.textContent).toBe("none");
});

it("silently refreshes role changes when the user returns to the page", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "changed", app_metadata: { role: "doctor" } } } },
    error: null,
  });
  mocks.maybeSingle.mockResolvedValue({
    data: { role: "doctor", full_name: "Teacher", department: "cybersecurity" },
    error: null,
  });
  await act(async () =>
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    ),
  );
  expect(container.textContent).toBe("doctor");
  mocks.maybeSingle.mockResolvedValue({
    data: { role: "student", full_name: "Student", department: "cybersecurity" },
    error: null,
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toBe("student");
});

it("does not grant a role from editable account metadata or browser cache", async () => {
  mocks.getSession.mockResolvedValue({
    data: {
      session: { user: { id: "student", user_metadata: { role: "owner" }, app_metadata: {} } },
    },
    error: null,
  });
  sessionStorage.setItem("cyber_cached_userid", "student");
  sessionStorage.setItem("cyber_cached_role", "owner");
  await act(async () => {
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  expect(container.textContent).toBe("none");
});

it("allows a trusted app metadata role if the profile is temporarily unavailable", async () => {
  mocks.getSession.mockResolvedValue({
    data: {
      session: { user: { id: "teacher", user_metadata: {}, app_metadata: { role: "doctor" } } },
    },
    error: null,
  });
  await act(async () => {
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  expect(container.textContent).toBe("doctor");
});
