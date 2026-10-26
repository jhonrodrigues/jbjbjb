import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { completeJob, failJob } = vi.hoisted(() => ({ completeJob: vi.fn(), failJob: vi.fn() }));
vi.mock("@/lib/jobs", async (original) => ({ ...await original<object>(), completeJob, failJob }));
import { POST as complete } from "@/app/api/internal/jobs/[id]/complete/route";
import { POST as fail } from "@/app/api/internal/jobs/[id]/fail/route";
import { JobValidationError } from "@/lib/jobs";
import { resetRateLimitForTests } from "@/lib/rate-limit";

const id = "00000000-0000-4000-8000-000000000001";
const leaseToken = "00000000-0000-4000-8000-000000000002";
const params = { params: Promise.resolve({ id }) };
function request(body: unknown, authorized = true) {
  return new NextRequest(`http://localhost/api/internal/jobs/${id}/complete`, {
    method: "POST", headers: { "content-type": "application/json", ...(authorized ? { authorization: `Bearer ${process.env.INTERNAL_API_SECRET}` } : {}) },
    body: JSON.stringify(body),
  });
}
beforeEach(() => { vi.clearAllMocks(); resetRateLimitForTests(); });
it.each([complete, fail])("rejects old worker contract without lease token", async (handler) => {
  expect((await handler(request({ workerId: "worker", result: {}, error: "fail" }), params)).status).toBe(422);
  expect(completeJob).not.toHaveBeenCalled();
  expect(failJob).not.toHaveBeenCalled();
});
it("passes lease identity to completion and exposes stale-lease conflict", async () => {
  completeJob.mockRejectedValue(new JobValidationError("Stale", 409, "JOB_STALE_LEASE"));
  const response = await complete(request({ workerId: "worker", result: {}, leaseToken }), params);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "JOB_STALE_LEASE" });
  expect(completeJob).toHaveBeenCalledWith(id, "worker", {}, leaseToken);
});
it("does not accept lease token instead of internal authentication", async () => {
  expect((await complete(request({ workerId: "worker", leaseToken }, false), params)).status).toBe(401);
});
