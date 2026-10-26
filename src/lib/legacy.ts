import { getDb, getPool, hasDatabaseUrl } from "@/db/client";
import {
  activityLogs,
  brandProfiles,
  campaignLeads,
  campaigns,
  contactEvents,
  contacts,
  jobs,
  lpVersions,
} from "@/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  hasColumn,
  loadLegacySchema,
  safeLegacyIdCast,
  safeNumericExpression,
  type LegacySchema,
  type LegacyTable,
} from "./legacy-schema";
import { getPlatformSettings, type ScoringSettings } from "./settings";
import { canonicalLpStatusSql } from "./lp-status";

export type Priority = "alta" | "media" | "baixa" | "nao_avaliada";

export type LegacyLead = {
  id: string;
  origem: string | null;
  idOrigem: string | null;
  empresa: string;
  nicho: string | null;
  site: string | null;
  telefone: string | null;
  instagram: string | null;
  rua: string | null;
  cidade: string | null;
  latitude: number | null;
  longitude: number | null;
  pontuacao: number | null;
  oportunidade: unknown;
  status: string | null;
  pesquisaWeb: unknown;
  analiseIa: unknown;
  analisadoEm: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  priority: Priority;
  priorityOverride: Priority | null;
  approvedAt: string | null;
  discardedAt: string | null;
  campaigns: { id: string; name: string }[];
  lpCount: number;
  lpStatuses: string[];
};

export type LeadFilters = {
  campaignId?: string;
  niche?: string;
  city?: string;
  status?: string;
  priority?: string;
  website?: "with" | "without_info" | "";
  lp?: "with" | "without" | "";
  discarded?: "exclude" | "only" | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type PagedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type LegacyLp = {
  id: string;
  leadId: string | null;
  html: string | null;
  status: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  empresa: string | null;
  nicho: string | null;
  cidade: string | null;
  campaigns: { id: string; name: string }[];
  version: LpVersionView | null;
};

export type LpVersionView = {
  id: string;
  lpId: string;
  leadId: string;
  version: number;
  template: string;
  config: Record<string, unknown>;
  htmlSnapshot: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  kind: string;
  summary: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

const PRIORITIES = new Set<Priority>(["alta", "media", "baixa", "nao_avaliada"]);

export class LegacySchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacySchemaError";
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return String(value);
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizePriority(value: unknown): Priority | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (normalized === "alta" || normalized === "high" || normalized === "quente") return "alta";
  if (normalized === "media" || normalized === "medium" || normalized === "morna") return "media";
  if (normalized === "baixa" || normalized === "low" || normalized === "fria") return "baixa";
  if (normalized === "nao_avaliada" || normalized === "nao avaliada") return "nao_avaliada";
  return PRIORITIES.has(normalized as Priority) ? (normalized as Priority) : null;
}

function derivePriority(score: number | null, scoring: ScoringSettings): Priority {
  if (score === null) return "nao_avaliada";
  if (score >= scoring.highThreshold) return "alta";
  if (score >= scoring.mediumThreshold) return "media";
  return "baixa";
}

function leadColumn(table: LegacyTable, column: string, alias = column): string {
  if (!hasColumn(table, column)) return `null::text as "${alias}"`;
  return `l."${column}" as "${alias}"`;
}

function lpColumn(table: LegacyTable, column: string, alias = column): string {
  if (!hasColumn(table, column)) return `null::text as "${alias}"`;
  return `lp."${column}" as "${alias}"`;
}

function requireLeadId(schema: LegacySchema): void {
  if (!schema.leads.exists) throw new LegacySchemaError("Tabela jb_agent_leads não encontrada");
  if (!hasColumn(schema.leads, "id")) {
    throw new LegacySchemaError("Coluna id não encontrada em jb_agent_leads");
  }
}

function requireLpId(schema: LegacySchema): void {
  if (!schema.lps.exists) throw new LegacySchemaError("Tabela jb_agent_lps não encontrada");
  if (!hasColumn(schema.lps, "id")) {
    throw new LegacySchemaError("Coluna id não encontrada em jb_agent_lps");
  }
}

function prioritySql(schema: LegacySchema, scoring: ScoringSettings): string {
  const score = safeNumericExpression(schema.leads, "pontuacao");
  return `case
    when m.priority_override is not null then m.priority_override
    when ${score} >= ${Number(scoring.highThreshold)} then 'alta'
    when ${score} >= ${Number(scoring.mediumThreshold)} then 'media'
    when ${score} is not null then 'baixa'
    else 'nao_avaliada'
  end`;
}


type FilterBuild = {
  joins: string;
  where: string;
  params: unknown[];
};

function buildLeadFilters(
  schema: LegacySchema,
  scoring: ScoringSettings,
  filters: LeadFilters,
): FilterBuild {
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const conditions: string[] = [];
  let joins = "";

  if (schema.leads.exists && hasColumn(schema.leads, "id")) {
    joins += ` left join jb_agent_lead_meta m on m.lead_id = l."id"::text`;
  }

  if (filters.campaignId) {
    conditions.push(
      `exists (select 1 from jb_agent_campaign_leads cl where cl.lead_id = l."id"::text and cl.campaign_id = ${add(filters.campaignId)}::uuid)`,
    );
  }
  if (filters.niche && hasColumn(schema.leads, "nicho")) {
    conditions.push(`coalesce(l."nicho"::text, '') = ${add(filters.niche)}`);
  }
  if (filters.city && hasColumn(schema.leads, "cidade")) {
    conditions.push(`coalesce(l."cidade"::text, '') ilike ${add(`%${filters.city}%`)}`);
  }
  if (filters.status && hasColumn(schema.leads, "status")) {
    conditions.push(`coalesce(l."status"::text, '') = ${add(filters.status)}`);
  }
  if (filters.priority) {
    conditions.push(`${prioritySql(schema, scoring)} = ${add(filters.priority)}`);
  }
  if (filters.website === "with") {
    conditions.push(
      hasColumn(schema.leads, "site")
        ? `nullif(trim(l."site"::text), '') is not null`
        : "false",
    );
  }
  if (filters.website === "without_info") {
    conditions.push(
      hasColumn(schema.leads, "site")
        ? `nullif(trim(l."site"::text), '') is null`
        : "true",
    );
  }
  if (filters.lp === "with" || filters.lp === "without") {
    const exists =
      schema.lps.exists && hasColumn(schema.lps, "lead_id") && hasColumn(schema.lps, "id")
        ? `exists (select 1 from jb_agent_lps lp where lp."lead_id"::text = l."id"::text)`
        : "false";
    conditions.push(filters.lp === "with" ? exists : `not ${exists}`);
  }
  if (filters.discarded === "exclude") conditions.push(`m.discarded_at is null`);
  if (filters.discarded === "only") conditions.push(`m.discarded_at is not null`);

  if (filters.search) {
    const searchColumns = ["empresa", "cidade", "telefone", "instagram", "site", "rua", "nicho"]
      .filter((column) => hasColumn(schema.leads, column))
      .map((column) => `coalesce(l."${column}"::text, '')`);
    if (searchColumns.length > 0) {
      conditions.push(`concat_ws(' ', ${searchColumns.join(", ")}) ilike ${add(`%${filters.search}%`)}`);
    }
  }

  if (hasColumn(schema.leads, "criado_em")) {
    if (filters.dateFrom) conditions.push(`l."criado_em" >= ${add(filters.dateFrom)}::timestamptz`);
    if (filters.dateTo) conditions.push(`l."criado_em" < ${add(filters.dateTo)}::timestamptz`);
  }

  return {
    joins,
    where: conditions.length ? `where ${conditions.join(" and ")}` : "",
    params,
  };
}

function normalizeLeadRow(
  row: Record<string, unknown>,
  scoring: ScoringSettings,
): LegacyLead {
  const score = asNumber(row.pontuacao);
  const override = normalizePriority(row.priority_override);
  return {
    id: String(row.id ?? ""),
    origem: asString(row.origem),
    idOrigem: asString(row.id_origem),
    empresa: asString(row.empresa) ?? "Empresa sem nome",
    nicho: asString(row.nicho),
    site: asString(row.site),
    telefone: asString(row.telefone),
    instagram: asString(row.instagram),
    rua: asString(row.rua),
    cidade: asString(row.cidade),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    pontuacao: score,
    oportunidade: parseJson(row.oportunidade),
    status: asString(row.status),
    pesquisaWeb: parseJson(row.pesquisa_web),
    analiseIa: parseJson(row.analise_ia),
    analisadoEm: toIso(row.analisado_em),
    criadoEm: toIso(row.criado_em),
    atualizadoEm: toIso(row.atualizado_em),
    priority: override ?? derivePriority(score, scoring),
    priorityOverride: override,
    approvedAt: toIso(row.approved_at),
    discardedAt: toIso(row.discarded_at),
    campaigns: [],
    lpCount: 0,
    lpStatuses: [],
  };
}

async function attachLeadRelations(leads: LegacyLead[]): Promise<void> {
  if (leads.length === 0) return;
  const db = getDb();
  const ids = leads.map((lead) => lead.id);
  const [links, lps] = await Promise.all([
    db
      .select({
        leadId: campaignLeads.leadId,
        campaignId: campaigns.id,
        campaignName: campaigns.name,
      })
      .from(campaignLeads)
      .innerJoin(campaigns, eq(campaignLeads.campaignId, campaigns.id))
      .where(inArray(campaignLeads.leadId, ids)),
    getLegacyLpsForLeadIds(ids),
  ]);

  const byLead = new Map<string, { id: string; name: string }[]>();
  for (const link of links) {
    const list = byLead.get(link.leadId) ?? [];
    list.push({ id: link.campaignId, name: link.campaignName });
    byLead.set(link.leadId, list);
  }
  const lpByLead = new Map<string, string[]>();
  for (const lp of lps) {
    if (!lp.leadId) continue;
    const list = lpByLead.get(lp.leadId) ?? [];
    if (lp.status) list.push(lp.status);
    lpByLead.set(lp.leadId, list);
  }

  for (const lead of leads) {
    lead.campaigns = byLead.get(lead.id) ?? [];
    const statuses = lpByLead.get(lead.id) ?? [];
    lead.lpCount = statuses.length;
    lead.lpStatuses = statuses;
  }
}

export async function getLeadsPage(
  filters: LeadFilters,
  page = 1,
  pageSize = 25,
): Promise<PagedResult<LegacyLead>> {
  if (!hasDatabaseUrl()) return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  const schema = await loadLegacySchema();
  requireLeadId(schema);
  const settings = await getPlatformSettings();
  const filter = buildLeadFilters(schema, settings.scoring, filters);
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(5, Math.floor(pageSize)));
  const offset = (safePage - 1) * safeSize;

  const select = [
    leadColumn(schema.leads, "id"),
    leadColumn(schema.leads, "origem"),
    leadColumn(schema.leads, "id_origem"),
    leadColumn(schema.leads, "empresa"),
    leadColumn(schema.leads, "nicho"),
    leadColumn(schema.leads, "site"),
    leadColumn(schema.leads, "telefone"),
    leadColumn(schema.leads, "instagram"),
    leadColumn(schema.leads, "rua"),
    leadColumn(schema.leads, "cidade"),
    leadColumn(schema.leads, "latitude"),
    leadColumn(schema.leads, "longitude"),
    leadColumn(schema.leads, "pontuacao"),
    leadColumn(schema.leads, "oportunidade"),
    leadColumn(schema.leads, "status"),
    leadColumn(schema.leads, "pesquisa_web"),
    leadColumn(schema.leads, "analise_ia"),
    leadColumn(schema.leads, "analisado_em"),
    leadColumn(schema.leads, "criado_em"),
    leadColumn(schema.leads, "atualizado_em"),
    `m.priority_override as "priority_override"`,
    `m.approved_at as "approved_at"`,
    `m.discarded_at as "discarded_at"`,
  ].join(", ");

  const orderParts: string[] = [];
  if (hasColumn(schema.leads, "atualizado_em")) orderParts.push(`l."atualizado_em" desc nulls last`);
  if (hasColumn(schema.leads, "criado_em")) orderParts.push(`l."criado_em" desc nulls last`);
  orderParts.push(`l."id" desc`);
  const order = `order by ${orderParts.join(", ")}`;

  const pool = getPool();
  const [{ rows }, count] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `select ${select} from jb_agent_leads l ${filter.joins} ${filter.where} ${order} limit $${filter.params.length + 1} offset $${filter.params.length + 2}`,
      [...filter.params, safeSize, offset],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as count from jb_agent_leads l ${filter.joins} ${filter.where}`,
      filter.params,
    ),
  ]);

  const leads = rows.map((row) => normalizeLeadRow(row, settings.scoring));
  await attachLeadRelations(leads);
  const total = Number(count.rows[0]?.count ?? 0);
  return {
    rows: leads,
    total,
    page: safePage,
    pageSize: safeSize,
    pageCount: Math.max(1, Math.ceil(total / safeSize)),
  };
}

export async function getLeadById(id: string): Promise<LegacyLead | null> {
  if (!hasDatabaseUrl()) return null;
  const schema = await loadLegacySchema();
  requireLeadId(schema);
  const settings = await getPlatformSettings();
  const select = [
    leadColumn(schema.leads, "id"),
    leadColumn(schema.leads, "origem"),
    leadColumn(schema.leads, "id_origem"),
    leadColumn(schema.leads, "empresa"),
    leadColumn(schema.leads, "nicho"),
    leadColumn(schema.leads, "site"),
    leadColumn(schema.leads, "telefone"),
    leadColumn(schema.leads, "instagram"),
    leadColumn(schema.leads, "rua"),
    leadColumn(schema.leads, "cidade"),
    leadColumn(schema.leads, "latitude"),
    leadColumn(schema.leads, "longitude"),
    leadColumn(schema.leads, "pontuacao"),
    leadColumn(schema.leads, "oportunidade"),
    leadColumn(schema.leads, "status"),
    leadColumn(schema.leads, "pesquisa_web"),
    leadColumn(schema.leads, "analise_ia"),
    leadColumn(schema.leads, "analisado_em"),
    leadColumn(schema.leads, "criado_em"),
    leadColumn(schema.leads, "atualizado_em"),
    `m.priority_override as "priority_override"`,
    `m.approved_at as "approved_at"`,
    `m.discarded_at as "discarded_at"`,
  ].join(", ");
  const { rows } = await getPool().query<Record<string, unknown>>(
    `select ${select} from jb_agent_leads l left join jb_agent_lead_meta m on m.lead_id = l."id"::text where l."id"::text = $1 limit 1`,
    [id],
  );
  if (!rows[0]) return null;
  const lead = normalizeLeadRow(rows[0], settings.scoring);
  await attachLeadRelations([lead]);
  return lead;
}

export async function getLegacyLpsForLeadIds(
  leadIds: string[],
): Promise<{ id: string; leadId: string | null; status: string | null }[]> {
  if (leadIds.length === 0 || !hasDatabaseUrl()) return [];
  const schema = await loadLegacySchema();
  if (!schema.lps.exists || !hasColumn(schema.lps, "id") || !hasColumn(schema.lps, "lead_id")) {
    return [];
  }
  const { rows } = await getPool().query<Record<string, unknown>>(
    `select lp."id" as id, lp."lead_id" as lead_id, ${canonicalLpStatusSql(schema)} as status
       from jb_agent_lps lp
      where lp."lead_id"::text = any($1::text[])`,
    [leadIds],
  );
  return rows.map((row) => ({
    id: String(row.id),
    leadId: asString(row.lead_id),
    status: asString(row.status),
  }));
}

export async function getLeadDetailsBundle(id: string) {
  const lead = await getLeadById(id);
  if (!lead) return null;
  const db = getDb();
  const [brand, versions, contactRows, contactEventRows, jobRows, activityRows] =
    await Promise.all([
      db.select().from(brandProfiles).where(eq(brandProfiles.leadId, id)).limit(1),
      db
        .select()
        .from(lpVersions)
        .where(eq(lpVersions.leadId, id))
        .orderBy(desc(lpVersions.version)),
      db.select().from(contacts).where(eq(contacts.leadId, id)).orderBy(desc(contacts.updatedAt)),
      db
        .select({
          id: contactEvents.id,
          contactId: contactEvents.contactId,
          type: contactEvents.type,
          fromStage: contactEvents.fromStage,
          toStage: contactEvents.toStage,
          notes: contactEvents.notes,
          metadata: contactEvents.metadata,
          createdAt: contactEvents.createdAt,
        })
        .from(contactEvents)
        .innerJoin(contacts, eq(contactEvents.contactId, contacts.id))
        .where(eq(contacts.leadId, id))
        .orderBy(desc(contactEvents.createdAt)),
      db.select().from(jobs).where(eq(jobs.leadId, id)).orderBy(desc(jobs.createdAt)).limit(30),
      db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.entityId, id))
        .orderBy(desc(activityLogs.createdAt))
        .limit(30),
    ]);

  return {
    lead,
    brand: brand[0] ?? null,
    versions: versions.map(normalizeVersion),
    contacts: contactRows,
    contactEvents: contactEventRows,
    jobs: jobRows,
    activity: activityRows,
  };
}

function normalizeVersion(row: typeof lpVersions.$inferSelect): LpVersionView {
  return {
    id: row.id,
    lpId: row.lpId,
    leadId: row.leadId,
    version: row.version,
    template: row.template,
    config: row.config ?? {},
    htmlSnapshot: row.htmlSnapshot,
    status: row.status,
    createdAt: toIso(row.createdAt) ?? "",
    updatedAt: toIso(row.updatedAt) ?? "",
  };
}

export type LpFilters = {
  status?: string;
  leadId?: string;
  campaignId?: string;
  search?: string;
};

export async function getLpsPage(
  filters: LpFilters,
  page = 1,
  pageSize = 24,
): Promise<PagedResult<LegacyLp>> {
  if (!hasDatabaseUrl()) return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  const schema = await loadLegacySchema();
  requireLpId(schema);
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const conditions: string[] = [];
  if (filters.status) {
    conditions.push(`${canonicalLpStatusSql(schema)} = ${add(filters.status)}`);
  }
  if (filters.leadId && hasColumn(schema.lps, "lead_id")) {
    conditions.push(`lp."lead_id"::text = ${add(filters.leadId)}`);
  }
  if (filters.campaignId && hasColumn(schema.lps, "lead_id")) {
    conditions.push(
      `exists (select 1 from jb_agent_campaign_leads cl where cl.lead_id = lp."lead_id"::text and cl.campaign_id = ${add(filters.campaignId)}::uuid)`,
    );
  }
  if (filters.search && hasColumn(schema.lps, "lead_id") && schema.leads.exists && hasColumn(schema.leads, "empresa")) {
    conditions.push(
      `exists (select 1 from jb_agent_leads l where l."id"::text = lp."lead_id"::text and coalesce(l."empresa"::text, '') ilike ${add(`%${filters.search}%`)})`,
    );
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const offset = (safePage - 1) * safeSize;
  const hasLeadJoin =
    schema.leads.exists &&
    hasColumn(schema.leads, "id") &&
    hasColumn(schema.lps, "lead_id");
  const leadJoin = hasLeadJoin
    ? `left join jb_agent_leads l on l."id"::text = lp."lead_id"::text`
    : "";
  const order = hasColumn(schema.lps, "criado_em")
    ? `order by lp."criado_em" desc nulls last, lp."id" desc`
    : `order by lp."id" desc`;
  const select = [
    lpColumn(schema.lps, "id"),
    lpColumn(schema.lps, "lead_id"),
    `${canonicalLpStatusSql(schema)} as status`,
    lpColumn(schema.lps, "criado_em"),
    lpColumn(schema.lps, "atualizado_em"),
    hasLeadJoin && hasColumn(schema.leads, "empresa") ? `l."empresa" as empresa` : "null::text as empresa",
    hasLeadJoin && hasColumn(schema.leads, "nicho") ? `l."nicho" as nicho` : "null::text as nicho",
    hasLeadJoin && hasColumn(schema.leads, "cidade") ? `l."cidade" as cidade` : "null::text as cidade",
  ].join(", ");
  const pool = getPool();
  const [{ rows }, count] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `select ${select} from jb_agent_lps lp ${leadJoin} ${where} ${order} limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, safeSize, offset],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as count from jb_agent_lps lp ${leadJoin} ${where}`,
      params,
    ),
  ]);
  const lps: LegacyLp[] = rows.map((row) => ({
    id: String(row.id),
    leadId: asString(row.lead_id),
    html: null,
    status: asString(row.status),
    criadoEm: toIso(row.criado_em),
    atualizadoEm: toIso(row.atualizado_em),
    empresa: asString(row.empresa),
    nicho: asString(row.nicho),
    cidade: asString(row.cidade),
    campaigns: [],
    version: null,
  }));
  await attachLpRelations(lps);
  const total = Number(count.rows[0]?.count ?? 0);
  return {
    rows: lps,
    total,
    page: safePage,
    pageSize: safeSize,
    pageCount: Math.max(1, Math.ceil(total / safeSize)),
  };
}

async function attachLpRelations(lps: LegacyLp[]): Promise<void> {
  if (lps.length === 0) return;
  const leadIds = [...new Set(lps.map((lp) => lp.leadId).filter((id): id is string => Boolean(id)))];
  const lpIds = lps.map((lp) => lp.id);
  const db = getDb();
  const links = leadIds.length
    ? await db
        .select({
          leadId: campaignLeads.leadId,
          campaignId: campaigns.id,
          campaignName: campaigns.name,
        })
        .from(campaignLeads)
        .innerJoin(campaigns, eq(campaignLeads.campaignId, campaigns.id))
        .where(inArray(campaignLeads.leadId, leadIds))
    : [];
  const versions = await db
    .select()
    .from(lpVersions)
    .where(inArray(lpVersions.lpId, lpIds))
    .orderBy(desc(lpVersions.version));
  const byLead = new Map<string, { id: string; name: string }[]>();
  for (const link of links) {
    const list = byLead.get(link.leadId) ?? [];
    list.push({ id: link.campaignId, name: link.campaignName });
    byLead.set(link.leadId, list);
  }
  const versionByLp = new Map<string, LpVersionView>();
  for (const version of versions) {
    if (!versionByLp.has(version.lpId)) versionByLp.set(version.lpId, normalizeVersion(version));
  }
  for (const lp of lps) {
    if (lp.leadId) lp.campaigns = byLead.get(lp.leadId) ?? [];
    lp.version = versionByLp.get(lp.id) ?? null;
  }
}

export async function getLegacyLpById(id: string): Promise<LegacyLp | null> {
  if (!hasDatabaseUrl()) return null;
  const schema = await loadLegacySchema();
  requireLpId(schema);
  const hasLeadJoin =
    schema.leads.exists && hasColumn(schema.leads, "id") && hasColumn(schema.lps, "lead_id");
  const select = [
    lpColumn(schema.lps, "id"),
    lpColumn(schema.lps, "lead_id"),
    lpColumn(schema.lps, "html"),
    `${canonicalLpStatusSql(schema)} as status`,
    lpColumn(schema.lps, "criado_em"),
    lpColumn(schema.lps, "atualizado_em"),
    hasLeadJoin && hasColumn(schema.leads, "empresa") ? `l."empresa" as empresa` : "null::text as empresa",
    hasLeadJoin && hasColumn(schema.leads, "nicho") ? `l."nicho" as nicho` : "null::text as nicho",
    hasLeadJoin && hasColumn(schema.leads, "cidade") ? `l."cidade" as cidade` : "null::text as cidade",
  ].join(", ");
  const { rows } = await getPool().query<Record<string, unknown>>(
    `select ${select} from jb_agent_lps lp ${hasLeadJoin ? `left join jb_agent_leads l on l."id"::text = lp."lead_id"::text` : ""} where lp."id"::text = $1 limit 1`,
    [id],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  const lp: LegacyLp = {
    id: String(row.id),
    leadId: asString(row.lead_id),
    html: asString(row.html),
    status: asString(row.status),
    criadoEm: toIso(row.criado_em),
    atualizadoEm: toIso(row.atualizado_em),
    empresa: asString(row.empresa),
    nicho: asString(row.nicho),
    cidade: asString(row.cidade),
    campaigns: [],
    version: null,
  };
  await attachLpRelations([lp]);
  return lp;
}

export async function getLpVersionsForLp(lpId: string): Promise<LpVersionView[]> {
  if (!hasDatabaseUrl()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(lpVersions)
    .where(eq(lpVersions.lpId, lpId))
    .orderBy(desc(lpVersions.version));
  return rows.map(normalizeVersion);
}

export async function getRecentActivity(limit = 12): Promise<ActivityItem[]> {
  if (!hasDatabaseUrl()) return [];
  const out: ActivityItem[] = [];
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    for (const row of rows) {
      out.push({
        id: row.id,
        kind: row.action,
        summary: row.summary,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: toIso(row.createdAt) ?? "",
      });
    }
  } catch {
    // tabela nova ainda não migrada
  }

  try {
    const schema = await loadLegacySchema();
    if (schema.leads.exists && hasColumn(schema.leads, "id")) {
      const fields = [
        leadColumn(schema.leads, "id"),
        leadColumn(schema.leads, "empresa"),
        leadColumn(schema.leads, "criado_em"),
      ].join(", ");
      const order = hasColumn(schema.leads, "criado_em") ? `order by l."criado_em" desc nulls last` : "";
      const { rows } = await getPool().query<Record<string, unknown>>(
        `select ${fields} from jb_agent_leads l ${order} limit $1`,
        [limit],
      );
      for (const row of rows) {
        if (!row.criado_em) continue;
        out.push({
          id: `lead-${String(row.id)}`,
          kind: "lead_found",
          summary: `Empresa encontrada: ${asString(row.empresa) ?? "sem nome"}`,
          entityType: "lead",
          entityId: String(row.id),
          createdAt: toIso(row.criado_em) ?? "",
        });
      }
    }
    if (schema.lps.exists && hasColumn(schema.lps, "id") && hasColumn(schema.lps, "criado_em")) {
      const { rows } = await getPool().query<Record<string, unknown>>(
        `select lp."id" as id, lp."criado_em" as criado_em from jb_agent_lps lp order by lp."criado_em" desc nulls last limit $1`,
        [limit],
      );
      for (const row of rows) {
        out.push({
          id: `lp-${String(row.id)}`,
          kind: "lp_created",
          summary: `Landing page criada #${String(row.id)}`,
          entityType: "lp",
          entityId: String(row.id),
          createdAt: toIso(row.criado_em) ?? "",
        });
      }
    }
  } catch {
    // schema legado ainda não disponível
  }

  return out
    .filter((item) => Boolean(item.createdAt))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getLeadFilterOptions(): Promise<{
  niches: string[];
  cities: string[];
  statuses: string[];
  campaigns: { id: string; name: string }[];
}> {
  if (!hasDatabaseUrl()) return { niches: [], cities: [], statuses: [], campaigns: [] };
  const schema = await loadLegacySchema();
  if (!schema.leads.exists) return { niches: [], cities: [], statuses: [], campaigns: [] };
  const pool = getPool();
  const distinct = async (column: string): Promise<string[]> => {
    if (!hasColumn(schema.leads, column)) return [];
    const { rows } = await pool.query<{ value: string }>(
      `select distinct l."${column}"::text as value from jb_agent_leads l where nullif(trim(l."${column}"::text), '') is not null order by value limit 200`,
    );
    return rows.map((row) => row.value).filter(Boolean);
  };
  const [niches, cities, statuses, campaignRows] = await Promise.all([
    distinct("nicho"),
    distinct("cidade"),
    distinct("status"),
    getDb().select({ id: campaigns.id, name: campaigns.name }).from(campaigns).orderBy(asc(campaigns.name)),
  ]);
  return { niches, cities, statuses, campaigns: campaignRows };
}

export function legacyIdCastForLead(schema: LegacySchema): string {
  return safeLegacyIdCast(schema.leads.columns.get("id"));
}
