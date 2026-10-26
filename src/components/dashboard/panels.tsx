import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleDot, ListFilter, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActivityItem } from "@/lib/legacy";
import type { CrmStage } from "@/db/schema";
import { cn, formatNumber, relativeTime, titleCase } from "@/lib/utils";

export function SalesPanel({
  metrics,
  activeCampaigns,
  runningJobs,
  failedJobs,
}: {
  metrics: { contacts: number; responses: number; proposals: number; sales: number; revenue: number };
  activeCampaigns: number;
  runningJobs: number;
  failedJobs: number;
}) {
  const items = [
    { label: "Contatos", value: formatNumber(metrics.contacts) },
    { label: "Respostas", value: formatNumber(metrics.responses) },
    { label: "Propostas", value: formatNumber(metrics.proposals) },
    { label: "Vendas", value: formatNumber(metrics.sales) },
    {
      label: "Receita",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: metrics.revenue > 99999 ? "compact" : "standard",
        maximumFractionDigits: 0,
      }).format(metrics.revenue),
    },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between border-b border-[var(--line)] p-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Comercial</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Resultado no período</h3>
        </div>
        <Link
          href="/comercial"
          className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Abrir CRM <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-px bg-[var(--line)]">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "bg-[var(--surface)] px-4 py-3",
              index === items.length - 1 && "col-span-2",
            )}
          >
            <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{item.label}</p>
            <p className="metric-value mt-1 text-lg font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-[var(--line)] p-4 text-[10px]">
        <OpsStat label="Campanhas" value={activeCampaigns} />
        <OpsStat label="Em execução" value={runningJobs} tone="accent" />
        <OpsStat label="Com erro" value={failedJobs} tone={failedJobs > 0 ? "danger" : "default"} />
      </div>
    </div>
  );
}

function OpsStat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "danger" | "default" }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-medium",
          tone === "accent" && "text-[var(--accent)]",
          tone === "danger" && "text-[var(--danger)]",
          (!tone || tone === "default") && "text-[var(--ink)]",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

export function FunnelPanel({ funnel }: { funnel: { stage: CrmStage; name: string; value: number }[] }) {
  const max = Math.max(...funnel.map((item) => item.value), 1);
  const total = funnel.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">CRM</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Funil comercial</h3>
        </div>
        <Badge variant="default">{formatNumber(total)} contatos</Badge>
      </div>
      {total === 0 ? (
        <EmptyState
          compact
          title="Nenhum contato no funil"
          description="Mova leads para o CRM para acompanhar as etapas comerciais."
          className="mt-4"
        />
      ) : (
        <div className="mt-5 space-y-2.5">
          {funnel.map((item, index) => {
            const pct = Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0);
            const opacity = 1 - index * 0.045;
            return (
              <div key={item.stage} className="grid grid-cols-[136px_1fr_38px] items-center gap-3">
                <span className="truncate text-[10px] text-[var(--muted)]">{item.name}</span>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                    style={{ width: `${pct}%`, opacity: Math.max(opacity, 0.4) }}
                  />
                </div>
                <span className="text-right font-mono text-[10px] text-[var(--ink)]">{formatNumber(item.value)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NichePanel({
  niches,
  cities,
  priorities,
}: {
  niches: { name: string; value: number }[];
  cities: { name: string; value: number }[];
  priorities: { name: string; value: number }[];
}) {
  const max = Math.max(...niches.map((item) => item.value), 1);
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Segmentação</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Nichos e regiões</h3>
        </div>
        <ListFilter className="size-3.5 text-[var(--muted-2)]" />
      </div>

      {niches.length === 0 ? (
        <EmptyState compact title="Sem dados de segmentação" className="mt-4" />
      ) : (
        <div className="mt-5 space-y-2.5">
          {niches.map((item) => (
            <div key={item.name} className="grid grid-cols-[1fr_100px_32px] items-center gap-2">
              <span className="truncate text-[10px] text-[var(--muted)]">{item.name}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="h-full rounded-full bg-[var(--ink)]/70" style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
              <span className="text-right font-mono text-[10px]">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">Principais cidades</p>
          {cities.length ? (
            <div className="space-y-1.5">
              {cities.slice(0, 4).map((city) => (
                <div key={city.name} className="flex items-center justify-between text-[10px]">
                  <span className="truncate text-[var(--muted)]">{city.name}</span>
                  <span className="font-mono">{formatNumber(city.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--muted-2)]">Sem dados.</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">Prioridades</p>
          {priorities.length ? (
            <div className="space-y-1.5">
              {priorities.map((priority) => (
                <div key={priority.name} className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--muted)]">{priorityLabel(priority.name)}</span>
                  <span className="font-mono">{formatNumber(priority.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--muted-2)]">Sem dados.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function priorityLabel(value: string): string {
  const map: Record<string, string> = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    nao_avaliada: "Não avaliada",
  };
  return map[value] ?? titleCase(value);
}

export function CampaignConversionPanel({
  rows,
}: {
  rows: { id: string; name: string; leads: number; closed: number; rate: number }[];
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between border-b border-[var(--line)] p-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Aquisição</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Conversão por campanha</h3>
        </div>
        <Link
          href="/campanhas"
          className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Ver campanhas <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState compact title="Nenhuma campanha com leads" description="Crie uma campanha e conecte os agentes para começar." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
                <th className="px-5 py-2.5 font-medium">Campanha</th>
                <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                <th className="px-3 py-2.5 text-right font-medium">Fechados</th>
                <th className="px-5 py-2.5 text-right font-medium">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="max-w-[260px] truncate px-5 py-3">
                    <Link href={`/campanhas/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[var(--muted)]">{formatNumber(row.leads)}</td>
                  <td className="px-3 py-3 text-right font-mono text-[var(--muted)]">{formatNumber(row.closed)}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge variant={row.rate >= 10 ? "success" : row.rate > 0 ? "accent" : "default"}>
                      {row.rate.toLocaleString("pt-BR")}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ActivityPanel({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between border-b border-[var(--line)] p-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Auditoria</p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Atividade recente</h3>
        </div>
        <Workflow className="size-3.5 text-[var(--muted-2)]" />
      </div>
      {activities.length === 0 ? (
        <div className="p-5">
          <EmptyState compact title="Nenhuma atividade registrada" description="Ações de agentes e usuários aparecerão aqui." />
        </div>
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {activities.slice(0, 10).map((activity) => (
            <div key={activity.id} className="flex gap-3 px-5 py-3">
              <span className="mt-1.5 inline-flex size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-[var(--ink)]">{activity.summary}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[var(--muted-2)]">
                  <span>{titleCase(activity.kind)}</span>
                  <CircleDot className="size-2" />
                  <span>{relativeTime(activity.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-subtle)] px-4 py-3">
      <div className="flex gap-2.5">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--warning)]" />
        <div>
          <p className="text-[11px] font-medium text-[var(--warning)]">Alguns dados não puderam ser carregados</p>
          <ul className="mt-1 space-y-0.5 text-[10px] text-[var(--muted)]">
            {warnings.slice(0, 4).map((warning) => (
              <li key={warning}>· {warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
