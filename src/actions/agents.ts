"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { cancelJob, retryJob, setAgentPaused } from "@/lib/jobs";
import { logError } from "@/lib/logger";

export async function toggleAgentAction(slug: string, paused: boolean): Promise<void> {
  const user = await requireUser();
  await setAgentPaused(slug, paused, user.id);
  revalidatePath("/agentes");
}

export async function retryJobAction(jobId: string): Promise<void> {
  const user = await requireUser();
  try {
    await retryJob(jobId, user.id);
  } catch (error) {
    logError("Falha ao reenfileirar tarefa", error, { jobId });
    redirect(`/agentes/${jobId}?error=${encodeURIComponent("Não foi possível reenfileirar a tarefa.")}`);
  }
  revalidatePath("/agentes");
  revalidatePath(`/agentes/${jobId}`);
  redirect(`/agentes/${jobId}?ok=${encodeURIComponent("Tarefa reenfileirada.")}`);
}

export async function cancelJobAction(jobId: string): Promise<void> {
  const user = await requireUser();
  try {
    await cancelJob(jobId, user.id);
  } catch (error) {
    logError("Falha ao cancelar tarefa", error, { jobId });
    redirect(`/agentes/${jobId}?error=${encodeURIComponent("Não foi possível cancelar a tarefa.")}`);
  }
  revalidatePath("/agentes");
  revalidatePath(`/agentes/${jobId}`);
  redirect(`/agentes/${jobId}?ok=${encodeURIComponent("Tarefa cancelada.")}`);
}
