import { checkDatabase } from "@/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const database = await checkDatabase();
  const configured = {
    database: database.ok,
    n8n: Boolean(process.env.N8N_BASE_URL?.trim()),
  };
  const ok = configured.database;

  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      service: "jb-agent-autopilot",
      timestamp: new Date().toISOString(),
      checks: {
        database: { ok: database.ok, latencyMs: database.latencyMs ?? null },
        n8n: { configured: configured.n8n },
      },
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
