import type { NextRequest } from "next/server";
import { z } from "zod";
import { getPool } from "@/db/client";
import { constantTimeEqual,jsonError,jsonOk } from "@/lib/http";
import { isSalesPaused } from "@/lib/sales-store";
import { canAutoReply,validateSalesDecision } from "@/lib/sales-policy";
import { logError } from "@/lib/logger";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const schema=z.object({
  idempotencyKey:z.uuid(),
  contactId:z.uuid(),
  channel:z.literal("whatsapp"),
  text:z.string().min(10).max(750),
  replyToProviderMessageId:z.string().min(4).max(160),
}).strict();

function configured():boolean {
  return process.env.JB_SALES_WORKER_ENABLED==="true" &&
    process.env.JB_SALES_AUTOSEND_ENABLED==="true";
}

// Ingress somente do motor autenticado. Nunca aceita envio arbitrário.
export async function POST(request:NextRequest) {
  const secret=process.env.JB_SALES_OUTBOUND_SECRET?.trim();
  const authorization=request.headers.get("authorization");
  if(!secret||secret.length<24) return jsonError("Gateway não configurado",503,"GATEWAY_DISABLED");
  if(!authorization?.startsWith("Bearer ")||
     !constantTimeEqual(authorization.slice(7),secret)) return jsonError("Não autorizado",401,"UNAUTHORIZED");
  if(!configured()) return jsonError("Envio automático desativado",409,"AUTOSEND_DISABLED");
  let raw:unknown;
  try {raw=await request.json();} catch{return jsonError("JSON inválido",400,"INVALID_JSON");}
  const result=schema.safeParse(raw);
  if(!result.success) return jsonError("Payload inválido",422,"INVALID_REQUEST");
  const body=result.data;
  if(!validateSalesDecision({reply:body.text,handoff:false,optOut:false}))
    return jsonError("Conteúdo não autorizado",422,"INVALID_CONTENT");

  const token=process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId=process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version=process.env.META_GRAPH_API_VERSION?.trim();
  if(!token||!phoneId||!version||!/^v\d{1,3}\.\d{1,2}$/.test(version)||
    !/^\d{4,25}$/.test(phoneId)) {
    return jsonError("Credenciais oficiais incompletas",503,"META_SEND_NOT_CONFIGURED");
  }

  const client=await getPool().connect();
  let reserved=false;
  let receiver:string|null=null;
  try {
    await client.query("BEGIN");
    try {
      const {rows:[context]}=await client.query<{
        status:string;direction:string;channel:string;content:string;in_reply_to:string|null;
        mode:"ai"|"human";opted_out:boolean;last_inbound_at:Date|null;
        external_user_id:string;stage:string;
      }>(`SELECT msg.status,msg.direction,msg.channel,msg.content,msg.in_reply_to,
           t.mode,t.opted_out,t.last_inbound_at,i.external_user_id,c.stage
         FROM jb_agent_sales_messages msg
         JOIN jb_agent_sales_threads t ON t.contact_id=msg.contact_id
         JOIN jb_agent_contacts c ON c.id=msg.contact_id
         JOIN jb_agent_acquisition_identities i ON i.contact_id=msg.contact_id AND i.channel='whatsapp'
         WHERE msg.id=$1 AND msg.contact_id=$2 FOR UPDATE OF msg`,
      [body.idempotencyKey,body.contactId]);

      const {rows:[inbound]}=await client.query<{id:string;created_at:Date}>(
        `SELECT id,created_at FROM jb_agent_sales_messages
         WHERE contact_id=$1 AND channel='whatsapp' AND direction='inbound'
           AND provider_message_id=$2 AND status='done' LIMIT 1`,
        [body.contactId,body.replyToProviderMessageId],
      );
      if(!context||context.direction!=="outbound"||context.channel!=="whatsapp"||
         context.status!=="draft"||context.content!==body.text||!inbound||
         context.in_reply_to!==inbound.id||
         ["fechado","perdido"].includes(context.stage)||
         !(await isSalesPaused(client)===false)||
         !canAutoReply({workerEnabled:true,paused:false,mode:context.mode,
            optedOut:context.opted_out,lastInboundAt:context.last_inbound_at,now:new Date()})) {
        await client.query("ROLLBACK");
        return jsonError("Envio bloqueado por estado, consentimento ou janela",409,"POLICY_BLOCK");
      }
      const {rows:[rate]}=await client.query<{last_minute:number;last_day:number}>(`
        SELECT
          count(*) FILTER (WHERE created_at >= now()-interval '1 minute')::integer AS last_minute,
          count(*) FILTER (WHERE created_at >= now()-interval '24 hours')::integer AS last_day
        FROM jb_agent_sales_messages
        WHERE contact_id=$1 AND direction='outbound' AND status='sent'`,
        [body.contactId],
      );
      if(Number(rate?.last_minute??0)>=2 || Number(rate?.last_day??0)>=30) {
        await client.query("ROLLBACK");
        return jsonError("Limite de respostas por contato atingido",429,"CONTACT_RATE_LIMIT");
      }
      const {rows:[newer]}=await client.query<{newer:boolean}>(`
        SELECT EXISTS(SELECT 1 FROM jb_agent_sales_messages m
          WHERE m.contact_id=$1 AND m.direction='inbound'
            AND (m.created_at,m.id)>($2::timestamptz,$3::uuid)) AS newer`,
        [body.contactId,inbound.created_at,inbound.id],
      );
      if(newer?.newer) {
        await client.query("ROLLBACK");
        return jsonError("Nova mensagem recebida: resposta anterior obsoleta",409,"STALE_REPLY");
      }
      // Outbox durável criado ANTES da chamada externa. Falhas ambíguas
      // nunca recebem segunda tentativa automática.
      const {rows:[claimed]}=await client.query<{reply_id:string}>(`
        INSERT INTO jb_agent_whatsapp_delivery_attempts(reply_id,status)
        VALUES($1,'sending') ON CONFLICT DO NOTHING RETURNING reply_id`,
        [body.idempotencyKey],
      );
      if(!claimed){
        const {rows:[prior]}=await client.query<{status:string;provider_message_id:string|null}>(
          "SELECT status,provider_message_id FROM jb_agent_whatsapp_delivery_attempts WHERE reply_id=$1",
          [body.idempotencyKey],
        );
        await client.query("ROLLBACK");
        if(prior?.status==="sent"&&prior.provider_message_id)
          return jsonOk({sent:true,providerMessageId:prior.provider_message_id,alreadyProcessed:true});
        return jsonError("Despacho anterior pendente; requer conciliação manual",409,"OUTBOUND_UNCERTAIN");
      }
      receiver=context.external_user_id;
      reserved=true;
      await client.query("COMMIT");
    } catch(error) {await client.query("ROLLBACK");throw error;}

    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),11000);
    try {
      const resp=await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`,{
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          messaging_product:"whatsapp",recipient_type:"individual",
          to:receiver,type:"text",text:{preview_url:false,body:body.text},
          context:{message_id:body.replyToProviderMessageId},
        }),
        signal:controller.signal,cache:"no-store",
      });
      if(!resp.ok) throw new Error("META_SEND_HTTP_"+resp.status);
      const reply=await resp.json() as {messages?:{id?:string}[]};
      const messageId=reply.messages?.[0]?.id;
      if(!messageId||typeof messageId!=="string") throw new Error("META_SEND_UNCONFIRMED");
      await client.query("BEGIN");
      try {
        await client.query(
          "UPDATE jb_agent_whatsapp_delivery_attempts SET status='sent',provider_message_id=$2,updated_at=now() WHERE reply_id=$1",
          [body.idempotencyKey,messageId],
        );
        await client.query(
          `UPDATE jb_agent_sales_messages SET status='sent',provider_reply_id=$2,
           updated_at=now() WHERE id=$1 AND status='draft'`,[body.idempotencyKey,messageId],
        );
        await client.query("COMMIT");
      } catch(error) {await client.query("ROLLBACK");throw error;}
      // 'sent' aqui significa aceito pela Graph API; entrega/leitura dependem de callback.
      return jsonOk({sent:true,providerMessageId:messageId});
    } finally {clearTimeout(timeout);}
  } catch(error){
    logError("Gateway WhatsApp: despacho não confirmado",error,{replyId:body.idempotencyKey});
    if(reserved){
      try {await client.query(
        `UPDATE jb_agent_whatsapp_delivery_attempts SET status='uncertain',updated_at=now()
         WHERE reply_id=$1 AND status='sending'`,[body.idempotencyKey]);}
      catch(inner){logError("Falha ao registrar outbox incerta",inner);}
    }
    return jsonError("Entrega incerta; nunca reenviar automaticamente",503,"OUTBOUND_UNCONFIRMED");
  } finally {client.release();}
}
