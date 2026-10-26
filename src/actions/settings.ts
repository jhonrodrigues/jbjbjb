"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/audit";
import { formString, firstZodMessage, type ActionState } from "@/lib/forms";
import { getPlatformSettings } from "@/lib/settings";
import { settingsPatchSchema } from "@/lib/validation";
import { logError } from "@/lib/logger";

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const opportunityValues = formString(formData, "opportunityValues")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const parsed = settingsPatchSchema.safeParse({
    scoring: {
      highThreshold: formString(formData, "highThreshold"),
      mediumThreshold: formString(formData, "mediumThreshold"),
      opportunityValues,
    },
    limits: {
      maxJobsPerDay: formString(formData, "maxJobsPerDay"),
      maxLpGenerationsPerDay: formString(formData, "maxLpGenerationsPerDay"),
      estimatedLpCost: formString(formData, "estimatedLpCost"),
      monthlyBudget: formString(formData, "monthlyBudget"),
    },
    lpDefaults: {
      template: formString(formData, "template"),
      primaryColor: formString(formData, "primaryColor"),
      secondaryColor: formString(formData, "secondaryColor"),
      accentColor: formString(formData, "accentColor"),
      typography: formString(formData, "typography"),
    },
    ai: {
      provider: formString(formData, "aiProvider"),
      model: formString(formData, "aiModel"),
    },
  });

  if (!parsed.success) return { error: firstZodMessage(parsed.error), success: null };

  try {
    const current = await getPlatformSettings();
    const next = {
      scoring: { ...current.scoring, ...(parsed.data.scoring ?? {}) },
      limits: { ...current.limits, ...(parsed.data.limits ?? {}) },
      lpDefaults: { ...current.lpDefaults, ...(parsed.data.lpDefaults ?? {}) },
      ai: { ...current.ai, ...(parsed.data.ai ?? {}) },
    };
    if (next.scoring.highThreshold <= next.scoring.mediumThreshold) {
      return {
        error: "A prioridade alta deve ser maior que a prioridade média.",
        success: null,
      };
    }
    await getDb()
      .insert(settings)
      .values({ key: "platform", value: next as unknown as Record<string, unknown>, updatedBy: user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: next as unknown as Record<string, unknown>, updatedBy: user.id, updatedAt: new Date() },
      });
    await recordActivity({
      actorType: "user",
      actorId: user.id,
      action: "settings_updated",
      entityType: "settings",
      entityId: "platform",
      summary: "Configurações da plataforma atualizadas",
    });
  } catch (error) {
    logError("Falha ao salvar configurações", error, { userId: user.id });
    return { error: "Não foi possível salvar as configurações.", success: null };
  }

  revalidatePath("/configuracoes");
  return { error: null, success: "Configurações salvas." };
}
