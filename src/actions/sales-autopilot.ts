"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { setSalesPaused, setSalesThreadMode, saveSalesInstructions } from "@/lib/sales-store";
import { getPool } from "@/db/client";
import { logError } from "@/lib/logger";

export async function setSalesPausedAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const paused = form.get("paused") === "true";
  try { await setSalesPaused(paused,user.id); }
  catch (error) { logError("Falha ao alterar kill switch comercial",error); redirect("/autopilot?error=Falha+ao+alterar+controle"); }
  revalidatePath("/autopilot");
  redirect("/autopilot?ok=Configura%C3%A7%C3%A3o+atualizada");
}

export async function setSalesThreadModeAction(contactId: string, form: FormData): Promise<void> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(contactId).success) throw new Error("INVALID_CONTACT_ID");
  const mode = form.get("mode");
  if (mode !== "ai" && mode !== "human") throw new Error("INVALID_MODE");
  try { await setSalesThreadMode(contactId,mode); }
  catch (error) { logError("Falha ao alterar modo da conversa",error,{contactId}); redirect("/autopilot?error=Falha+ao+alterar+conversa"); }
  revalidatePath("/autopilot");
  revalidatePath(`/autopilot/${contactId}`);
  redirect(`/autopilot/${contactId}?ok=Modo+atualizado`);
}

export async function optOutSalesThreadAction(contactId: string): Promise<void> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(contactId).success) throw new Error("INVALID_CONTACT_ID");
  await getPool().query(
    `UPDATE jb_agent_sales_threads SET opted_out=true,mode='human',updated_at=now()
     WHERE contact_id=$1`,[contactId],
  );
  revalidatePath("/autopilot");
  revalidatePath(`/autopilot/${contactId}`);
  redirect(`/autopilot/${contactId}?ok=Contato+bloqueado`);
}

export async function saveSalesInstructionsAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const instructions = String(form.get("instructions") ?? "").trim();
  if (instructions.length > 4000) throw new Error("SALES_INSTRUCTIONS_TOO_LONG");
  try { await saveSalesInstructions(instructions,user.id); }
  catch (error) {
    logError("Falha ao salvar instruções comerciais",error);
    redirect("/autopilot?error=Falha+ao+salvar+instru%C3%A7%C3%B5es");
  }
  revalidatePath("/autopilot");
  redirect("/autopilot?ok=Instru%C3%A7%C3%B5es+salvas");
}
