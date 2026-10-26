import type { NextRequest } from "next/server";
import { getLegacyLpById, getLpVersionsForLp } from "@/lib/legacy";
import { previewResponseHeaders, sanitizeLpHtml, readPreviewToken } from "@/lib/lp-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const payload = readPreviewToken(token, id);
  if (!payload) {
    return new Response("Preview expirado ou inválido.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const lp = await getLegacyLpById(id);
  if (!lp) return new Response("Landing page não encontrada.", { status: 404 });

  const versions = await getLpVersionsForLp(id);
  const version = payload.version ? versions.find((version) => version.id === payload.version) : null;
  const html = payload.version ? version?.htmlSnapshot : lp.html;

  if (!html) {
    return new Response("Esta landing page ainda não possui HTML gerado.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response(sanitizeLpHtml(html), { status: 200, headers: previewResponseHeaders() });
}
