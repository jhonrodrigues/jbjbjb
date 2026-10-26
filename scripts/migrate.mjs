import "dotenv/config";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL?.trim();
if (!url && !(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD)) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url || undefined,
  max: 2,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
});

const client = await pool.connect();
try {
  await client.query("select pg_advisory_lock(hashtext('jb_agent_migrations'))");
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Migrações aplicadas com sucesso.");
} catch (error) {
  console.error("Falha ao aplicar migrações:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try {
    await client.query("select pg_advisory_unlock(hashtext('jb_agent_migrations'))");
  } catch {}
  client.release();
  await pool.end();
}
