import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bot, CircleAlert, Clock3, Pause, Play, Workflow } from "lucide-react";
import { AGENT_CATALOG, ensureAgentsSeeded } from "@/lib/agents";
import { getAgentObservability, getJobStats, getJobsPage } from "@/lib/jobs";
import { hasDatabaseUrl } from "@/db/client";
import { toggleAgentAction } from "@/actions/agents";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { JOB_STATUS_LABELS, JOB_STATUS_TONE, JOB_TYPE_LABELS } from "@/lib/labels";
import { cn, formatNumber, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Agentes" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; page?: string }>;

const STATUS_TABS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Na fila" },
  { key: "processing", label: "Executando" },
  { key: "completed", label: "Concluídas" },
  { key: "failed", label: "Com erro" },
];

export default async function AgentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (!hasDatabaseUrl()) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Sistema" title="Agentes" description="Fila de trabalho e saúde dos agentes." />
        <EmptyState title="Banco de dados não configurado" description="Configure DATABASE_URL e execute as migrações." />
      </div>
    );
  }

  let jobsData: Awaited<ReturnType<typeof getJobsPage>>;
  let stats: Awaited<ReturnType<typeof getJobStats>>;
  let observability: Awaited<ReturnType<typeof getAgentObservability>>;
  let error: string | null = null;
  const status = params.status || "all";
  const page = Math.max(1, Number(params.page) || 1);

  try {
    await ensureAgentsSeeded();
    [jobsData, stats, observability] = await Promise.all([
      getJobsPage(page, 20, status),
      getJobStats(),
      getAgentObservability(),
    ]);
  } catch (err) {
    jobsData = { rows: [], total: 0, page, pageSize: 20, pageCount: 0 };
    stats = { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, total: 0 };
    observability = { byAgent: new Map(), paused: new Map() };
    error = err instanceof Error ? err.message : "Erro ao consultar a fila.";
  }

  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/agentes${query.size ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Agentes"
        description="Cada tarefa é executada por um agente via fila persistente. O painel não depende de processos em memória."
      />

      {error ? (
        <p className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QueueStat icon={Clock3} label="Na fila" value={stats.pending} />
        <QueueStat icon={Activity} label="Em execução" value={stats.processing} tone="accent" />
        <QueueStat icon={Workflow} label="Concluídas" value={stats.completed} tone="success" />
        <QueueStat icon={CircleAlert} label="Com erro" value={stats.failed} tone={stats.failed > 0 ? "danger" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {AGENT_CATALOG.map((agent) => {
          const row = observability.byAgent.get(agent.slug);
          const paused = observability.paused.get(agent.slug) ?? false;
          return (
            <div key={agent.slug} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Bot className="size-3.5 text-[var(--muted-2)]" />
                    <p className="text-[11px] font-medium text-[var(--ink)]">{agent.name}</p>
                  </div>
                  <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{agent.role}</p>
                </div>
                <Badge variant={paused ? "warning" : "success"}>{paused ? "Pausado" : "Ativo"}</Badge>
              </div>
              <p className="mt-3 min-h-8 text-[10px] leading-relaxed text-[var(--muted)]">{agent.description}</p>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[9px] text-[var(--muted-2)]">
                <span>
                  {row ? `${row.pending + row.processing} ativas · ${row.failed} erros` : "Sem execuções"}
                </span>
                <span>{row?.lastRun ? relativeTime(row.lastRun) : "—"}</span>
              </div>
              <form action={toggleAgentAction.bind(null, agent.slug, !paused)} className="mt-3">
                <Button type="submit" variant={paused ? "outline" : "ghost"} size="sm" className="w-full">
                  {paused ? <Play /> : <Pause />}
                   {paused ? "Liberar novos claims" : "Pausar novos claims"}
                </Button>
              </form>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/agentes${tab.key === "all" ? "" : `?status=${tab.key}`}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium",
                  status === tab.key ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <p className="text-[9px] text-[var(--muted-2)]">{jobsData.total.toLocaleString("pt-BR")} tarefas</p>
        </div>

        {jobsData.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState compact title="Nenhuma tarefa nesta visão" description="Execute uma campanha ou enfileire uma ação em um lead." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Agente</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tentativas</th>
                  <th className="px-3 py-2.5 font-medium">Criada</th>
                  <th className="px-4 py-2.5 text-right font-medium">Atualizada</th>
                </tr>
              </thead>
              <tbody>
                {jobsData.rows.map((job) => (
                  <tr key={job.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-2.5">
                      <Link href={`/agentes/${job.id}`} className="font-medium text-[var(--ink)] hover:underline">
                        {JOB_TYPE_LABELS[job.type] ?? job.type}
                      </Link>
                      {job.error ? <p className="mt-0.5 line-clamp-1 max-w-[320px] text-[9px] text-[var(--danger)]">{job.error}</p> : null}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{job.agentSlug ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[var(--muted)]">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="px-3 py-2.5 text-[9px] text-[var(--muted-2)]">{relativeTime(job.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right text-[9px] text-[var(--muted-2)]">{relativeTime(job.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={jobsData.page} pageCount={jobsData.pageCount} total={jobsData.total} makeHref={makeHref} />
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/40 p-4 text-[10px] leading-relaxed text-[var(--muted)]">
        <p className="font-medium text-[var(--ink)]">Integração com n8n</p>
        <p className="mt-1">
          Workers externos reivindicam tarefas via <code className="rounded bg-[var(--surface)] px-1 py-0.5 font-mono">POST /api/internal/jobs/claim</code>{" "}
          com Bearer <code className="rounded bg-[var(--surface)] px-1 py-0.5 font-mono">INTERNAL_API_SECRET</code>. A fila usa lock transacional,
           recuperação de lock expirado e retentativas. Pausar bloqueia novos claims e novas tarefas; execuções em andamento continuam.
        </p>
      </div>
    </div>
  );
}

function QueueStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
  tone?: "accent" | "success" | "danger" | "default";
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{label}</p>
        <Icon className="size-3.5 text-[var(--muted-2)]" />
      </div>
      <p
        className={cn(
          "metric-value mt-2 text-xl font-semibold",
          tone === "accent" && "text-[var(--accent)]",
          tone === "success" && "text-[var(--success)]",
          tone === "danger" && "text-[var(--danger)]",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}
