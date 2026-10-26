import { describe, expect, it, vi } from "vitest";

describe("dashboard day keys", () => {
  it("uses APP_TIMEZONE rather than the Node process timezone", async () => {
    const original = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = "Pacific/Kiritimati";
    vi.resetModules();
    try {
      const dashboard = await import("@/lib/dashboard");
      const daysBetween = (dashboard as unknown as {
        daysBetween?: (range: { from: Date; to: Date }) => string[];
      }).daysBetween;
      expect(daysBetween).toBeDefined();
      expect(daysBetween!({
        from: new Date("2026-10-25T10:30:00.000Z"),
        to: new Date("2026-10-27T10:00:00.000Z"),
      })).toEqual(["2026-10-26", "2026-10-27"]);
    } finally {
      if (original === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = original;
      vi.resetModules();
    }
  });
});
