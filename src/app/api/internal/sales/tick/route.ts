import type { NextRequest } from "next/server";
import { requireInternalRequest,jsonOk } from "@/lib/http";
import { runSalesTick } from "@/lib/sales-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Chame pelo agendador n8n. Uma mensagem inbound é processada por tick.
export async function POST(request: NextRequest) {
  const unauthorized = requireInternalRequest(request);
  if (unauthorized) return unauthorized;
  return jsonOk(await runSalesTick());
}
