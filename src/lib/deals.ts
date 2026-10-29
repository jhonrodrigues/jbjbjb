export const DELIVERY_TASKS = [
  { key: "dados_cliente", label: "Receber dados e materiais do cliente" },
  { key: "personalizacao", label: "Personalizar textos, imagens e contatos" },
  { key: "dominio", label: "Configurar domínio e DNS" },
  { key: "hospedagem", label: "Preparar hospedagem e HTTPS" },
  { key: "revisao_cliente", label: "Obter revisão e aprovação final do cliente" },
  { key: "autorizacao_publicacao", label: "Registrar autorização de publicação" },
  { key: "publicacao", label: "Verificar publicação e testes de funcionamento" },
  { key: "entrega", label: "Entregar acessos, documentação e orientações" },
] as const;

export type DeliveryTaskKey = (typeof DELIVERY_TASKS)[number]["key"];
export type DealStatus = "none" | "draft" | "sent" | "accepted" | "paid";

export type DealEvent = {
  id: string;
  type: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date | string;
};

export type Proposal = {
  id: string;
  title: string;
  scope: string;
  price: string;
  monthly: string;
  deliveryDays: number;
};

export type DealState = {
  proposal: Proposal | null;
  status: DealStatus;
  completedTasks: DeliveryTaskKey[];
  deliveryFinished: boolean;
};

export function priceToCents(value: string): number | null {
  const clean = value.trim();
  if (!/^(?:0|[1-9][0-9]{0,8})(?:[,.][0-9]{1,2})?$/.test(clean)) return null;
  const [whole, decimals = ""] = clean.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function deriveDealState(events: DealEvent[]): DealState {
  let current: Proposal | null = null;
  let status: DealStatus = "none";
  let finished = false;
  const completed = new Set<DeliveryTaskKey>();
  // Eventos chegam em ordem decrescente pela consulta do CRM.
  for (const event of [...events].reverse()) {
    const m = event.metadata ?? {};
    if (event.type === "proposta_rascunho") {
      const id = typeof m.proposal_id === "string" ? m.proposal_id : "";
      if (!id) continue;
      current = {
        id,
        title: String(m.title ?? ""),
        scope: event.notes ?? "",
        price: String(m.price ?? ""),
        monthly: String(m.monthly ?? "0.00"),
        deliveryDays: Number(m.delivery_days ?? 0),
      };
      status = "draft";
      finished = false;
      completed.clear();
      continue;
    }
    if (!current || m.proposal_id !== current.id) continue;
    if (event.type === "proposta_enviada" && status === "draft") status = "sent";
    if (event.type === "aceite_recebido" && status === "sent") status = "accepted";
    if (event.type === "pagamento_confirmado" && status === "accepted") status = "paid";
    if (event.type === "entrega_item_concluido" && status === "paid") {
      const key = m.task_key;
      if (DELIVERY_TASKS.some(task => task.key === key)) completed.add(key as DeliveryTaskKey);
    }
    if (event.type === "entrega_concluida" && status === "paid" && completed.size === DELIVERY_TASKS.length) {
      finished = true;
    }
  }
  return { proposal: current, status, completedTasks: [...completed], deliveryFinished: finished };
}

export function dealStatusLabel(status: DealStatus): string {
  return ({ none: "Sem proposta", draft: "Rascunho", sent: "Enviada", accepted: "Aceite registrado", paid: "Pagamento confirmado" })[status];
}

export function proposalText(proposal: Proposal, business: string): string {
  return [
    "PROPOSTA COMERCIAL — JB AGENT",
    "",
    `Para: ${business}`,
    `Projeto: ${proposal.title}`,
    "",
    "ESCOPO",
    proposal.scope,
    "",
    `Implantação: R$ ${Number(proposal.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `Mensalidade: R$ ${Number(proposal.monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `Prazo previsto: ${proposal.deliveryDays} dias após recebimento dos materiais e início acordado.`,
    "",
    "Esta é uma proposta para revisão. Condições de pagamento, responsabilidade por domínio/hospedagem",
    "e eventuais serviços externos devem ser formalizadas antes do aceite.",
    "Publicação somente após aprovação expressa do cliente.",
  ].join("\n");
}
