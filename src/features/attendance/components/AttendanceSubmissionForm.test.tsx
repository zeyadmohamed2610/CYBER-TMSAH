import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type SessionSummary } from "../types";
import { AttendanceSubmissionForm } from "./AttendanceSubmissionForm";
const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  toast: vi.fn(),
  verify: null as null | ((receipt: string) => void),
}));
vi.mock("@/shared/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../context/GpsContext", () => ({ useGps: () => ({ coords: { lat: 30, lng: 31 } }) }));
vi.mock("../services/offlineAttendanceService", () => ({
  offlineAttendanceService: { queueSubmission: mocks.submit },
}));
vi.mock("./AttendanceBiometricGate", () => ({
  AttendanceBiometricGate: ({ onVerified }: { onVerified: (id: string) => void }) => {
    mocks.verify = onVerified;
    return <span>تحقق جديد</span>;
  },
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.submit.mockResolvedValue({ success: true, offline: false });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <AttendanceSubmissionForm
        sessions={[
          {
            id: "unrelated",
            isActive: true,
            latitude: 1,
            longitude: 1,
            radiusMeters: 50,
          } as SessionSummary,
        ]}
      />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});
async function code(value: string) {
  const input = container.querySelector<HTMLInputElement>("#attendance-code")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = () =>
  act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
describe("attendance verification lifecycle", () => {
  it("does not reject the entered session because an unrelated active session has a different location", async () => {
    await code("123456");
    await act(async () => mocks.verify!("receipt"));
    await submit();
    expect(mocks.submit).toHaveBeenCalledWith("123456", "receipt");
  });
  it("ignores a late verification after the student changes the attendance code", async () => {
    await code("123456");
    const previous = mocks.verify!;
    await code("654321");
    await act(async () => previous("old-receipt"));
    await submit();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("requires a new verification after its short validity window", async () => {
    await code("123456");
    await act(async () => mocks.verify!("receipt"));
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });
    await submit();
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(container.textContent).toContain("تحقق جديد");
  });
});
