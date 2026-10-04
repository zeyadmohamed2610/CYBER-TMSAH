import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AppRole } from "../types";
import { RoleGate } from "../components/RoleGate";
import { dashboardTabs } from "../utils/roleAccess";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as AppRole | null,
  loading: false,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => state }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.assign(state, { user: null, role: null, loading: false });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(allowed: AppRole = "owner") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RoleGate allowedRole={allowed}>
                <span>privileged-content</span>
              </RoleGate>
            }
          />
          <Route path="*" element={<span>redirected</span>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  return container.textContent;
}
it.each(["student", "doctor", "ta", "coordinator"] as const)(
  "rejects a %s opening an owner route",
  async (role) => {
    Object.assign(state, { user: { id: "account" }, role });
    expect(await render()).toBe("redirected");
  },
);
it("fails closed when a signed-in user's trusted role is unresolved", async () => {
  state.user = { id: "account" };
  expect(await render()).toBe("redirected");
});
it("does not mount content based on a role without an active user", async () => {
  state.role = "owner";
  expect(await render()).toBe("redirected");
});
it("allows a resolved signed-in owner", async () => {
  Object.assign(state, { user: { id: "owner" }, role: "owner" });
  expect(await render()).toBe("privileged-content");
});
it("waits for the session instead of redirecting from a cached role", async () => {
  Object.assign(state, { role: "owner", loading: true });
  const content = await render();
  expect(content).not.toContain("redirected");
  expect(content).not.toContain("privileged-content");
  state.user = { id: "owner" };
  state.loading = false;
  expect(await render()).toBe("privileged-content");
});
it.each(["student", "doctor", "ta"] as const)("restricts %s tabs to academic tasks", (role) => {
  expect(dashboardTabs(role)).not.toContain("users");
  expect(dashboardTabs(role)).not.toContain("devices");
  expect(dashboardTabs(role)).not.toContain("profile");
  expect(dashboardTabs(role)).not.toContain("followup");
});
