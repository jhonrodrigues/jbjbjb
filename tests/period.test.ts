import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePeriod } from "@/lib/period";

describe("resolvePeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 15, 30, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to the last 30 days", () => {
    const range = resolvePeriod(undefined);
    expect(range.key).toBe("30d");
    expect(range.from.getDate()).toBe(27);
    expect(range.from.getMonth()).toBe(8);
    expect(range.to.getDate()).toBe(27);
    expect(range.to.getMonth()).toBe(9);
  });

  it("includes all of today", () => {
    const range = resolvePeriod("today");
    expect(range.from.toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000);
  });

  it("uses configured timezone before UTC midnight and rejects reversed ranges", () => {
    vi.setSystemTime(new Date("2026-10-26T01:00:00Z"));
    expect(resolvePeriod("today").fromIso).toBe("2026-10-25T03:00:00.000Z");
    expect(resolvePeriod("custom", "2026-10-30", "2026-10-01").label).toBe("Últimos 30 dias");
  });

  it("accepts a valid custom range", () => {
    const range = resolvePeriod("custom", "2026-10-01", "2026-10-10");
    expect(range.from.getDate()).toBe(1);
    expect(range.to.getDate()).toBe(11);
    expect(range.label).toContain("01/10/2026");
  });

  it("falls back when custom dates are invalid", () => {
    const range = resolvePeriod("custom", "invalid", "2026-10-10");
    expect(range.key).toBe("custom");
    expect(range.label).toBe("Últimos 30 dias");
  });
});
