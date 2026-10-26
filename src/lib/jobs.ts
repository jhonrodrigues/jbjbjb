import { and, count, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, getPool } from "@/db/client";
import { agents, jobEvents, jobs, type JobType } from "@/db/schema";
import { getPlatformSettings } from "./settings";
import { JOB_AGENT_MAP } from "./agents";
import { recordActivity } from "./audit";
import { logError } from "./logger";
import { resolvePeriod } from "./period";

export class JobValidationError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 422, code = "JOB_VALIDATION") {
    super(message);
    this.name = "JobValidationError";
    this.status = status;
    this.code = code;
  }
}

export type EnqueueJobInput = {
  type: JobType;
  payload?: Record<string, unknown>;
  campaignId?: string | null;
  leadId?: string | null;
  lpId?: string | null;
  idempotencyKey?: string | null;
  createdBy?: string | null;
  agentSlug?: string | null;
  maxAttempts?: number;
};

function startOfToday(): Date {
  return resolvePeriod("today").from;
}

function lockTimeoutSeconds(): number {
  const value = Number(process.env.JOB_LOCK_TIMEOUT_SECONDS ?? 900);
  return Number.isFinite(value) ? Math.max(60, value) : 900;
}

function requireLease(job: Record<string, unknown>, workerId: string, leaseToken: string) {
  if (!leaseToken || job.lease_token !== leaseToken) {
    throw new JobValidationError("Claim expirado ou substituído", 409, "JOB_STALE_LEASE");
  }
  if (job.status === "completed") return;
  if (job.locked_by !== workerId) throw new JobValidationError("Tarefa pertence a outro worker", 409, "JOB_LOCKED");
  const lockedAt = job.locked_at instanceof Date ? job.locked_at.getTime() : new Date(String(job.locked_at)).getTime();
  if (!Number.isFinite(lockedAt) || lockedAt + lockTimeoutSeconds() * 1000 <= Date.now()) {
    throw new JobValidationError("Claim expirado", 409, "JOB_STALE_LEASE");
  }
}

function isLpGeneration(type: JobType): boolean {
  return type === "generate_lp" || type === "regenerate_lp";
}

export async function enqueueJob(input: EnqueueJobInput) {
  const db = getDb();
  const agentSlug = input.agentSlug ?? JOB_AGENT_MAP[input.type];
  const platform = await getPlatformSettings(true);

  const created = await db.transaction(async (tx) => {
  // Serialize quota admission; counts cover new jobs, not worker/manual retry attempts.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('jb_agent_job_admission'))`);
  if (input.idempotencyKey) {
    const [existing] = await tx.select().from(jobs).where(eq(jobs.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existing) return existing;
  }
  if (input.campaignId) {
    const { rows } = await tx.execute(sql`select status from jb_agent_campaigns where id = ${input.campaignId}::uuid for share`);
    if (rows[0]?.status !== "active") throw new JobValidationError("Campanha não está ativa", 409, "CAMPAIGN_INACTIVE");
  }

  const [agent] = await tx.select().from(agents).where(eq(agents.slug, agentSlug)).limit(1).for("share");
  if (agent?.paused) {
    throw new JobValidationError("Agente pausado para novas tarefas", 409, "AGENT_PAUSED");
  }

  const since = startOfToday();
  const [{ value: jobsToday }] = await tx
    .select({ value: count() })
    .from(jobs)
    .where(gte(jobs.createdAt, since));

  if (Number(jobsToday) >= platform.limits.maxJobsPerDay) {
    throw new JobValidationError("Limite diário de tarefas atingido", 429, "JOB_LIMIT");
  }

  if (isLpGeneration(input.type)) {
    const [{ value: lpsToday }] = await tx
      .select({ value: count() })
      .from(jobs)
      .where(and(gte(jobs.createdAt, since), inArray(jobs.type, ["generate_lp", "regenerate_lp"])));
    if (Number(lpsToday) >= platform.limits.maxLpGenerationsPerDay) {
      throw new JobValidationError("Limite diário de geração de LPs atingido", 429, "LP_LIMIT");
    }
  }

  const [created] = await tx
    .insert(jobs)
    .values({
      type: input.type,
      agentSlug,
      payload: input.payload ?? {},
      campaignId: input.campaignId ?? null,
      leadId: input.leadId ?? null,
      lpId: input.lpId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdBy: input.createdBy ?? null,
      maxAttempts: input.maxAttempts ?? 3,
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey })
    .returning();

  if (!created) {
    const [existing] = input.idempotencyKey
      ? await tx.select().from(jobs).where(eq(jobs.idempotencyKey, input.idempotencyKey)).limit(1)
      : [];
    if (!existing) throw new JobValidationError("Não foi possível enfileirar a tarefa", 500, "ENQUEUE_FAILED");
    return existing;
  }

  await tx.insert(jobEvents).values({
    jobId: created.id,
    event: "enqueued",
    data: { type: created.type, agentSlug },
  });

  return created;
  });

  await recordActivity({
    actorType: input.createdBy ? "user" : "system",
    actorId: input.createdBy ?? null,
    action: "job_enqueued",
    entityType: "job",
    entityId: created.id,
    summary: `Tarefa enfileirada: ${input.type}`,
    metadata: {
      type: created.type,
      campaignId: created.campaignId,
      leadId: created.leadId,
      lpId: created.lpId,
    },
  });

  return created;
}

export async function claimJobs(workerId: string, limit: number, types?: JobType[]) {
  const pool = getPool();
  const client = await pool.connect();
  const lockTimeout = lockTimeoutSeconds();
  try {
    await client.query("begin");

    await client.query(
      `update jb_agent_jobs
          set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
              error = coalesce(error, 'Lock expirado; tarefa liberada para nova tentativa'),
              locked_at = null,
              locked_by = null,
              lease_token = null,
              available_at = now() + interval '30 seconds',
              finished_at = case when attempts >= max_attempts then now() else finished_at end,
              updated_at = now()
        where status = 'processing'
          and locked_at < now() - ($1::int * interval '1 second')`,
      [lockTimeout],
    );

    const typeFilter = types && types.length > 0 ? types : null;
    const { rows } = await client.query<Record<string, unknown>>(
      `with candidates as (
         select id
           from jb_agent_jobs
          where status = 'pending'
            and available_at <= now()
             and ($2::text[] is null or type = any($2::text[]))
             and not exists (select 1 from jb_agent_agents a where a.slug = jb_agent_jobs.agent_slug and a.paused)
             and (campaign_id is null or exists (select 1 from jb_agent_campaigns c where c.id = campaign_id and c.status = 'active'))
          order by available_at asc, created_at asc
          for update skip locked
          limit $1
       )
       update jb_agent_jobs j
          set status = 'processing',
              attempts = j.attempts + 1,
              locked_at = now(),
               locked_by = $3,
               lease_token = gen_random_uuid(),
              started_at = coalesce(j.started_at, now()),
              updated_at = now()
         from candidates c
        where j.id = c.id
        returning j.*`,
      [limit, typeFilter, workerId],
    );

    for (const job of rows) {
      await client.query(
        `insert into jb_agent_job_events (job_id, event, worker_id, data)
         values ($1::uuid, 'claimed', $2, $3::jsonb)`,
        [job.id, workerId, JSON.stringify({ attempt: job.attempts })],
      );
    }

    await client.query("commit");
    return rows;
  } catch (error) {
    await client.query("rollback");
    logError("Falha ao reivindicar tarefas", error, { workerId });
    throw error;
  } finally {
    client.release();
  }
}

export async function completeJob(
  id: string,
  workerId: string,
  result: Record<string, unknown>,
  leaseToken: string,
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<Record<string, unknown>>(
      `select * from jb_agent_jobs where id = $1::uuid for update`,
      [id],
    );
    const job = rows[0];
    if (!job) {
      await client.query("rollback");
      throw new JobValidationError("Tarefa não encontrada", 404, "JOB_NOT_FOUND");
    }
    if (job.status === "completed") {
      requireLease(job, workerId, leaseToken);
      await client.query("commit");
      return job;
    }
    if (job.status !== "processing") {
      await client.query("rollback");
      throw new JobValidationError("Tarefa não está em processamento", 409, "JOB_NOT_PROCESSING");
    }
    requireLease(job, workerId, leaseToken);
    const { rows: updated } = await client.query<Record<string, unknown>>(
      `update jb_agent_jobs
          set status = 'completed',
              result = $2::jsonb,
              error = null,
              finished_at = now(),
              locked_at = null,
              locked_by = null,
              updated_at = now()
        where id = $1::uuid
        returning *`,
      [id, JSON.stringify(result)],
    );
    await client.query(
      `insert into jb_agent_job_events (job_id, event, worker_id, data)
       values ($1::uuid, 'completed', $2, $3::jsonb)`,
      [id, workerId, JSON.stringify({ result })],
    );
    await client.query("commit");
    await recordActivity({
      actorType: "worker",
      actorId: workerId,
      action: "job_completed",
      entityType: "job",
      entityId: id,
      summary: "Tarefa concluída pelo worker",
      metadata: { type: job.type },
    });
    return updated[0];
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // transação já encerrada
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function failJob(
  id: string,
  workerId: string,
  errorMessage: string,
  retryable: boolean,
  leaseToken: string,
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<Record<string, unknown>>(
      `select * from jb_agent_jobs where id = $1::uuid for update`,
      [id],
    );
    const job = rows[0];
    if (!job) {
      await client.query("rollback");
      throw new JobValidationError("Tarefa não encontrada", 404, "JOB_NOT_FOUND");
    }
    if (job.status === "completed") {
      await client.query("rollback");
      throw new JobValidationError("Tarefa já concluída", 409, "JOB_COMPLETED");
    }
    if (job.status !== "processing") {
      await client.query("rollback");
      throw new JobValidationError("Tarefa não está em processamento", 409, "JOB_NOT_PROCESSING");
    }
    requireLease(job, workerId, leaseToken);
    const attempts = Number(job.attempts ?? 0);
    const maxAttempts = Number(job.max_attempts ?? 3);
    const finalFailure = !retryable || attempts >= maxAttempts;
    const { rows: updated } = await client.query<Record<string, unknown>>(
      `update jb_agent_jobs
          set status = $2,
              error = $3,
              available_at = case when $2 = 'pending' then now() + interval '60 seconds' else available_at end,
              finished_at = case when $2 = 'failed' then now() else finished_at end,
              locked_at = null,
              locked_by = null,
              lease_token = null,
              updated_at = now()
        where id = $1::uuid
        returning *`,
      [id, finalFailure ? "failed" : "pending", errorMessage.slice(0, 4000)],
    );
    await client.query(
      `insert into jb_agent_job_events (job_id, event, worker_id, data)
       values ($1::uuid, $2, $3, $4::jsonb)`,
      [id, finalFailure ? "failed" : "retry_scheduled", workerId, JSON.stringify({ error: errorMessage })],
    );
    await client.query("commit");
    await recordActivity({
      actorType: "worker",
      actorId: workerId,
      action: finalFailure ? "job_failed" : "job_retry_scheduled",
      entityType: "job",
      entityId: id,
      summary: finalFailure ? "Tarefa falhou definitivamente" : "Tarefa será tentada novamente",
      metadata: { type: job.type, error: errorMessage },
    });
    return updated[0];
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // transação já encerrada
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getJobById(id: string) {
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return job ?? null;
}

export async function getJobsPage(page = 1, pageSize = 25, status?: string) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(5, pageSize));
  const where = status && status !== "all" ? eq(jobs.status, status as never) : undefined;
  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(where)
      .orderBy(desc(jobs.createdAt))
      .limit(safeSize)
      .offset((safePage - 1) * safeSize),
    db.select({ value: count() }).from(jobs).where(where),
  ]);
  return {
    rows,
    total: Number(total),
    page: safePage,
    pageSize: safeSize,
    pageCount: Math.max(1, Math.ceil(Number(total) / safeSize)),
  };
}

export async function getAgentObservability() {
  const db = getDb();
  const rows = await db
    .select({
      agentSlug: jobs.agentSlug,
      status: jobs.status,
      total: count(),
      lastRun: sql<Date | null>`max(${jobs.updatedAt})`,
    })
    .from(jobs)
    .where(isNotNull(jobs.agentSlug))
    .groupBy(jobs.agentSlug, jobs.status);

  const pausedRows = await db.select().from(agents);
  const byAgent = new Map<
    string,
    { pending: number; processing: number; completed: number; failed: number; lastRun: Date | null }
  >();
  for (const row of rows) {
    if (!row.agentSlug) continue;
    const current = byAgent.get(row.agentSlug) ?? {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      lastRun: null,
    };
    if (row.status === "pending") current.pending = Number(row.total);
    if (row.status === "processing") current.processing = Number(row.total);
    if (row.status === "completed") current.completed = Number(row.total);
    if (row.status === "failed") current.failed = Number(row.total);
    if (row.lastRun && (!current.lastRun || new Date(row.lastRun) > current.lastRun)) {
      current.lastRun = new Date(row.lastRun);
    }
    byAgent.set(row.agentSlug, current);
  }
  return { byAgent, paused: new Map(pausedRows.map((agent) => [agent.slug, agent.paused])) };
}

export async function setAgentPaused(slug: string, paused: boolean, userId?: string) {
  const db = getDb();
  const [updated] = await db
    .update(agents)
    .set({ paused, updatedAt: new Date() })
    .where(eq(agents.slug, slug))
    .returning();
  if (!updated) throw new JobValidationError("Agente não encontrado", 404, "AGENT_NOT_FOUND");
  await recordActivity({
    actorType: userId ? "user" : "system",
    actorId: userId ?? null,
    action: paused ? "agent_paused" : "agent_resumed",
    entityType: "agent",
    entityId: slug,
    summary: paused ? `Agente ${updated.name} pausado` : `Agente ${updated.name} reativado`,
  });
  return updated;
}

export async function getJobEvents(jobId: string) {
  const db = getDb();
  return db
    .select()
    .from(jobEvents)
    .where(eq(jobEvents.jobId, jobId))
    .orderBy(desc(jobEvents.createdAt))
    .limit(100);
}

export async function getJobStats() {
  const db = getDb();
  const rows = await db.select({ status: jobs.status, total: count() }).from(jobs).groupBy(jobs.status);
  const map = new Map(rows.map((row) => [row.status, Number(row.total)]));
  return {
    pending: map.get("pending") ?? 0,
    processing: map.get("processing") ?? 0,
    completed: map.get("completed") ?? 0,
    failed: map.get("failed") ?? 0,
    cancelled: map.get("cancelled") ?? 0,
    total: rows.reduce((sum, row) => sum + Number(row.total), 0),
  };
}

export async function retryJob(id: string, userId?: string) {
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
  const [updated] = await tx
    .update(jobs)
    .set({
      status: "pending",
      attempts: 0,
      error: null,
      availableAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      leaseToken: null,
      startedAt: null,
      result: null,
      finishedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["failed", "cancelled"])))
    .returning();
  if (!updated) throw new JobValidationError("Somente tarefas com falha ou canceladas podem ser reenfileiradas", 409, "JOB_INVALID_TRANSITION");
  await tx.insert(jobEvents).values({ jobId: id, event: "retried", data: {} });
  return updated;
  });
  await recordActivity({
    actorType: userId ? "user" : "system",
    actorId: userId ?? null,
    action: "job_retried",
    entityType: "job",
    entityId: id,
    summary: "Tarefa reenfileirada manualmente",
  });
  return updated;
}

export async function cancelJob(id: string, userId?: string) {
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
  const [updated] = await tx
    .update(jobs)
    .set({
      status: "cancelled",
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      leaseToken: null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["pending", "processing", "failed"])))
    .returning();
  if (!updated) throw new JobValidationError("Estado da tarefa não permite cancelamento", 409, "JOB_INVALID_TRANSITION");
  await tx.insert(jobEvents).values({ jobId: id, event: "cancelled", data: {} });
  return updated;
  });
  await recordActivity({
    actorType: userId ? "user" : "system",
    actorId: userId ?? null,
    action: "job_cancelled",
    entityType: "job",
    entityId: id,
    summary: "Tarefa cancelada manualmente",
  });
  return updated;
}
