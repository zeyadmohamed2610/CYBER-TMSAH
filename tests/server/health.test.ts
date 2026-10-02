// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => new Response(null, { status: 200 }));
});
const handler = async (method = "GET") => (await import("../../api/health")).GET(new Request("https://example.test/api/health", { method }));
it("checks the remote database and authentication endpoints", async () => {
  expect((await handler()).status).toBe(200);
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["https://example.supabase.co/rest/v1/subjects?select=id&limit=1", "https://example.supabase.co/auth/v1/health"]);
});
it("returns 503 when authentication service is unavailable", async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 503 }));
  const result = await handler();
  expect(result.status).toBe(503);
  expect((await result.json()).checks.auth.status).toBe("down");
});
it("handles network failures and HEAD requests", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  const result = await handler("HEAD");
  expect(result.status).toBe(503);
  expect(await result.text()).toBe("");
});
it("rejects writes without probing services", async () => {
  expect((await handler("POST")).status).toBe(405);
  expect(fetchMock).not.toHaveBeenCalled();
});
