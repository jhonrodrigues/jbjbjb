import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CircleDollarSign, KanbanSquare, MessageSquare, Search, TrendingUp } from "lucide-react";
import { getCrmContactsPage, getCrmMetrics } from "@/lib/contacts";
import { getCampaignOptions } from "@/lib/campaigns";
import { hasDatabaseUrl } from "@/db/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { CRM_STAGE_COLUMNS, STAGE_LABELS } from "@/lib/labels";
import type { CrmStage } from "@/db/schema";
import { formatCurrency, formatNumber, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Comercial" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ campaignId?: string; search?: string; created?: string; page?: string }>;

export default async function CrmPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (!hasDatabaseUrl()) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Receita" title="Comercial" description="Pipeline de contatos e negociações." />
        <EmptyState title="Banco de dados não configurado" description="Configure DATABASE_URL e execute as migrações." />
      </div>
    );
  }

  let contactPage: Awaited<ReturnType<typeof getCrmContactsPage>>;
  let metrics: Awaited<ReturnType<typeof getCrmMetrics>>;
  let campaigns: Awaited<ReturnType<typeof getCampaignOptions>>;
  let error: string | null = null;
  try {
    [contactPage, metrics, campaigns] = await Promise.all([
      getCrmContactsPage({ campaignId: params.campaignId || undefined, search: params.search }, Number(params.page) || 1),
      getCrmMetrics(),
      getCampaignOptions(),
    ]);
  } catch (err) {
    contactPage = { rows: [], total: 0, page: 1, pageSize: 25, pageCount: 1 };
    metrics = { total: 0, open: 0, closed: 0, lost: 0, revenue: 0, pipeline: 0 };
    campaigns = [];
    error = err instanceof Error ? err.message : "Erro ao consultar o CRM.";
  }

  const contacts = contactPage.rows;
  const filtered = contacts;
  const makeHref = (page: number) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.campaignId) query.set("campaignId", params.campaignId);
    query.set("page", String(page));
    return `/comercial?${query}`;
  };

  const byStage = new Map<CrmStage, typeof filtered>();
  for (const stage of CRM_STAGE_COLUMNS) byStage.set(stage, []);
  for (const contact of filtered) {
    const list = byStage.get(contact.stage) ?? [];
    list.push(contact);
    byStage.set(contact.stage, list);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Receita"
        title="Comercial"
        description="Pipeline operacional: cada lead qualificado vira um contato acompanhado até a venda."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/leads">
              <Building2 /> Buscar leads
            </Link>
          </Button>
        }
      />

      {params.created === "1" ? (
        <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">
          Lead adicionado ao CRM.
        </div>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CrmMetric icon={KanbanSquare} label="Contatos no CRM" value={formatNumber(metrics.total)} />
        <CrmMetric icon={MessageSquare} label="Em andamento" value={formatNumber(metrics.open)} />
        <CrmMetric icon={TrendingUp} label="Vendas fechadas" value={formatNumber(metrics.closed)} />
        <CrmMetric icon={CircleDollarSign} label="Receita fechada" value={formatCurrency(metrics.revenue)} hint={`Pipeline ${formatCurrency(metrics.pipeline)}`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form action="/comercial" className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
            <Input name="search" defaultValue={params.search ?? ""} placeholder="Filtrar contatos..." className="h-8 pl-8 text-[11px]" />
          </div>
          <select
            name="campaignId"
            defaultValue={params.campaignId ?? ""}
            className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]"
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">Filtrar</Button>
          {params.search || params.campaignId ? (
            <Button asChild variant="ghost" size="sm"><Link href="/comercial">Limpar</Link></Button>
          ) : null}
        </form>
        <p className="text-[9px] text-[var(--muted-2)]">{filtered.length} nesta página · {contactPage.total} no filtro · indicadores globais</p>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title="Nenhum contato no CRM"
          description="Abra um lead qualificado e use “Adicionar ao CRM” para iniciar o acompanhamento."
          action={
            <Button asChild variant="accent" size="sm">
              <Link href="/leads">Explorar leads</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {CRM_STAGE_COLUMNS.map((stage) => {
              const items = byStage.get(stage) ?? [];
              return (
                <div key={stage} className="w-[272px] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/40">
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${stageDot(stage)}`} />
                      <p className="text-[10px] font-medium text-[var(--ink)]">{STAGE_LABELS[stage]}</p>
                    </div>
                    <span className="font-mono text-[9px] text-[var(--muted-2)]">{items.length}</span>
                  </div>
                  <div className="space-y-2 p-2">
                    {items.length === 0 ? (
                      <p className="px-2 py-6 text-center text-[9px] text-[var(--muted-2)]">Nenhum contato</p>
                    ) : (
                      items.map((contact) => (
                        <Link
                          key={contact.id}
                          href={`/comercial/${contact.id}`}
                          className="block rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--line-strong)]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-[11px] font-medium text-[var(--ink)]">
                              {contact.lead?.empresa ?? `Lead ${contact.leadId}`}
                            </p>
                            {contact.events > 0 ? (
                              <span className="inline-flex shrink-0 items-center gap-0.5 text-[8px] text-[var(--muted-2)]">
                                <MessageSquare className="size-2.5" /> {contact.events}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-[9px] text-[var(--muted)]">
                            {[contact.lead?.nicho, contact.lead?.cidade].filter(Boolean).join(" · ") || "Sem segmento"}
                          </p>
                          {contact.nextAction ? (
                            <p className="mt-2 line-clamp-1 rounded bg-[var(--accent-subtle)] px-1.5 py-1 text-[9px] text-[var(--accent-strong)]">
                              {contact.nextAction}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[8px] text-[var(--muted-2)]">
                            <span>{contact.closedValue ? formatCurrency(Number(contact.closedValue)) : contact.proposedValue ? formatCurrency(Number(contact.proposedValue)) : "Sem valor"}</span>
                            <span>{relativeTime(contact.updatedAt)}</span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Pagination page={contactPage.page} pageCount={contactPage.pageCount} total={contactPage.total} makeHref={makeHref} />
    </div>
  );
}

function stageDot(stage: CrmStage): string {
  if (stage === "fechado") return "bg-[var(--success)]";
  if (stage === "perdido") return "bg-[var(--danger)]";
  if (stage === "respondeu" || stage === "em_negociacao" || stage === "proposta_enviada") return "bg-[var(--accent)]";
  if (stage === "contatado") return "bg-[var(--warning)]";
  return "bg-[var(--muted-2)]";
}

function CrmMetric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof KanbanSquare;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{label}</p>
        <Icon className="size-3.5 text-[var(--muted-2)]" />
      </div>
      <p className="metric-value mt-2 text-xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[9px] text-[var(--muted-2)]">{hint}</p> : null}
    </div>
  );
}
