"use server";

import { createHash } from "node:crypto";
import { enqueueJob } from "@/lib/jobs";
import { getLegacyLpById, getLpVersionsForLp } from "@/lib/legacy";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type LpStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/audit";
import { setLpStatus } from "@/lib/lp-status";
import { logError } from "@/lib/logger";

const ALLOWED: LpStatus[] = ["draft", "approved", "published", "archived"];

export async function setLpStatusAction(lpId: string, status: string): Promise<void> {
  const user = await requireUser();
  if (!ALLOWED.includes(status as LpStatus)) throw new Error("INVALID_STATUS");
  const next = status as LpStatus;

  try {
    const result = await setLpStatus(lpId, next);

    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "lp_status_changed",
      entityType: "lp",
      entityId: lpId,
      summary: `Status da landing page alterado para ${next}`,
      metadata: { status: next, ...result },
    });
  } catch (error) {
    logError("Falha ao alterar status da LP", error, { lpId, status });
    redirect(`/landing-pages/${encodeURIComponent(lpId)}?error=${encodeURIComponent("Não foi possível alterar o status da LP.")}`);
  }

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${lpId}`);
  redirect(`/landing-pages/${encodeURIComponent(lpId)}?ok=${encodeURIComponent("Status atualizado.")}`);
}

export async function requestLpRefinementAction(lpId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const url = `/landing-pages/${encodeURIComponent(lpId)}`;
  const fail = (message: string): never => redirect(`${url}?error=${encodeURIComponent(message)}`);
  if (process.env.LP_REFINEMENT_WORKER_READY !== "true") {
    fail("O refinamento orientado ainda não está disponível.");
  }
  const instructions = String(formData.get("instructions") ?? "").trim();
  const baseVersionId = String(formData.get("baseVersionId") ?? "").trim();
  if (!instructions || instructions.length > 2000) fail("Informe melhorias com até 2000 caracteres.");
  const [lp, versions] = await Promise.all([getLegacyLpById(lpId), getLpVersionsForLp(lpId)]);
  const base = versions.find((version) => version.id === baseVersionId);
  if (!lp?.leadId || !base?.htmlSnapshot || base.leadId !== lp.leadId) {
    fail("A versão de referência não está disponível. Atualize a página.");
  }
  const key = createHash("sha256").update(JSON.stringify([lpId, baseVersionId, instructions])).digest("hex");
  try {
    await enqueueJob({
      type: "regenerate_lp",
      leadId: lp.leadId,
      lpId,
      createdBy: user.id,
      idempotencyKey: `refine:${key}`,
      payload: { lpId, leadId: lp.leadId, baseVersionId, baseVersion: base.version, instructions },
      maxAttempts: 1,
    });
  } catch (error) {
    logError("Falha ao solicitar refinamento da LP", error, { lpId });
    fail("Não foi possível solicitar o refinamento. Verifique os limites e o agente.");
  }
  revalidatePath(url);
  redirect(`${url}?ok=${encodeURIComponent("Solicitação enviada para a fila.")}`);
}
