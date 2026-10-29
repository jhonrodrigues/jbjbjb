import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireInternalRequest } from "@/lib/http";
import { resolveAcquisitionIdentity, safeMarketingKey } from "@/lib/acquisition";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  submissionId:z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9_.:-]+$/),
  name:z.string().trim().min(2).max(160),
  email:z.email().max(254).optional(),
  source:z.enum(["form","b2b_email","organic","other"]),
  campaignKey:z.string().max(160).optional(),
  utmSource:z.string().max(160).optional(),
  utmMedium:z.string().max(160).optional(),
  utmCampaign:z.string().max(160).optional(),
  utmContent:z.string().max(160).optional(),
  marketingOptIn:z.boolean().default(false),
}).strict();

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalRequest(request);
  if (unauthorized) return unauthorized;
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return jsonError("JSON inválido",400,"INVALID_JSON"); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError("Dados de captação inválidos",422,"INVALID_LEAD");
  const data = parsed.data;
  try {
    const lead = await resolveAcquisitionIdentity({
      channel:"form",externalId:data.submissionId,
      displayName:data.name,email:data.email?.trim().toLowerCase() ?? null,
      source:data.source,campaignKey:safeMarketingKey(data.campaignKey),
      utmSource:safeMarketingKey(data.utmSource),utmMedium:safeMarketingKey(data.utmMedium),
      utmCampaign:safeMarketingKey(data.utmCampaign),utmContent:safeMarketingKey(data.utmContent),
      eventKey:"form:"+data.submissionId,eventType:"form_submitted",
    });
    // O opt-in de marketing é informado pela origem, mas NÃO habilita mensagens;
    // a evidência de consentimento precisa ser verificada e persistida no canal correspondente.
    return jsonOk({ ok:true,contactId:lead.contactId,created:lead.created,autoContact:false },
      { status:lead.created ? 201 : 200 });
  } catch (error) {
    logError("Falha ao registrar novo lead de formulário",error);
    return jsonError("Falha ao registrar lead",500,"LEAD_CAPTURE_FAILED");
  }
}
