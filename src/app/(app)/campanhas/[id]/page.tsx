import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CircleDollarSign,
  MapPin,
  Pencil,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { getCampaignById, getCampaignMetrics } from "@/lib/campaigns";
import { getLeadsPage, getLpsPage } from "@/lib/legacy";
import { runCampaignAction, setCampaignStatusAction } from "@/actions/campaigns";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignStat } from "@/components/campaigns/campaign-stat";
import { LeadTable } from "@/components/leads/lead-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  FREQUENCY_LABELS,
  LP_STATUS_LABELS,
  LP_STATUS_TONE,
  labelFor,
} from "@/lib/labels";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Campanha" };
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { saved } = await searchParams;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [metrics, leads, lps] = await Promise.all([
    getCampaignMetrics(id),
    getLeadsPage({ campaignId: id }, 1, 8),
    getLpsPage({ campaignId: id }, 1, 6),
  ]);

  const isActive = campaign.status === "active";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Campanha"
        title={campaign.name}
        description={campaign.description || [campaign.niche, campaign.city, campaign.state].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/campanhas">
                <ArrowLeft /> Campanhas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/campanhas/${id}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
            <form action={runCampaignAction.bind(null, id)}>
              <Button type="submit" variant="accent" size="sm" disabled={!isActive}>
                <Play /> Executar agora
              </Button>
            </form>
          </>
        }
      />

      {saved === "1" ? (
        <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">
          Campanha atualizada.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={CAMPAIGN_STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge>
        <span className="text-[10px] text-[var(--muted)]">
          {labelFor(FREQUENCY_LABELS, campaign.frequency)} · {campaign.maxPerRun} por execução · limite {formatNumber(campaign.maxLeads)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {campaign.status !== "active" ? (
            <form action={setCampaignStatusAction.bind(null, id, "active")}>
              <Button type="submit" variant="outline" size="sm">Ativar</Button>
            </form>
          ) : (
            <form action={setCampaignStatusAction.bind(null, id, "paused")}>
              <Button type="submit" variant="outline" size="sm">Pausar</Button>
            </form>
          )}
          {campaign.status !== "archived" ? (
            <form action={setCampaignStatusAction.bind(null, id, "archived")}>
              <Button type="submit" variant="ghost" size="sm">Arquivar</Button>
            </form>
          ) : (
            <form action={setCampaignStatusAction.bind(null, id, "draft")}>
              <Button type="submit" variant="ghost" size="sm">Reabrir</Button>
            </form>
          )}
        </div>
      </div>

      {!isActive ? (
        <p className="rounded-lg border border-[var(--warning)]/20 bg-[var(--warning-subtle)] px-3 py-2 text-[10px] text-[var(--warning)]">
          Ative a campanha para liberar novas execuções dos agentes.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CampaignStat icon={Users} label="Leads vinculados" value={formatNumber(metrics.leads)} />
        <CampaignStat icon={Building2} label="Contatos no CRM" value={formatNumber(metrics.contacts)} />
        <CampaignStat icon={Sparkles} label="Vendas fechadas" value={formatNumber(metrics.closed)} />
        <CampaignStat icon={CircleDollarSign} label="Receita" value={formatCurrency(metrics.revenue)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Resultados</p>
                <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Empresas vinculadas</h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/leads?campaignId=${id}`}>Ver todos</Link>
              </Button>
            </div>
            <LeadTable leads={leads.rows} compact />
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Demonstrações</p>
                <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Landing pages da campanha</h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/landing-pages?campaignId=${id}`}>Abrir</Link>
              </Button>
            </div>
            {lps.rows.length === 0 ? (
              <div className="p-4">
                <EmptyState compact title="Nenhuma LP gerada" description="As demonstrações aparecerão após a geração pelo agente." />
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {lps.rows.map((lp) => (
                  <Link key={lp.id} href={`/landing-pages/${lp.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium">{lp.empresa ?? `LP #${lp.id}`}</p>
                      <p className="mt-0.5 text-[9px] text-[var(--muted-2)]">{formatDateTime(lp.criadoEm)}</p>
                    </div>
                    <Badge variant={LP_STATUS_TONE[(lp.status as keyof typeof LP_STATUS_TONE) ?? "draft"] ?? "outline"}>
                      {labelFor(LP_STATUS_LABELS, lp.status, "Rascunho")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Configuração</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Parâmetros</h2>
            <dl className="mt-4 space-y-3 text-[11px]">
              <Detail label="Nicho" value={campaign.niche} />
              <Detail label="Subnicho" value={campaign.subNiche} />
              <Detail
                label="Local"
                value={[campaign.city, campaign.state, campaign.country].filter(Boolean).join(" · ")}
                icon={MapPin}
              />
              <Detail label="Máximo por execução" value={String(campaign.maxPerRun)} />
              <Detail label="Última execução" value={campaign.lastRunAt ? formatDateTime(campaign.lastRunAt) : "Nunca"} />
              <Detail label="Criada em" value={formatDateTime(campaign.createdAt)} />
            </dl>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Automação</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Comportamento dos agentes</h2>
            <div className="mt-4 space-y-2">
              <Automation label="Análise automática" enabled={campaign.autoAnalyze} />
              <Automation label="Geração automática de LP" enabled={campaign.autoLp} />
              <Automation label="Aprovação humana obrigatória" enabled={campaign.requireHuman} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, icon: Icon }: { label: string; value: string | null; icon?: typeof MapPin }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-1 text-[var(--muted)]">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </dt>
      <dd className="max-w-[60%] text-right text-[var(--ink)]">{value || "—"}</dd>
    </div>
  );
}

function Automation({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)]/60 px-3 py-2 text-[10px]">
      <span className="text-[var(--muted)]">{label}</span>
      <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Ativo" : "Inativo"}</Badge>
    </div>
  );
}
