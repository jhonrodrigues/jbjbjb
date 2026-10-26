import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileText, Search, Sparkles } from "lucide-react";
import { getLpsPage, type LpFilters } from "@/lib/legacy";
import { getCampaignOptions } from "@/lib/campaigns";
import { hasDatabaseUrl } from "@/db/client";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { LP_STATUS_LABELS, LP_STATUS_TONE, labelFor } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Landing pages" };
export const dynamic = "force-dynamic";

const SELECT =
  "h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function LandingPagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filters: LpFilters = {
    status: params.status || "",
    leadId: params.leadId || "",
    campaignId: params.campaignId || "",
    search: params.search || "",
  };

  if (!hasDatabaseUrl()) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Demonstrações" title="Landing pages" description="Demonstrações geradas a partir dos leads." />
        <EmptyState title="Banco de dados não configurado" description="Configure DATABASE_URL e execute as migrações." />
      </div>
    );
  }

  let data: Awaited<ReturnType<typeof getLpsPage>>;
  let campaigns: Awaited<ReturnType<typeof getCampaignOptions>>;
  let error: string | null = null;
  try {
    [data, campaigns] = await Promise.all([getLpsPage(filters, page, 24), getCampaignOptions()]);
  } catch (err) {
    data = { rows: [], total: 0, page, pageSize: 24, pageCount: 0 };
    campaigns = [];
    error = err instanceof Error ? err.message : "Erro ao consultar as landing pages.";
  }

  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: nextPage > 1 ? String(nextPage) : undefined })) {
      if (value) query.set(key, value);
    }
    return `/landing-pages${query.size ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Demonstrações"
        title="Landing pages"
        description="Revise, aprove e publique as demonstrações geradas para cada empresa."
        actions={
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <FileText className="size-3.5" /> {data.total.toLocaleString("pt-BR")} LPs
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">{error}</p>
      ) : null}

      <form action="/landing-pages" className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
          <Input name="search" defaultValue={filters.search} placeholder="Buscar por empresa..." className="h-8 pl-8 text-[11px]" />
        </div>
        <select name="status" defaultValue={filters.status} className={SELECT} aria-label="Status">
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="approved">Aprovada</option>
          <option value="published">Publicada</option>
          <option value="archived">Arquivada</option>
        </select>
        <select name="campaignId" defaultValue={filters.campaignId} className={SELECT} aria-label="Campanha">
          <option value="">Todas as campanhas</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
      </form>

      {data.rows.length === 0 ? (
        <EmptyState
          title="Nenhuma landing page encontrada"
          description="As demonstrações são geradas pelo agente de LP a partir de leads qualificados."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/leads">
                <Sparkles /> Ver leads
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
            {data.rows.map((lp) => {
              const status = (lp.version?.status ?? lp.status ?? "draft") as keyof typeof LP_STATUS_TONE;
              return (
                <Link
                  key={lp.id}
                  href={`/landing-pages/${lp.id}`}
                  className="group flex min-h-[180px] flex-col justify-between bg-[var(--bg)] p-5 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={LP_STATUS_TONE[status] ?? "outline"}>{labelFor(LP_STATUS_LABELS, status, "Rascunho")}</Badge>
                      <ExternalLink className="size-3.5 text-[var(--muted-2)]" />
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-semibold tracking-tight">{lp.empresa ?? `Landing page #${lp.id}`}</h3>
                    <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{[lp.nicho, lp.cidade].filter(Boolean).join(" · ") || "Sem segmento"}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--line)] pt-3 text-[9px] text-[var(--muted-2)]">
                    <span>{lp.version ? `Versão ${lp.version.version} · ${lp.version.template}` : "Sem versão no painel"}</span>
                    <span>{formatDateTime(lp.criadoEm)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} total={data.total} makeHref={makeHref} />
        </div>
      )}
    </div>
  );
}
