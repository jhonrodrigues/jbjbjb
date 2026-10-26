import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { getCampaignsPage } from "@/lib/campaigns";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campanhas" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Ativas" },
  { key: "draft", label: "Rascunhos" },
  { key: "paused", label: "Pausadas" },
  { key: "archived", label: "Arquivadas" },
];

type SearchParams = Promise<{ status?: string; search?: string; page?: string }>;

export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = params.status || "all";
  const search = params.search?.trim() || "";
  const data = await getCampaignsPage({ status, search }, page);

  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (search) query.set("search", search);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/campanhas${query.size ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Aquisição"
        title="Campanhas"
        description="Defina nicho, região e limites de prospecção. Os agentes executam o trabalho a partir daqui."
        actions={
          <Button asChild variant="accent" size="sm">
            <Link href="/campanhas/nova">
              <Plus />
              Nova campanha
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/campanhas${tab.key === "all" ? "" : `?status=${tab.key}`}`}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[10px] font-medium transition-colors",
                status === tab.key ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <form className="relative w-full sm:max-w-xs" action="/campanhas">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
          <Input name="search" defaultValue={search} placeholder="Buscar campanha..." className="h-8 pl-8 text-[11px]" />
        </form>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          title={search || status !== "all" ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada"}
          description={
            search || status !== "all"
              ? "Ajuste os filtros para ver outros resultados."
              : "Crie a primeira campanha para o Prospector encontrar empresas."
          }
          action={
            !search && status === "all" ? (
              <Button asChild variant="accent" size="sm">
                <Link href="/campanhas/nova">
                  <Plus /> Criar campanha
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
            {data.rows.map((campaign) => (
              <div key={campaign.id} className="bg-[var(--bg)] p-px">
                <CampaignCard campaign={campaign} />
              </div>
            ))}
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} total={data.total} makeHref={makeHref} />
        </div>
      )}
    </div>
  );
}
