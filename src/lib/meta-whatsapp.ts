import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaInboundText = {
  senderId: string;
  providerMessageId: string;
  text: string;
  displayName: string | null;
  campaignKey: string | null;
  adKey: string | null;
};

export function isValidMetaSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256",appSecret).update(rawBody,"utf8").digest();
  const supplied = Buffer.from(signature.slice(7),"hex");
  return supplied.length === expected.length && timingSafeEqual(expected,supplied);
}

function object(value: unknown): Record<string,unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : null;
}
function string(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

export function parseMetaWhatsAppInbound(payload: unknown, phoneNumberId: string): MetaInboundText[] {
  const root = object(payload);
  if (root?.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];
  const collected: MetaInboundText[] = [];
  for (const entry of root.entry.slice(0,10)) {
    const e = object(entry);
    if (!Array.isArray(e?.changes)) continue;
    for (const change of e.changes.slice(0,10)) {
      const ch = object(change);
      if (ch?.field !== "messages") continue;
      const v = object(ch.value);
      const metadata = object(v?.metadata);
      if (metadata?.phone_number_id !== phoneNumberId || !Array.isArray(v?.messages)) continue;
      const contacts = Array.isArray(v?.contacts) ? v.contacts : [];
      for (const item of v.messages.slice(0,30)) {
        const msg = object(item);
        if (!msg || msg.type !== "text") continue;
        const id = string(msg.id,160);
        const from = string(msg.from,128);
        const body = string(object(msg.text)?.body,4000);
        if (!id || !from || !body || !/^[a-zA-Z0-9_.:-]{4,160}$/.test(id) ||
            !/^[a-zA-Z0-9_.:-]{5,128}$/.test(from)) continue;
        const profile = contacts.map(object).find(c => c?.wa_id === from);
        const name = string(object(profile?.profile)?.name,160);
        const referral = object(msg.referral);
        const ad = string(referral?.source_id,160);
        const isAd = referral?.source_type === "ad" || typeof referral?.ctwa_clid === "string";
        collected.push({
          senderId:from,providerMessageId:id,text:body.trim(),
          displayName:name ? name.trim() : null,
          campaignKey:null,adKey:isAd && ad && /^[\w.:-]+$/.test(ad) ? ad : null,
        });
      }
    }
  }
  return collected;
}
