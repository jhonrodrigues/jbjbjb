import type { Metadata } from "next";
import Link from "next/link";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { getLeadFilterOptions, getLeadsPage, type LeadFilters } from "@/lib/legacy";
import { hasDatabaseUrl } from "@/db/client";
import { PageHeader } from "@/components/layout/page-header";
import { LeadTable } from "@/components/leads/lead-table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PRIORITY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | undefined>>;

const SELECT =
  "h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filters: LeadFilters = {
    campaignId: params.campaignId || "",
    niche: params.niche || "",
    city: params.city || "",
    status: params.status || "",
    priority: params.priority || "",
    website: (params.website as LeadFilters["website"]) || "",
    lp: (params.lp as LeadFilters["lp"]) || "",
    discarded: (params.discarded as LeadFilters["discarded"]) || "exclude",
    search: params.search || "",
    dateFrom: params.dateFrom || "",
    dateTo: params.dateTo || "",
  };

  if (!hasDatabaseUrl()) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Aquisição"
          title="Leads"
          description="Empresas encontradas e qualificadas pelos agentes."
        />
        <EmptyState
          title="Banco de dados não configurado"
          description="Configure DATABASE_URL e execute as migrações para visualizar os leads reais."
        />
      </div>
    );
  }

  let bundle: {
    rows: Awaited<ReturnType<typeof getLeadsPage>>["rows"];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
    options: Awaited<ReturnType<typeof getLeadFilterOptions>>;
    error: string | null;
  };

  try {
    const [leadsData, options] = await Promise.all([
      getLeadsPage(filters, page, 25),
      getLeadFilterOptions(),
    ]);
    bundle = { ...leadsData, options, error: null };
  } catch (error) {
    bundle = {
      rows: [],
      total: 0,
      page,
      pageSize: 25,
      pageCount: 0,
      options: { niches: [], cities: [], statuses: [], campaigns: [] },
      error: error instanceof Error ? error.message : "Erro ao consultar o banco de dados.",
    };
  }

  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: nextPage > 1 ? String(nextPage) : undefined })) {
      if (value) query.set(key, value);
    }
    return `/leads${query.size ? `?${query}` : ""}`;
  };

  const activeFilters = Object.entries(params).filter(
    ([key, value]) => value && !["page", "discarded"].includes(key),
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Aquisição"
        title="Leads"
        description="Empresas reais encontradas pelos agentes, com prioridade, análise e demonstrações."
        actions={
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
            <SlidersHorizontal className="size-3.5" />
            {bundle.total.toLocaleString("pt-BR")} empresas
          </div>
        }
      />

      {bundle.error ? (
        <p className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">
          {bundle.error}
        </p>
      ) : null}

      <form action="/leads" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
            <Input name="search" defaultValue={filters.search} placeholder="Buscar por empresa, cidade, telefone..." className="h-8 pl-8 text-[11px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select name="campaignId" defaultValue={filters.campaignId} className={SELECT} aria-label="Campanha">
              <option value="">Todas as campanhas</option>
              {bundle.options.campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
            <select name="niche" defaultValue={filters.niche} className={SELECT} aria-label="Nicho">
              <option value="">Todos os nichos</option>
              {bundle.options.niches.map((niche) => (
                <option key={niche} value={niche}>{niche}</option>
              ))}
            </select>
            <select name="city" defaultValue={filters.city} className={SELECT} aria-label="Cidade">
              <option value="">Todas as cidades</option>
              {bundle.options.cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select name="priority" defaultValue={filters.priority} className={SELECT} aria-label="Prioridade">
              <option value="">Prioridade</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select name="status" defaultValue={filters.status} className={SELECT} aria-label="Status">
              <option value="">Status</option>
              {bundle.options.statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="discarded" defaultValue={filters.discarded} className={SELECT} aria-label="Descartados">
              <option value="exclude">Ativos</option>
              <option value="only">Descartados</option>
              <option value="all">Todos</option>
            </select>
            <select name="lp" defaultValue={filters.lp} className={SELECT} aria-label="Landing page">
              <option value="">LP: todas</option>
              <option value="with">Com LP</option>
              <option value="without">Sem LP</option>
            </select>
            <select name="website" defaultValue={filters.website} className={SELECT} aria-label="Site">
              <option value="">Site: todos</option>
              <option value="with">Com site</option>
              <option value="without_info">Sem site</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              <Filter /> Filtrar
            </Button>
            {activeFilters > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/leads">Limpar</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-[10px] text-[var(--muted)]">
            <span className={cn("font-medium text-[var(--ink)]", bundle.rows.length === 0 && "text-[var(--muted)]")}>
              {bundle.total.toLocaleString("pt-BR")}
            </span>{" "}
            empresas no filtro atual
          </p>
          <p className="text-[9px] text-[var(--muted-2)]">
            {filters.discarded === "only" ? "Somente descartados" : filters.discarded === "all" ? "Incluindo descartados" : "Descartados ocultos"}
          </p>
        </div>
        <LeadTable leads={bundle.rows} />
        <Pagination page={bundle.page} pageCount={bundle.pageCount} total={bundle.total} makeHref={makeHref} />
      </div>
    </div>
  );
}
