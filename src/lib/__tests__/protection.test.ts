import { describe, it, expect, beforeEach } from "vitest";

// Inline rate limiter for testing (avoid importing protection.ts which runs initProtection)
class RpcRateLimiter {
  private calls: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxCalls: number;

  constructor(windowMs = 60_000, maxCalls = 30) {
    this.windowMs = windowMs;
    this.maxCalls = maxCalls;
  }

  check(rpcName: string): boolean {
    const now = Date.now();
    const timestamps = this.calls.get(rpcName) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxCalls) return false;
    recent.push(now);
    this.calls.set(rpcName, recent);
    return true;
  }

  remaining(rpcName: string): number {
    const now = Date.now();
    const timestamps = this.calls.get(rpcName) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxCalls - recent.length);
  }
}

describe("RpcRateLimiter", () => {
  let limiter: RpcRateLimiter;

  beforeEach(() => {
    limiter = new RpcRateLimiter(60_000, 3);
  });

  it("should allow calls within limit", () => {
    expect(limiter.check("test_rpc")).toBe(true);
    expect(limiter.check("test_rpc")).toBe(true);
    expect(limiter.check("test_rpc")).toBe(true);
  });

  it("should block calls over limit", () => {
    limiter = new RpcRateLimiter(60_000, 2);
    limiter.check("test_rpc");
    limiter.check("test_rpc");
    expect(limiter.check("test_rpc")).toBe(false);
  });

  it("should track remaining calls correctly", () => {
    limiter = new RpcRateLimiter(60_000, 5);
    expect(limiter.remaining("test_rpc")).toBe(5);
    limiter.check("test_rpc");
    limiter.check("test_rpc");
    expect(limiter.remaining("test_rpc")).toBe(3);
  });

  it("should isolate rate limits per RPC name", () => {
    limiter = new RpcRateLimiter(60_000, 1);
    limiter.check("rpc_a");
    expect(limiter.check("rpc_a")).toBe(false);
    expect(limiter.check("rpc_b")).toBe(true);
  });
});
