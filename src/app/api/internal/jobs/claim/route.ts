import type { NextRequest } from "next/server";
import { claimJobs, JobValidationError } from "@/lib/jobs";
import { jobClaimSchema } from "@/lib/validation";
import { jsonError, jsonOk, requireInternalRequest } from "@/lib/http";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalRequest(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido", 400, "INVALID_JSON");
  }

  const parsed = jobClaimSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Payload inválido", 422, "VALIDATION_ERROR");
  }

  try {
    const jobs = await claimJobs(parsed.data.workerId, parsed.data.limit, parsed.data.types);
    return jsonOk({ jobs, count: jobs.length });
  } catch (error) {
    if (error instanceof JobValidationError) return jsonError(error.message, error.status, error.code);
    logError("Falha no claim de tarefas", error, { workerId: parsed.data.workerId });
    return jsonError("Falha ao reivindicar tarefas", 500, "CLAIM_FAILED");
  }
}
