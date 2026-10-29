import { getPool } from "@/db/client";
import { getLeadById } from "@/lib/legacy";
import { getAcquisitionProfile } from "@/lib/acquisition";
import { generateSalesReply, type SalesHistoryMessage } from "./sales-ai";
import { canAutoReply, isOptOut, type SalesChannel, type SalesMode } from "./sales-policy";
import { isSalesPaused } from "./sales-store";
import { logError } from "./logger";

type Claimed = {
  id: string; contact_id: string; channel: SalesChannel; content: string;
  provider_message_id: string; attempts: number;
};
type Thread = {
  mode: SalesMode; opted_out: boolean; last_inbound_at: Date | null;
  lead_id: string; lp_id: string | null; stage: string;
};

export type SalesTickResult = {
  outcome: "disabled" | "paused" | "busy" | "empty" | "held" | "draft" | "sent" | "error";
  messageId?: string;
};

function maxSalesPerHour() {
  const amount = Number(process.env.JB_SALES_MAX_PER_HOUR ?? 30);
  return Number.isInteger(amount) ? Math.min(100,Math.max(1,amount)) : 30;
}

async function dispatchReply(input: {
  id: string; contactId: string; channel: SalesChannel; text: string; providerInboundId: string;
}) {
  const address = process.env.JB_SALES_OUTBOUND_URL?.trim();
  const secret = process.env.JB_SALES_OUTBOUND_SECRET?.trim();
  if (!address || !secret || secret.length < 24) throw new Error("SALES_OUTBOUND_NOT_CONFIGURED");
  const url = new URL(address);
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash) {
    throw new Error("SALES_OUTBOUND_INVALID_URL");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const reply = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey: input.id,
        contactId: input.contactId,
        channel: input.channel,
        text: input.text,
        replyToProviderMessageId: input.providerInboundId,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!reply.ok) throw new Error(`SALES_OUTBOUND_HTTP_${reply.status}`);
    const result = await reply.json() as { sent?: unknown; providerMessageId?: unknown };
    if (result.sent !== true || typeof result.providerMessageId !== "string" || !result.providerMessageId.trim()) {
      throw new Error("SALES_OUTBOUND_NOT_CONFIRMED");
    }
    return result.providerMessageId.slice(0,160);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runSalesTick(): Promise<SalesTickResult> {
  if (process.env.JB_SALES_WORKER_ENABLED !== "true") return { outcome: "disabled" };
  const client = await getPool().connect();
  let locked = false;
  let claimed: Claimed | null = null;
  try {
    const { rows: [lock] } = await client.query<{ ok: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('jb_agent_sales_worker')) AS ok",
    );
    locked = lock?.ok === true;
    if (!locked) return { outcome: "busy" };
    if (await isSalesPaused(client)) return { outcome: "paused" };
    if (!process.env.OPENAI_API_KEY) return { outcome: "disabled" };

    const hour = await client.query<{ total: number }>(
      `SELECT count(*)::integer AS total FROM jb_agent_sales_messages
       WHERE direction='inbound' AND attempts>0 AND updated_at > now()-interval '1 hour'`,
    );
    if (Number(hour.rows[0]?.total ?? 0) >= maxSalesPerHour()) return { outcome: "paused" };

    await client.query("BEGIN");
    try {
      await client.query(
        `UPDATE jb_agent_sales_messages SET status=CASE WHEN attempts >= 2 THEN 'held' ELSE 'pending' END,
         error='WORKER_TIMEOUT',locked_at=NULL,updated_at=now()
         WHERE direction='inbound' AND status='processing'
           AND locked_at < now()-interval '5 minutes'`,
      );
      const { rows } = await client.query<Claimed>(
        `UPDATE jb_agent_sales_messages SET status='processing',attempts=attempts+1,
                 locked_at=now(),updated_at=now()
         WHERE id=(SELECT id FROM jb_agent_sales_messages
                    WHERE direction='inbound' AND status='pending'
                    ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
         RETURNING id,contact_id,channel,content,provider_message_id,attempts`,
      );
      claimed = rows[0] ?? null;
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    if (!claimed) return { outcome: "empty" };

    const { rows: [thread] } = await client.query<Thread>(
      `SELECT t.mode,t.opted_out,t.last_inbound_at,c.lead_id,c.lp_id,c.stage
       FROM jb_agent_sales_threads t
       JOIN jb_agent_contacts c ON c.id=t.contact_id
       WHERE t.contact_id=$1`,
      [claimed.contact_id],
    );
    if (!thread || ["fechado","perdido"].includes(thread.stage) || isOptOut(claimed.content) || !canAutoReply({
      workerEnabled: true, paused: await isSalesPaused(client),
      mode: thread.mode, optedOut: thread.opted_out,
      lastInboundAt: thread.last_inbound_at, now: new Date(),
    })) {
      await client.query(
        `UPDATE jb_agent_sales_messages SET status='held',error='SALES_BLOCKED',
         updated_at=now(),locked_at=NULL WHERE id=$1`,[claimed.id],
      );
      return { outcome: "held", messageId: claimed.id };
    }

    const lead = await getLeadById(thread.lead_id).catch(() => null);
    const acquisition = !lead ? await getAcquisitionProfile(claimed.contact_id) : null;
    const approved = thread.lp_id
      ? await client.query<{ status: string }>(
        "SELECT status FROM jb_agent_lp_versions WHERE lp_id=$1 ORDER BY version DESC LIMIT 1",[thread.lp_id],
      )
      : null;
    const { rows: history } = await client.query<{ direction: SalesHistoryMessage["direction"]; content: string }>(
      `SELECT direction,content FROM (
         SELECT direction,content,created_at,id FROM jb_agent_sales_messages
         WHERE contact_id=$1 AND (
           (direction='inbound' AND status IN ('done','processing','held')) OR
           (direction='outbound' AND status='sent')
         ) ORDER BY created_at DESC,id DESC LIMIT 16
       ) m ORDER BY created_at ASC,id ASC`,
      [claimed.contact_id],
    );
    const decision = await generateSalesReply(history,{
      businessName: lead?.empresa || "negócio ainda não informado",
      customerName: acquisition?.display_name ?? null,
      niche: lead?.nicho ?? null,
      city: lead?.cidade ?? null,
      hasApprovedLp: ["approved","published"].includes(approved?.rows[0]?.status ?? ""),
    });
    if (decision.optOut) {
      await client.query("BEGIN");
      try {
        await client.query("UPDATE jb_agent_sales_threads SET opted_out=true,updated_at=now() WHERE contact_id=$1",[claimed.contact_id]);
        await client.query("UPDATE jb_agent_sales_messages SET status='done',updated_at=now(),locked_at=NULL WHERE id=$1",[claimed.id]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      return { outcome: "held", messageId: claimed.id };
    }

    await client.query("BEGIN");
    let outboundId: string | null = null;
    try {
      if (decision.reply) {
        const { rows: [outbound] } = await client.query<{ id: string }>(
          `INSERT INTO jb_agent_sales_messages
            (contact_id,channel,direction,content,status,in_reply_to)
           VALUES($1,$2,'outbound',$3,'draft',$4)
           ON CONFLICT DO NOTHING RETURNING id`,
          [claimed.contact_id,claimed.channel,decision.reply,claimed.id],
        );
        outboundId = outbound?.id ?? null;
      }
      if (decision.handoff) {
        await client.query("UPDATE jb_agent_sales_threads SET mode='human',updated_at=now() WHERE contact_id=$1",[claimed.contact_id]);
        await client.query(
          "UPDATE jb_agent_contacts SET next_action='Atendimento humano solicitado',updated_at=now() WHERE id=$1",
          [claimed.contact_id],
        );
      }
      await client.query("UPDATE jb_agent_sales_messages SET status='done',updated_at=now(),locked_at=NULL WHERE id=$1",[claimed.id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    if (!outboundId || decision.handoff) return { outcome: "held", messageId: claimed.id };

    // Sem opt-in global explícito, só se gera rascunho. A habilitação é dupla:
    // setting do painel E flag no servidor, além de canal outbound configurado.
    if (process.env.JB_SALES_AUTOSEND_ENABLED !== "true") return { outcome: "draft",messageId: claimed.id };
    const { rows: [fresh] } = await client.query<{
      mode: SalesMode; opted_out: boolean; last_inbound_at: Date | null;
    }>("SELECT mode,opted_out,last_inbound_at FROM jb_agent_sales_threads WHERE contact_id=$1",[claimed.contact_id]);
    if (!fresh || !canAutoReply({
      workerEnabled: true,paused: await isSalesPaused(client),mode:fresh.mode,
      optedOut:fresh.opted_out,lastInboundAt:fresh.last_inbound_at,now:new Date(),
    })) return { outcome:"draft",messageId:claimed.id };

    const { rows: [newer] } = await client.query<{ newer: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM jb_agent_sales_messages
         WHERE contact_id=$1 AND direction='inbound'
           AND (created_at,id) > (SELECT created_at,id FROM jb_agent_sales_messages WHERE id=$2)
       ) AS newer`,[claimed.contact_id,claimed.id],
    );
    if (newer?.newer) return { outcome:"draft",messageId:claimed.id };

    const { rows: [rate] } = await client.query<{ last_minute: number; last_day: number }>(
      `SELECT
       count(*) FILTER (WHERE created_at >= now()-interval '1 minute')::integer AS last_minute,
       count(*) FILTER (WHERE created_at >= now()-interval '24 hours')::integer AS last_day
       FROM jb_agent_sales_messages WHERE contact_id=$1 AND direction='outbound' AND status='sent'`,
      [claimed.contact_id],
    );
    if (Number(rate?.last_minute ?? 0) >= 2 || Number(rate?.last_day ?? 0) >= 30) {
      return { outcome:"draft",messageId:claimed.id };
    }

    // Não repetir despacho em caso de falha/incerteza. Requer inspeção humana.
    try {
      const providerId = await dispatchReply({
        id:outboundId,contactId:claimed.contact_id,channel:claimed.channel,
        text:decision.reply,providerInboundId:claimed.provider_message_id,
      });
      await client.query(
        `UPDATE jb_agent_sales_messages SET status='sent',provider_reply_id=$2,
         updated_at=now() WHERE id=$1 AND status='draft'`,[outboundId,providerId],
      );
      return { outcome:"sent",messageId:claimed.id };
    } catch (error) {
      logError("Envio do vendedor virtual sem confirmação — manter rascunho",error,{ contactId:claimed.contact_id });
      await client.query(
        "UPDATE jb_agent_sales_messages SET error='OUTBOUND_UNCONFIRMED',updated_at=now() WHERE id=$1",
        [outboundId],
      );
      return { outcome:"draft",messageId:claimed.id };
    }
  } catch (error) {
    logError("Falha no tick do motor comercial",error,{ messageId:claimed?.id });
    if (claimed) {
      try {
        await client.query(
          `UPDATE jb_agent_sales_messages SET
             status=CASE WHEN attempts>=2 THEN 'held' ELSE 'pending' END,
             error='PROCESSING_FAILED',locked_at=NULL,updated_at=now()
           WHERE id=$1 AND status='processing'`,[claimed.id],
        );
      } catch (inner) { logError("Falha ao recuperar mensagem comercial",inner,{messageId:claimed.id}); }
    }
    return { outcome:"error",messageId:claimed?.id };
  } finally {
    if (locked) {
      try { await client.query("SELECT pg_advisory_unlock(hashtext('jb_agent_sales_worker'))"); }
      catch (error) { logError("Falha ao liberar lock comercial",error); }
    }
    client.release();
  }
}
