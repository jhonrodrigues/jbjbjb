import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type GlobalDb = {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

const globalForDb = globalThis as typeof globalThis & { __jbAgentDb?: GlobalDb };

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim() || (
    process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD
  ));
}

export function getPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  const existing = globalForDb.__jbAgentDb?.pool;
  if (existing) return existing;

  const pool = new Pool({
    connectionString: url || undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
  });

  pool.on("error", (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "postgres-pool",
        message: error.message,
      }),
    );
  });

  globalForDb.__jbAgentDb = { ...(globalForDb.__jbAgentDb ?? {}), pool };
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  const existing = globalForDb.__jbAgentDb?.db;
  if (existing) return existing;

  const db = drizzle(getPool(), { schema });
  globalForDb.__jbAgentDb = { ...(globalForDb.__jbAgentDb ?? {}), db };
  return db;
}

export async function checkDatabase(): Promise<{
  ok: boolean;
  error?: string;
  latencyMs?: number;
}> {
  if (!hasDatabaseUrl()) return { ok: false, error: "DATABASE_URL não configurada" };
  const started = Date.now();
  try {
    const pool = getPool();
    await pool.query("select 1");
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao conectar no PostgreSQL",
      latencyMs: Date.now() - started,
    };
  }
}

export async function closeDb(): Promise<void> {
  const pool = globalForDb.__jbAgentDb?.pool;
  if (pool) await pool.end();
  globalForDb.__jbAgentDb = undefined;
}
