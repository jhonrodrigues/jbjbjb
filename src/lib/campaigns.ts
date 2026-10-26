import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db/client";
import { campaignLeads, campaigns, contacts, type CampaignStatus } from "@/db/schema";

export type CampaignListRow = {
  id: string;
  name: string;
  description: string | null;
  niche: string;
  subNiche: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  country: string;
  status: CampaignStatus;
  maxLeads: number;
  maxPerRun: number;
  frequency: string;
  autoAnalyze: boolean;
  autoLp: boolean;
  requireHuman: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
  leads: number;
  contactCount: number;
  closed: number;
};

export type CampaignsPage = {
  rows: CampaignListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getCampaignsPage(
  filters: { status?: string; search?: string } = {},
  page = 1,
  pageSize = 12,
): Promise<CampaignsPage> {
  if (!hasDatabaseUrl()) return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  const db = getDb();
  const safePage = Math.max(1, page);
  const safeSize = Math.min(60, Math.max(1, pageSize));
  const conditions = [];
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(campaigns.status, filters.status as CampaignStatus));
  }
  if (filters.search) {
    conditions.push(
      or(
        ilike(campaigns.name, `%${filters.search}%`),
        ilike(campaigns.niche, `%${filters.search}%`),
        ilike(campaigns.city, `%${filters.search}%`),
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        niche: campaigns.niche,
        subNiche: campaigns.subNiche,
        city: campaigns.city,
        state: campaigns.state,
        region: campaigns.region,
        country: campaigns.country,
        status: campaigns.status,
        maxLeads: campaigns.maxLeads,
        maxPerRun: campaigns.maxPerRun,
        frequency: campaigns.frequency,
        autoAnalyze: campaigns.autoAnalyze,
        autoLp: campaigns.autoLp,
        requireHuman: campaigns.requireHuman,
        lastRunAt: campaigns.lastRunAt,
        createdAt: campaigns.createdAt,
        leads: count(sql`distinct ${campaignLeads.leadId}`),
        contactCount: count(sql`distinct ${contacts.id}`),
        closed: count(sql`distinct case when ${contacts.stage} = 'fechado' then ${contacts.id} end`),
      })
      .from(campaigns)
      .leftJoin(campaignLeads, eq(campaignLeads.campaignId, campaigns.id))
      .leftJoin(contacts, eq(contacts.campaignId, campaigns.id))
      .where(where)
      .groupBy(campaigns.id)
      .orderBy(desc(campaigns.createdAt))
      .limit(safeSize)
      .offset((safePage - 1) * safeSize),
    db.select({ value: count() }).from(campaigns).where(where),
  ]);

  const total = Number(totalRow[0]?.value ?? 0);
  return {
    rows: rows.map((row) => ({
      ...row,
      leads: Number(row.leads),
      contactCount: Number(row.contactCount),
      closed: Number(row.closed),
    })),
    total,
    page: safePage,
    pageSize: safeSize,
    pageCount: Math.max(1, Math.ceil(total / safeSize)),
  };
}

export async function getCampaignById(id: string) {
  if (!hasDatabaseUrl()) return null;
  const db = getDb();
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCampaignMetrics(id: string) {
  if (!hasDatabaseUrl()) return { leads: 0, contacts: 0, closed: 0, revenue: 0, lps: 0 };
  const db = getDb();
  const [leadCount] = await db
    .select({ value: count() })
    .from(campaignLeads)
    .where(eq(campaignLeads.campaignId, id));
  const [contactStats] = await db
    .select({
      total: count(),
      closed: count(sql`case when ${contacts.stage} = 'fechado' then 1 end`),
      revenue: sql<string>`coalesce(sum(case when ${contacts.stage} = 'fechado' then ${contacts.closedValue} else 0 end), 0)`,
    })
    .from(contacts)
    .where(eq(contacts.campaignId, id));

  return {
    leads: Number(leadCount?.value ?? 0),
    contacts: Number(contactStats?.total ?? 0),
    closed: Number(contactStats?.closed ?? 0),
    revenue: Number(contactStats?.revenue ?? 0),
    lps: 0,
  };
}

export async function getCampaignOptions() {
  if (!hasDatabaseUrl()) return [];
  return getDb()
    .select({ id: campaigns.id, name: campaigns.name, status: campaigns.status })
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt));
}
