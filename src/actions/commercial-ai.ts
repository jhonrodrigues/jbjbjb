"use server";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contactEvents, contacts } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { getLeadById } from "@/lib/legacy";
import {
  createCommercialAiSuggestion, type CommercialAiKind,
  type CommercialAiResult,
} from "@/lib/commercial-ai";
import { logError } from "@/lib/logger";

export async function generateCommercialAiDraftAction(
  contactId: string, kind: CommercialAiKind,
): Promise<CommercialAiResult> {
  const user = await requireUser();
  if (kind !== "outreach" && kind !== "proposal") return { ok: false, error: "Tipo de rascunho inválido." };
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Configure OPENAI_API_KEY no EasyPanel para habilitar a IA." };
  }
  try {
    const db = getDb();
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
    if (!contact) return { ok: false, error: "Contato não encontrado." };
    if (["fechado", "perdido"].includes(contact.stage)) {
      return { ok: false, error: "Esta oportunidade não está aberta para novas propostas ou abordagens." };
    }

    // Reserva de cota ANTES de chamar a IA. Serializa solicitações do mesmo contato
    // e impede cliques repetidos de gerar chamadas sem contabilização.
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"commercial-ai:" + user.id}))`);
      await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId)).limit(1).for("update");
      const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [{ total: userToday }] = await tx.select({ total: count() }).from(contactEvents)
        .where(and(eq(contactEvents.createdBy, user.id),
                   eq(contactEvents.type, "ia_solicitacao"), gte(contactEvents.createdAt, sinceDay)));
      if (Number(userToday) >= 40) throw new Error("AI_RATE_LIMIT");
      const sinceMinute = new Date(Date.now() - 60 * 1000);
      const [{ total: contactToday }] = await tx.select({ total: count() }).from(contactEvents)
        .where(and(eq(contactEvents.contactId, contactId),
                   eq(contactEvents.type, "ia_solicitacao"), gte(contactEvents.createdAt, sinceDay)));
      const [{ total: contactMinute }] = await tx.select({ total: count() }).from(contactEvents)
        .where(and(eq(contactEvents.contactId, contactId),
                   eq(contactEvents.type, "ia_solicitacao"), gte(contactEvents.createdAt, sinceMinute)));
      if (Number(contactToday) >= 12 || Number(contactMinute) >= 2) throw new Error("AI_RATE_LIMIT");
      await tx.insert(contactEvents).values({
        contactId,
        type: "ia_solicitacao",
        notes: null,
        metadata: { kind, status: "requested", model: process.env.JB_COMMERCIAL_AI_MODEL || "gpt-4.1-mini" },
        createdBy: user.id,
      });
    });

    const lead = await getLeadById(contact.leadId);
    if (!lead) return { ok: false, error: "Dados do lead não disponíveis." };

    const suggestion = await createCommercialAiSuggestion(kind, {
      businessName: lead.empresa || "Negócio local",
      niche: lead.nicho ?? null,
      city: lead.cidade ?? null,
      website: lead.site ?? null,
      hasDemonstration: Boolean(contact.lpId),
      lpApproved: false, // Aprovação nunca é inferida a partir da existência da LP.
    });
    return { ok: true, suggestion };
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMIT") {
      return { ok: false, error: "Limite de IA atingido (2/minuto e 12/24h por contato, ou 40/24h por operador)." };
    }
    logError("Falha ao gerar sugestão comercial por IA", error, { contactId, kind });
    return { ok: false, error: "A IA não conseguiu gerar o rascunho. Verifique o modelo e a chave de API." };
  }
}
