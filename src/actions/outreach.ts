"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contactEvents, contacts, lpVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { formString } from "@/lib/forms";
import { logError } from "@/lib/logger";
import { canApproachLead, nextOutreachStage, OUTREACH_CHANNELS } from "@/lib/outreach";

function back(contactId: string, message: string, kind: "ok" | "error" = "ok"): never {
  redirect(`/comercial/${contactId}?${kind}=${encodeURIComponent(message)}#central-contato`);
}

function refresh(contactId: string) {
  revalidatePath(`/comercial/${contactId}`);
  revalidatePath("/comercial");
  revalidatePath("/operacao");
}

export async function saveOutreachDraftAction(contactId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const message = formString(formData, "message").trim();
  if (message.length < 15 || message.length > 2200) {
    back(contactId, "A abordagem precisa ter entre 15 e 2200 caracteres.", "error");
  }

  try {
    await getDb().transaction(async tx => {
      const [contact] = await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
      if (!contact) throw new Error("CONTACT_NOT_FOUND");
      await tx.insert(contactEvents).values({
        contactId,
        type: "abordagem_rascunho",
        notes: message,
        metadata: { format: "permission_request", delivery: "not_sent" },
        createdBy: user.id,
      });
      await tx.update(contacts).set({ updatedAt: new Date() }).where(eq(contacts.id, contactId));
    });
  } catch (error) {
    logError("Falha ao salvar abordagem", error, { contactId });
    back(contactId, "Não foi possível salvar a abordagem.", "error");
  }

  refresh(contactId);
  back(contactId, "Abordagem salva como rascunho. Nenhuma mensagem foi enviada.");
}

export async function recordManualOutreachAction(contactId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const channel = formString(formData, "channel");
  const notes = formString(formData, "notes").trim();
  const actualMessage = formString(formData, "actualMessage").trim();
  const consentConfirmed = formData.get("consentConfirmed") === "on";
  if (!OUTREACH_CHANNELS.some(item => item.value === channel)) {
    back(contactId, "Selecione um canal válido.", "error");
  }
  if (channel === "whatsapp" && !consentConfirmed) {
    back(contactId, "Confirme a autorização do contato antes de registrar WhatsApp.", "error");
  }
  if (notes.length > 2000 || actualMessage.length > 2200) {
    back(contactId, "O registro ultrapassa o limite permitido.", "error");
  }

  try {
    await getDb().transaction(async tx => {
      const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).for("update");
      if (!contact) throw new Error("CONTACT_NOT_FOUND");
      if (contact.stage === "fechado" || contact.stage === "perdido") throw new Error("CONTACT_CLOSED");

      if (contact.lpId) {
        const [latest] = await tx
          .select({ status: lpVersions.status })
          .from(lpVersions)
          .where(eq(lpVersions.lpId, contact.lpId))
          .orderBy(desc(lpVersions.version))
          .limit(1);
        if (!canApproachLead(contact.lpId, latest?.status ?? null)) {
          throw new Error("LP_NOT_APPROVED");
        }
      }

      const next = nextOutreachStage(contact.stage, "contato");
      await tx.insert(contactEvents).values({
        contactId,
        type: "contato",
        fromStage: next !== contact.stage ? contact.stage : null,
        toStage: next !== contact.stage ? next as typeof contact.stage : null,
        notes: notes || "Contato realizado manualmente.",
        metadata: { channel, actualMessage: actualMessage || null, consentConfirmed: channel === "whatsapp" ? consentConfirmed : null, delivery: "confirmed_manually" },
        createdBy: user.id,
      });
      await tx.update(contacts)
        .set({
          stage: next as typeof contact.stage,
          channel,
          nextAction: "Aguardar resposta e acompanhar conversa",
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contactId));
    });
  } catch (error) {
    logError("Falha ao registrar abordagem manual", error, { contactId });
    back(
      contactId,
      error instanceof Error && error.message === "LP_NOT_APPROVED"
        ? "A demonstração precisa ser aprovada antes de registrar a abordagem."
        : "Não foi possível registrar o contato.",
      "error",
    );
  }

  refresh(contactId);
  back(contactId, "Contato manual registrado. Histórico e pipeline atualizados.");
}

export async function recordLeadReplyAction(contactId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const notes = formString(formData, "notes").trim();
  if (notes.length < 3 || notes.length > 4000) {
    back(contactId, "Resuma a resposta recebida (3 a 4000 caracteres).", "error");
  }
  try {
    await getDb().transaction(async tx => {
      const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).for("update");
      if (!contact) throw new Error("CONTACT_NOT_FOUND");
      if (contact.stage === "fechado" || contact.stage === "perdido") throw new Error("CONTACT_CLOSED");
      const next = nextOutreachStage(contact.stage, "resposta");
      await tx.insert(contactEvents).values({
        contactId,
        type: "resposta",
        fromStage: next !== contact.stage ? contact.stage : null,
        toStage: next !== contact.stage ? next as typeof contact.stage : null,
        notes,
        metadata: { direction: "inbound", delivery: "received_manually" },
        createdBy: user.id,
      });
      await tx.update(contacts).set({
        stage: next as typeof contact.stage,
        nextAction: "Responder ao interesse e apresentar demonstração quando autorizada",
        updatedAt: new Date(),
      }).where(eq(contacts.id, contactId));
    });
  } catch (error) {
    logError("Falha ao registrar resposta recebida", error, { contactId });
    back(contactId, "Não foi possível registrar a resposta.", "error");
  }
  refresh(contactId);
  back(contactId, "Resposta registrada e oportunidade atualizada.");
}
