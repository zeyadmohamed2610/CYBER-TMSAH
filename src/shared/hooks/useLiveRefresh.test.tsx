import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useLiveRefresh } from "./useLiveRefresh";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), event: undefined as undefined | (() => void) }));
vi.mock("@/shared/api/supabaseClient", () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (_: unknown, __: unknown, event: () => void) => {
          mocks.event = event;
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: mocks.remove,
  },
}));
let root: Root;
let container: HTMLDivElement;
let refresh: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
function Probe() {
  useLiveRefresh(refresh, ["join_requests"]);
  return null;
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  refresh = vi.fn().mockResolvedValue(true);
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<Probe />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const advance = async (time: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(time);
  });
it("does not poll while offline or hidden and resumes once online", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await advance(90_000);
  expect(refresh).not.toHaveBeenCalled();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await advance(30_000);
  expect(refresh).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  window.dispatchEvent(new Event("online"));
  await advance(300);
  expect(refresh).toHaveBeenCalledTimes(1);
});
it.each([false, "throw"])(
  "backs off after %s failures and reconnecting resets delay",
  async (failure) => {
    if (failure === false) refresh.mockResolvedValue(false);
    else refresh.mockRejectedValue(new Error("offline"));
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    await advance(90_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    refresh.mockResolvedValue(true);
    window.dispatchEvent(new Event("online"));
    await advance(300);
    expect(refresh).toHaveBeenCalledTimes(3);
  },
);
it("coalesces live events and never overlaps requests", async () => {
  let resolve!: (value: boolean) => void;
  refresh.mockImplementationOnce(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  mocks.event!();
  mocks.event!();
  window.dispatchEvent(new Event("focus"));
  await advance(300);
  expect(refresh).toHaveBeenCalledTimes(1);
  mocks.event!();
  await advance(300);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => resolve(true));
  await advance(300);
  expect(refresh).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
  await advance(60_000);
  expect(refresh).toHaveBeenCalledTimes(2);
});
