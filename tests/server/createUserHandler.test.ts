// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { handleCreateUser } from "../../supabase/functions/createUser/handler.ts";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
}));
vi.mock("npm:@supabase/server@1.8.0", () => ({ createSupabaseContext: mocks.context }));
vi.stubGlobal("Deno", { env: { get: () => undefined } });
beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: () => query, eq: () => query, single: mocks.single };
  mocks.context.mockResolvedValue({
    data: { supabase: { auth: { getUser: mocks.getUser }, from: () => query, rpc: mocks.rpc } },
    error: null,
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null });
  mocks.single.mockResolvedValue({
    data: { role: "coordinator", department: "cybersecurity" },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: "new-account", error: null });
});
const request = (overrides = {}) =>
  new Request("https://backend/createUser", {
    method: "POST",
    headers: { origin: "https://www.cyber-tmsah.site", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Student",
      email: "test@example.com",
      password: "NotReal!Example123",
      role: "student",
      academic_year: "2",
      section_number: 1,
      ...overrides,
    }),
  });
it("uses the authenticated transactional RPC with the caller department", async () => {
  expect((await handleCreateUser(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "admin_create_user",
    expect.objectContaining({ p_department: "cybersecurity", p_role: "student" }),
  );
});
it("rechecks that the session still exists", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("revoked") });
  expect((await handleCreateUser(request())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("refuses non-manager profiles and privileged requested ranks", async () => {
  mocks.single.mockResolvedValue({ data: { role: "student" }, error: null });
  expect((await handleCreateUser(request())).status).toBe(403);
  expect((await handleCreateUser(request({ role: "owner" }))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("does not leak internal database errors", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error("sensitive internal SQL") });
  const result = await handleCreateUser(request());
  expect(result.status).toBe(400);
  expect(await result.text()).not.toContain("sensitive internal SQL");
});
