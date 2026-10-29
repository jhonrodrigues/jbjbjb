import type { NextRequest } from "next/server";
import { constantTimeEqual, jsonError, jsonOk } from "@/lib/http";
import { ingestVerifiedWhatsApp } from "@/lib/acquisition";
import { isValidMetaSignature, parseMetaWhatsAppInbound } from "@/lib/meta-whatsapp";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.META_WHATSAPP_VERIFY_TOKEN?.trim();
  const params = request.nextUrl.searchParams;
  const challenge = params.get("hub.challenge");
  const received = params.get("hub.verify_token");
  if (!expected || !received || !challenge || challenge.length > 1024 ||
    params.get("hub.mode") !== "subscribe" || !constantTimeEqual(received,expected)) {
    return new Response("Forbidden",{status:403});
  }
  return new Response(challenge,{status:200,headers:{"Content-Type":"text/plain","Cache-Control":"no-store"}});
}

export async function POST(request: NextRequest) {
  const secret = process.env.META_WHATSAPP_APP_SECRET?.trim();
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!secret || !phoneId) return jsonError("WhatsApp oficial não configurado",503,"META_NOT_CONFIGURED");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 262144) return jsonError("Payload muito grande",413,"PAYLOAD_TOO_LARGE");
  let raw: string;
  try { raw = await request.text(); }
  catch { return jsonError("Body inválido",400,"INVALID_BODY"); }
  if (Buffer.byteLength(raw,"utf8") > 262144) return jsonError("Payload muito grande",413,"PAYLOAD_TOO_LARGE");
  if (!isValidMetaSignature(raw,request.headers.get("x-hub-signature-256"),secret)) {
    return jsonError("Assinatura inválida",401,"INVALID_SIGNATURE");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return jsonError("JSON inválido",400,"INVALID_JSON"); }
  const inbound = parseMetaWhatsAppInbound(parsed,phoneId);
  let accepted = 0;
  let duplicate = 0;
  try {
    for (const item of inbound) {
      const result = await ingestVerifiedWhatsApp(item);
      if (result.duplicate) duplicate++;
      else accepted++;
    }
  } catch (error) {
    logError("Falha ao persistir mensagem oficial do WhatsApp",error);
    return jsonError("Falha temporária. O provedor poderá reenviar.",503,"PERSIST_FAILED");
  }
  return jsonOk({ ok:true, accepted, duplicate });
}
