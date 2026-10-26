import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url && !(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD)) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}
const catalog = JSON.parse(await readFile(new URL("../src/lib/agent-catalog.json", import.meta.url), "utf8"));
const pool = new Pool({ connectionString: url || undefined, max: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined });

try {
  for (const agent of catalog) {
    await pool.query(
      `insert into jb_agent_agents (slug, name, role, description)
       values ($1, $2, $3, $4)
       on conflict (slug) do update set name = excluded.name, role = excluded.role, description = excluded.description, updated_at = now()`,
      [agent.slug, agent.name, agent.role, agent.description],
    );
  }
  console.log(`Catálogo sincronizado: ${catalog.length} agentes.`);
} catch (error) {
  console.error("Falha ao sincronizar catálogo:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
