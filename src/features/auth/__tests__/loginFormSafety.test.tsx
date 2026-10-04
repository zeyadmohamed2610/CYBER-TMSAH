import { act, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLoginForm } from "../hooks/useLoginForm";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  insert: vi.fn(),
  navigate: vi.fn(),
  passkey: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  from: undefined as string | undefined,
}));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    auth: { setSession: mocks.setSession, getSession: mocks.getSession },
    from: () => ({
      insert: mocks.insert,
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
  },
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null, role: null, loading: false }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: "/login", state: { from: mocks.from } }),
}));
vi.mock("@/shared/i18n", () => ({
  useLang: () => ({ t: { auth: { requestSent: "تم الإرسال" } }, lang: "ar", isRTL: true }),
}));
vi.mock("@/features/auth/passkeys", () => ({ authenticateWithPasskey: mocks.passkey }));
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
  mocks.from = undefined;
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
  expect(model.loginError).toContain("تعذر الاتصال");
  expect(localStorage.getItem("attendance_login_attempts")).toBeNull();
  expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async () => model.handleLogin(submit()));
  expect(mocks.invoke).toHaveBeenCalledTimes(2);
});

it("rejects an invalid numeric identifier before submitting authentication", async () => {
  await act(async () => model.setUsername("123"));
  await act(async () => model.handleLogin(submit()));
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(model.loginLoading).toBe(false);
  expect(model.loginError).toContain("14");
  expect(model.loginErrorField).toBe("identifier");
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

it("blocks simultaneous password and passkey attempts, including the same tick", async () => {
  let resolve!: (value: unknown) => void;
  mocks.invoke.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await act(async () => {
    model.setUsername("student_name");
    model.setPassword("Example!123");
  });
  let flight!: Promise<void>;
  await act(async () => {
    flight = model.handleLogin(submit());
    void model.handleLogin(submit());
    await model.handlePasskeyLogin();
  });
  expect(model.authBusy).toBe(true);
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  expect(mocks.passkey).not.toHaveBeenCalled();
  await act(async () => {
    resolve({ data: null, error: { name: "FunctionsFetchError" } });
    await flight;
  });
  expect(model.authBusy).toBe(false);
});

it("releases cancellation without showing an error or counting a failed attempt", async () => {
  mocks.passkey.mockResolvedValue({ cancelled: true });
  await act(async () => model.handlePasskeyLogin());
  expect(model.loginError).toBeNull();
  expect(model.authBusy).toBe(false);
  expect(localStorage.getItem("attendance_login_attempts")).toBeNull();
});

it("normalizes national ID digits without modifying or trimming the password", async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError" } });
  await act(async () => {
    model.setUsername("٣٠٤١٠٢٦٠٢٠١٩١١");
    model.setPassword("  pasted Password!  ");
  });
  await act(async () => model.handleLogin(submit()));
  expect(mocks.invoke).toHaveBeenCalledWith("account-login", {
    body: { identifier: "30410260201911", password: "  pasted Password!  " },
  });
  expect(model.password).toBe("  pasted Password!  ");
});

it("removes a remembered identifier immediately when unchecked", async () => {
  localStorage.setItem("cyber_remember_user", "old_name");
  await act(async () => model.setRememberMe(false));
  expect(localStorage.getItem("cyber_remember_user")).toBeNull();
});

it("returns to a protected deep link after resolving the trusted role", async () => {
  mocks.from = "/owner-dashboard?tab=users#pending";
  mocks.invoke.mockResolvedValue({
    data: { session: { access_token: "test", refresh_token: "test" } },
    error: null,
  });
  mocks.setSession.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: {} } });
  mocks.maybeSingle.mockResolvedValue({ data: { role: "owner" } });
  await act(async () => {
    model.setUsername("owner_name");
    model.setPassword("Example!123");
  });
  await act(async () => model.handleLogin(submit()));
  expect(mocks.navigate).toHaveBeenCalledWith(mocks.from, { replace: true });
});

it.each([
  ["name", "j-name"],
  ["email", "j-email"],
  ["username", "j-user"],
  ["password", "j-pass"],
  ["confirmation", "j-confirm-pass"],
  ["departments", "j-departments"],
] as const)(
  "reports %s validation beside its field without inserting a request",
  async (invalid, field) => {
    await act(async () => {
      model.setJoinRole("doctor");
      model.setFullName("Ahmed Mohamed Ali");
      model.setJoinEmail("doctor@example.com");
      model.setJoinUsername("doctor_name");
      model.setJoinPassword("Example!123");
      model.setConfirmPassword("Example!123");
      if (invalid === "name") model.setFullName("Ahmed");
      if (invalid === "email") model.setJoinEmail("invalid");
      if (invalid === "username") model.setJoinUsername("invalid name");
      if (invalid === "password") model.setJoinPassword("123");
      if (invalid === "confirmation") model.setConfirmPassword("different");
      if (invalid === "departments") model.setJoinDepartments([]);
    });
    await act(async () => model.handleJoin(submit()));
    expect(model.joinError?.field).toBe(field);
    expect(model.joinLoading).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  },
);

it("submits coordinator membership as a request without creating a session", async () => {
  mocks.insert.mockResolvedValue({ error: null });
  await act(async () => {
    model.setJoinRole("coordinator");
    model.setFullName("Ahmed Mohamed Ali");
    model.setJoinEmail("coordinator@example.com");
    model.setJoinUsername("coordinator_name");
    model.setJoinPassword("Example!123");
    model.setConfirmPassword("Example!123");
  });
  await act(async () => model.handleJoin(submit()));
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "coordinator" }));
  expect(mocks.setSession).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(model.joinSuccess).toBe(true);
});
