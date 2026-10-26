import { z } from "zod";
import { CRM_STAGES, JOB_TYPES } from "@/db/schema";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const campaignInputSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  niche: z.string().trim().min(2, "Informe o nicho").max(120),
  subNiche: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().min(2).max(80).default("Brasil"),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  boundingBox: z.record(z.string(), z.number()).optional().nullable(),
  maxLeads: z.coerce.number().int().min(1).max(100000).default(100),
  maxPerRun: z.coerce.number().int().min(1).max(1000).default(25),
  frequency: z.enum(["manual", "daily", "weekly", "monthly"]).default("manual"),
  prospectSource: z.string().trim().min(2).max(80).default("google_places"),
  searchProvider: z.string().trim().min(2).max(80).default("n8n"),
  autoAnalyze: z.coerce.boolean().default(false),
  autoLp: z.coerce.boolean().default(false),
  requireHuman: z.coerce.boolean().default(true),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const leadFiltersSchema = z.object({
  campaignId: z.string().uuid().optional().or(z.literal("")),
  niche: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.string().trim().max(80).optional().or(z.literal("")),
  priority: z.enum(["alta", "media", "baixa", "nao_avaliada"]).optional().or(z.literal("")),
  website: z.enum(["with", "without_info"]).optional().or(z.literal("")),
  lp: z.enum(["with", "without"]).optional().or(z.literal("")),
  discarded: z.enum(["exclude", "only", "all"]).optional().or(z.literal("")),
  search: z.string().trim().max(160).optional().or(z.literal("")),
  dateFrom: z.string().optional().or(z.literal("")),
  dateTo: z.string().optional().or(z.literal("")),
});

export const crmStageSchema = z.enum(CRM_STAGES);

export const contactEventInputSchema = z.object({
  contactId: z.string().uuid(),
  type: z.enum(["contato", "resposta", "proposta", "venda", "nota", "etapa"]),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  toStage: crmStageSchema.optional(),
});

export const contactInputSchema = z.object({
  leadId: z.string().trim().min(1),
  campaignId: z.string().uuid().optional().or(z.literal("")),
  ownerId: z.string().uuid().optional().or(z.literal("")),
  stage: crmStageSchema.default("identificado"),
  channel: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  nextAction: z.string().trim().max(240).optional().or(z.literal("")),
  nextActionAt: z.string().optional().or(z.literal("")),
  proposedValue: z.coerce.number().min(0).optional().nullable(),
  closedValue: z.coerce.number().min(0).optional().nullable(),
  lpId: z.string().trim().max(120).optional().or(z.literal("")),
});

export const brandProfileSchema = z.object({
  businessName: z.string().trim().max(160).optional().or(z.literal("")),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  secondaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  typography: z.string().trim().max(120).optional().or(z.literal("")),
  segment: z.string().trim().max(120).optional().or(z.literal("")),
  visualStyle: z.string().trim().max(120).optional().or(z.literal("")),
  tone: z.string().trim().max(240).optional().or(z.literal("")),
  visualReferences: z.array(z.string().trim().max(500)).max(20).optional(),
  sourceFonts: z.array(z.string().trim().max(120)).max(20).optional(),
  confidence: z.coerce.number().int().min(0).max(100).optional().nullable(),
  identityStatus: z.enum(["confirmed", "suggested"]).default("suggested"),
});

export const lpConfigSchema = z.object({
  template: z.enum([
    "beauty_premium",
    "medical_clean",
    "corporate_modern",
    "luxury_minimal",
    "bold_creative",
    "local_business",
  ]),
  palette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  typography: z.string().max(120),
  headerStyle: z.enum(["minimal", "centered", "split", "transparent"]),
  heroStyle: z.enum([
    "editorial_minimal",
    "animated_gradient",
    "floating_elements",
    "soft_motion_image",
    "split_screen",
    "animated_type",
  ]),
  sections: z.array(z.string().max(80)).max(30),
  buttonStyle: z.enum(["solid", "outline", "pill", "square"]),
  cardStyle: z.enum(["soft", "bordered", "elevated", "flat"]),
  spacing: z.enum(["compact", "balanced", "airy"]),
  effects: z.array(
    z.enum(["fade_in", "parallax", "floating", "scroll_transitions", "hover", "animated_gradient"]),
  ).max(10),
  reducedMotion: z.boolean().default(true),
});

export const jobEnqueueSchema = z.object({
  type: z.enum(JOB_TYPES),
  campaignId: z.string().uuid().optional(),
  leadId: z.string().trim().max(120).optional(),
  lpId: z.string().trim().max(120).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const jobClaimSchema = z.object({
  workerId: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(1),
  types: z.array(z.enum(JOB_TYPES)).max(10).optional(),
});

export const jobResultSchema = z.object({
  leaseToken: z.string().uuid(),
  workerId: z.string().trim().min(2).max(120),
  result: z.record(z.string(), z.unknown()).default({}),
});

export const jobFailSchema = z.object({
  leaseToken: z.string().uuid(),
  workerId: z.string().trim().min(2).max(120),
  error: z.string().trim().min(1).max(4000),
  retryable: z.boolean().default(true),
});

export const settingsPatchSchema = z.object({
  scoring: z
    .object({
      highThreshold: z.coerce.number().int().min(1).max(100),
      mediumThreshold: z.coerce.number().int().min(0).max(99),
      opportunityValues: z.array(z.string().trim().min(1).max(40)).max(30),
    })
    .partial()
    .optional(),
  limits: z
    .object({
      maxJobsPerDay: z.coerce.number().int().min(1).max(100000),
      maxLpGenerationsPerDay: z.coerce.number().int().min(0).max(100000),
      estimatedLpCost: z.coerce.number().min(0).max(1000000),
      monthlyBudget: z.coerce.number().min(0).max(100000000),
    })
    .partial()
    .optional(),
  lpDefaults: z
    .object({
      template: z.string().max(80),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      typography: z.string().max(120),
    })
    .partial()
    .optional(),
  ai: z
    .object({
      provider: z.string().max(120),
      model: z.string().max(120),
      configured: z.boolean(),
    })
    .partial()
    .optional(),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "A senha deve ter pelo menos 10 caracteres").max(200),
  role: z.enum(["admin", "member"]).default("member"),
});

export const userUpdateSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(10).max(200).optional().or(z.literal("")),
  role: z.enum(["admin", "member"]).optional(),
  active: z.coerce.boolean().optional(),
});
