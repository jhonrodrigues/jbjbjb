import type { NextRequest } from "next/server";
import { completeJob, JobValidationError } from "@/lib/jobs";
import { jobResultSchema } from "@/lib/validation";
import { jsonError, jsonOk, requireInternalRequest } from "@/lib/http";
import { logError } from "@/lib/logger";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireInternalRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("ID de tarefa inválido", 400, "INVALID_ID");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido", 400, "INVALID_JSON");
  }

  const parsed = jobResultSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Payload inválido", 422, "VALIDATION_ERROR");
  }

  try {
    const job = await completeJob(id, parsed.data.workerId, parsed.data.result, parsed.data.leaseToken);
    return jsonOk({ job });
  } catch (error) {
    if (error instanceof JobValidationError) return jsonError(error.message, error.status, error.code);
    logError("Falha ao concluir tarefa", error, { jobId: id });
    return jsonError("Falha ao concluir a tarefa", 500, "COMPLETE_FAILED");
  }
}
