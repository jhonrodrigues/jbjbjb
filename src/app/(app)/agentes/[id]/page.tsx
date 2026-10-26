import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleAlert, RotateCcw, Square, Workflow } from "lucide-react";
import { getJobById, getJobEvents } from "@/lib/jobs";
import { getCampaignById } from "@/lib/campaigns";
import { getLeadById } from "@/lib/legacy";
import { cancelJobAction, retryJobAction } from "@/actions/agents";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { JOB_STATUS_LABELS, JOB_STATUS_TONE, JOB_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime, relativeTime, titleCase, toPrettyJson } from "@/lib/utils";

export const metadata: Metadata = { title: "Tarefa" };
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { ok, error } = await searchParams;

  const job = await getJobById(id).catch(() => null);
  if (!job) notFound();
  const [events, campaign, lead] = await Promise.all([
    getJobEvents(id).catch(() => []),
    job.campaignId ? getCampaignById(job.campaignId).catch(() => null) : Promise.resolve(null),
    job.leadId ? getLeadById(job.leadId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Execução"
        title={JOB_TYPE_LABELS[job.type] ?? job.type}
        description={`Tarefa ${job.id.slice(0, 8)} · ${job.agentSlug ?? "sem agente"}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agentes">
                <ArrowLeft /> Agentes
              </Link>
            </Button>
            {job.status === "failed" || job.status === "cancelled" ? (
              <form action={retryJobAction.bind(null, id)}>
                <Button type="submit" variant="accent" size="sm">
                  <RotateCcw /> Reenfileirar
                </Button>
              </form>
            ) : null}
            {job.status !== "completed" && job.status !== "cancelled" ? (
              <form action={cancelJobAction.bind(null, id)}>
                <Button type="submit" variant="outline" size="sm">
                  <Square /> Cancelar
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      {ok ? <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">{ok}</div> : null}
      {error ? (
        <div className="flex gap-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
        <span className="text-[10px] text-[var(--muted)]">
          Tentativa {job.attempts} de {job.maxAttempts}
        </span>
        <span className="text-[10px] text-[var(--muted-2)]">Criada {formatDateTime(job.createdAt)}</span>
        {campaign ? (
          <Link href={`/campanhas/${campaign.id}`} className="text-[10px] text-[var(--accent)] hover:underline">
            {campaign.name}
          </Link>
        ) : null}
        {lead ? (
          <Link href={`/leads/${lead.id}`} className="text-[10px] text-[var(--accent)] hover:underline">
            {lead.empresa}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Payload</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Entrada da tarefa</h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-[var(--surface-muted)]/60 p-3 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
              {toPrettyJson(job.payload)}
            </pre>
          </div>

          {job.error ? (
            <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-subtle)] p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">Erro</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[var(--danger)]">{job.error}</pre>
            </div>
          ) : null}

          {job.result ? (
            <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--success-subtle)] p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--success)]">Resultado</p>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[var(--muted)]">
                {toPrettyJson(job.result)}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Ciclo de vida</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Eventos</h2>
            {events.length === 0 ? (
              <EmptyState compact title="Nenhum evento" className="mt-4" />
            ) : (
              <div className="mt-4 space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-2.5">
                    <Workflow className="mt-0.5 size-3 shrink-0 text-[var(--muted-2)]" />
                    <div>
                      <p className="text-[10px] font-medium">{titleCase(event.event)}</p>
                      <p className="text-[9px] text-[var(--muted-2)]">
                        {relativeTime(event.createdAt)}
                        {event.workerId ? ` · ${event.workerId}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Metadados</p>
            <dl className="mt-3 space-y-2 text-[10px]">
              <Row label="ID" value={<span className="font-mono">{job.id}</span>} />
              <Row label="Worker" value={job.lockedBy ?? "—"} />
              <Row label="Disponível em" value={formatDateTime(job.availableAt)} />
              <Row label="Iniciada em" value={formatDateTime(job.startedAt)} />
              <Row label="Finalizada em" value={formatDateTime(job.finishedAt)} />
              <Row label="Atualizada em" value={formatDateTime(job.updatedAt)} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-[var(--ink)]">{value}</dd>
    </div>
  );
}
