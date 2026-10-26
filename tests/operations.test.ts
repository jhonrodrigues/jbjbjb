import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

const { Pool } = vi.hoisted(() => ({ Pool: vi.fn(function () { return { on: vi.fn() }; }) }));
vi.mock("pg", () => ({ Pool }));
import { getPool, hasDatabaseUrl } from "@/db/client";

it("accepts PostgreSQL environment fields without interpolating password into a URL", () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PGHOST", "localhost");
  vi.stubEnv("PGDATABASE", "autopilot_verify");
  vi.stubEnv("PGUSER", "verify");
  vi.stubEnv("PGPASSWORD", "synthetic/@#?+:");
  expect(hasDatabaseUrl()).toBe(true);
  getPool();
  expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ connectionString: undefined }));
  vi.unstubAllEnvs();
});

it("never selects or prints samples in the inspection script", () => {
  const script = readFileSync(new URL("../scripts/inspect-legacy.mjs", import.meta.url), "utf8");
  expect(script).not.toMatch(/select \*|Amostra:|JSON\.stringify/);
});
