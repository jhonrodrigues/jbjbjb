import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireInternalRequest, jsonError, jsonOk } from "@/lib/http";
import { ingestSalesInbound } from "@/lib/sales-store";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  contactId: z.string().uuid(),
  channel: z.enum(["whatsapp","instagram","email"]),
  providerMessageId: z.string().trim().min(4).max(160),
  text: z.string().trim().min(1).max(4000),
  customerInitiated: z.literal(true),
}).strict();

export async function POST(request: NextRequest) {
  const unauthorized = requireInternalRequest(request);
  if (unauthorized) return unauthorized;
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return jsonError("JSON inválido",400,"INVALID_JSON"); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError("Mensagem inválida",422,"INVALID_MESSAGE");
  try {
    const result = await ingestSalesInbound(parsed.data);
    return jsonOk({ ok:true,...result },{status:result.duplicate ? 200 : 202});
  } catch (error) {
    if (error instanceof Error && error.message === "SALES_CONTACT_NOT_FOUND")
      return jsonError("Contato desconhecido; faça vinculação CRM primeiro",404,"CONTACT_NOT_FOUND");
    logError("Falha ao registrar mensagem recebida",error);
    return jsonError("Falha ao receber mensagem",500,"INBOUND_FAILED");
  }
}
