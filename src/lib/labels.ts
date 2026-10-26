import type { CampaignStatus, CrmStage, JobStatus, JobType, LpStatus } from "@/db/schema";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, "default" | "success" | "warning" | "outline"> = {
  draft: "outline",
  active: "success",
  paused: "warning",
  archived: "default",
};

export const LP_STATUS_LABELS: Record<LpStatus, string> = {
  draft: "Rascunho",
  approved: "Aprovada",
  published: "Publicada",
  archived: "Arquivada",
};

export const LP_STATUS_TONE: Record<LpStatus, "default" | "accent" | "success" | "warning" | "outline"> = {
  draft: "outline",
  approved: "accent",
  published: "success",
  archived: "default",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Na fila",
  processing: "Em execução",
  completed: "Concluída",
  failed: "Com erro",
  cancelled: "Cancelada",
};

export const JOB_STATUS_TONE: Record<JobStatus, "default" | "accent" | "success" | "danger" | "outline"> = {
  pending: "outline",
  processing: "accent",
  completed: "success",
  failed: "danger",
  cancelled: "default",
};

export const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  nao_avaliada: "Não avaliada",
};

export const PRIORITY_TONE: Record<string, "danger" | "warning" | "default" | "outline"> = {
  alta: "danger",
  media: "warning",
  baixa: "default",
  nao_avaliada: "outline",
};

export const STAGE_LABELS: Record<CrmStage, string> = {
  identificado: "Identificado",
  qualificado: "Qualificado",
  demonstracao_preparada: "Demonstração preparada",
  aguardando_aprovacao: "Aguardando aprovação",
  pronto_para_contato: "Pronto para contato",
  contatado: "Contatado",
  respondeu: "Respondeu",
  em_negociacao: "Em negociação",
  proposta_enviada: "Proposta enviada",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const CRM_STAGE_COLUMNS: CrmStage[] = [
  "identificado",
  "qualificado",
  "demonstracao_preparada",
  "aguardando_aprovacao",
  "pronto_para_contato",
  "contatado",
  "respondeu",
  "em_negociacao",
  "proposta_enviada",
  "fechado",
  "perdido",
];

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  prospect_campaign: "Prospectar campanha",
  analyze_lead: "Analisar lead",
  research_brand: "Pesquisar marca",
  generate_lp: "Gerar landing page",
  regenerate_lp: "Regenerar landing page",
  publish_lp: "Publicar landing page",
  prepare_outreach: "Preparar abordagem",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  manual: "Manual",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

export function labelFor(map: Record<string, string>, key: string | null | undefined, fallback = "—"): string {
  if (!key) return fallback;
  return map[key] ?? key;
}
