import { getPool } from "@/db/client";
import type { PoolClient } from "pg";
import { isOptOut, type SalesChannel, type SalesMode } from "./sales-policy";

export type SalesThreadRow = {
  contact_id: string;
  mode: SalesMode;
  opted_out: boolean;
  last_inbound_at: Date | null;
  updated_at: Date;
};
export type SalesMessageRow = {
  id: string;
  contact_id: string;
  channel: SalesChannel;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  in_reply_to: string | null;
  provider_message_id: string | null;
  created_at: Date;
};

async function transaction<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try { const result = await fn(); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}

export async function isSalesPaused(client?: PoolClient): Promise<boolean> {
  const db = client ?? getPool();
  const { rows } = await db.query<{ value: { paused?: boolean } }>(
    "SELECT value FROM jb_agent_settings WHERE key='sales_autopilot' LIMIT 1",
  );
  // Fail closed if configuration was not initialized by migration.
  return rows[0]?.value?.paused !== false;
}

export async function ingestSalesInbound(input: {
  contactId: string;
  channel: SalesChannel;
  providerMessageId: string;
  text: string;
  customerInitiated: true;
}) {
  const client = await getPool().connect();
  try {
    return await transaction(client, async () => {
      const exists = await client.query<{ id: string }>(
        "SELECT id FROM jb_agent_contacts WHERE id=$1 FOR SHARE", [input.contactId],
      );
      if (!exists.rowCount) throw new Error("SALES_CONTACT_NOT_FOUND");
      const stop = isOptOut(input.text);
      const { rows: [row] } = await client.query<{ id: string }>(
        `INSERT INTO jb_agent_sales_messages
          (contact_id,channel,provider_message_id,direction,content,status)
         VALUES ($1,$2,$3,'inbound',$4,$5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [input.contactId,input.channel,input.providerMessageId,input.text,stop ? "held" : "pending"],
      );
      if (!row) return { duplicate: true };

      await client.query(
        `INSERT INTO jb_agent_sales_threads(contact_id,mode,opted_out,last_inbound_at)
         VALUES ($1,'ai',$2,now())
         ON CONFLICT(contact_id) DO UPDATE
            SET last_inbound_at=now(),
                opted_out=jb_agent_sales_threads.opted_out OR EXCLUDED.opted_out,
                updated_at=now()`,
        [input.contactId,stop],
      );
      if (!stop) {
        await client.query(
          `UPDATE jb_agent_contacts
              SET stage=CASE WHEN stage IN ('pronto_para_contato','contatado')
                THEN 'respondeu' ELSE stage END,
                  updated_at=now()
            WHERE id=$1`,
          [input.contactId],
        );
      } else {
        await client.query(
          "UPDATE jb_agent_contacts SET next_action='Não contatar — opt-out registrado', updated_at=now() WHERE id=$1",
          [input.contactId],
        );
      }
      return { duplicate: false, messageId: row.id, optedOut: stop };
    });
  } finally { client.release(); }
}

export async function setSalesPaused(paused: boolean, userId: string) {
  await getPool().query(
    `INSERT INTO jb_agent_settings(key,value,updated_by,updated_at)
      VALUES('sales_autopilot',jsonb_build_object('paused',$1::boolean),$2::uuid,now())
      ON CONFLICT(key) DO UPDATE SET
        value=jsonb_build_object('paused',$1::boolean),
        updated_by=$2::uuid, updated_at=now()`,
    [paused,userId],
  );
}

export async function setSalesThreadMode(contactId: string, mode: SalesMode) {
  const { rowCount } = await getPool().query(
    `INSERT INTO jb_agent_sales_threads(contact_id,mode)
      SELECT id,$2 FROM jb_agent_contacts WHERE id=$1
      ON CONFLICT(contact_id) DO UPDATE SET mode=$2,updated_at=now()`,
    [contactId,mode],
  );
  if (!rowCount) throw new Error("SALES_CONTACT_NOT_FOUND");
}

export async function listSalesThreads(limit = 60) {
  return (await getPool().query<{
    contact_id: string; mode: SalesMode; opted_out: boolean;
    last_inbound_at: Date | null; updated_at: Date;
    lead_id: string; stage: string;
    messages: number; pending: number; drafts: number; last_message: string | null;
  }>(
    `SELECT t.*,c.lead_id,c.stage,
      (SELECT count(*)::integer FROM jb_agent_sales_messages m WHERE m.contact_id=t.contact_id) AS messages,
      (SELECT count(*)::integer FROM jb_agent_sales_messages m WHERE m.contact_id=t.contact_id AND m.status IN ('pending','processing')) AS pending,
      (SELECT count(*)::integer FROM jb_agent_sales_messages m WHERE m.contact_id=t.contact_id AND m.status IN ('draft','held')) AS drafts,
      (SELECT left(m.content,140) FROM jb_agent_sales_messages m WHERE m.contact_id=t.contact_id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message
     FROM jb_agent_sales_threads t JOIN jb_agent_contacts c ON c.id=t.contact_id
     ORDER BY t.updated_at DESC LIMIT $1`,
    [Math.max(1,Math.min(limit,100))],
  )).rows;
}

export async function listSalesMessages(contactId: string, limit = 80): Promise<SalesMessageRow[]> {
  return (await getPool().query<SalesMessageRow>(
    `SELECT id,contact_id,channel,direction,content,status,in_reply_to,provider_message_id,created_at
       FROM jb_agent_sales_messages
      WHERE contact_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
    [contactId,Math.max(1,Math.min(limit,100))],
  )).rows.reverse();
}

export async function getSalesStats() {
  const { rows: [stats] } = await getPool().query<{
    conversations: number; ai: number; human: number; stopped: number; pending: number; drafts: number; sent: number;
  }>(`SELECT
    (SELECT count(*)::integer FROM jb_agent_sales_threads) AS conversations,
    (SELECT count(*)::integer FROM jb_agent_sales_threads WHERE mode='ai' AND NOT opted_out) AS ai,
    (SELECT count(*)::integer FROM jb_agent_sales_threads WHERE mode='human') AS human,
    (SELECT count(*)::integer FROM jb_agent_sales_threads WHERE opted_out) AS stopped,
    (SELECT count(*)::integer FROM jb_agent_sales_messages WHERE direction='inbound' AND status='pending') AS pending,
    (SELECT count(*)::integer FROM jb_agent_sales_messages WHERE direction='outbound' AND status='draft') AS drafts,
    (SELECT count(*)::integer FROM jb_agent_sales_messages WHERE direction='outbound' AND status='sent') AS sent`);
  return stats;
}

export async function getSalesThread(contactId: string): Promise<SalesThreadRow | null> {
  const { rows } = await getPool().query<SalesThreadRow>(
    "SELECT * FROM jb_agent_sales_threads WHERE contact_id=$1", [contactId],
  );
  return rows[0] ?? null;
}
