import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Hand, MessageCircle, PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";
import { requireUser, isAdmin } from "@/lib/auth-helpers";
import { getSalesStats, isSalesPaused, listSalesThreads } from "@/lib/sales-store";
import { setSalesPausedAction } from "@/actions/sales-autopilot";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Autopilot comercial" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function SalesAutopilotPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;
  const workerEnabled = process.env.JB_SALES_WORKER_ENABLED === "true";
  const autoSend = process.env.JB_SALES_AUTOSEND_ENABLED === "true";
  let paused = true;
  let threads: Awaited<ReturnType<typeof listSalesThreads>> = [];
  let stats: Awaited<ReturnType<typeof getSalesStats>> | null = null;
  let error: string | null = null;
  try {
    [paused,threads,stats] = await Promise.all([isSalesPaused(),listSalesThreads(),getSalesStats()]);
  } catch {
    error = "Não foi possível ler o motor comercial. Confirme a migração 0004 no PostgreSQL.";
  }
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Operação" title="Autopilot comercial"
        description="Conversas recebidas, respostas da IA, atendimento humano e controles de segurança." />
      {error || params.error ? <p className="rounded-lg border border-[var(--danger)]/25 p-3 text-xs text-[var(--danger)]">{error || params.error}</p> : null}
      {params.ok ? <p className="rounded-lg border border-[var(--success)]/25 p-3 text-xs text-[var(--success)]">{params.ok}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Info label="Conversas" value={stats?.conversations ?? 0} />
        <Info label="Aguardando IA" value={stats?.pending ?? 0} />
        <Info label="Rascunhos para revisão" value={stats?.drafts ?? 0} />
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {paused ? <PauseCircle className="size-4 text-[var(--warning)]" /> : <PlayCircle className="size-4 text-[var(--success)]" />}
              <h2 className="text-sm font-semibold">Chave geral: {paused ? "Pausado" : "Liberado no painel"}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-[11px] text-[var(--muted)]">
              Worker: {workerEnabled ? "habilitado no servidor" : "desabilitado no servidor"} ·
              Envio externo: {autoSend ? "habilitado no servidor" : "desligado"}. A liberação no painel
              não ignora as flags e as restrições do canal. Receber mensagens não é disparar prospecção fria.
            </p>
          </div>
          {isAdmin(user) ? (
            <form action={setSalesPausedAction}>
              <input type="hidden" name="paused" value={paused ? "false" : "true"} />
              <Button type="submit" size="sm" variant={paused ? "outline" : "danger"} disabled={Boolean(error)}>
                {paused ? <PlayCircle /> : <PauseCircle />} {paused ? "Liberar processamento" : "Pausar tudo"}
              </Button>
            </form>
          ) : null}
        </div>
        <p className="mt-3 text-[10px] text-[var(--muted-2)]">
          Por padrão, a IA não envia mensagens. Somente inbound confirmado pelo provedor, em janela de atendimento elegível,
          pode receber resposta automática quando ambos os controles e o gateway de envio estiverem configurados.
        </p>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-[var(--muted)]"/>
          <h2 className="text-sm font-semibold">Conversas monitoradas</h2>
        </div>
        {threads.length === 0 ? <p className="mt-4 text-xs text-[var(--muted)]">
          Ainda não há conversas. Ligue o webhook inbound do canal conectado ao CRM.
        </p> : (
          <div className="mt-4 divide-y divide-[var(--line)]">
            {threads.map(t => (
              <Link key={t.contact_id} href={`/autopilot/${t.contact_id}`}
                className="flex items-center justify-between gap-3 py-3 text-xs hover:text-[var(--accent)]">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {t.mode === "human" ? <Hand className="size-3"/> : <Bot className="size-3"/>}
                    Lead {t.lead_id}
                    {t.opted_out ? <ShieldAlert className="size-3 text-[var(--danger)]"/> : null}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-[var(--muted)]">
                    {t.last_message || "Nenhuma mensagem"} · {t.stage}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[10px] text-[var(--muted)]">
                  <span className="block">{t.pending} pendentes · {t.drafts} revisão</span>
                  <span className="block">{formatDateTime(t.last_inbound_at)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function Info({ label,value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
    <p className="text-[10px] text-[var(--muted)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</p>
  </div>;
}
