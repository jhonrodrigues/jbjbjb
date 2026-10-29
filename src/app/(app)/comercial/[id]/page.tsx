import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CircleAlert, FileText, MessageSquare, Phone, UserRound } from "lucide-react";
import { getCampaignById } from "@/lib/campaigns";
import { getContactById, getContactEvents } from "@/lib/contacts";
import { getLeadById, getLpVersionsForLp } from "@/lib/legacy";
import { canApproachLead, prepareOutreachMessage } from "@/lib/outreach";
import { saveOutreachDraftAction, recordManualOutreachAction, recordLeadReplyAction } from "@/actions/outreach";
import { OutreachPanel } from "@/components/contacts/outreach-panel";
import { DealPanel } from "@/components/contacts/deal-panel";
import { generateCommercialAiDraftAction } from "@/actions/commercial-ai";
import { getDealState } from "@/lib/deal-store";
import { moveContactStageAction, registerContactEventAction, updateContactAction } from "@/actions/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CRM_STAGE_COLUMNS, STAGE_LABELS } from "@/lib/labels";
import { formatCurrency, formatDateTime, relativeTime, titleCase } from "@/lib/utils";
import { APP_TIMEZONE, toAppLocalInput } from "@/lib/period";

export const metadata: Metadata = { title: "Contato" };
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

const SELECT =
  "h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";

export default async function ContactDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const [contact, events] = await Promise.all([getContactById(id), getContactEvents(id)]);
  if (!contact) notFound();
  const [lead, campaign] = await Promise.all([
    getLeadById(contact.leadId).catch(() => null),
    contact.campaignId ? getCampaignById(contact.campaignId).catch(() => null) : Promise.resolve(null),
  ]);

  const lpVersions = contact.lpId ? await getLpVersionsForLp(contact.lpId).catch(() => []) : [];
  const lpStatus = lpVersions[0]?.status ?? null;
  const canContact = canApproachLead(contact.lpId, lpStatus);
  const dealState = await getDealState(contact.id);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const savedDraft = events.find(event => event.type === "abordagem_rascunho")?.notes;
  const initialMessage = savedDraft || prepareOutreachMessage(lead?.empresa, lead?.cidade, Boolean(contact.lpId));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comercial"
        title={lead?.empresa ?? `Contato ${contact.id.slice(0, 8)}`}
        description={[lead?.nicho, lead?.cidade, campaign?.name].filter(Boolean).join(" · ")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/comercial">
              <ArrowLeft /> CRM
            </Link>
          </Button>
        }
      />

      {ok ? <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">{ok}</div> : null}
      {error ? (
        <div className="flex gap-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">{STAGE_LABELS[contact.stage] ?? contact.stage}</Badge>
        {lead ? (
          <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]">
            <Building2 className="size-3" /> Abrir lead
          </Link>
        ) : null}
        {contact.lpId ? (
          <Link href={`/landing-pages/${encodeURIComponent(contact.lpId)}`} className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-strong)] hover:underline">
            <FileText className="size-3" /> Abrir demonstração
          </Link>
        ) : null}
        {lead?.telefone ? (
          <a href={`tel:${lead.telefone}`} className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]">
            <Phone className="size-3" /> {lead.telefone}
          </a>
        ) : null}
        <span className="ml-auto text-[9px] text-[var(--muted-2)]">Atualizado {relativeTime(contact.updatedAt)}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Etapa</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Mover no funil</h2>
            <form action={moveContactStageAction.bind(null, id)} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select name="stage" defaultValue={contact.stage} className={SELECT}>
                {CRM_STAGE_COLUMNS.map((stage) => (
                  <option key={stage} value={stage} disabled={stage === "fechado" || stage === "proposta_enviada"}>{STAGE_LABELS[stage]}</option>
                ))}
              </select>
              <input
                name="notes"
                placeholder="Observação da mudança (opcional)"
                className="h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]"
              />
              <Button type="submit" variant="accent" size="sm">Mover</Button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Dados comerciais</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Acompanhamento</h2>
            <form action={updateContactAction.bind(null, id)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Canal">
                <input name="channel" defaultValue={contact.channel ?? ""} className={SELECT} placeholder="WhatsApp, e-mail..." />
              </Field>
              <Field label={`Próxima ação em (${APP_TIMEZONE})`}>
                <input
                  name="nextActionAt"
                  type="datetime-local"
                  defaultValue={contact.nextActionAt ? toAppLocalInput(contact.nextActionAt) : ""}
                  className={SELECT}
                />
              </Field>
              <Field label="Próxima ação" className="sm:col-span-2">
                <input name="nextAction" defaultValue={contact.nextAction ?? ""} className={SELECT} placeholder="Ex.: enviar proposta revisada" />
              </Field>
              <Field label="Valor proposto (BRL)">
                <input name="proposedValue" type="number" step="0.01" min="0" defaultValue={contact.proposedValue ?? ""} className={SELECT} />
              </Field>
              <Field label="Valor fechado (BRL)">
                <input name="closedValue" type="number" step="0.01" min="0" defaultValue={contact.closedValue ?? ""} className={SELECT} />
              </Field>
              <Field label="Notas" className="sm:col-span-2">
                <textarea
                  name="notes"
                  defaultValue={contact.notes ?? ""}
                  rows={3}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" variant="outline" size="sm">Salvar dados</Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Histórico</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Eventos do contato</h2>
            {events.length === 0 ? (
              <EmptyState compact title="Nenhum evento registrado" className="mt-4" />
            ) : (
              <div className="mt-4 space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <div className="min-w-0">
                      <p className="text-[11px]">
                        {titleCase(event.type)}
                        {event.fromStage && event.toStage ? (
                          <span className="text-[var(--muted)]"> · {STAGE_LABELS[event.fromStage] ?? event.fromStage} → {STAGE_LABELS[event.toStage] ?? event.toStage}</span>
                        ) : null}
                      </p>
                      {event.notes ? <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--muted)]">{event.notes}</p> : null}
                      <p className="mt-0.5 text-[9px] text-[var(--muted-2)]">{formatDateTime(event.createdAt)} · {relativeTime(event.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <OutreachPanel
            businessName={lead?.empresa ?? "este lead"}
            aiConfigured={aiConfigured}
            aiAction={generateCommercialAiDraftAction.bind(null, contact.id, "outreach")}
            initialMessage={initialMessage}
            canContact={canContact}
            hasLp={Boolean(contact.lpId)}
            lpStatus={lpStatus}
            saveAction={saveOutreachDraftAction.bind(null, id)}
            recordContactAction={recordManualOutreachAction.bind(null, id)}
            recordReplyAction={recordLeadReplyAction.bind(null, id)}
          />
          <DealPanel contactId={contact.id} business={lead?.empresa ?? `Lead ${contact.leadId}`}
            stage={contact.stage} lpId={contact.lpId} lpStatus={lpStatus} state={dealState}
            aiConfigured={aiConfigured} aiAction={generateCommercialAiDraftAction.bind(null, contact.id, "proposal")}/>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-3.5 text-[var(--muted-2)]" />
              <h2 className="text-sm font-semibold tracking-tight">Registrar interação</h2>
            </div>
            <form action={registerContactEventAction.bind(null, id)} className="mt-3 space-y-2">
              <select name="type" className={SELECT} defaultValue="nota">
                <option value="nota">Nota interna</option>
              </select>
              <textarea
                name="notes"
                rows={3}
                placeholder="Resumo da interação..."
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <Button type="submit" variant="accent" size="sm" className="w-full">Registrar evento</Button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Resumo</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Negociação</h2>
            <dl className="mt-4 space-y-2.5 text-[10px]">
              <Row label="Valor proposto" value={contact.proposedValue ? formatCurrency(Number(contact.proposedValue)) : "—"} />
              <Row label="Valor fechado" value={contact.closedValue ? formatCurrency(Number(contact.closedValue)) : "—"} />
              <Row label="Fechado em" value={contact.closedAt ? formatDateTime(contact.closedAt) : "—"} />
              <Row label="Canal" value={contact.channel} />
              <Row label="Campanha" value={campaign?.name ?? null} />
              <Row label="Eventos" value={String(events.length)} />
              <Row label="Dono" value={contact.ownerId ? <span className="inline-flex items-center gap-1"><UserRound className="size-2.5" /> atribuído</span> : null} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-[var(--ink)]">{value ?? "—"}</dd>
    </div>
  );
}
