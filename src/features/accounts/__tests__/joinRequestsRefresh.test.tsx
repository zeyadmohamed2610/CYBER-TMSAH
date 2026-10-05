import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JoinRequestsPanel } from "../components/JoinRequestsPanel";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  refresh: undefined as undefined | (() => Promise<unknown>),
  result: { data: [] as unknown[], count: 5 as number | null, error: null as unknown },
}));
vi.mock("@/shared/i18n", () => ({ useLang: () => ({ lang: "ar" }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/shared/hooks/useLiveRefresh", () => ({
  useLiveRefresh: (refresh: () => Promise<unknown>) => {
    mocks.refresh = refresh;
  },
}));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    from: () => {
      const query = {
        select: (...args: unknown[]) => {
          mocks.select(...args);
          return query;
        },
        order: () => query,
        eq: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.result).then(resolve),
      };
      return query;
    },
  },
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.result = { data: [], count: 5, error: null };
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<JoinRequestsPanel />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
});
it("uses the pending list count without a second HEAD request and retains it on failure", async () => {
  expect(container.textContent).toContain("طلبات الانضمام (5)");
  expect(mocks.select).toHaveBeenCalledTimes(1);
  expect(mocks.select.mock.calls[0]![1]).toEqual({ count: "exact" });
  mocks.result = { data: [], count: null, error: { message: "connection closed" } };
  await act(async () => {
    expect(await mocks.refresh!()).toBe(false);
  });
  expect(container.textContent).toContain("طلبات الانضمام (5)");
});
it("keeps the count and avoids queries when offline", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await act(async () => {
    expect(await mocks.refresh!()).toBe(false);
  });
  expect(mocks.select).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("طلبات الانضمام (5)");
});
