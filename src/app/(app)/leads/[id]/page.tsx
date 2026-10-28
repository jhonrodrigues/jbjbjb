import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  BrainCircuit,
  Building2,
  CircleAlert,
  ExternalLink,
  FileText,
  Globe2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { getCampaignOptions } from "@/lib/campaigns";
import { getLeadDetailsBundle } from "@/lib/legacy";
import {
  addLeadToCampaignAction,
  addLeadToCrmAction,
  approveLeadAction,
  discardLeadAction,
  enqueueLeadJobAction,
  restoreLeadAction,
  setLeadPriorityAction,
} from "@/actions/leads";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
  JOB_TYPE_LABELS,
  LP_STATUS_LABELS,
  LP_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  STAGE_LABELS,
} from "@/lib/labels";
import { formatDateTime, formatNumber, parseJsonValue, relativeTime, titleCase, toPrettyJson } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  let bundle: Awaited<ReturnType<typeof getLeadDetailsBundle>>;

  try {
    bundle = await getLeadDetailsBundle(id);
  } catch (err) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Lead" title="Detalhes da empresa" />
        <EmptyState
          title="Não foi possível carregar o lead"
          description={err instanceof Error ? err.message : "Erro ao consultar o banco de dados."}
        />
      </div>
    );
  }

  if (!bundle) notFound();
  const { lead, brand, brandAssets, versions, contacts, contactEvents, jobs, activity } = bundle;
  const campaigns = await getCampaignOptions();
  const discarded = Boolean(lead.discardedAt);
  const analysis = parseJsonValue(lead.analiseIa);
  const research = parseJsonValue(lead.pesquisaWeb);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Lead"
        title={lead.empresa}
        description={[lead.nicho, lead.cidade, lead.status].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/leads">
                <ArrowLeft /> Leads
              </Link>
            </Button>
            {discarded ? (
              <form action={restoreLeadAction.bind(null, lead.id)}>
                <Button type="submit" variant="outline" size="sm">
                  <RefreshCw /> Restaurar
                </Button>
              </form>
            ) : (
              <>
                <form action={approveLeadAction.bind(null, lead.id)}>
                  <Button type="submit" variant="accent" size="sm">
                    <BadgeCheck /> Aprovar
                  </Button>
                </form>
                <form action={discardLeadAction.bind(null, lead.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Descartar
                  </Button>
                </form>
              </>
            )}
          </>
        }
      />

      {ok ? (
        <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">{ok}</div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
        </div>
      ) : null}
      {discarded ? (
        <div className="rounded-lg border border-[var(--warning)]/20 bg-[var(--warning-subtle)] px-3 py-2 text-[11px] text-[var(--warning)]">
          Lead descartado {lead.discardedAt ? relativeTime(lead.discardedAt) : ""}. Ele continua visível para auditoria.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={PRIORITY_TONE[lead.priority] ?? "outline"}>{PRIORITY_LABELS[lead.priority] ?? lead.priority}</Badge>
              {lead.approvedAt ? <Badge variant="success">Aprovado</Badge> : null}
              {discarded ? <Badge variant="warning">Descartado</Badge> : null}
              {lead.campaigns.map((campaign) => (
                <Link key={campaign.id} href={`/campanhas/${campaign.id}`}>
                  <Badge variant="accent">{campaign.name}</Badge>
                </Link>
              ))}
              <span className="ml-auto font-mono text-[10px] text-[var(--muted-2)]">
                Score {lead.pontuacao !== null ? formatNumber(lead.pontuacao) : "—"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
              <ContactLine icon={Building2} label="Origem" value={lead.origem} />
              <ContactLine icon={Globe2} label="Site" value={lead.site} href={lead.site ?? undefined} />
              <ContactLine icon={Phone} label="Telefone" value={lead.telefone} href={lead.telefone ? `tel:${lead.telefone}` : undefined} />
              <ContactLine icon={MessageCircle} label="Instagram" value={lead.instagram} href={lead.instagram?.startsWith("http") ? lead.instagram : undefined} />
              <ContactLine icon={MapPin} label="Endereço" value={[lead.rua, lead.cidade].filter(Boolean).join(" · ")} />
              <ContactLine icon={FileText} label="ID de origem" value={lead.idOrigem} />
            </div>
          </div>

          <JsonPanel title="Análise de IA" data={analysis} icon={BrainCircuit} empty="O Analista IA ainda não avaliou esta empresa." />
          <JsonPanel title="Pesquisa web" data={research} icon={Search} empty="Nenhuma pesquisa web registrada." />
          <JsonPanel title="Oportunidade" data={lead.oportunidade} icon={Sparkles} empty="Sem sinal de oportunidade." />

          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Demonstrações</p>
              <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Landing pages e versões</h2>
            </div>
            {versions.length === 0 ? (
              <div className="p-4">
                <EmptyState compact title="Nenhuma LP gerada" description="Enfileire a geração para criar uma demonstração." />
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {versions.map((version) => (
                  <Link key={version.id} href={`/landing-pages/${version.lpId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]">
                    <div>
                      <p className="text-[11px] font-medium">Versão {version.version} · {version.template}</p>
                      <p className="mt-0.5 text-[9px] text-[var(--muted-2)]">{formatDateTime(version.createdAt)}</p>
                    </div>
                    <Badge variant={LP_STATUS_TONE[version.status as keyof typeof LP_STATUS_TONE] ?? "outline"}>{LP_STATUS_LABELS[version.status as keyof typeof LP_STATUS_LABELS] ?? version.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Ações</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Próximos passos</h2>

            <form action={setLeadPriorityAction.bind(null, lead.id)} className="mt-4 space-y-2">
              <label htmlFor="priority" className="text-[10px] text-[var(--muted)]">Prioridade manual</label>
              <div className="flex gap-2">
                <select
                  id="priority"
                  name="priority"
                  defaultValue={lead.priorityOverride ?? ""}
                  className="h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]"
                >
                  <option value="">Automática pelo score</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                  <option value="nao_avaliada">Não avaliada</option>
                </select>
                <Button type="submit" variant="outline" size="sm">Salvar</Button>
              </div>
            </form>

            <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
              <JobButton leadId={lead.id} type="analyze_lead" label="Analisar com IA" icon={BrainCircuit} />
              <JobButton leadId={lead.id} type="research_brand" label="Pesquisar marca" icon={Search} />
              <JobButton leadId={lead.id} type="generate_lp" label="Gerar landing page" icon={Sparkles} />
              <JobButton leadId={lead.id} type="prepare_outreach" label="Preparar abordagem" icon={MessageCircle} />
            </div>

            <form action={addLeadToCampaignAction.bind(null, lead.id)} className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
              <label htmlFor="campaignId" className="text-[10px] text-[var(--muted)]">Adicionar à campanha</label>
              <div className="flex gap-2">
                <select
                  id="campaignId"
                  name="campaignId"
                  className="h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>Selecione</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm"><Plus /></Button>
              </div>
            </form>

            <form action={addLeadToCrmAction.bind(null, lead.id)} className="mt-3 space-y-2">
              <select
                name="campaignId"
                className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]"
                defaultValue={lead.campaigns[0]?.id ?? ""}
              >
                <option value="">Sem campanha</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
              <Button type="submit" variant="accent" size="sm" className="w-full">
                <UserPlus /> Adicionar ao CRM
              </Button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Marca</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Brand profile</h2>
            {brand ? (
              <div className="mt-4 space-y-2.5 text-[10px]">
                <BrandLine label="Status" value={titleCase(brand.identityStatus)} />
                <BrandLine label="Segmento" value={brand.segment} />
                <BrandLine label="Estilo" value={brand.visualStyle} />
                <BrandLine label="Tom" value={brand.tone} />
                <BrandLine label="Tipografia" value={brand.typography} />
                <div className="flex items-center gap-1.5 pt-1">
                  {[brand.primaryColor, brand.secondaryColor, brand.accentColor].filter(Boolean).map((color) => (
                    <span key={color} className="size-4 rounded border border-[var(--line)]" style={{ background: color ?? undefined }} title={color ?? undefined} />
                  ))}
                </div>
              </div>
            ) : brandAssets ? (
              <div className="mt-4 space-y-2.5 text-[10px]">
                <p className="text-[var(--muted)]">Dados pesquisados pelo agente; sujeitos à validação.</p>
                <BrandLine label="Status do logo" value={brandAssets.logoStatus} />
                <BrandLine label="Origem do logo" value={brandAssets.logoSource} />
                <BrandLine label="Estilo" value={brandAssets.visualStyle} />
                <BrandLine label="Cor principal" value={brandAssets.primaryColor} />
                <BrandLine label="Cor secundária" value={brandAssets.secondaryColor} />
                <BrandLine label="Cor de fundo" value={brandAssets.backgroundColor} />
                <BrandLine label="Observações" value={brandAssets.notes} />
              </div>
            ) : (
              <p className="mt-3 text-[10px] text-[var(--muted)]">Nenhum brand profile sugerido ou confirmado.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Execuções</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Tarefas recentes</h2>
            {jobs.length === 0 ? (
              <p className="mt-3 text-[10px] text-[var(--muted)]">Nenhuma tarefa registrada.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {jobs.slice(0, 6).map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-muted)]/50 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[10px]">{JOB_TYPE_LABELS[job.type] ?? job.type}</p>
                      <p className="text-[9px] text-[var(--muted-2)]">{relativeTime(job.createdAt)}</p>
                    </div>
                    <Badge variant={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">CRM</p>
            <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Contatos e histórico</h2>
            {contacts.length === 0 ? (
              <p className="mt-3 text-[10px] text-[var(--muted)]">Lead ainda não está no CRM.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="accent">{STAGE_LABELS[contact.stage] ?? contact.stage}</Badge>
                      <span className="text-[9px] text-[var(--muted-2)]">{relativeTime(contact.updatedAt)}</span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--muted)]">{contact.nextAction ?? "Sem próxima ação definida."}</p>
                  </div>
                ))}
                {contactEvents.length > 0 ? (
                  <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                    {contactEvents.slice(0, 5).map((event) => (
                      <p key={event.id} className="text-[9px] text-[var(--muted-2)]">
                        {titleCase(event.type)} · {relativeTime(event.createdAt)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {activity.length > 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">Auditoria</p>
              <h2 className="mt-0.5 text-sm font-semibold tracking-tight">Histórico</h2>
              <div className="mt-3 space-y-2">
                {activity.slice(0, 8).map((item) => (
                  <div key={item.id}>
                    <p className="text-[10px] text-[var(--ink)]">{item.summary}</p>
                    <p className="text-[9px] text-[var(--muted-2)]">{titleCase(item.action)} · {relativeTime(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContactLine({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string | null; href?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--muted-2)]" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{label}</p>
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-[var(--ink)] hover:underline">
              <span className="truncate">{value}</span> <ExternalLink className="size-2.5 shrink-0" />
            </a>
          ) : (
            <p className="mt-0.5 truncate text-[11px] text-[var(--ink)]">{value}</p>
          )
        ) : (
          <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">—</p>
        )}
      </div>
    </div>
  );
}

function JsonPanel({ title, data, icon: Icon, empty }: { title: string; data: unknown; icon: typeof BrainCircuit; empty: string }) {
  const text = toPrettyJson(data);
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-[var(--muted-2)]" />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {text === "—" ? (
        <p className="mt-2 text-[10px] text-[var(--muted)]">{empty}</p>
      ) : (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)]/60 p-3 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
          {text}
        </pre>
      )}
    </div>
  );
}

function BrandLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right text-[var(--ink)]">{value || "—"}</span>
    </div>
  );
}

function JobButton({ leadId, type, label, icon: Icon }: { leadId: string; type: string; label: string; icon: typeof Search }) {
  return (
    <form action={enqueueLeadJobAction.bind(null, leadId, type)}>
      <Button type="submit" variant="outline" size="sm" className="w-full justify-start">
        <Icon /> {label}
      </Button>
    </form>
  );
}
