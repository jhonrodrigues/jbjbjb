import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db/client";
import { settings } from "@/db/schema";

export type ScoringSettings = {
  highThreshold: number;
  mediumThreshold: number;
  opportunityValues: string[];
};

export type PlatformSettings = {
  scoring: ScoringSettings;
  limits: {
    maxJobsPerDay: number;
    maxLpGenerationsPerDay: number;
    estimatedLpCost: number;
    monthlyBudget: number;
  };
  lpDefaults: {
    template: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    typography: string;
  };
  ai: {
    provider: string;
    model: string;
    configured: boolean;
  };
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  scoring: {
    highThreshold: 80,
    mediumThreshold: 50,
    opportunityValues: ["sim", "true", "1", "alta", "qualificado", "aprovado", "quente"],
  },
  limits: {
    maxJobsPerDay: 200,
    maxLpGenerationsPerDay: 50,
    estimatedLpCost: 0,
    monthlyBudget: 0,
  },
  lpDefaults: {
    template: "local_business",
    primaryColor: "#111318",
    secondaryColor: "#F5F5F2",
    accentColor: "#4F46E5",
    typography: "Geist",
  },
  ai: {
    provider: "OpenAI-compatible",
    model: "",
    configured: false,
  },
};

function mergeSettings(value: unknown): PlatformSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Partial<PlatformSettings>;
  return {
    scoring: { ...DEFAULT_SETTINGS.scoring, ...(raw.scoring ?? {}) },
    limits: { ...DEFAULT_SETTINGS.limits, ...(raw.limits ?? {}) },
    lpDefaults: { ...DEFAULT_SETTINGS.lpDefaults, ...(raw.lpDefaults ?? {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(raw.ai ?? {}) },
  };
}

export async function getPlatformSettings(strict = false): Promise<PlatformSettings> {
  if (!hasDatabaseUrl()) return DEFAULT_SETTINGS;
  try {
    const db = getDb();
    const rows = await db.select().from(settings).where(eq(settings.key, "platform"));
    return mergeSettings(rows[0]?.value);
  } catch (error) {
    if (strict) throw error;
    return DEFAULT_SETTINGS;
  }
}

export async function savePlatformSettings(
  patch: Partial<PlatformSettings>,
  userId?: string,
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next: PlatformSettings = {
    scoring: { ...current.scoring, ...(patch.scoring ?? {}) },
    limits: { ...current.limits, ...(patch.limits ?? {}) },
    lpDefaults: { ...current.lpDefaults, ...(patch.lpDefaults ?? {}) },
    ai: { ...current.ai, ...(patch.ai ?? {}) },
  };
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: "platform", value: next as unknown as Record<string, unknown>, updatedBy: userId })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: next as unknown as Record<string, unknown>,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
  return next;
}

export function isAgentPaused(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "paused" in value &&
      (value as { paused?: unknown }).paused === true,
  );
}
