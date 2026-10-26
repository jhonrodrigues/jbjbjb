"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/audit";
import { formCheckbox, formOptional, formString, firstZodMessage, type ActionState, zodFieldErrors } from "@/lib/forms";
import { campaignInputSchema } from "@/lib/validation";
import { enqueueJob } from "@/lib/jobs";
import { logError } from "@/lib/logger";

function optionalNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function saveCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = formString(formData, "id");
  const parsed = campaignInputSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    niche: formString(formData, "niche"),
    subNiche: formString(formData, "subNiche"),
    country: formString(formData, "country") || "Brasil",
    state: formString(formData, "state"),
    city: formString(formData, "city"),
    region: formString(formData, "region"),
    latitude: optionalNumber(formString(formData, "latitude")),
    longitude: optionalNumber(formString(formData, "longitude")),
    maxLeads: formString(formData, "maxLeads") || "100",
    maxPerRun: formString(formData, "maxPerRun") || "25",
    frequency: formString(formData, "frequency") || "manual",
    prospectSource: formString(formData, "prospectSource") || "google_places",
    searchProvider: formString(formData, "searchProvider") || "n8n",
    autoAnalyze: formCheckbox(formData, "autoAnalyze"),
    autoLp: formCheckbox(formData, "autoLp"),
    requireHuman: formCheckbox(formData, "requireHuman"),
    status: formString(formData, "status") || "draft",
  });

  if (!parsed.success) {
    return {
      error: firstZodMessage(parsed.error),
      success: null,
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const db = getDb();
  let campaignId = id;
  try {
    const values = {
      name: parsed.data.name,
      description: formOptional(formData, "description"),
      niche: parsed.data.niche,
      subNiche: formOptional(formData, "subNiche"),
      country: parsed.data.country,
      state: formOptional(formData, "state"),
      city: formOptional(formData, "city"),
      region: formOptional(formData, "region"),
      latitude: parsed.data.latitude?.toString() ?? null,
      longitude: parsed.data.longitude?.toString() ?? null,
      maxLeads: parsed.data.maxLeads,
      maxPerRun: parsed.data.maxPerRun,
      frequency: parsed.data.frequency,
      prospectSource: parsed.data.prospectSource,
      searchProvider: parsed.data.searchProvider,
      autoAnalyze: parsed.data.autoAnalyze,
      autoLp: parsed.data.autoLp,
      requireHuman: parsed.data.requireHuman,
      status: parsed.data.status,
      updatedAt: new Date(),
    };

    if (id) {
      const [updated] = await db.update(campaigns).set(values).where(eq(campaigns.id, id)).returning();
      if (!updated) return { error: "Campanha não encontrada.", success: null };
      await recordActivity({
        actorType: "user",
        actorId: user.id,
        action: "campaign_updated",
        entityType: "campaign",
        entityId: id,
        summary: `Campanha atualizada: ${updated.name}`,
      });
    } else {
      const [created] = await db
        .insert(campaigns)
        .values({ ...values, createdBy: user.id })
        .returning();
      campaignId = created.id;
      await recordActivity({
        actorType: "user",
        actorId: user.id,
        action: "campaign_created",
        entityType: "campaign",
        entityId: created.id,
        summary: `Campanha criada: ${created.name}`,
      });
    }
  } catch (error) {
    logError("Falha ao salvar campanha", error, { campaignId, userId: user.id });
    return { error: "Não foi possível salvar a campanha. Verifique a conexão com o banco.", success: null };
  }

  revalidatePath("/campanhas");
  revalidatePath(`/campanhas/${campaignId}`);
  redirect(`/campanhas/${campaignId}?saved=1`);
}

export async function setCampaignStatusAction(id: string, status: string): Promise<void> {
  const user = await requireUser();
  if (!["draft", "active", "paused", "archived"].includes(status)) throw new Error("INVALID_STATUS");
  const db = getDb();
  const [updated] = await db
    .update(campaigns)
    .set({ status: status as "draft" | "active" | "paused" | "archived", updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning();
  if (!updated) throw new Error("CAMPAIGN_NOT_FOUND");
  await recordActivity({
    actorType: "user",
    actorId: user.id,
    action: "campaign_status_changed",
    entityType: "campaign",
    entityId: id,
    summary: `Status da campanha alterado para ${status}`,
    metadata: { status },
  });
  revalidatePath("/campanhas");
  revalidatePath(`/campanhas/${id}`);
}

export async function runCampaignAction(id: string): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "active") throw new Error("CAMPAIGN_INACTIVE");

  await enqueueJob({
    type: "prospect_campaign",
    campaignId: id,
    createdBy: user.id,
    idempotencyKey: `prospect:${id}:${new Date().toISOString().slice(0, 13)}`,
    payload: {
      campaignId: id,
      niche: campaign.niche,
      city: campaign.city,
      state: campaign.state,
      country: campaign.country,
      maxPerRun: campaign.maxPerRun,
    },
  });

  await db
    .update(campaigns)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, id));

  revalidatePath(`/campanhas/${id}`);
  revalidatePath("/agentes");
}
