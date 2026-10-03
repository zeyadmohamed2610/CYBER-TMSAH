import { attendanceRecordService } from "@/features/attendance/services/attendanceRecordService";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ data: { id: "attendance" }, error: null }),
}));
vi.mock("@/shared/api/supabaseClient", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("../../../shared/lib/deviceFingerprint", () => ({
  computeFingerprint: vi.fn().mockResolvedValue("same-identity-as-device-lock"),
}));

it("submits the same device identity used to register and lock the device", async () => {
  await attendanceRecordService.submitAttendance("123456", 30, 31, "credential");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "submit_attendance",
    expect.objectContaining({
      p_device_fingerprint: "same-identity-as-device-lock",
      p_biometric_credential_id: "credential",
    }),
  );
});
