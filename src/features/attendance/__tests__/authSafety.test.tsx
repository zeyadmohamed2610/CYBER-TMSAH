import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
} }));
import { AttendanceAuthProvider, useAttendanceAuth } from "../context/AttendanceAuthContext";

let root: Root;
let container: HTMLDivElement;
function Probe() { const { role, loading } = useAttendanceAuth(); return <div>{loading ? "loading" : role ?? "none"}</div>; }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear(); sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("profile unavailable") });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it("does not grant a role from editable account metadata or browser cache", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "student", user_metadata: { role: "owner" }, app_metadata: {} } } }, error: null });
  sessionStorage.setItem("cyber_cached_userid", "student");
  sessionStorage.setItem("cyber_cached_role", "owner");
  await act(async () => { root.render(<AttendanceAuthProvider><Probe /></AttendanceAuthProvider>); });
  expect(container.textContent).toBe("none");
});

it("allows a trusted app metadata role if the profile is temporarily unavailable", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "teacher", user_metadata: {}, app_metadata: { role: "doctor" } } } }, error: null });
  await act(async () => { root.render(<AttendanceAuthProvider><Probe /></AttendanceAuthProvider>); });
  expect(container.textContent).toBe("doctor");
});
