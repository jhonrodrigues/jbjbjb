import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAppUrl, getInternalApiSecret, getN8nWebhookSecret } from "./env";
import { checkRateLimit } from "./rate-limit";

export function jsonError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
): Response {
  return Response.json({ error: message, code }, { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const appUrl = new URL(getAppUrl());
    const host = request.headers.get("host");
    return originUrl.host === appUrl.host || originUrl.host === host;
  } catch {
    return false;
  }
}

export function requireInternalRequest(request: NextRequest): Response | null {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`internal:${ip}`, 240, 60_000);
  if (!limit.allowed) {
    return jsonError("Limite de requisições excedido", 429, "RATE_LIMITED");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  let configured = "";
  try {
    configured = getInternalApiSecret();
  } catch {
    return jsonError("INTERNAL_API_SECRET não configurado", 503, "NOT_CONFIGURED");
  }
  if (bearer && constantTimeEqual(bearer, configured)) return null;

  const webhookSecret = getN8nWebhookSecret();
  const signature = request.headers.get("x-jb-signature");
  if (webhookSecret && signature && constantTimeEqual(signature, webhookSecret)) return null;

  return jsonError("Não autorizado", 401, "UNAUTHORIZED");
}
