import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  FileText,
  Globe2,
  Plus,
  ScanSearch,
  Send,
  Sparkles,
} from "lucide-react";
import { getDashboardData } from "@/lib/dashboard";
import { resolvePeriod } from "@/lib/period";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PeriodSwitcher } from "@/components/dashboard/period-switcher";
import { LeadsChart } from "@/components/dashboard/leads-chart";
import {
  ActivityPanel,
  CampaignConversionPanel,
  DataWarnings,
  FunnelPanel,
  NichePanel,
  SalesPanel,
} from "@/components/dashboard/panels";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Visão geral" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ period?: string; from?: string; to?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = resolvePeriod(params.period, params.from, params.to);
  const data = await getDashboardData(range);
  const metric = (key: string) => data.metrics.find((item) => item.key === key)?.value ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operação"
        title="Visão geral"
        description="Acompanhe aquisição, demonstrações e resultado comercial a partir dos dados reais da operação."
        actions={
          <>
            <PeriodSwitcher current={definePeriodKey(params.period)} label={range.label} />
            <Button asChild variant="accent" size="sm">
              <Link href="/campanhas/nova">
                <Plus />
                Nova campanha
              </Link>
            </Button>
          </>
        }
      />

      {!data.configured ? (
        <div className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-subtle)] px-4 py-3.5">
          <p className="text-[11px] font-medium text-[var(--warning)]">Banco de dados não configurado</p>
          <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-[var(--muted)]">
            Defina <code className="rounded bg-[var(--surface)] px-1 py-0.5 font-mono">DATABASE_URL</code> no arquivo{" "}
            <code className="rounded bg-[var(--surface)] px-1 py-0.5 font-mono">.env</code> e execute as migrações.
            Os indicadores abaixo permanecem zerados até a conexão ser validada.
          </p>
        </div>
      ) : null}

      <DataWarnings warnings={data.warnings} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Empresas encontradas" value={metric("leadsFound")} icon={Building2} />
        <MetricCard label="Empresas analisadas" value={metric("leadsAnalyzed")} icon={ScanSearch} />
        <MetricCard label="Leads qualificados" value={metric("leadsQualified")} icon={BadgeCheck} accent />
        <MetricCard label="LPs geradas" value={metric("lpsGenerated")} icon={Sparkles} />
        <MetricCard label="LPs publicadas" value={metric("lpsPublished")} icon={Globe2} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between border-b border-[var(--line)] p-5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Volume</p>
              <h3 className="mt-1 text-sm font-semibold tracking-tight">Empresas e demonstrações por dia</h3>
            </div>
            <div className="flex items-center gap-3 text-[9px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" /> Empresas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[var(--muted-2)]" /> LPs
              </span>
            </div>
          </div>
          <div className="p-4 pt-5">
            <LeadsChart leads={data.leadsByDay} lps={data.lpsByDay} />
          </div>
          <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-2.5 text-[9px] text-[var(--muted-2)]">
            <span>{range.label}</span>
            <span>Atualizado em {formatDate(new Date())}</span>
          </div>
        </div>

        <SalesPanel
          metrics={{
            contacts: metric("contacts"),
            responses: metric("responses"),
            proposals: metric("proposals"),
            sales: metric("sales"),
            revenue: metric("revenue"),
          }}
          activeCampaigns={metric("activeCampaigns")}
          runningJobs={metric("runningJobs")}
          failedJobs={metric("failedJobs")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <FunnelPanel funnel={data.funnel} />
        <NichePanel niches={data.leadsByNiche} cities={data.leadsByCity} priorities={data.priorities} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <CampaignConversionPanel rows={data.conversionByCampaign} />
        <ActivityPanel activities={data.activities} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href="/leads"
          title="Explorar leads"
          description="Filtre por nicho, cidade e prioridade."
          icon={Building2}
        />
        <QuickLink
          href="/landing-pages"
          title="Revisar demonstrações"
          description="Valide e publique landing pages."
          icon={FileText}
        />
        <QuickLink
          href="/agentes"
          title="Monitorar agentes"
          description="Fila, execuções e falhas recentes."
          icon={Send}
        />
      </div>
    </div>
  );
}

function definePeriodKey(value: string | undefined): string {
  return value === "today" || value === "7d" || value === "30d" || value === "90d" || value === "custom" ? value : "30d";
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Building2;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--line-strong)]"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted)]">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-[var(--ink)]">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--muted)]">{description}</span>
      </span>
    </Link>
  );
}
