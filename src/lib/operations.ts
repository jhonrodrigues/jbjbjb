import { getPool, hasDatabaseUrl } from "@/db/client";
import { hasColumn, loadLegacySchema } from "./legacy-schema";

export type OperationPhase = "preparacao" | "revisao" | "abordagem" | "conversa" | "negociacao" | "venda" | "entrega" | "entregue" | "perdido";

export type OperationEntry = {
  contactId: string;
  leadId: string;
  businessName: string;
  segment: string | null;
  city: string | null;
  stage: string;
  lpId: string | null;
  lpVersion: number | null;
  lpStatus: string | null;
  nextAction: string | null;
  updatedAt: Date;
  phase: OperationPhase;
  paid: boolean;
  delivered: boolean;
};

export const OPERATION_PHASES: { id: OperationPhase; title: string; description: string }[] = [
  { id: "preparacao", title: "Preparação", description: "Lead identificado; falta a demonstração" },
  { id: "revisao", title: "Revisão da LP", description: "Aprovação humana antes do contato" },
  { id: "abordagem", title: "Pronto para contato", description: "Demonstração aprovada; preparar abordagem" },
  { id: "conversa", title: "Em conversa", description: "Contato registrado e respostas" },
  { id: "negociacao", title: "Negociação", description: "Propostas e acompanhamento" },
  { id: "venda", title: "Venda fechada", description: "Venda registrada sem checklist iniciado" },
  { id: "entrega", title: "Em entrega", description: "Pagamento confirmado e tarefas pendentes" },
  { id: "entregue", title: "Entregues", description: "Checklist de entrega concluído" },
  { id: "perdido", title: "Perdido", description: "Oportunidades encerradas" },
];

export function operationPhase(stage: string, lpStatus: string | null, paid = false, delivered = false): OperationPhase {
  if (stage === "perdido") return "perdido";
  if (stage === "fechado") return delivered ? "entregue" : paid ? "entrega" : "venda";
  if (stage === "em_negociacao" || stage === "proposta_enviada") return "negociacao";
  if (stage === "contatado" || stage === "respondeu") return "conversa";
  if (!lpStatus) return "preparacao";
  if (stage === "aguardando_aprovacao" || lpStatus === "draft" || lpStatus === "archived") return "revisao";
  if (stage === "pronto_para_contato" || lpStatus === "approved" || lpStatus === "published") return "abordagem";
  return "revisao";
}

export async function getOperationPipeline(): Promise<OperationEntry[]> {
  if (!hasDatabaseUrl()) return [];
  // Uma oportunidade por contato, sem inferir empresas/receita. Os dados
  // vem das tabelas legadas e das versoes de LP persistidas pelo n8n.
  const schema = await loadLegacySchema();
  const hasLeadJoin = schema.leads.exists && hasColumn(schema.leads, "id");
  const pick = (field: string) => hasLeadJoin && hasColumn(schema.leads, field)
    ? `l."${field}"::text AS ${field}`
    : `null::text AS ${field}`;
  const leadJoin = hasLeadJoin ? `LEFT JOIN jb_agent_leads l ON l."id"::text = c.lead_id` : "";
  const { rows } = await getPool().query<{
    contact_id: string;
    lead_id: string;
    empresa: string | null;
    nicho: string | null;
    cidade: string | null;
    stage: string;
    lp_id: string | null;
    lp_version: number | null;
    lp_status: string | null;
    next_action: string | null;
    updated_at: Date;
    paid: boolean;
    delivered: boolean;
  }>(`
    SELECT
      c.id::text AS contact_id,
      c.lead_id::text AS lead_id,
      ${pick("empresa")},
      ${pick("nicho")},
      ${pick("cidade")},
      c.stage,
      COALESCE(v.lp_id, c.lp_id)::text AS lp_id,
      v.version AS lp_version,
      v.status AS lp_status,
      c.next_action,
      EXISTS (SELECT 1 FROM jb_agent_contact_events e WHERE e.contact_id=c.id AND e.type='pagamento_confirmado') AS paid,
      EXISTS (SELECT 1 FROM jb_agent_contact_events e WHERE e.contact_id=c.id AND e.type='entrega_concluida') AS delivered,
      c.updated_at
    FROM jb_agent_contacts c
    ${leadJoin}
    LEFT JOIN LATERAL (
      SELECT lp_id, version, status
      FROM jb_agent_lp_versions
      WHERE lead_id = c.lead_id
      ORDER BY created_at DESC, version DESC
      LIMIT 1
    ) v ON TRUE
    ORDER BY c.updated_at DESC, c.id DESC
    LIMIT 500
  `);
  return rows.map(row => ({
    contactId: row.contact_id,
    leadId: row.lead_id,
    businessName: row.empresa?.trim() || `Lead ${row.lead_id}`,
    segment: row.nicho,
    city: row.cidade,
    stage: row.stage,
    lpId: row.lp_id,
    lpVersion: row.lp_version,
    lpStatus: row.lp_status,
    nextAction: row.next_action,
    updatedAt: row.updated_at,
    paid: row.paid,
    delivered: row.delivered,
    phase: operationPhase(row.stage, row.lp_status, row.paid, row.delivered),
  }));
}
