import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, release } = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("@/db/client", () => ({
  getPool: () => ({ connect: async () => ({ query, release }) }),
  getDb: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({ getPlatformSettings: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordActivity: vi.fn() }));
import { completeJob, failJob } from "@/lib/jobs";

describe("worker failure contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["pending", "cancelled", "failed"])("rejects failure for %s jobs", async (status) => {
    query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("select") ? [{ id: "job", status, attempts: 0 }] : [],
    }));
    await expect(failJob("job", "worker", "failure", true, "old-lease")).rejects.toMatchObject({
      status: 409,
      code: "JOB_NOT_PROCESSING",
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("update jb_agent_jobs"))).toBe(false);
    expect(release).toHaveBeenCalled();
  });

  it.each(["complete", "fail"])("rejects stale %s from the same worker", async (action) => {
    query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("select") ? [{
      id: "job", status: "processing", locked_by: "worker", lease_token: "new-lease", locked_at: new Date(),
    }] : [] }));
    const call = action === "complete"
      ? completeJob("job", "worker", {}, "old-lease")
      : failJob("job", "worker", "late", true, "old-lease");
    await expect(call).rejects.toMatchObject({ code: "JOB_STALE_LEASE" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("update jb_agent_jobs"))).toBe(false);
  });
});
