import { describe, expect, it } from "vitest";
import { centsToPrice, DELIVERY_TASKS, deriveDealState, priceToCents, proposalText, type DealEvent } from "@/lib/deals";
import { operationPhase } from "@/lib/operations";

const p = "11111111-1111-4111-8111-111111111111";
function ev(type: string, metadata: Record<string, unknown> = {}, notes: string | null = null, idx = 1): DealEvent {
  return { id: String(idx), type, metadata: { proposal_id: p, ...metadata }, notes,
    createdAt: new Date(2026, 1, 1, 12, 0, idx) };
}
const draft = ev("proposta_rascunho", { title: "Site institucional", price: "1500.00", monthly: "99.00", delivery_days: 20 },
  "Landing page completa e personalizada para a empresa", 1);
const sent = ev("proposta_enviada", { channel: "email" }, null, 2);
const accepted = ev("aceite_recebido", {}, "Cliente aceitou em ligação", 3);
const paid = ev("pagamento_confirmado", { amount: "1500.00" }, "Recibo verificado", 4);

describe("propostas e entregas", () => {
  it("valida valores exatos em centavos sem arredondamentos", () => {
    expect(priceToCents("1500.00")).toBe(150000);
    expect(priceToCents("1500,5")).toBe(150050);
    expect(priceToCents("0.00")).toBe(0);
    expect(priceToCents("10.123")).toBeNull();
    expect(priceToCents("-10")).toBeNull();
    expect(priceToCents("1e4")).toBeNull();
    expect(centsToPrice(150050)).toBe("1500.50");
  });

  it("exige sequencia de rascunho, envio, aceite e pagamento", () => {
    expect(deriveDealState([draft]).status).toBe("draft");
    expect(deriveDealState([sent, draft]).status).toBe("sent");
    expect(deriveDealState([accepted, sent, draft]).status).toBe("accepted");
    expect(deriveDealState([paid, accepted, sent, draft]).status).toBe("paid");
    expect(deriveDealState([paid, draft]).status).toBe("draft");
    expect(deriveDealState([]).status).toBe("none");
  });

  it("isola versoes anteriores de proposta por proposal_id", () => {
    const old = ev("proposta_enviada", { proposal_id: "old" }, null, 4);
    const fresh = ev("proposta_rascunho", { proposal_id: "new", title: "Novo projeto", price: "2000.00" },
      "Outro escopo.", 5);
    const state = deriveDealState([fresh, old, sent, draft]);
    expect(state.status).toBe("draft");
    expect(state.proposal?.id).toBe("new");
  });

  it("so conclui entrega quando todas as tarefas estao marcadas", () => {
    const steps = DELIVERY_TASKS.map((t,i) => ev("entrega_item_concluido", {task_key: t.key}, "feito", i+5));
    const completed = ev("entrega_concluida", {}, "Entrega confirmada", 20);
    expect(deriveDealState([completed, ...steps.slice(0,-1).reverse(),paid,accepted,sent,draft]).deliveryFinished).toBe(false);
    const state = deriveDealState([completed,...steps.reverse(),paid,accepted,sent,draft]);
    expect(state.completedTasks.length).toBe(DELIVERY_TASKS.length);
    expect(state.deliveryFinished).toBe(true);
  });

  it("mostra pagamento e entrega na coluna certa sem contar duas vendas", () => {
    expect(operationPhase("fechado","approved",false,false)).toBe("venda");
    expect(operationPhase("fechado","approved",true,false)).toBe("entrega");
    expect(operationPhase("fechado","approved",true,true)).toBe("entregue");
  });

  it("a proposta apresentada menciona prazo e valores, sem envio real", () => {
    const state = deriveDealState([draft]);
    expect(proposalText(state.proposal!, "Empresa Exemplo")).toContain("Empresa Exemplo");
    expect(proposalText(state.proposal!, "Empresa Exemplo")).toContain("20 dias");
    expect(proposalText(state.proposal!, "Empresa Exemplo")).toContain("1.500,00");
  });
});
