import { expect, it } from "vitest";
import { parseAppLocalInput, toAppLocalInput } from "@/lib/period";
it("roundtrips commercial local inputs in the application timezone", () => {
  const date = parseAppLocalInput("2026-10-26T09:30");
  expect(date.toISOString()).toBe("2026-10-26T12:30:00.000Z");
  expect(toAppLocalInput(date)).toBe("2026-10-26T09:30");
  expect(() => parseAppLocalInput("2026-02-30T09:30")).toThrow("INVALID_LOCAL_DATE");
});
