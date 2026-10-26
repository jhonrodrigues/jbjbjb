import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const LP_STATUSES = ["draft", "approved", "published", "archived"] as const;
export type LpStatus = (typeof LP_STATUSES)[number];

export const JOB_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TYPES = [
  "prospect_campaign",
  "analyze_lead",
  "research_brand",
  "generate_lp",
  "regenerate_lp",
  "publish_lp",
  "prepare_outreach",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const CRM_STAGES = [
  "identificado",
  "qualificado",
  "demonstracao_preparada",
  "aguardando_aprovacao",
  "pronto_para_contato",
  "contatado",
  "respondeu",
  "em_negociacao",
  "proposta_enviada",
  "fechado",
  "perdido",
] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const users = pgTable(
  "jb_agent_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    sessionVersion: integer("session_version").notNull().default(0),
    role: text("role").$type<UserRole>().notNull().default("member"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("jb_agent_users_email_uq").on(table.email)],
);

export const campaigns = pgTable(
  "jb_agent_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    niche: text("niche").notNull(),
    subNiche: text("sub_niche"),
    country: text("country").notNull().default("Brasil"),
    state: text("state"),
    city: text("city"),
    region: text("region"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    boundingBox: jsonb("bounding_box").$type<Record<string, number> | null>(),
    maxLeads: integer("max_leads").notNull().default(100),
    maxPerRun: integer("max_per_run").notNull().default(25),
    frequency: text("frequency").notNull().default("manual"),
    prospectSource: text("prospect_source").notNull().default("google_places"),
    searchProvider: text("search_provider").notNull().default("n8n"),
    autoAnalyze: boolean("auto_analyze").notNull().default(false),
    autoLp: boolean("auto_lp").notNull().default(false),
    requireHuman: boolean("require_human").notNull().default(true),
    status: text("status").$type<CampaignStatus>().notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jb_agent_campaigns_status_idx").on(table.status),
    index("jb_agent_campaigns_created_idx").on(table.createdAt),
  ],
);

export const campaignLeads = pgTable(
  "jb_agent_campaign_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull(),
    source: text("source"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jb_agent_campaign_leads_uq").on(table.campaignId, table.leadId),
    index("jb_agent_campaign_leads_lead_idx").on(table.leadId),
    index("jb_agent_campaign_leads_campaign_idx").on(table.campaignId),
  ],
);

export const leadMeta = pgTable(
  "jb_agent_lead_meta",
  {
    leadId: text("lead_id").primaryKey(),
    priorityOverride: text("priority_override"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
    discardedReason: text("discarded_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jb_agent_lead_meta_priority_idx").on(table.priorityOverride),
    index("jb_agent_lead_meta_discarded_idx").on(table.discardedAt),
  ],
);

export const brandProfiles = pgTable(
  "jb_agent_brand_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: text("lead_id").notNull(),
    businessName: text("business_name"),
    logoPath: text("logo_path"),
    logoAltPath: text("logo_alt_path"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    accentColor: text("accent_color"),
    typography: text("typography"),
    segment: text("segment"),
    visualStyle: text("visual_style"),
    tone: text("tone"),
    visualReferences: jsonb("visual_references").$type<string[]>().notNull().default([]),
    sourceFonts: jsonb("source_fonts").$type<string[]>().notNull().default([]),
    confidence: integer("confidence"),
    identityStatus: text("identity_status").notNull().default("suggested"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jb_agent_brand_profiles_lead_uq").on(table.leadId),
    index("jb_agent_brand_profiles_status_idx").on(table.identityStatus),
  ],
);

export const lpVersions = pgTable(
  "jb_agent_lp_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lpId: text("lp_id").notNull(),
    leadId: text("lead_id").notNull(),
    version: integer("version").notNull(),
    template: text("template").notNull().default("local_business"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    htmlSnapshot: text("html_snapshot"),
    status: text("status").$type<LpStatus>().notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jb_agent_lp_versions_lp_version_uq").on(table.lpId, table.version),
    index("jb_agent_lp_versions_lead_idx").on(table.leadId),
    index("jb_agent_lp_versions_status_idx").on(table.status),
    index("jb_agent_lp_versions_created_idx").on(table.createdAt),
  ],
);

export const contacts = pgTable(
  "jb_agent_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: text("lead_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    stage: text("stage").$type<CrmStage>().notNull().default("identificado"),
    channel: text("channel"),
    notes: text("notes"),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    nextAction: text("next_action"),
    proposedValue: numeric("proposed_value", { precision: 12, scale: 2 }),
    closedValue: numeric("closed_value", { precision: 12, scale: 2 }),
    lpId: text("lp_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jb_agent_contacts_lead_idx").on(table.leadId),
    index("jb_agent_contacts_campaign_idx").on(table.campaignId),
    index("jb_agent_contacts_stage_idx").on(table.stage),
    index("jb_agent_contacts_owner_idx").on(table.ownerId),
  ],
);

export const contactEvents = pgTable(
  "jb_agent_contact_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fromStage: text("from_stage").$type<CrmStage>(),
    toStage: text("to_stage").$type<CrmStage>(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jb_agent_contact_events_contact_idx").on(table.contactId),
    index("jb_agent_contact_events_created_idx").on(table.createdAt),
  ],
);

export const jobs = pgTable(
  "jb_agent_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<JobType>().notNull(),
    agentSlug: text("agent_slug"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    leadId: text("lead_id"),
    lpId: text("lp_id"),
    status: text("status").$type<JobStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    idempotencyKey: text("idempotency_key"),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    leaseToken: uuid("lease_token"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jb_agent_jobs_idempotency_uq").on(table.idempotencyKey),
    index("jb_agent_jobs_claim_idx").on(table.status, table.availableAt),
    index("jb_agent_jobs_campaign_idx").on(table.campaignId),
    index("jb_agent_jobs_lead_idx").on(table.leadId),
    index("jb_agent_jobs_agent_idx").on(table.agentSlug),
    index("jb_agent_jobs_created_idx").on(table.createdAt),
  ],
);

export const jobEvents = pgTable(
  "jb_agent_job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    workerId: text("worker_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jb_agent_job_events_job_idx").on(table.jobId),
    index("jb_agent_job_events_created_idx").on(table.createdAt),
  ],
);

export const activityLogs = pgTable(
  "jb_agent_activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: text("actor_type").notNull().default("system"),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jb_agent_activity_logs_created_idx").on(table.createdAt),
    index("jb_agent_activity_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const settings = pgTable("jb_agent_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable("jb_agent_agents", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  description: text("description"),
  paused: boolean("paused").notNull().default(false),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type User = typeof users.$inferSelect;
export type BrandProfile = typeof brandProfiles.$inferSelect;
export type LpVersion = typeof lpVersions.$inferSelect;
