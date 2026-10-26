import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitForTests();
  });

  it("limits repeated requests within a window", () => {
    expect(checkRateLimit("login:test", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("login:test", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("login:test", 2, 60_000).allowed).toBe(false);
  });

  it("bounds key growth and prunes expired buckets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));

    for (let index = 0; index < 10_000; index += 1) {
      expect(checkRateLimit(`random:${index}`, 1, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit("random:overflow", 1, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit("random:after-expiry", 1, 60_000).allowed).toBe(true);
  });
});
