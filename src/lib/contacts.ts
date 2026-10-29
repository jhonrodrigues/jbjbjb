import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, getPool, hasDatabaseUrl } from "@/db/client";
import { contactEvents, contacts, CRM_STAGES, type CrmStage } from "@/db/schema";
import { hasColumn, loadLegacySchema } from "./legacy-schema";

export type LeadSummary = {
  id: string;
  empresa: string;
  nicho: string | null;
  cidade: string | null;
  telefone: string | null;
  site: string | null;
  prioridade: string | null;
};

export type CrmContact = typeof contacts.$inferSelect & {
  lead: LeadSummary | null;
  events: number;
};

async function getLeadSummaries(ids: string[]): Promise<Map<string, LeadSummary>> {
  const map = new Map<string, LeadSummary>();
  if (!hasDatabaseUrl() || ids.length === 0) return map;
  const schema = await loadLegacySchema();
  if (!schema.leads.exists || !hasColumn(schema.leads, "id")) return map;
  const pick = (column: string, alias = column) =>
    hasColumn(schema.leads, column) ? `l."${column}"::text as "${alias}"` : `null::text as "${alias}"`;
  const { rows } = await getPool().query<Record<string, string | null>>(
    `select l."id"::text as id, ${pick("empresa")}, ${pick("nicho")}, ${pick("cidade")}, ${pick("telefone")}, ${pick("site")}, ${pick("pontuacao", "prioridade")}
       from jb_agent_leads l
      where l."id"::text = any($1::text[])`,
    [ids],
  );
  for (const row of rows) {
    map.set(String(row.id), {
      id: String(row.id),
      empresa: row.empresa ?? "Empresa sem nome",
      nicho: row.nicho ?? null,
      cidade: row.cidade ?? null,
      telefone: row.telefone ?? null,
      site: row.site ?? null,
      prioridade: row.prioridade ?? null,
    });
  }
  return map;
}

export async function getCrmContactsPage(filters: { campaignId?: string; stage?: string; search?: string } = {}, page = 1, pageSize = 25) {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 25;
  const empty = { rows: [] as CrmContact[], total: 0, page: safePage, pageSize: safeSize, pageCount: 1 };
  if (!hasDatabaseUrl()) return empty;
  const db = getDb();
  const schema = await loadLegacySchema();
  const params: unknown[] = [];
  const add = (value: unknown) => { params.push(value); return `$${params.length}`; };
  const conditions = [];
  if (filters.campaignId) conditions.push(`ct.campaign_id = ${add(filters.campaignId)}::uuid`);
  if (filters.stage) conditions.push(`ct.stage = ${add(filters.stage)}`);
  if (filters.search?.trim()) {
    const columns = ["empresa", "cidade", "telefone"].filter(column => hasColumn(schema.leads, column));
    const search = add(`%${filters.search.trim().slice(0, 160)}%`);
    const legacy = schema.leads.exists && hasColumn(schema.leads, "id") && columns.length
      ? `or exists (select 1 from jb_agent_leads l where l."id"::text=ct.lead_id and concat_ws(' ', ${columns.map(column => `l."${column}"::text`).join(",")}) ilike ${search})` : "";
    conditions.push(`(ct.next_action ilike ${search} ${legacy})`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const pool = getPool();
  const [selected, totals] = await Promise.all([
    pool.query<{ id: string }>(`select ct.id from jb_agent_contacts ct ${where} order by ct.updated_at desc, ct.id desc limit $${params.length + 1} offset $${params.length + 2}`, [...params, safeSize, (safePage - 1) * safeSize]),
    pool.query<{ total: string }>(`select count(*)::text as total from jb_agent_contacts ct ${where}`, params),
  ]);
  const total = Number(totals.rows[0].total);
  if (!selected.rows.length) return { ...empty, total, pageCount: Math.max(1, Math.ceil(total / safeSize)) };
  const rows = await db
    .select({
      contact: contacts,
      events: count(contactEvents.id),
    })
    .from(contacts)
    .leftJoin(contactEvents, eq(contactEvents.contactId, contacts.id))
    .where(inArray(contacts.id, selected.rows.map(row => row.id)))
    .groupBy(contacts.id)
    .orderBy(desc(contacts.updatedAt), desc(contacts.id));

  const leadMap = await getLeadSummaries([...new Set(rows.map((row) => row.contact.leadId))]);
  return { rows: rows.map((row) => ({
    ...row.contact,
    events: Number(row.events),
    lead: leadMap.get(row.contact.leadId) ?? null,
  })), total, page: safePage, pageSize: safeSize, pageCount: Math.max(1, Math.ceil(total / safeSize)) };
}

export async function moveContactStage(contactId: string, stage: CrmStage, notes: string, userId?: string) {
  if (!CRM_STAGES.includes(stage) || notes.length > 4000) throw new Error("INVALID_CONTACT_EVENT");
  if (stage === "fechado" || stage === "proposta_enviada") {
    throw new Error("USE_FORMAL_DEAL_FLOW");
  }
  return getDb().transaction(async (tx) => {
    const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).for("update");
    if (!contact) throw new Error("CONTACT_NOT_FOUND");
    if (contact.stage === stage) return contact;
    await tx.update(contacts).set({ stage, closedAt: null, updatedAt: new Date() }).where(eq(contacts.id, contactId));
    await tx.insert(contactEvents).values({ contactId, type: "etapa", fromStage: contact.stage, toStage: stage, notes: notes || null, createdBy: userId });
    return contact;
  });
}

export async function registerContactEvent(contactId: string, type: string, notes: string, userId?: string) {
  if (!["contato", "resposta", "nota"].includes(type) || notes.length > 4000) throw new Error("INVALID_CONTACT_EVENT");
  return getDb().transaction(async (tx) => {
    const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).for("update");
    if (!contact) throw new Error("CONTACT_NOT_FOUND");
    await tx.insert(contactEvents).values({ contactId, type, notes: notes || null, createdBy: userId });
    await tx.update(contacts).set({ updatedAt: new Date() }).where(eq(contacts.id, contactId));
    return contact;
  });
}

export async function getCrmMetrics() {
  if (!hasDatabaseUrl()) return { total: 0, open: 0, closed: 0, lost: 0, revenue: 0, pipeline: 0 };
  const db = getDb();
  const [row] = await db
    .select({
      total: count(),
      closed: count(sql`case when ${contacts.stage} = 'fechado' then 1 end`),
      lost: count(sql`case when ${contacts.stage} = 'perdido' then 1 end`),
      revenue: sql<string>`coalesce(sum(case when ${contacts.stage} = 'fechado' then ${contacts.closedValue} else 0 end), 0)`,
      pipeline: sql<string>`coalesce(sum(case when ${contacts.stage} not in ('fechado','perdido') then ${contacts.proposedValue} else 0 end), 0)`,
    })
    .from(contacts);
  const total = Number(row?.total ?? 0);
  const closed = Number(row?.closed ?? 0);
  return {
    total,
    open: total - closed - Number(row?.lost ?? 0),
    closed,
    lost: Number(row?.lost ?? 0),
    revenue: Number(row?.revenue ?? 0),
    pipeline: Number(row?.pipeline ?? 0),
  };
}

export async function getContactById(id: string): Promise<CrmContact | null> {
  if (!hasDatabaseUrl()) return null;
  const db = getDb();
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!row) return null;
  const [eventCount] = await db
    .select({ value: count() })
    .from(contactEvents)
    .where(eq(contactEvents.contactId, id));
  const leadMap = await getLeadSummaries([row.leadId]);
  return { ...row, events: Number(eventCount?.value ?? 0), lead: leadMap.get(row.leadId) ?? null };
}

export async function getContactEvents(contactId: string) {
  if (!hasDatabaseUrl()) return [];
  return getDb()
    .select()
    .from(contactEvents)
    .where(eq(contactEvents.contactId, contactId))
    .orderBy(desc(contactEvents.createdAt))
    .limit(100);
}
