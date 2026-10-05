import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";
import ResetPasswordPage from "../pages/ResetPasswordPage";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), update: vi.fn(), signOut: vi.fn() }));
vi.mock("@/shared/api/supabaseClient", () => ({
  recoverySessionReady: Promise.resolve({ user: { id: "recovery-owner" } }),
  supabase: { auth: { getUser: mocks.getUser, updateUser: mocks.update, signOut: mocks.signOut } },
}));
vi.mock("@/shared/i18n", () => ({ useLang: () => ({ lang: "ar", isRTL: true }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "recovery-owner" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <HelmetProvider>
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>
      </HelmetProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
async function fill(password: string) {
  for (const id of ["new-password", "confirm-password"]) {
    const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        password,
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}
const submit = async () =>
  act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
it("rejects the old password and keeps the recovery session usable for a second attempt", async () => {
  mocks.update
    .mockResolvedValueOnce({
      error: new AuthApiError("New password should be different", 422, "same_password"),
    })
    .mockResolvedValueOnce({ error: null });
  await fill("old-password");
  await submit();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "لا يمكن استخدام كلمة المرور القديمة",
  );
  expect(document.activeElement?.id).toBe("new-password");
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(container.querySelector("form")).not.toBeNull();
  await fill("new-password");
  await submit();
  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect(container.textContent).toContain("تم تغيير كلمة المرور بنجاح");
});
it("never updates a different account if the session changes after opening the link", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "another-account" } }, error: null });
  await fill("different-password");
  await submit();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(container.textContent).toContain("رابط الاستعادة غير متوفر");
});
it("keeps the form and password after a transient request failure", async () => {
  mocks.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await fill("different-password");
  await submit();
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>("#new-password")?.value).toBe(
    "different-password",
  );
  expect(container.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(false);
});
