import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, CheckCircle2, ClipboardCheck, MessageCircle, Plus, Sparkles } from "lucide-react";
import { hasDatabaseUrl } from "@/db/client";
import { getOperationPipeline, OPERATION_PHASES, type OperationEntry } from "@/lib/operations";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { STAGE_LABELS } from "@/lib/labels";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Operação comercial" };
export const dynamic = "force-dynamic";

export default async function OperationPage() {
  const configured = hasDatabaseUrl();
  let items: Awaited<ReturnType<typeof getOperationPipeline>> = [];
  let error: string | null = null;
  if (configured) {
    try {
      items = await getOperationPipeline();
    } catch (err) {
      error = err instanceof Error ? err.message : "Falha ao carregar o pipeline.";
    }
  }

  const counts = Object.fromEntries(OPERATION_PHASES.map(phase => [
    phase.id, items.filter(item => item.phase === phase.id).length,
  ]));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operação"
        title="Pipeline de sites"
        description="Da prospecção à aprovação da demonstração e ao fechamento, com dados reais da fila e do CRM."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/campanhas"><Plus /> Prospecção</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/landing-pages"><Sparkles /> Landing pages</Link>
            </Button>
            <Button asChild variant="accent" size="sm">
              <Link href="/comercial"><MessageCircle /> CRM</Link>
            </Button>
          </div>
        }
      />

      {!configured || error ? (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--surface)] p-4 text-xs text-[var(--warning)]">
          {error || "Banco de dados ainda não configurado."}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Em revisão" value={counts.revisao ?? 0} icon={ClipboardCheck} />
        <Metric label="Prontos para contato" value={counts.abordagem ?? 0} icon={MessageCircle} />
        <Metric label="Em negociação" value={counts.negociacao ?? 0} icon={ArrowUpRight} />
        <Metric label="Vendas fechadas" value={counts.venda ?? 0} icon={CheckCircle2} />
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
        <strong className="text-[var(--ink)]">Como funciona:</strong>{" "}
        a LP gravada pelo n8n entra em revisão e fica vinculada ao CRM. Depois da aprovação manual,
        a oportunidade avança para contato. Mensagens, propostas, pagamentos e publicação não são enviados
        ou executados automaticamente nesta etapa.
      </div>

      {!error && configured && items.length === 0 ? (
        <EmptyState title="Nenhuma oportunidade com LP ainda" description="Gere uma demonstração pelo lead para iniciar o acompanhamento comercial." action={
          <Button asChild variant="outline" size="sm"><Link href="/leads"><Building2 /> Ver leads</Link></Button>
        } />
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max items-start gap-3">
            {OPERATION_PHASES.map(phase => {
              const cards = items.filter(item => item.phase === phase.id);
              return (
                <section key={phase.id} className="w-[278px] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/40">
                  <header className="border-b border-[var(--line)] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold text-[var(--ink)]">{phase.title}</h2>
                      <span className="rounded bg-[var(--surface)] px-2 py-1 text-[10px] tabular-nums">{cards.length}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">{phase.description}</p>
                  </header>
                  <div className="space-y-2 p-2">
                    {cards.length === 0 ? (
                      <p className="px-2 py-5 text-center text-[10px] text-[var(--muted-2)]">Nenhum registro</p>
                    ) : cards.map(item => <OpportunityCard key={item.contactId} item={item} />)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
      <p className="text-[10px] text-[var(--muted-2)]">
        Dados do PostgreSQL, limitados aos 500 contatos atualizados mais recentemente. Nenhuma abordagem automática é realizada.
      </p>
    </div>
  );
}

function OpportunityCard({ item }: { item: OperationEntry }) {
  return (
    <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)]">
      <div>
        <Link href={`/comercial/${item.contactId}`} className="text-[12px] font-semibold leading-snug text-[var(--ink)] hover:underline">
          {item.businessName}
        </Link>
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          {[item.segment, item.city].filter(Boolean).join(" · ") || "Sem segmento"}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <span className="rounded bg-[var(--surface-muted)] px-2 py-1 text-[var(--muted)]">
          {STAGE_LABELS[item.stage as keyof typeof STAGE_LABELS] ?? item.stage}
        </span>
        <span className="text-[var(--muted-2)]">{relativeTime(item.updatedAt)}</span>
      </div>
      {item.lpId ? (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2 text-[10px]">
          <span className="text-[var(--muted)]">LP #{item.lpId}{item.lpVersion ? ` · v${item.lpVersion}` : ""}</span>
          <Link className="font-medium text-[var(--accent-strong)] hover:underline" href={`/landing-pages/${encodeURIComponent(item.lpId)}`}>
            {item.phase === "revisao" ? "Revisar LP" : "Abrir LP"} ↗
          </Link>
        </div>
      ) : (
        <Link href={`/leads/${encodeURIComponent(item.leadId)}`} className="block border-t border-[var(--line)] pt-2 text-[10px] font-medium text-[var(--accent-strong)] hover:underline">
          Gerar landing page ↗
        </Link>
      )}
      {item.nextAction ? (
        <p className="rounded bg-[var(--accent-subtle)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--accent-strong)]">
          {item.nextAction}
        </p>
      ) : null}
    </div>
  );
}

function Metric({
  label, value, icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardCheck;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-[var(--muted)]">{label}</p>
        <Icon className="size-4 text-[var(--muted-2)]" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--ink)]">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
