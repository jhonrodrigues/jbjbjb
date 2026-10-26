"use server";

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
