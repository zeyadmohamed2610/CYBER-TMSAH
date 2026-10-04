import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";

const mocks = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    auth: { resetPasswordForEmail: mocks.reset },
  },
}));
vi.mock("@/shared/i18n", () => ({ useLang: () => ({ isRTL: true }) }));
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ForgotPasswordModal isOpen onClose={() => {}} />));
  const fill = async (id: string, value: string) => {
    const input = document.getElementById(id) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await fill("reset-email", "owner@gmail.com");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
const submit = () =>
  document
    .querySelector('[role="dialog"] form')!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

it("requests only a recovery link and never claims delivery or discloses account existence", async () => {
  mocks.reset.mockResolvedValue({ error: null });
  await act(async () => submit());
  expect(mocks.reset).toHaveBeenCalledWith("owner@gmail.com", {
    redirectTo: window.location.origin + "/reset-password",
  });
  expect(document.body.textContent).toContain("إذا كان البريد مسجلًا");
  expect(document.getElementById("reset-phone")).toBeNull();
  await act(async () => submit());
  expect(mocks.reset).toHaveBeenCalledTimes(1);
});
it("shows provider rate limiting, preserves email and blocks repeat attempts", async () => {
  mocks.reset.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
  await act(async () => submit());
  expect(document.body.textContent).toContain("وصلت خدمة البريد إلى حد الإرسال");
  expect((document.getElementById("reset-email") as HTMLInputElement).value).toBe(
    "owner@gmail.com",
  );
  await act(async () => submit());
  expect(mocks.reset).toHaveBeenCalledTimes(1);
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
  mocks.reset.mockResolvedValue({ error: null });
  await act(async () => submit());
  expect(mocks.reset).toHaveBeenCalledTimes(2);
});
it("blocks same-tick duplicate submissions during a slow request", async () => {
  let resolve!: (value: unknown) => void;
  mocks.reset.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await act(async () => {
    submit();
    submit();
  });
  expect(mocks.reset).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ error: null }));
});
it("honors the shared cooldown on remount", async () => {
  sessionStorage.setItem("cyber_reset_retry_at", String(Date.now() + 60_000));
  await act(async () => submit());
  expect(mocks.reset).not.toHaveBeenCalled();
});
