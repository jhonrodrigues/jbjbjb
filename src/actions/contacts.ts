"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contacts, type CrmStage } from "@/db/schema";
import { CRM_STAGES } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/audit";
import { formString } from "@/lib/forms";
import { logError } from "@/lib/logger";
import { moveContactStage, registerContactEvent } from "@/lib/contacts";
import { parseAppLocalInput } from "@/lib/period";
import { contactInputSchema } from "@/lib/validation";

function back(contactId: string, message: string, kind: "ok" | "error" = "ok"): never {
  redirect(`/comercial/${contactId}?${kind === "ok" ? "ok" : "error"}=${encodeURIComponent(message)}`);
}

async function loadContact(contactId: string) {
  const [contact] = await getDb().select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) back(contactId, "Contato não encontrado.", "error");
  return contact;
}

export async function moveContactStageAction(contactId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const stage = formString(formData, "stage") as CrmStage;
  if (!CRM_STAGES.includes(stage)) back(contactId, "Etapa inválida.", "error");

  try {
    const contact = await moveContactStage(contactId, stage, formString(formData, "notes"), user.id);
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "contact_stage_changed",
      entityType: "contact",
      entityId: contactId,
      summary: `Contato movido de ${contact.stage} para ${stage}`,
      metadata: { from: contact.stage, to: stage, leadId: contact.leadId },
    });
  } catch (error) {
    logError("Falha ao mover contato", error, { contactId, stage });
    back(contactId, "Não foi possível mover o contato.", "error");
  }

  revalidatePath("/comercial");
  revalidatePath(`/comercial/${contactId}`);
  back(contactId, "Etapa atualizada.");
}

export async function registerContactEventAction(contactId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const type = formString(formData, "type") || "nota";
  if (!["contato", "resposta", "proposta", "venda", "nota"].includes(type)) back(contactId, "Tipo de evento inválido.", "error");

  try {
    const contact = await registerContactEvent(contactId, type, formString(formData, "notes"), user.id);
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: `contact_${type}`,
      entityType: "contact",
      entityId: contactId,
      summary: `Evento registrado: ${type}`,
      metadata: { leadId: contact.leadId },
    });
  } catch (error) {
    logError("Falha ao registrar evento de contato", error, { contactId, type });
    back(contactId, "Não foi possível registrar o evento.", "error");
  }

  revalidatePath(`/comercial/${contactId}`);
  revalidatePath("/comercial");
  back(contactId, "Evento registrado.");
}

export async function updateContactAction(contactId: string, formData: FormData): Promise<void> {
  await requireUser();
  const proposed = formString(formData, "proposedValue");
  const closed = formString(formData, "closedValue");
  const nextActionAt = formString(formData, "nextActionAt");
  try {
    await loadContact(contactId);
    const input = contactInputSchema.parse({
      leadId: "validated-existing-contact", channel: formString(formData, "channel"),
      nextAction: formString(formData, "nextAction"), notes: formString(formData, "notes"),
      proposedValue: proposed ? Number(proposed.replace(",", ".")) : null,
      closedValue: closed ? Number(closed.replace(",", ".")) : null,
    });
    await getDb()
      .update(contacts)
      .set({
        channel: input.channel || null,
        nextAction: input.nextAction || null,
        nextActionAt: nextActionAt ? parseAppLocalInput(nextActionAt) : null,
        proposedValue: input.proposedValue?.toString() ?? null,
        closedValue: input.closedValue?.toString() ?? null,
        notes: input.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId));
  } catch (error) {
    logError("Falha ao atualizar contato", error, { contactId });
    back(contactId, "Não foi possível atualizar o contato.", "error");
  }
  revalidatePath(`/comercial/${contactId}`);
  revalidatePath("/comercial");
  back(contactId, "Contato atualizado.");
}
