import { BadgeCheck, BriefcaseBusiness, CheckCircle2, ClipboardList, FileText, Handshake, Wallet } from "lucide-react";
import { DELIVERY_TASKS, dealStatusLabel, proposalText, type DealState } from "@/lib/deals";
import {
  completeDeliveryTaskAction, finishDeliveryAction, markProposalSentAction,
  recordFullPaymentAction, recordProposalAcceptanceAction, saveProposalDraftAction,
} from "@/actions/deals";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const FIELD = "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]";
const LABEL = "block space-y-1 text-[10px] font-semibold text-[var(--ink)]";
const BOX = "space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]";

export function DealPanel({ contactId, business, stage, lpId, lpStatus, state }: {
  contactId: string;
  business: string;
  stage: string;
  lpId: string | null;
  lpStatus: string | null;
  state: DealState;
}) {
  const p = state.proposal;
  const canSend = Boolean(p && state.status === "draft" && lpId && ["approved","published"].includes(lpStatus ?? "")
    && ["respondeu","em_negociacao","proposta_enviada"].includes(stage));
  const done = new Set(state.completedTasks);
  return (
    <section id="negocio" className="space-y-4">
      <div className={BOX}>
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-[var(--accent-strong)]" />
          <h2 className="text-sm font-semibold">Proposta, venda e entrega</h2>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--muted)]">
          Uma proposta por vez, sempre vinculada à oportunidade. Nenhum envio, cobrança ou publicação ocorre automaticamente.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-medium">{dealStatusLabel(state.status)}</span>
          {state.deliveryFinished ? <span className="inline-flex items-center gap-1 text-[10px] text-[var(--success)]"><BadgeCheck className="size-3" /> Entregue</span> : null}
          {p ? <span className="text-xs font-semibold">{formatCurrency(Number(p.price))}</span> : null}
        </div>
      </div>

      {state.status === "none" || state.status === "draft" ? (
        <div className={BOX}>
          <h3 className="text-xs font-semibold">Preparar proposta comercial</h3>
          <p className="text-[10px] text-[var(--muted)]">Salve o escopo e os valores antes de apresentá-los ao cliente. Salvar novamente cria uma nova versão de rascunho.</p>
          <form action={saveProposalDraftAction.bind(null, contactId)} className="space-y-3">
            <label className={LABEL}>Nome do projeto
              <input name="title" required minLength={5} maxLength={120} defaultValue={p?.title ?? "Site institucional profissional"} className={FIELD} />
            </label>
            <label className={LABEL}>Escopo e entregáveis
              <textarea name="scope" required minLength={30} maxLength={6000} rows={6}
                defaultValue={p?.scope ?? "Criação e personalização de landing page responsiva, com informações, serviços, canais de contato e revisão antes da publicação."}
                className={FIELD}/>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={LABEL}>Implantação (R$)
                <input name="price" required inputMode="decimal" defaultValue={p?.price ?? ""} placeholder="1200.00" className={FIELD}/>
              </label>
              <label className={LABEL}>Mensalidade (R$)
                <input name="monthly" required inputMode="decimal" defaultValue={p?.monthly ?? "0.00"} className={FIELD}/>
              </label>
            </div>
            <label className={LABEL}>Prazo em dias
              <input type="number" name="deliveryDays" min={1} max={365} required defaultValue={p?.deliveryDays || 15} className={FIELD}/>
            </label>
            <Button type="submit" variant="outline" size="sm" className="w-full"><FileText/> Salvar rascunho da proposta</Button>
          </form>
        </div>
      ) : null}

      {p ? (
        <div className={BOX}>
          <h3 className="text-xs font-semibold">Proposta para apresentar ao cliente</h3>
          <p className="text-[10px] text-[var(--muted)]">Selecione e copie o conteúdo para envio por canal autorizado. A operação no painel não envia mensagens.</p>
          <textarea readOnly rows={12} value={proposalText(p, business)}
            className={FIELD + " font-mono text-[10px] leading-relaxed"} aria-label="Proposta comercial para copiar" />
          {state.status === "draft" ? (
            <form action={markProposalSentAction.bind(null, contactId)} className="space-y-3 border-t border-[var(--line)] pt-3">
              <input type="hidden" name="proposalId" value={p.id}/>
              <label className={LABEL}>Canal utilizado
                <select name="channel" defaultValue="email" className={FIELD}>
                  <option value="email">E-mail</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp (somente com permissão)</option>
                  <option value="telefone">Telefone</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className={LABEL}>Observações sobre o envio
                <input name="notes" maxLength={2000} className={FIELD} placeholder="Ex.: enviada após conversa com o responsável"/>
              </label>
              <label className="flex items-start gap-2 text-[10px] text-[var(--muted)]">
                <input name="waConsent" type="checkbox" className="mt-0.5"/>
                Se o envio foi por WhatsApp, confirmo a autorização prévia para contato comercial nesse canal.
              </label>
              <label className="flex items-start gap-2 text-[10px] text-[var(--muted)]">
                <input name="manualSent" type="checkbox" required disabled={!canSend} className="mt-0.5"/>
                Confirmo que a proposta foi realmente apresentada ao lead, com autorização para o canal utilizado.
              </label>
              {!canSend ? <p className="text-[10px] text-[var(--warning)]">O envio só pode ser registrado após aprovação da LP e resposta/interesse do lead.</p> : null}
              <Button type="submit" variant="accent" size="sm" disabled={!canSend} className="w-full">
                <Handshake/> Registrar proposta enviada
              </Button>
            </form>
          ) : null}
          {state.status === "sent" ? (
            <form action={recordProposalAcceptanceAction.bind(null, contactId)} className="space-y-3 border-t border-[var(--line)] pt-3">
              <input type="hidden" name="proposalId" value={p.id}/>
              <h3 className="text-xs font-semibold">O cliente aceitou?</h3>
              <label className={LABEL}>Evidência do aceite
                <textarea name="evidence" required minLength={8} maxLength={2000} rows={3} className={FIELD}
                  placeholder="Quando, como e por qual contato o aceite foi recebido?"/>
              </label>
              <label className="flex items-start gap-2 text-[10px] text-[var(--muted)]">
                <input name="acceptanceConfirmed" type="checkbox" required className="mt-0.5"/>
                Confirmo que o cliente aceitou efetivamente as condições da proposta.
              </label>
              <Button type="submit" variant="outline" size="sm" className="w-full">
                <BadgeCheck/> Registrar aceite recebido
              </Button>
            </form>
          ) : null}
          {state.status === "accepted" ? (
            <form action={recordFullPaymentAction.bind(null, contactId)} className="space-y-3 border-t border-[var(--line)] pt-3">
              <input type="hidden" name="proposalId" value={p.id}/>
              <h3 className="text-xs font-semibold">Confirmar pagamento integral</h3>
              <p className="text-[10px] text-[var(--muted)]">Registro manual após conferência externa. Não processa cobrança nem consulta o banco.</p>
              <label className={LABEL}>Valor recebido (R$)
                <input name="amount" required defaultValue={p.price} className={FIELD}/>
              </label>
              <label className={LABEL}>Referência do pagamento
                <input name="reference" required maxLength={300} className={FIELD} placeholder="Identificador/recibo verificado"/>
              </label>
              <label className="flex items-start gap-2 text-[10px] text-[var(--muted)]">
                <input name="paymentConfirmed" required type="checkbox" className="mt-0.5"/>
                Verifiquei que o pagamento integral entrou efetivamente na conta.
              </label>
              <Button type="submit" variant="accent" size="sm" className="w-full">
                <Wallet/> Registrar pagamento e fechar venda
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {state.status === "paid" && p ? (
        <div className={BOX}>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-[var(--accent-strong)]"/>
            <h3 className="text-sm font-semibold">Checklist de entrega</h3>
          </div>
          <p className="text-[10px] text-[var(--muted)]">{done.size} de {DELIVERY_TASKS.length} etapas concluídas. O painel registra verificações manuais; não publica nem configura hospedagem sozinho.</p>
          <div className="space-y-3">
            {DELIVERY_TASKS.map(task => (
              <form action={completeDeliveryTaskAction.bind(null, contactId)} key={task.key}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/30 p-3 space-y-2">
                <input type="hidden" name="proposalId" value={p.id}/>
                <input type="hidden" name="taskKey" value={task.key}/>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-medium">{task.label}</span>
                  {done.has(task.key) ? <span className="flex items-center gap-1 text-[9px] text-[var(--success)]"><CheckCircle2 className="size-3"/> Feito</span> : null}
                </div>
                {!done.has(task.key) && !state.deliveryFinished ? (
                  <>
                    <input name="note" maxLength={1500} className={FIELD}
                      required={["autorizacao_publicacao","publicacao","entrega"].includes(task.key)}
                      placeholder="Observação/evidência da conclusão"/>
                    <Button type="submit" size="sm" variant="outline" className="w-full">Registrar conclusão</Button>
                  </>
                ) : null}
              </form>
            ))}
          </div>
          {done.size === DELIVERY_TASKS.length && !state.deliveryFinished ? (
            <form action={finishDeliveryAction.bind(null, contactId)} className="space-y-3 border-t border-[var(--line)] pt-3">
              <input type="hidden" name="proposalId" value={p.id}/>
              <label className={LABEL}>Como a entrega foi confirmada?
                <textarea name="note" required minLength={8} maxLength={1500} rows={3} className={FIELD}/>
              </label>
              <label className="flex items-start gap-2 text-[10px] text-[var(--muted)]">
                <input name="deliveryConfirmed" type="checkbox" required className="mt-0.5"/>
                Confirmo que a entrega foi concluída e os materiais foram disponibilizados ao cliente.
              </label>
              <Button type="submit" size="sm" variant="accent" className="w-full"><BadgeCheck/> Concluir entrega</Button>
            </form>
          ) : null}
          {state.deliveryFinished ? <p className="rounded-lg bg-[var(--success-subtle)] p-3 text-[11px] text-[var(--success)]">Entrega concluída e registrada no histórico comercial.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
