import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), reset: vi.fn() }));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    from: () => ({ insert: mocks.insert }),
    auth: { resetPasswordForEmail: mocks.reset },
  },
}));
vi.mock("../services/auditService", () => ({ recordAuditLog: vi.fn() }));
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
  await act(async () =>
    root.render(<ForgotPasswordModal isOpen onClose={() => {}} lang="ar" isRTL />),
  );
  const fill = async (id: string, value: string) => {
    const input = document.getElementById(id) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await fill("reset-email", "owner@gmail.com");
  await fill("reset-phone", "٠١٥٥٣٤٥٠٢٣٢");
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
it("only reports accepted email requests conditionally and normalizes the contact number", async () => {
  mocks.insert.mockResolvedValue({ error: null });
  mocks.reset.mockResolvedValue({ error: null });
  await act(async () => submit());
  expect(mocks.insert).toHaveBeenCalledWith({
    email: "owner@gmail.com",
    phone: "01553450232",
    status: "pending",
  });
  expect(mocks.reset).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain("إذا كان البريد مسجلًا");
  await act(async () => submit());
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it("preserves an accepted support request when email fails and does not duplicate it on retry", async () => {
  mocks.insert.mockResolvedValue({ error: null });
  mocks.reset
    .mockResolvedValueOnce({ error: new Error("mail unavailable") })
    .mockResolvedValue({ error: null });
  await act(async () => submit());
  expect(document.body.textContent).toContain("لكن تعذر طلب رسالة الاستعادة");
  await act(async () => submit());
  expect(mocks.reset).toHaveBeenCalledTimes(1);
  const future = Date.now() + 61_000;
  vi.spyOn(Date, "now").mockReturnValue(future);
  await act(async () => submit());
  expect(mocks.reset).toHaveBeenCalledTimes(2);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it("does not claim success or request email when support request storage fails", async () => {
  mocks.insert.mockResolvedValue({ error: new Error("offline") });
  await act(async () => submit());
  expect(document.body.textContent).toContain("تعذر تسجيل الطلب");
  expect(mocks.reset).not.toHaveBeenCalled();
});
it("blocks same-tick duplicate submissions during a slow request", async () => {
  let resolve!: (value: unknown) => void;
  mocks.insert.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  mocks.reset.mockResolvedValue({ error: null });
  await act(async () => {
    submit();
    submit();
  });
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ error: null });
  });
  expect(mocks.reset).toHaveBeenCalledTimes(1);
});
