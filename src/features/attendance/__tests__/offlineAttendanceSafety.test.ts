import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn(), getSession: vi.fn() }));
vi.mock("../services/attendanceService", () => ({ attendanceService: { submitAttendance: mocks.submit } }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock("../utils/fingerprint", () => ({ computeFingerprint: vi.fn().mockResolvedValue("device") }));
import { offlineAttendanceService } from "../services/offlineAttendanceService";

const key = "cyber_tmsah_pending_attendance";
const entry = (id: string, authId?: string) => ({ id, authId, hash: "123456", latitude: null, longitude: null, retries: 4, timestamp: new Date().toISOString() });
describe("attendance queue safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "student-a" } } } });
    mocks.submit.mockResolvedValue({ error: null });
  });
  it("never submits another account's entries or unbound legacy entries", async () => {
    localStorage.setItem(key, JSON.stringify([entry("own", "student-a"), entry("other", "student-b"), entry("legacy")]));
    const result = await offlineAttendanceService.syncPending();
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ synced: 1, failed: 2 });
    expect(offlineAttendanceService.getPendingItems().map(item => item.id)).toEqual(["other", "legacy"]);
  });
  it("preserves a failed entry after the fifth attempt", async () => {
    localStorage.setItem(key, JSON.stringify([entry("own", "student-a")]));
    mocks.submit.mockResolvedValue({ error: "temporarily unavailable" });
    await offlineAttendanceService.syncPending();
    expect(offlineAttendanceService.getPendingItems()).toEqual([expect.objectContaining({ id: "own", retries: 5 })]);
  });
  it("preserves entries added while a request is in flight", async () => {
    localStorage.setItem(key, JSON.stringify([entry("own", "student-a")]));
    mocks.submit.mockImplementation(async () => {
      localStorage.setItem(key, JSON.stringify([entry("own", "student-a"), entry("new", "student-a")]));
      return { error: null };
    });
    await offlineAttendanceService.syncPending();
    expect(offlineAttendanceService.getPendingItems().map(item => item.id)).toEqual(["new"]);
  });
  it("does not send entries while logged out", async () => {
    localStorage.setItem(key, JSON.stringify([entry("own", "student-a")]));
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await offlineAttendanceService.syncPending();
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(offlineAttendanceService.getPendingCount()).toBe(1);
  });
  it("stops sending entries if the account changes during synchronization", async () => {
    localStorage.setItem(key, JSON.stringify([entry("own", "student-a")]));
    mocks.getSession.mockResolvedValueOnce({ data: { session: { user: { id: "student-a" } } } }).mockResolvedValueOnce({ data: { session: { user: { id: "student-b" } } } });
    await offlineAttendanceService.syncPending();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("shares a single synchronization when two callers run at once", async () => {
    localStorage.setItem(key, JSON.stringify([entry("own", "student-a")]));
    const first = offlineAttendanceService.syncPending();
    const second = offlineAttendanceService.syncPending();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it("does not claim a new attendance succeeded while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValueOnce(false);
    expect((await offlineAttendanceService.queueSubmission("123456")).success).toBe(false);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(offlineAttendanceService.getPendingCount()).toBe(0);
  });
});
