import { getPool } from "@/db/client";
import { hasColumn, loadLegacySchema, type LegacySchema } from "./legacy-schema";
import { LP_STATUSES, type LpStatus } from "@/db/schema";

export function canonicalLpStatusSql(schema: LegacySchema): string {
  const fallback = hasColumn(schema.lps, "status") ? 'lp."status"::text' : "null::text";
  return `coalesce((select v.status from jb_agent_lp_versions v where v.lp_id = lp."id"::text order by v.version desc limit 1), ${fallback}, 'draft')`;
}

const EARLY_STAGES = [
  "identificado", "qualificado", "demonstracao_preparada",
  "aguardando_aprovacao", "pronto_para_contato",
];

export function nextCrmStageAfterLpReview(
  currentStage: string,
  lpStatus: LpStatus,
): string | null {
  if (!EARLY_STAGES.includes(currentStage)) return null;
  if (lpStatus === "approved") return "pronto_para_contato";
  if (lpStatus === "draft" && currentStage === "pronto_para_contato") return "aguardando_aprovacao";
  return null;
}

export async function setLpStatus(lpId: string, status: LpStatus) {
  if (!LP_STATUSES.includes(status)) throw new Error("INVALID_STATUS");
  const schema = await loadLegacySchema();
  if (!schema.lps.exists || !hasColumn(schema.lps, "id")) throw new Error("LP_NOT_FOUND");

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`lp-status:${lpId}`]);
    const { rows: [legacy] } = await client.query<{ id: string; lead_id: string | null; html: string | null; status: string | null }>(
      'select "id"::text as id, "lead_id"::text as lead_id, "html"::text as html, "status"::text as status from jb_agent_lps where "id"::text=$1 for update',
      [lpId],
    );
    if (!legacy) throw new Error("LP_NOT_FOUND");

    const { rows: [latest] } = await client.query<{ id: string; version: number; status: string; html_snapshot: string | null }>(
      "select id,version,status,html_snapshot from jb_agent_lp_versions where lp_id=$1 order by version desc limit 1 for update",
      [lpId],
    );
    const legacyUpdated = hasColumn(schema.lps, "status");
    if (!latest && !legacyUpdated) throw new Error("LP_STATUS_UNSUPPORTED");

    const previous = latest?.status ?? legacy.status ?? "draft";
    if ((status === "approved" || status === "published") && !latest?.html_snapshot && !legacy.html) {
      throw new Error("LP_HTML_MISSING");
    }
    // Aprovar a demonstracao e publicar sao acoes diferentes.
    if (status === "published" && previous !== "approved" && previous !== "published") {
      throw new Error("LP_APPROVAL_REQUIRED");
    }

    if (previous !== status) {
      if (latest) {
        await client.query("update jb_agent_lp_versions set status=$2,updated_at=now() where id=$1", [latest.id, status]);
      }
      if (legacyUpdated) {
        await client.query('update jb_agent_lps set "status"=$2 where "id"::text=$1', [lpId, status]);
      }

      // Gatilho da migracao 0003 cria a oportunidade na geracao; este e o
      // fallback para LPs antigas e a transicao da aprovacao para o CRM.
      if (legacy.lead_id && (status === "approved" || status === "draft")) {
        await client.query("select pg_advisory_xact_lock(hashtext($1))", [`crm-lead:${legacy.lead_id}`]);
        const { rows: [contact] } = await client.query<{ id: string; stage: string }>(
          `select id,stage from jb_agent_contacts where lead_id=$1
            order by case when stage in ('fechado','perdido') then 1 else 0 end, created_at asc
            limit 1 for update`,
          [legacy.lead_id],
        );
        let contactId = contact?.id;
        if (!contactId && status === "approved") {
          const created = await client.query<{ id: string }>(
            `insert into jb_agent_contacts (lead_id,lp_id,stage,channel,next_action)
             values ($1,$2,'pronto_para_contato','manual','Preparar abordagem e revisar o canal comercial')
             returning id`,
            [legacy.lead_id, lpId],
          );
          contactId = created.rows[0]?.id;
        } else if (contactId) {
          const nextStage = nextCrmStageAfterLpReview(contact.stage, status);
          if (nextStage && nextStage !== contact.stage) {
            await client.query(
              `update jb_agent_contacts
                  set stage=$2, lp_id=$3, updated_at=now(),
                      next_action=case when $2='pronto_para_contato'
                        then 'Preparar abordagem e revisar o canal comercial'
                        else 'Revisar demonstracao antes do contato' end
                where id=$1`,
              [contactId, nextStage, lpId],
            );
            await client.query(
              `insert into jb_agent_contact_events (contact_id,type,from_stage,to_stage,notes,metadata)
               values ($1,'etapa',$2,$3,'Revisao da landing page',$4::jsonb)`,
              [contactId, contact.stage, nextStage, JSON.stringify({ lp_id: lpId, lp_status: status })],
            );
          }
        }
        if (contactId) {
          await client.query(
            `insert into jb_agent_contact_events (contact_id,type,notes,metadata)
             values ($1,'lp_revisada',$2,$3::jsonb)`,
            [contactId, status === "approved" ? "Demonstracao aprovada manualmente" : "Demonstracao devolvida para revisao", JSON.stringify({ lp_id: lpId, status })],
          );
        }
      }
    }

    await client.query("commit");
    return { version: latest?.version ?? null, legacyUpdated, previous, changed: previous !== status };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
