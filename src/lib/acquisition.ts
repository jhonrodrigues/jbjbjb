import { createHash } from "node:crypto";
import { getPool } from "@/db/client";
import { ingestSalesInbound } from "@/lib/sales-store";

export type AcquisitionSource =
  | "meta_ads" | "whatsapp_organic" | "form" | "b2b_email" | "organic" | "other";

export function acquisitionSourceLabel(source: string): string {
  return ({
    meta_ads: "Meta Ads", whatsapp_organic: "WhatsApp orgânico",
    form: "Formulário", b2b_email: "Prospecção por e-mail",
    organic: "Orgânico", other: "Outros",
  } as Record<string,string>)[source] ?? source;
}

function stableLeadId(channel: string, externalId: string): string {
  return "inbound:" + channel + ":" +
    createHash("sha256").update(channel + ":" + externalId).digest("hex").slice(0,32);
}
export function safeMarketingKey(value: unknown, limit = 160): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= limit && /^[\w.:-]+$/.test(trimmed) ? trimmed : null;
}

export type AcquisitionIdentity = {
  channel: "whatsapp" | "form";
  externalId: string;
  displayName: string | null;
  source: AcquisitionSource;
  campaignKey?: string | null;
  adKey?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  email?: string | null;
  eventKey: string;
  eventType: "conversation_started" | "form_submitted";
  marketingOptIn?: boolean;
};

export async function resolveAcquisitionIdentity(input: AcquisitionIdentity):
  Promise<{ contactId: string; created: boolean }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    try {
      // Uma identidade só pode criar um contato. Não fazemos fusão especulativa
      // entre canais, números e contas nem alteramos leads prospectados.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",
        ["acquisition:" + input.channel + ":" + input.externalId]);
      const { rows: [existing] } = await client.query<{ contact_id: string }>(
        "SELECT contact_id FROM jb_agent_acquisition_identities WHERE channel=$1 AND external_user_id=$2",
        [input.channel,input.externalId],
      );
      let contactId: string;
      let created = false;
      if (existing) {
        contactId = existing.contact_id;
      } else {
        const { rows: [contact] } = await client.query<{ id: string }>(
          `INSERT INTO jb_agent_contacts(lead_id,channel,stage,next_action)
            VALUES($1,$2,'identificado',$3) RETURNING id`,
          [stableLeadId(input.channel,input.externalId),input.channel,
            input.channel === "whatsapp" ? "Responder interessado via canal autorizado" : "Qualificar lead recebido"],
        );
        contactId = contact.id;
        created = true;
        await client.query(
          `INSERT INTO jb_agent_acquisition_identities(channel,external_user_id,contact_id,display_name)
           VALUES($1,$2,$3,$4)`,
          [input.channel,input.externalId,contactId,input.displayName],
        );
        await client.query(
          `INSERT INTO jb_agent_acquisition_contacts
             (contact_id,source,display_name,email,campaign_key,ad_key,utm_source,utm_medium,utm_campaign,utm_content)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [contactId,input.source,input.displayName,input.email ?? null,
            input.campaignKey ?? null,input.adKey ?? null,input.utmSource ?? null,
            input.utmMedium ?? null,input.utmCampaign ?? null,input.utmContent ?? null],
        );
      }
      await client.query(
        `UPDATE jb_agent_acquisition_identities SET last_seen_at=now(),
          display_name=coalesce($3,display_name) WHERE channel=$1 AND external_user_id=$2`,
        [input.channel,input.externalId,input.displayName],
      );
      // Guarda atribuição de cada evento, preservando o primeiro toque.
      await client.query(
        `INSERT INTO jb_agent_acquisition_events
          (contact_id,event_key,event_type,source,campaign_key,ad_key,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(event_key) DO NOTHING`,
        [contactId,input.eventKey,input.eventType,input.source,
          input.campaignKey ?? null,input.adKey ?? null,
          JSON.stringify({marketingOptInClaimed: input.marketingOptIn === true})],
      );
      await client.query("COMMIT");
      return { contactId, created };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally { client.release(); }
}

export async function ingestVerifiedWhatsApp(input: {
  senderId: string; displayName: string | null;
  providerMessageId: string; text: string;
  campaignKey: string | null; adKey: string | null; isAdReferral: boolean;
  providerSentAt: Date;
}) {
  // Não inferir autorização de publicidade; é apenas resposta à conversa
  // iniciada pelo cliente, que o webhook oficial autenticou.
  const identity = await resolveAcquisitionIdentity({
    channel: "whatsapp", externalId:input.senderId,
    displayName: input.displayName,source:input.isAdReferral ? "meta_ads" : "whatsapp_organic",
    campaignKey:input.campaignKey,adKey:input.adKey,
    eventType:"conversation_started",eventKey:"wa:"+input.providerMessageId,
  });
  const message = await ingestSalesInbound({
    contactId:identity.contactId,channel:"whatsapp",
    providerMessageId:input.providerMessageId,text:input.text,
    customerInitiated:true,receivedAt:input.providerSentAt,
  });
  return { ...identity, ...message };
}

export async function getAcquisitionProfile(contactId: string): Promise<{
  display_name: string | null; email: string | null; source: string; campaign_key: string | null;
} | null> {
  const { rows } = await getPool().query<{
    display_name: string | null; email: string | null; source: string; campaign_key: string | null;
  }>("SELECT display_name,email,source,campaign_key FROM jb_agent_acquisition_contacts WHERE contact_id=$1",
  [contactId]);
  return rows[0] ?? null;
}
