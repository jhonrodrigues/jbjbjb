"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { campaignLeads, campaigns, contacts, leadMeta, type JobType } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";
import { formString } from "@/lib/forms";
import { logError } from "@/lib/logger";
import { PRIORITY_LABELS } from "@/lib/labels";

function backToLead(leadId: string, message: string, kind: "ok" | "error" = "ok"): never {
  redirect(`/leads/${encodeURIComponent(leadId)}?${kind === "ok" ? "ok" : "error"}=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const known: Record<string, string> = {
      AGENT_PAUSED: "O agente está pausado. Reative-o em Agentes.",
      JOB_LIMIT: "O limite diário de tarefas foi atingido.",
      LP_LIMIT: "O limite diário de geração de LPs foi atingido.",
    };
    return known[error.message] ?? error.message;
  }
  return "Erro inesperado.";
}

export async function setLeadPriorityAction(leadId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const priority = formString(formData, "priority");
  if (!["alta", "media", "baixa", "nao_avaliada", ""].includes(priority)) backToLead(leadId, "Prioridade inválida.", "error");
  try {
    await getDb()
      .insert(leadMeta)
      .values({ leadId, priorityOverride: priority || null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: leadMeta.leadId,
        set: { priorityOverride: priority || null, updatedAt: new Date() },
      });
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "lead_priority_changed",
      entityType: "lead",
      entityId: leadId,
      summary: `Prioridade do lead alterada para ${PRIORITY_LABELS[priority] ?? "automática"}`,
      metadata: { priority },
    });
  } catch (error) {
    logError("Falha ao alterar prioridade", error, { leadId });
    backToLead(leadId, "Não foi possível alterar a prioridade.", "error");
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  backToLead(leadId, "Prioridade atualizada.");
}

export async function approveLeadAction(leadId: string): Promise<void> {
  const user = await requireUser();
  try {
    await getDb()
      .insert(leadMeta)
      .values({ leadId, approvedAt: new Date(), discardedAt: null, approvedBy: user.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: leadMeta.leadId,
        set: { approvedAt: new Date(), discardedAt: null, approvedBy: user.id, updatedAt: new Date() },
      });
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "lead_approved",
      entityType: "lead",
      entityId: leadId,
      summary: "Lead aprovado manualmente",
    });
  } catch (error) {
    logError("Falha ao aprovar lead", error, { leadId });
    backToLead(leadId, "Não foi possível aprovar o lead.", "error");
  }
  revalidatePath(`/leads/${leadId}`);
  backToLead(leadId, "Lead aprovado.");
}

export async function discardLeadAction(leadId: string): Promise<void> {
  const user = await requireUser();
  try {
    await getDb()
      .insert(leadMeta)
      .values({ leadId, discardedAt: new Date(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: leadMeta.leadId,
        set: { discardedAt: new Date(), updatedAt: new Date() },
      });
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "lead_discarded",
      entityType: "lead",
      entityId: leadId,
      summary: "Lead descartado manualmente",
    });
  } catch (error) {
    logError("Falha ao descartar lead", error, { leadId });
    backToLead(leadId, "Não foi possível descartar o lead.", "error");
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  backToLead(leadId, "Lead descartado.");
}

export async function restoreLeadAction(leadId: string): Promise<void> {
  const user = await requireUser();
  try {
    await getDb()
      .insert(leadMeta)
      .values({ leadId, discardedAt: null, updatedAt: new Date() })
      .onConflictDoUpdate({ target: leadMeta.leadId, set: { discardedAt: null, updatedAt: new Date() } });
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "lead_restored",
      entityType: "lead",
      entityId: leadId,
      summary: "Lead restaurado",
    });
  } catch (error) {
    logError("Falha ao restaurar lead", error, { leadId });
    backToLead(leadId, "Não foi possível restaurar o lead.", "error");
  }
  revalidatePath(`/leads/${leadId}`);
  backToLead(leadId, "Lead restaurado.");
}

export async function addLeadToCampaignAction(leadId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const campaignId = formString(formData, "campaignId");
  if (!campaignId) backToLead(leadId, "Selecione uma campanha.", "error");
  try {
    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) backToLead(leadId, "Campanha não encontrada.", "error");
    await db
      .insert(campaignLeads)
      .values({ campaignId, leadId, source: "manual" })
      .onConflictDoNothing({ target: [campaignLeads.campaignId, campaignLeads.leadId] });
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "lead_added_to_campaign",
      entityType: "lead",
      entityId: leadId,
      summary: `Lead adicionado à campanha ${campaign.name}`,
      metadata: { campaignId },
    });
  } catch (error) {
    logError("Falha ao adicionar lead à campanha", error, { leadId, campaignId });
    backToLead(leadId, "Não foi possível adicionar à campanha.", "error");
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/campanhas");
  backToLead(leadId, "Lead adicionado à campanha.");
}

export async function addLeadToCrmAction(leadId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const campaignId = formString(formData, "campaignId") || null;
  try {
    const db = getDb();
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`crm-lead:${leadId}`}))`);
      const existing = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.leadId, leadId))
        .limit(1);
      if (existing[0]) return false;
      await tx.insert(contacts).values({ leadId, campaignId, ownerId: user.id, stage: "identificado", channel: "manual" });
      return true;
    });
    if (created) await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "contact_created",
      entityType: "lead",
      entityId: leadId,
      summary: "Lead adicionado ao CRM",
      metadata: { campaignId },
    });
  } catch (error) {
    logError("Falha ao adicionar lead ao CRM", error, { leadId });
    backToLead(leadId, "Não foi possível adicionar ao CRM.", "error");
  }
  revalidatePath("/comercial");
  revalidatePath(`/leads/${leadId}`);
  redirect("/comercial?created=1");
}

const LEAD_JOB_TYPES = new Set<JobType>(["analyze_lead", "research_brand", "generate_lp", "regenerate_lp", "prepare_outreach"]);

export async function enqueueLeadJobAction(leadId: string, type: string): Promise<void> {
  const user = await requireUser();
  if (!LEAD_JOB_TYPES.has(type as JobType)) backToLead(leadId, "Tipo de tarefa inválido.", "error");
  const jobType = type as JobType;
  try {
    await enqueueJob({
      type: jobType,
      leadId,
      createdBy: user.id,
      idempotencyKey: `${jobType}:${leadId}:${new Date().toISOString().slice(0, 13)}`,
      payload: { leadId },
    });
  } catch (error) {
    logError("Falha ao enfileirar tarefa de lead", error, { leadId, type });
    backToLead(leadId, errorMessage(error), "error");
  }
  revalidatePath("/agentes");
  revalidatePath(`/leads/${leadId}`);
  backToLead(leadId, "Tarefa enviada para a fila.");
}
