import { getDb } from "@/db/client";
import { activityLogs } from "@/db/schema";
import { logError } from "./logger";

export type AuditInput = {
  actorType?: "user" | "worker" | "system";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function recordActivity(input: AuditInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(activityLogs).values({
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logError("Falha ao registrar atividade", error, {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}
