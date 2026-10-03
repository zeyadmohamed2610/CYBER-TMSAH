import { act, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLoginForm } from "../hooks/useLoginForm";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn(), navigate: vi.fn() }));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: () => ({ insert: mocks.insert }),
  },
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null, role: null, loading: false }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: "/login" }),
}));
vi.mock("@/shared/i18n", () => ({
  useLang: () => ({ t: { auth: { requestSent: "Sent" } }, lang: "en", isRTL: false }),
}));
vi.mock("@/features/auth/services/auditService", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/features/auth/utils/cyberAudio", () => ({ playCyberSuccessChime: vi.fn() }));
vi.mock("@/shared/lib/pwnedPassword", () => ({
  checkPwnedPassword: vi.fn().mockResolvedValue({ isPwned: false, count: 0 }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
let model: ReturnType<typeof useLoginForm>;
const submit = () => new Event("submit", { cancelable: true }) as unknown as FormEvent;
function Probe() {
  model = useLoginForm();
  return null;
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Probe />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("releases password login after a transport rejection and allows retry", async () => {
  mocks.invoke.mockRejectedValue(new Error("offline"));
  await act(async () => {
    model.setUsername("student_name");
    model.setPassword("Example!123");
  });
  await act(async () => model.handleLogin(submit()));
  expect(model.loginLoading).toBe(false);
  expect(model.loginError).toBe("Could not sign in. Please try again.");
  expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async () => model.handleLogin(submit()));
  expect(mocks.invoke).toHaveBeenCalledTimes(2);
});

it("rejects an invalid numeric identifier before submitting authentication", async () => {
  await act(async () => model.setUsername("123"));
  await act(async () => model.handleLogin(submit()));
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(model.loginLoading).toBe(false);
  expect(model.loginError).toContain("14 digits");
});

it("releases join submission after a transport rejection without claiming success", async () => {
  mocks.insert.mockRejectedValue(new Error("offline"));
  await act(async () => {
    model.setJoinRole("doctor");
    model.setFullName("John Doe Smith");
    model.setJoinEmail("doctor@example.com");
    model.setJoinUsername("doctor_name");
    model.setJoinPassword("Example!123");
    model.setConfirmPassword("Example!123");
  });
  await act(async () => model.handleJoin(submit()));
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  expect(model.joinLoading).toBe(false);
  expect(model.joinSuccess).toBe(false);
});
