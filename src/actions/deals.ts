"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contacts, contactEvents, lpVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { DELIVERY_TASKS, deriveDealState, centsToPrice, priceToCents, type DealEvent } from "@/lib/deals";
import { formString } from "@/lib/forms";
import { logError } from "@/lib/logger";

function back(id: string, message: string, error = false): never {
  redirect(`/comercial/${encodeURIComponent(id)}?${error ? "error" : "ok"}=${encodeURIComponent(message)}#negocio`);
}
function refresh(id: string) {
  revalidatePath(`/comercial/${id}`);
  revalidatePath("/comercial");
  revalidatePath("/operacao");
}
function fail(id: string, message: string): never { back(id, message, true); }

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function load(tx: Tx, id: string) {
  const [contact] = await tx.select().from(contacts).where(eq(contacts.id, id)).limit(1).for("update");
  if (!contact) throw new Error("CONTACT_NOT_FOUND");
  const history = await tx.select().from(contactEvents)
    .where(eq(contactEvents.contactId, id)).orderBy(desc(contactEvents.createdAt), desc(contactEvents.id)).limit(500);
  return { contact, state: deriveDealState(history as DealEvent[]) };
}

async function ensureApprovedLp(tx: Tx, lpId: string | null) {
  if (!lpId) throw new Error("LP_REQUIRED");
  const [latest] = await tx.select({ status: lpVersions.status }).from(lpVersions)
    .where(eq(lpVersions.lpId, lpId)).orderBy(desc(lpVersions.version)).limit(1);
  if (!latest || !["approved", "published"].includes(latest.status)) throw new Error("LP_APPROVAL_REQUIRED");
}

async function addEvent(
  tx: Tx, contactId: string, userId: string, type: string,
  notes: string, metadata: Record<string, unknown>,
) {
  await tx.insert(contactEvents).values({ contactId, type, notes, metadata, createdBy: userId });
}

export async function saveProposalDraftAction(id: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const title = formString(form, "title").trim();
  const scope = formString(form, "scope").trim();
  const price = priceToCents(formString(form, "price"));
  const monthly = priceToCents(formString(form, "monthly") || "0");
  const days = Number(formString(form, "deliveryDays"));
  if (title.length < 5 || title.length > 120 || scope.length < 30 || scope.length > 6000
      || price === null || price < 100 || monthly === null || days < 1 || days > 365 || !Number.isInteger(days)) {
    fail(id, "Confira título, escopo, valores e prazo da proposta.");
  }
  try {
    await getDb().transaction(async tx => {
      const { contact, state } = await load(tx, id);
      if (["fechado", "perdido"].includes(contact.stage) || ["accepted", "paid"].includes(state.status)) {
        throw new Error("NEGOCIACAO_ENCERRADA");
      }
      const proposalId = randomUUID();
      await addEvent(tx, id, user.id, "proposta_rascunho", scope, {
        proposal_id: proposalId, title, price: centsToPrice(price), monthly: centsToPrice(monthly),
        delivery_days: days, delivery: "not_sent",
      });
      await tx.update(contacts).set({ updatedAt: new Date(), nextAction: "Revisar e apresentar proposta" }).where(eq(contacts.id, id));
    });
  } catch (error) {
    logError("Falha ao criar proposta", error, { contactId: id });
    fail(id, "Não foi possível salvar a proposta.");
  }
  refresh(id);
  back(id, "Proposta salva como rascunho. Nenhuma mensagem foi enviada.");
}

export async function markProposalSentAction(id: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const proposalId = formString(form, "proposalId");
  const channel = formString(form, "channel").trim();
  const note = formString(form, "notes").trim();
  const confirmed = form.get("manualSent") === "on";
  if (!confirmed || !["email","instagram","whatsapp","telefone","outro"].includes(channel) || note.length > 2000) {
    fail(id, "Confirme o envio manual e selecione o canal utilizado.");
  }
  if (channel === "whatsapp" && form.get("waConsent") !== "on") {
    fail(id, "Para registrar envio pelo WhatsApp, confirme autorização prévia para contato comercial.");
  }
  try {
    await getDb().transaction(async tx => {
      const { contact, state } = await load(tx, id);
      if (!state.proposal || state.proposal.id !== proposalId || state.status !== "draft") throw new Error("DRAFT_CHANGED");
      if (!["respondeu","em_negociacao","proposta_enviada"].includes(contact.stage)) throw new Error("LEAD_NOT_INTERESTED");
      await ensureApprovedLp(tx, contact.lpId);
      await addEvent(tx, id, user.id, "proposta_enviada", note || "Proposta apresentada manualmente.", {
        proposal_id: proposalId, channel, delivery: "confirmed_manually",
      });
      await tx.update(contacts).set({
        stage: "proposta_enviada", proposedValue: state.proposal.price,
        nextAction: "Aguardar resposta à proposta", updatedAt: new Date(),
      }).where(eq(contacts.id, id));
    });
  } catch (error) {
    logError("Falha ao registrar proposta enviada", error, { contactId: id });
    fail(id, "Envio não registrado. Verifique a aprovação da LP, o interesse do lead e a versão da proposta.");
  }
  refresh(id);
  back(id, "Envio manual registrado. Proposta vinculada ao histórico.");
}

export async function recordProposalAcceptanceAction(id: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const proposalId = formString(form, "proposalId");
  const evidence = formString(form, "evidence").trim();
  if (form.get("acceptanceConfirmed") !== "on" || evidence.length < 8 || evidence.length > 2000) {
    fail(id, "Confirme o aceite real e registre quando e como ele foi recebido.");
  }
  try {
    await getDb().transaction(async tx => {
      const { contact, state } = await load(tx, id);
      if (contact.stage === "perdido" || state.proposal?.id !== proposalId || state.status !== "sent") {
        throw new Error("INVALID_ACCEPTANCE");
      }
      await addEvent(tx, id, user.id, "aceite_recebido", evidence, {
        proposal_id: proposalId, source: "manual_confirmation",
      });
      await tx.update(contacts).set({
        nextAction: "Aguardar confirmação do pagamento integral",
        updatedAt: new Date(),
      }).where(eq(contacts.id, id));
    });
  } catch (error) {
    logError("Falha ao registrar aceite", error, { contactId: id });
    fail(id, "Aceite não registrado. Confirme que a proposta foi enviada e está ativa.");
  }
  refresh(id);
  back(id, "Aceite do cliente registrado. Aguardando confirmação de pagamento.");
}

export async function recordFullPaymentAction(id: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const proposalId = formString(form, "proposalId");
  const reference = formString(form, "reference").trim();
  const amount = priceToCents(formString(form, "amount"));
  if (form.get("paymentConfirmed") !== "on" || !reference || reference.length > 300 || amount === null) {
    fail(id, "Confirme o pagamento real, o valor integral e a referência.");
  }
  try {
    await getDb().transaction(async tx => {
      const { contact, state } = await load(tx, id);
      if (state.proposal?.id !== proposalId || state.status !== "accepted" || contact.stage === "perdido") {
        throw new Error("INVALID_PAYMENT");
      }
      const expected = priceToCents(state.proposal.price);
      if (!expected || expected !== amount) throw new Error("AMOUNT_MISMATCH");
      await addEvent(tx, id, user.id, "pagamento_confirmado", reference, {
        proposal_id: proposalId, amount: state.proposal.price,
        payment: "manually_confirmed", reference,
      });
      await tx.update(contacts).set({
        stage: "fechado", closedAt: new Date(), closedValue: state.proposal.price,
        proposedValue: state.proposal.price, nextAction: "Executar checklist de entrega",
        updatedAt: new Date(),
      }).where(eq(contacts.id, id));
    });
  } catch (error) {
    logError("Falha ao confirmar pagamento", error, { contactId: id });
    fail(id, "Pagamento não registrado. O valor precisa coincidir com o total da implantação.");
  }
  refresh(id);
  back(id, "Pagamento integral registrado manualmente. Checklist de entrega liberado.");
}

export async function completeDeliveryTaskAction(id: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const proposalId = formString(form, "proposalId");
  const key = formString(form, "taskKey");
  const note = formString(form, "note").trim();
  if (!DELIVERY_TASKS.some(item => item.key === key) || note.length > 1500) fail(id, "Etapa de entrega inválida.");
  if (["autorizacao_publicacao","publicacao","entrega"].includes(key) && note.length < 8) {
    fail(id, "Registre uma evidência objetiva para concluir esta etapa.");
  }
  try {
    await getDb().transaction(async tx => {
      const { state } = await load(tx, id);
      if (state.proposal?.id !== proposalId || state.status !== "paid" || state.deliveryFinished
        || state.completedTasks.includes(key as typeof state.completedTasks[number])) {
        throw new Error("INVALID_DELIVERY_STEP");
      }
      await addEvent(tx, id, user.id, "entrega_item_concluido", note || "Concluído manualmente.", {
        proposal_id: proposalId, task_key: key,
      });
      await tx.update(contacts).set({ updatedAt: new Date(), nextAction: "Continuar checklist de entrega" }).where(eq(contacts.id, id));
    });
  } catch (error) {
    logError("Falha no checklist de entrega", error, { contactId: id });
    fail(id, "Não foi possível concluir a etapa. Atualize a página e tente novamente.");
  }
  refresh(id);
  back(id, "Etapa de entrega registrada.");
}

export async function finishDeliveryAction(id: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const proposalId = formString(form, "proposalId");
  const note = formString(form, "note").trim();
  if (form.get("deliveryConfirmed") !== "on" || note.length < 8 || note.length > 1500) {
    fail(id, "Confirme a entrega e registre como o cliente recebeu os acessos.");
  }
  try {
    await getDb().transaction(async tx => {
      const { state } = await load(tx, id);
      if (state.proposal?.id !== proposalId || state.status !== "paid" || state.deliveryFinished
        || state.completedTasks.length !== DELIVERY_TASKS.length) throw new Error("DELIVERY_INCOMPLETE");
      await addEvent(tx, id, user.id, "entrega_concluida", note, { proposal_id: proposalId });
      await tx.update(contacts).set({ nextAction: "Acompanhar pós-venda", updatedAt: new Date() }).where(eq(contacts.id, id));
    });
  } catch (error) {
    logError("Falha ao finalizar entrega", error, { contactId: id });
    fail(id, "Entrega não concluída. Todas as etapas precisam estar registradas.");
  }
  refresh(id);
  back(id, "Entrega concluída e registrada no histórico comercial.");
}
