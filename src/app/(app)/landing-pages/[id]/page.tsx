import type { Metadata } from "next";
import { LpQualityPanel } from "@/components/lps/lp-quality-panel";
import { getPool } from "@/db/client";
import { getLpRefinementJobs } from "@/lib/jobs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CircleAlert, ExternalLink, Eye, FileCode2, Globe2, Pencil, UserRound } from "lucide-react";
import { getLegacyLpById, getLpVersionsForLp } from "@/lib/legacy";
import { getLeadById } from "@/lib/legacy";
import { createPreviewToken } from "@/lib/lp-preview";
import { requestLpRefinementAction, setLpStatusAction } from "@/actions/lps";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LP_STATUS_LABELS, LP_STATUS_TONE, JOB_STATUS_LABELS, JOB_STATUS_TONE, labelFor } from "@/lib/labels";
import { formatDateTime, toPrettyJson } from "@/lib/utils";

export const metadata: Metadata = { title: "Landing page" };
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function LandingPageDetail({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { ok, error } = await searchParams;

  let lp: Awaited<ReturnType<typeof getLegacyLpById>>;
  try {
    lp = await getLegacyLpById(id);
  } catch (err) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Demonstração" title="Landing page" />
        <EmptyState title="Não foi possível carregar a LP" description={err instanceof Error ? err.message : "Erro ao consultar o banco."} />
      </div>
    );
  }
  if (!lp) notFound();

  const [versions, lead] = await Promise.all([
    getLpVersionsForLp(id).catch(() => []),
    lp.leadId ? getLeadById(lp.leadId).catch(() => null) : Promise.resolve(null),
  ]);

  const refinements = await getLpRefinementJobs(id).catch(() => []);
  const activeRefinement = refinements.some((job) => job.status === "pending" || job.status === "processing");
  const latest = versions[0] ?? null;
  const status = (latest?.status ?? lp.status ?? "draft") as keyof typeof LP_STATUS_TONE;
  const hasHtml = Boolean(latest?.htmlSnapshot || lp.html);

  // A comparação visual pode rejeitar a versão mais recente. Até que uma
  // candidata passe por todas as verificações, o baseline continua sendo a referência.
  let referenceVersion: number | null = null;
  let referenceUnavailable = false;
  try {
    const result = await getPool().query<{ baseline_version: number }>(
      "SELECT baseline_version FROM jb_agent_lp_ab_comparisons WHERE lp_id::text = $1 ORDER BY id DESC LIMIT 1",
      [id],
    );
    referenceVersion = result.rows[0]?.baseline_version ?? null;
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && err.code === "42P01")) {
      referenceUnavailable = true;
    }
  }
  const previewVersion = referenceVersion === null
    ? latest
    : versions.find((version) => version.version === referenceVersion) ?? null;
  const previewHasHtml = !referenceUnavailable && (
    previewVersion?.htmlSnapshot || (referenceVersion === null && lp.html)
  );

  let previewUrl: string | null = null;
  if (previewHasHtml) {
    try {
      previewUrl = `/api/lp-preview/${encodeURIComponent(id)}?token=${createPreviewToken(id, previewVersion?.htmlSnapshot ? previewVersion.id : undefined)}`;
    } catch {
      previewUrl = null;
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Demonstração"
        title={lp.empresa ?? `Landing page #${lp.id}`}
        description={[lp.nicho, lp.cidade].filter(Boolean).join(" · ") || "Demonstração privada"}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/landing-pages">
                <ArrowLeft /> Landing pages
              </Link>
            </Button>
            {previewUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Abrir preview
                </a>
              </Button>
            ) : null}
            {status !== "published" ? (
              <form action={setLpStatusAction.bind(null, id, "published")}>
                <Button type="submit" variant="accent" size="sm" disabled={!hasHtml}>
                  <Globe2 /> Publicar
                </Button>
              </form>
            ) : (
              <form action={setLpStatusAction.bind(null, id, "approved")}>
                <Button type="submit" variant="outline" size="sm">Despublicar</Button>
              </form>
            )}
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
        <Badge variant={LP_STATUS_TONE[status] ?? "outline"}>{labelFor(LP_STATUS_LABELS, status, "Rascunho")}</Badge>
        {latest ? <Badge variant="default">Mais recente: versão {latest.version}</Badge> : null}
        {latest ? <span className="text-[10px] text-[var(--muted)]">{latest.template}</span> : null}
        <span className="text-[10px] text-[var(--muted-2)]">Criada em {formatDateTime(lp.criadoEm)}</span>
        {lead ? (
          <Link href={`/leads/${lead.id}`} className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]">
            <UserRound className="size-3" /> {lead.empresa}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--danger)]/70" />
              <span className="size-2 rounded-full bg-[var(--warning)]/70" />
              <span className="size-2 rounded-full bg-[var(--success)]/70" />
            </div>
            <span className="font-mono text-[9px] text-[var(--muted-2)]">preview seguro · sandbox{previewVersion ? ` · versão ${previewVersion.version}` : ""}</span>
          </div>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="Preview da landing page"
              sandbox="allow-scripts"
              className="h-[640px] w-full bg-white"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="p-5">
              <EmptyState
                icon={hasHtml ? Eye : FileCode2}
                title={hasHtml ? "Preview indisponível" : "HTML ainda não gerado"}
                description={
                  hasHtml
                    ? "Não foi possível carregar com segurança a versão de referência. Confira as avaliações e tente novamente."
                    : "O agente de LP ainda não produziu o HTML desta demonstração. Enfileire a geração no lead."
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <LpQualityPanel lpId={id} />
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-semibold">Melhorar esta página</h2>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Descreva as melhorias. Uma nova versão será criada em rascunho a partir da versão {previewVersion?.version ?? "de referência"}; as anteriores serão preservadas.
            </p>
            <form action={requestLpRefinementAction.bind(null, id)} className="mt-3 space-y-3">
              <input type="hidden" name="baseVersionId" value={previewVersion?.id ?? ""} />
              <label htmlFor="refinement-instructions" className="text-[10px] font-medium">O que melhorar na próxima versão?</label>
              <textarea id="refinement-instructions" name="instructions" required maxLength={2000} rows={5}
                placeholder="Ex.: melhore a hierarquia da primeira dobra e o espaçamento no celular."
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-xs" />
              <Button type="submit" variant="outline" size="sm" disabled={process.env.LP_REFINEMENT_WORKER_READY !== "true" || !previewVersion?.htmlSnapshot || activeRefinement}>
                Gerar nova versão
              </Button>
              {process.env.LP_REFINEMENT_WORKER_READY !== "true" ? <p className="text-[10px] text-[var(--muted)]">Refinamento orientado ainda não disponível.</p> : null}
              {activeRefinement ? <p className="text-[10px] text-[var(--muted)]">Já existe um refinamento em andamento. Confira o status abaixo.</p> : null}
            </form>
            {refinements.length > 0 ? (
              <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
                <p className="text-[10px] font-semibold">Solicitações recentes</p>
                {refinements.map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-2 text-xs">
                    <Link href={`/agentes/${job.id}`} className="underline underline-offset-2">
                      {formatDateTime(job.createdAt)}
                    </Link>
                    <Badge variant={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                  </div>
                ))}
                <p className="text-[10px] text-[var(--muted)]">Abra a tarefa para consultar erros ou reenfileirar uma falha.</p>
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Aprovação</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Status da demonstração</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatusButton lpId={id} status="draft" label="Rascunho" current={status} />
              <StatusButton lpId={id} status="approved" label="Aprovada" current={status} />
              <StatusButton lpId={id} status="published" label="Publicada" current={status} />
              <StatusButton lpId={id} status="archived" label="Arquivada" current={status} />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted-2)]">
              Publicar aqui atualiza o status no painel e, quando a coluna legada existe, também a LP original.
              Links públicos continuam privados até a publicação pelo fluxo de produção.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Versões</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Histórico de geração</h2>
            {versions.length === 0 ? (
              <p className="mt-3 text-[10px] text-[var(--muted)]">Nenhuma versão registrada no painel.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium">v{version.version} · {version.template}</span>
                      <Badge variant={LP_STATUS_TONE[version.status as keyof typeof LP_STATUS_TONE] ?? "outline"}>{LP_STATUS_LABELS[version.status as keyof typeof LP_STATUS_LABELS] ?? version.status}</Badge>
                    </div>
                    <p className="mt-1 text-[9px] text-[var(--muted-2)]">{formatDateTime(version.createdAt)}</p>
                    {version.htmlSnapshot ? <a className="mt-2 inline-block text-xs underline" href={`/api/lp-preview/${encodeURIComponent(id)}?token=${createPreviewToken(id, version.id)}`} target="_blank" rel="noopener noreferrer">Abrir v{version.version}</a> : null}
                    {version.config.source === "08R" ? <p className="mt-1 text-xs text-[var(--muted)]">Refinamento controlado · avaliação pendente</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {latest ? (
            <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <summary className="cursor-pointer text-[10px] font-medium text-[var(--muted)]">
                Configuração da versão {latest.version}
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-[var(--surface-muted)]/60 p-3 font-mono text-[9px] leading-relaxed text-[var(--muted)]">
                {toPrettyJson(latest.config)}
              </pre>
            </details>
          ) : null}

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Campanhas</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Origem do lead</h2>
            {lp.campaigns.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lp.campaigns.map((campaign) => (
                  <Link key={campaign.id} href={`/campanhas/${campaign.id}`}>
                    <Badge variant="accent">{campaign.name}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[10px] text-[var(--muted)]">Sem campanha vinculada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusButton({ lpId, status, label, current }: { lpId: string; status: string; label: string; current: string }) {
  if (status === current) {
    return <Button variant="outline" size="sm" disabled className="justify-start"><BadgeCheck /> {label}</Button>;
  }
  return (
    <form action={setLpStatusAction.bind(null, lpId, status)}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start"><Pencil /> {label}</Button>
    </form>
  );
}
