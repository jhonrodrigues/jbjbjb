import { getPool } from "@/db/client";
import { hasColumn, loadLegacySchema, type LegacySchema } from "./legacy-schema";
import { LP_STATUSES, type LpStatus } from "@/db/schema";

export function canonicalLpStatusSql(schema: LegacySchema): string {
  const fallback = hasColumn(schema.lps, "status") ? 'lp."status"::text' : "null::text";
  return `coalesce((select v.status from jb_agent_lp_versions v where v.lp_id = lp."id"::text order by v.version desc limit 1), ${fallback}, 'draft')`;
}

export async function setLpStatus(lpId: string, status: LpStatus) {
  if (!LP_STATUSES.includes(status)) throw new Error("INVALID_STATUS");
  const schema = await loadLegacySchema();
  if (!schema.lps.exists || !hasColumn(schema.lps, "id")) throw new Error("LP_NOT_FOUND");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`lp-status:${lpId}`]);
    const legacy = await client.query('select "id" from jb_agent_lps where "id"::text=$1 for update', [lpId]);
    if (!legacy.rowCount) throw new Error("LP_NOT_FOUND");
    const { rows: [latest] } = await client.query("select id,version from jb_agent_lp_versions where lp_id=$1 order by version desc limit 1 for update", [lpId]);
    const legacyUpdated = hasColumn(schema.lps, "status");
    if (!latest && !legacyUpdated) throw new Error("LP_STATUS_UNSUPPORTED");
    if (latest) await client.query("update jb_agent_lp_versions set status=$2,updated_at=now() where id=$1", [latest.id, status]);
    if (legacyUpdated) await client.query('update jb_agent_lps set "status"=$2 where "id"::text=$1', [lpId, status]);
    await client.query("commit");
    return { version: latest?.version ?? null, legacyUpdated };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
