import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StudentAttendanceAccess } from "./StudentAttendanceAccess";

const state = vi.hoisted(() => ({
  checking: false,
  error: "",
  retry: vi.fn(),
  isDeviceLocked: false,
  hasDeviceLock: false,
  lockDevice: vi.fn(),
  locking: false,
}));
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "student" } }),
}));
vi.mock("../hooks/useDeviceLock", () => ({ useDeviceLock: () => state }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    checking: false,
    error: "",
    isDeviceLocked: false,
    hasDeviceLock: false,
    locking: false,
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render() {
  await act(async () =>
    root.render(
      <>
        <nav>الجدول وسجل حضوري</nav>
        <StudentAttendanceAccess>
          <form>submit-attendance</form>
        </StudentAttendanceAccess>
      </>,
    ),
  );
}
it("keeps academic navigation accessible without a registered attendance device", async () => {
  await render();
  expect(container.querySelector("nav")?.textContent).toBe("الجدول وسجل حضوري");
  expect(container.querySelector("form")).toBeNull();
  expect(container.textContent).toContain("قفل هذا الجهاز والمتابعة");
});
it("does not show registration or attendance on a different linked device", async () => {
  state.hasDeviceLock = true;
  await render();
  expect(container.querySelector("button")).toBeNull();
  expect(container.querySelector("form")).toBeNull();
  expect(container.textContent).toContain("استخدم الجهاز المرتبط بحسابك");
});
it("mounts the attendance ceremony only on the matching device", async () => {
  Object.assign(state, { isDeviceLocked: true, hasDeviceLock: true });
  await render();
  expect(container.querySelector("form")?.textContent).toBe("submit-attendance");
});
it("fails closed on a device lookup error and provides retry", async () => {
  state.error = "تعذر التحقق";
  await render();
  expect(container.querySelector("form")).toBeNull();
  await act(async () => container.querySelector("button")?.click());
  expect(state.retry).toHaveBeenCalledOnce();
});
it("does not offer attendance or binding while checking device access", async () => {
  state.checking = true;
  await render();
  expect(container.querySelector("form,button")).toBeNull();
  expect(container.querySelector('[role="status"]')).not.toBeNull();
});
