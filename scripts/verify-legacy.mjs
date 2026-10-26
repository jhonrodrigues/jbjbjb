import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url && !(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD)) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}
const pool = new Pool({ connectionString: url || undefined, max: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined });

const REQUIRED = {
  jb_agent_leads: ["id"],
  jb_agent_lps: ["id"],
};

try {
  const problems = [];
  const { rows: columns } = await pool.query(
    `select table_name, column_name, udt_name from information_schema.columns where table_schema = 'public'`,
  );
  const map = new Map();
  for (const row of columns) {
    const list = map.get(row.table_name) ?? new Map();
    list.set(row.column_name, row.udt_name);
    map.set(row.table_name, list);
  }

  for (const [table, required] of Object.entries(REQUIRED)) {
    const tableColumns = map.get(table);
    if (!tableColumns) {
      problems.push(`Tabela obrigatória ausente: ${table}`);
      continue;
    }
    for (const column of required) {
      if (!tableColumns.has(column)) problems.push(`${table}.${column} ausente`);
    }
  }

  const leadId = map.get("jb_agent_leads")?.get("id");
  const lpId = map.get("jb_agent_lps")?.get("id");
  console.log("jb_agent_leads.id:", leadId ?? "ausente");
  console.log("jb_agent_lps.id:", lpId ?? "ausente");

  if (leadId && !["uuid", "int8", "int4", "text", "varchar"].includes(leadId)) {
    problems.push(`Tipo de id de lead não suportado: ${leadId}`);
  }
  if (lpId && !["uuid", "int8", "int4", "text", "varchar"].includes(lpId)) {
    problems.push(`Tipo de id de LP não suportado: ${lpId}`);
  }

  const leadColumns = map.get("jb_agent_leads");
  if (leadColumns) {
    console.log("Colunas de leads:", [...leadColumns.keys()].join(", "));
    for (const optional of ["criado_em", "atualizado_em", "analisado_em", "pontuacao"]) {
      if (!leadColumns.has(optional)) console.warn(`Aviso: coluna opcional ausente em leads: ${optional}`);
    }
  }

  if (problems.length) {
    console.error("\nFalhas de compatibilidade:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("\nSchema legado compatível.");
  }
} catch (error) {
  console.error("Falha na verificação:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
