import { getDb, getPool, hasDatabaseUrl } from "@/db/client";
import { campaigns, jobs } from "@/db/schema";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { CRM_STAGES, type CrmStage } from "@/db/schema";
import { loadLegacySchema, hasColumn, safeNumericExpression } from "./legacy-schema";
import { getRecentActivity, type ActivityItem } from "./legacy";
import { getPlatformSettings } from "./settings";
import type { DateRange } from "./period";
import { APP_TIMEZONE, appDay, addCalendarDays } from "./period";
import { canonicalLpStatusSql } from "./lp-status";

export type DashboardMetric = {
  key: string;
  label: string;
  value: number;
  format?: "number" | "currency";
};

export type DashboardData = {
  configured: boolean;
  warnings: string[];
  metrics: DashboardMetric[];
  leadsByDay: { date: string; label: string; value: number }[];
  leadsByNiche: { name: string; value: number }[];
  leadsByCity: { name: string; value: number }[];
  priorities: { name: string; value: number }[];
  lpsByDay: { date: string; label: string; value: number }[];
  funnel: { stage: CrmStage; name: string; value: number }[];
  conversionByCampaign: { id: string; name: string; leads: number; closed: number; rate: number }[];
  activities: ActivityItem[];
};

const STAGE_LABELS: Record<CrmStage, string> = {
  identificado: "Identificado",
  qualificado: "Qualificado",
  demonstracao_preparada: "Demonstração preparada",
  aguardando_aprovacao: "Aguardando aprovação",
  pronto_para_contato: "Pronto para contato",
  contatado: "Contatado",
  respondeu: "Respondeu",
  em_negociacao: "Em negociação",
  proposta_enviada: "Proposta enviada",
  fechado: "Fechado",
  perdido: "Perdido",
};

function emptyData(configured: boolean, warnings: string[] = []): DashboardData {
  return {
    configured,
    warnings,
    metrics: [
      { key: "activeCampaigns", label: "Campanhas ativas", value: 0 },
      { key: "leadsFound", label: "Empresas encontradas", value: 0 },
      { key: "leadsAnalyzed", label: "Empresas analisadas", value: 0 },
      { key: "leadsQualified", label: "Leads qualificados", value: 0 },
      { key: "lpsGenerated", label: "Landing pages geradas", value: 0 },
      { key: "lpsPublished", label: "Landing pages publicadas", value: 0 },
      { key: "contacts", label: "Contatos realizados", value: 0 },
      { key: "responses", label: "Respostas recebidas", value: 0 },
      { key: "proposals", label: "Propostas enviadas", value: 0 },
      { key: "sales", label: "Vendas fechadas", value: 0 },
      { key: "revenue", label: "Receita registrada", value: 0, format: "currency" },
      { key: "runningJobs", label: "Agentes em execução", value: 0 },
      { key: "failedJobs", label: "Tarefas com erro", value: 0 },
    ],
    leadsByDay: [],
    leadsByNiche: [],
    leadsByCity: [],
    priorities: [],
    lpsByDay: [],
    funnel: CRM_STAGES.map((stage) => ({ stage, name: STAGE_LABELS[stage], value: 0 })),
    conversionByCampaign: [],
    activities: [],
  };
}

export function daysBetween(range: DateRange): string[] {
  const days: string[] = [];
  let cursor = appDay(range.from);
  const end = appDay(range.to);
  while (cursor < end) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

async function safe<T>(
  warning: string,
  warnings: string[],
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    warnings.push(`${warning}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    return fallback;
  }
}

async function scalar(query: string, params: unknown[] = []): Promise<number> {
  const usedParams = query.includes("$1") ? params : [];
  const { rows } = await getPool().query<{ value: string | number }>(query, usedParams);
  return Number(rows[0]?.value ?? 0);
}

function priorityExpression(scoreExpression: string, high: number, medium: number): string {
  return `case
    when m.priority_override is not null then m.priority_override
    when ${scoreExpression} >= ${Number(high)} then 'alta'
    when ${scoreExpression} >= ${Number(medium)} then 'media'
    when ${scoreExpression} is not null then 'baixa'
    else 'nao_avaliada'
  end`;
}

function rangeCondition(column: string, fromParam: string, toParam: string): string {
  return `${column} >= ${fromParam}::timestamptz and ${column} < ${toParam}::timestamptz`;
}

export async function getDashboardData(range: DateRange): Promise<DashboardData> {
  if (!hasDatabaseUrl()) {
    return emptyData(false, ["DATABASE_URL não configurada."]);
  }

  const warnings: string[] = [];
  const data = emptyData(true);
  const settings = await getPlatformSettings();
  const schema = await safe("Schema legado", warnings, () => loadLegacySchema(), null);
  const pool = getPool();
  const db = getDb();
  const p1 = "$1";
  const p2 = "$2";
  const params = [range.fromIso, range.toIso];

  const leadExists = Boolean(schema?.leads.exists && schema.leads.columns.has("id"));
  const leadRange = leadExists && hasColumn(schema!.leads, "criado_em")
    ? `and ${rangeCondition('l."criado_em"', p1, p2)}`
    : "and $1::timestamptz < $2::timestamptz";
  const leadMetaJoin = leadExists ? "left join jb_agent_lead_meta m on m.lead_id = l.\"id\"::text" : "";
  const scoreExpression = leadExists
    ? safeNumericExpression(schema!.leads, "pontuacao")
    : "null::numeric";

  const lpExists = Boolean(schema?.lps.exists && schema.lps.columns.has("id"));
  const lpRange = lpExists && hasColumn(schema!.lps, "criado_em")
    ? `and ${rangeCondition('lp."criado_em"', p1, p2)}`
    : "and $1::timestamptz < $2::timestamptz";

  const activeCampaigns = await safe(
    "Campanhas ativas",
    warnings,
    () =>
      db
        .select({ value: count() })
        .from(campaigns)
        .where(eq(campaigns.status, "active"))
        .then((rows) => Number(rows[0]?.value ?? 0)),
    0,
  );

  const leadsFound = await safe(
    "Empresas encontradas",
    warnings,
    () =>
      scalar(
        leadExists
          ? `select count(*)::text as value from jb_agent_leads l where 1=1 ${leadRange}`
          : "select 0::text as value",
        params,
      ),
    0,
  );

  const leadsAnalyzed = await safe(
    "Empresas analisadas",
    warnings,
    () =>
      scalar(
        leadExists && hasColumn(schema!.leads, "analisado_em")
          ? `select count(*)::text as value from jb_agent_leads l where l."analisado_em" is not null ${leadRange}`
          : leadExists && hasColumn(schema!.leads, "analise_ia")
            ? `select count(*)::text as value from jb_agent_leads l where l."analise_ia" is not null ${leadRange}`
            : "select 0::text as value",
        params,
      ),
    0,
  );

  const leadsQualified = await safe(
    "Leads qualificados",
    warnings,
    async () => {
      if (!leadExists) return 0;
      const opportunity = hasColumn(schema!.leads, "oportunidade")
        ? `(lower(coalesce(l."oportunidade"::text, '')) = any($3::text[]))`
        : "cardinality($3::text[]) < 0";
      const value = await scalar(
        `select count(*)::text as value
           from jb_agent_leads l
           ${leadMetaJoin}
          where 1=1 ${leadRange}
            and (${opportunity} or (${priorityExpression(scoreExpression, settings.scoring.highThreshold, settings.scoring.mediumThreshold)} = 'alta'))`,
        [...params, settings.scoring.opportunityValues],
      );
      return value;
    },
    0,
  );

  const lpsGenerated = await safe(
    "Landing pages geradas",
    warnings,
    () =>
      scalar(
        lpExists ? `select count(*)::text as value from jb_agent_lps lp where 1=1 ${lpRange}` : "select 0::text as value",
        params,
      ),
    0,
  );

  const lpsPublished = await safe(
    "Landing pages publicadas",
    warnings,
    () =>
      scalar(
        lpExists
          ? `select count(*)::text as value from jb_agent_lps lp where lower(${canonicalLpStatusSql(schema!)}) in ('published','publicado','publicada','live') ${lpRange}`
          : "select 0::text as value",
        params,
      ),
    0,
  );

  const contactsMade = await safe(
    "Contatos realizados",
    warnings,
    () =>
      scalar(
        `select count(*)::text as value from jb_agent_contact_events ce
          where ce.type in ('contato','contato_realizado','contact')
            and ${rangeCondition("ce.created_at", p1, p2)}`,
        params,
      ),
    0,
  );
  const responses = await safe(
    "Respostas recebidas",
    warnings,
    () =>
      scalar(
        `select count(*)::text as value from jb_agent_contact_events ce
          where ce.type in ('resposta','response')
            and ${rangeCondition("ce.created_at", p1, p2)}`,
        params,
      ),
    0,
  );
  const proposals = await safe(
    "Propostas enviadas",
    warnings,
    () =>
      scalar(
        `select count(*)::text as value from jb_agent_contact_events ce
          where ce.type in ('proposta','proposal')
            and ${rangeCondition("ce.created_at", p1, p2)}`,
        params,
      ),
    0,
  );
  const sales = await safe(
    "Vendas fechadas",
    warnings,
    () =>
      scalar(
        `select count(*)::text as value from jb_agent_contact_events ce
          where ce.type in ('venda','sale','fechado')
            and ${rangeCondition("ce.created_at", p1, p2)}`,
        params,
      ),
    0,
  );
  const revenue = await safe(
    "Receita registrada",
    warnings,
    () =>
      scalar(
        `select coalesce(sum(ct.closed_value), 0)::text as value from jb_agent_contacts ct
          where ct.stage = 'fechado' and ${rangeCondition("coalesce(ct.closed_at, ct.updated_at)", p1, p2)}`,
        params,
      ),
    0,
  );
  const runningJobs = await safe(
    "Agentes em execução",
    warnings,
    () =>
      db
        .select({ value: count() })
        .from(jobs)
        .where(eq(jobs.status, "processing"))
        .then((rows) => Number(rows[0]?.value ?? 0)),
    0,
  );
  const failedJobs = await safe(
    "Tarefas com erro",
    warnings,
    () =>
      db
        .select({ value: count() })
        .from(jobs)
        .where(and(eq(jobs.status, "failed"), gte(jobs.updatedAt, range.from), lt(jobs.updatedAt, range.to)))
        .then((rows) => Number(rows[0]?.value ?? 0)),
    0,
  );

  data.metrics = [
    { key: "activeCampaigns", label: "Campanhas ativas", value: activeCampaigns },
    { key: "leadsFound", label: "Empresas encontradas", value: leadsFound },
    { key: "leadsAnalyzed", label: "Empresas analisadas", value: leadsAnalyzed },
    { key: "leadsQualified", label: "Leads qualificados", value: leadsQualified },
    { key: "lpsGenerated", label: "Landing pages geradas", value: lpsGenerated },
    { key: "lpsPublished", label: "Landing pages publicadas", value: lpsPublished },
    { key: "contacts", label: "Contatos realizados", value: contactsMade },
    { key: "responses", label: "Respostas recebidas", value: responses },
    { key: "proposals", label: "Propostas enviadas", value: proposals },
    { key: "sales", label: "Vendas fechadas", value: sales },
    { key: "revenue", label: "Receita registrada", value: revenue, format: "currency" },
    { key: "runningJobs", label: "Agentes em execução", value: runningJobs },
    { key: "failedJobs", label: "Tarefas com erro", value: failedJobs },
  ];

  const dayKeys = daysBetween(range);
  const emptyDays = dayKeys.map((date) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    value: 0,
  }));

  data.leadsByDay = await safe(
    "Leads por dia",
    warnings,
    async () => {
      if (!leadExists || !hasColumn(schema!.leads, "criado_em")) return [];
      const { rows } = await pool.query<{ date: string; value: string }>(
        `select to_char(date_trunc('day', l."criado_em" at time zone $3), 'YYYY-MM-DD') as date, count(*)::text as value
           from jb_agent_leads l
          where ${rangeCondition('l."criado_em"', p1, p2)}
          group by 1 order by 1`,
        [...params, APP_TIMEZONE],
      );
      const map = new Map(rows.map((row) => [row.date, Number(row.value)]));
      return emptyDays.map((day) => ({ ...day, value: map.get(day.date) ?? 0 }));
    },
    emptyDays,
  );

  data.leadsByNiche = await safe(
    "Leads por nicho",
    warnings,
    async () => {
      if (!leadExists || !hasColumn(schema!.leads, "nicho")) return [];
      const { rows } = await pool.query<{ name: string; value: string }>(
        `select coalesce(nullif(trim(l."nicho"::text), ''), 'Não informado') as name, count(*)::text as value
           from jb_agent_leads l
          where 1=1 ${leadRange}
          group by 1 order by 2 desc limit 8`,
        params,
      );
      return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
    },
    [],
  );

  data.leadsByCity = await safe(
    "Leads por cidade",
    warnings,
    async () => {
      if (!leadExists || !hasColumn(schema!.leads, "cidade")) return [];
      const { rows } = await pool.query<{ name: string; value: string }>(
        `select coalesce(nullif(trim(l."cidade"::text), ''), 'Não informado') as name, count(*)::text as value
           from jb_agent_leads l
          where 1=1 ${leadRange}
          group by 1 order by 2 desc limit 8`,
        params,
      );
      return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
    },
    [],
  );

  data.priorities = await safe(
    "Distribuição de prioridades",
    warnings,
    async () => {
      if (!leadExists) return [];
      const { rows } = await pool.query<{ name: string; value: string }>(
        `select ${priorityExpression(scoreExpression, settings.scoring.highThreshold, settings.scoring.mediumThreshold)} as name,
                count(*)::text as value
           from jb_agent_leads l ${leadMetaJoin}
          where 1=1 ${leadRange}
          group by 1 order by 1`,
        params,
      );
      return rows.map((row) => ({ name: row.name, value: Number(row.value) }));
    },
    [],
  );

  data.lpsByDay = await safe(
    "LPs por período",
    warnings,
    async () => {
      if (!lpExists || !hasColumn(schema!.lps, "criado_em")) return [];
      const { rows } = await pool.query<{ date: string; value: string }>(
        `select to_char(date_trunc('day', lp."criado_em" at time zone $3), 'YYYY-MM-DD') as date, count(*)::text as value
           from jb_agent_lps lp
          where ${rangeCondition('lp."criado_em"', p1, p2)}
          group by 1 order by 1`,
        [...params, APP_TIMEZONE],
      );
      const map = new Map(rows.map((row) => [row.date, Number(row.value)]));
      return emptyDays.map((day) => ({ ...day, value: map.get(day.date) ?? 0 }));
    },
    emptyDays,
  );

  data.funnel = await safe(
    "Funil comercial",
    warnings,
    async () => {
      const { rows } = await pool.query<{ stage: CrmStage; value: string }>(
        `select ct.stage, count(*)::text as value
           from jb_agent_contacts ct
          group by ct.stage`,
      );
      const map = new Map(rows.map((row) => [row.stage, Number(row.value)]));
      return CRM_STAGES.map((stage) => ({
        stage,
        name: STAGE_LABELS[stage],
        value: map.get(stage) ?? 0,
      }));
    },
    CRM_STAGES.map((stage) => ({ stage, name: STAGE_LABELS[stage], value: 0 })),
  );

  data.conversionByCampaign = await safe(
    "Conversão por campanha",
    warnings,
    async () => {
      const { rows } = await pool.query<{
        id: string;
        name: string;
        leads: string;
        closed: string;
      }>(
        `select c.id, c.name,
                count(distinct cl.lead_id)::text as leads,
                count(distinct case when ct.stage = 'fechado' then ct.lead_id end)::text as closed
           from jb_agent_campaigns c
           left join jb_agent_campaign_leads cl on cl.campaign_id = c.id
           left join jb_agent_contacts ct on ct.lead_id = cl.lead_id
          group by c.id, c.name
          order by count(distinct cl.lead_id) desc, c.name
          limit 8`,
      );
      return rows.map((row) => {
        const leads = Number(row.leads);
        const closed = Number(row.closed);
        return {
          id: row.id,
          name: row.name,
          leads,
          closed,
          rate: leads > 0 ? Math.round((closed / leads) * 1000) / 10 : 0,
        };
      });
    },
    [],
  );

  data.activities = await safe("Atividade recente", warnings, () => getRecentActivity(12), []);
  return data;
}

export { STAGE_LABELS };
