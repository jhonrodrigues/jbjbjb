import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url && !(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD)) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}
const pool = new Pool({ connectionString: url || undefined, max: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined });

try {
  const { rows: tables } = await pool.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_name in ('jb_agent_leads','jb_agent_lps') order by table_name`,
  );
  console.log("Tabelas legadas encontradas:", tables.map((row) => row.table_name).join(", ") || "nenhuma");
  for (const { table_name: table } of tables) {
    const { rows: columns } = await pool.query(
      `select column_name, data_type, udt_name, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public' and table_name = $1
        order by ordinal_position`,
      [table],
    );
    console.log(`\n${table} (${columns.length} colunas)`);
    for (const column of columns) {
      console.log(`  ${column.column_name}: ${column.data_type}${column.udt_name ? ` [${column.udt_name}]` : ""}${column.is_nullable === "NO" ? " NOT NULL" : ""}`);
    }
  }

  for (const table of ["jb_agent_leads", "jb_agent_lps"]) {
    const exists = tables.some((row) => row.table_name === table);
    if (!exists) continue;
    const { rows } = await pool.query(`select count(*)::text as count from ${table}`);
    console.log(`\n${table}: ${rows[0].count} registros`);
    // Never print row contents: sensitive data may be nested in JSON or HTML columns.
  }
} catch (error) {
  console.error("Falha na inspeção:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
