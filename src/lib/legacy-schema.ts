import { getPool } from "@/db/client";

export type LegacyColumn = {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
};

export type LegacyTable = {
  exists: boolean;
  columns: Map<string, LegacyColumn>;
};

export type LegacySchema = {
  leads: LegacyTable;
  lps: LegacyTable;
  loadedAt: number;
};

type Cache = { value?: LegacySchema; expiresAt?: number };

const globalCache = globalThis as typeof globalThis & {
  __jbLegacySchemaCache?: Cache;
};

const CACHE_MS = 30_000;

export async function loadLegacySchema(force = false): Promise<LegacySchema> {
  const cache = globalCache.__jbLegacySchemaCache;
  if (!force && cache?.value && cache.expiresAt && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const pool = getPool();
  const { rows } = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `select table_name, column_name, data_type, udt_name, is_nullable, column_default
       from information_schema.columns
      where table_schema = current_schema()
        and table_name in ('jb_agent_leads', 'jb_agent_lps')
      order by table_name, ordinal_position`,
  );

  const leads = new Map<string, LegacyColumn>();
  const lps = new Map<string, LegacyColumn>();

  for (const row of rows) {
    const column: LegacyColumn = {
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
    };
    if (row.table_name === "jb_agent_leads") leads.set(row.column_name, column);
    if (row.table_name === "jb_agent_lps") lps.set(row.column_name, column);
  }

  const value: LegacySchema = {
    leads: { exists: leads.size > 0, columns: leads },
    lps: { exists: lps.size > 0, columns: lps },
    loadedAt: Date.now(),
  };

  globalCache.__jbLegacySchemaCache = { value, expiresAt: Date.now() + CACHE_MS };
  return value;
}

export function clearLegacySchemaCache(): void {
  globalCache.__jbLegacySchemaCache = undefined;
}

export function hasColumn(table: LegacyTable, column: string): boolean {
  return table.columns.has(column);
}

export function columnInfo(table: LegacyTable, column: string): LegacyColumn | undefined {
  return table.columns.get(column);
}

export function safeLegacyIdCast(column: LegacyColumn | undefined): string {
  switch (column?.udtName) {
    case "uuid":
      return "::uuid";
    case "int2":
      return "::smallint";
    case "int4":
      return "::integer";
    case "int8":
      return "::bigint";
    default:
      return "::text";
  }
}

export function safeNumericExpression(table: LegacyTable, column: string): string {
  if (!hasColumn(table, column)) return "null::numeric";
  const info = columnInfo(table, column);
  if (!info) return "null::numeric";
  if (["numeric", "decimal", "real", "double precision", "int2", "int4", "int8"].includes(info.dataType)) {
    return `l."${column}"::numeric`;
  }
  return `case when l."${column}"::text ~ '^-?[0-9]+(\\.[0-9]+)?$' then l."${column}"::text::numeric end`;
}

export function selectOrNull(table: LegacyTable, column: string, alias = column): string {
  return hasColumn(table, column) ? `"${column}"` : `null::text as "${alias}"`;
}
