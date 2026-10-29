import { describe, expect, it } from "vitest";
import { operationPhase } from "@/lib/operations";
import { nextCrmStageAfterLpReview } from "@/lib/lp-status";

describe("pipeline entre demonstracao e CRM", () => {
  it("nao libera contato para demonstracao sem aprovacao", () => {
    expect(operationPhase("aguardando_aprovacao", "draft")).toBe("revisao");
    expect(operationPhase("pronto_para_contato", "draft")).toBe("revisao");
    expect(operationPhase("qualificado", null)).toBe("preparacao");
  });

  it("somente aprova para contato apos revisao humana", () => {
    expect(nextCrmStageAfterLpReview("aguardando_aprovacao", "approved")).toBe("pronto_para_contato");
    expect(nextCrmStageAfterLpReview("qualificado", "approved")).toBe("pronto_para_contato");
    expect(operationPhase("pronto_para_contato", "approved")).toBe("abordagem");
  });

  it("nao retrocede negocios ja contatados, em negociacao ou fechados", () => {
    for (const stage of ["contatado", "respondeu", "em_negociacao", "proposta_enviada", "fechado"]) {
      expect(nextCrmStageAfterLpReview(stage, "draft")).toBeNull();
      expect(nextCrmStageAfterLpReview(stage, "approved")).toBeNull();
    }
    expect(operationPhase("fechado", "draft")).toBe("venda");
    expect(operationPhase("em_negociacao", "draft")).toBe("negociacao");
  });

  it("permite devolver uma LP aprovada para revisao antes de contatar", () => {
    expect(nextCrmStageAfterLpReview("pronto_para_contato", "draft")).toBe("aguardando_aprovacao");
    expect(operationPhase("aguardando_aprovacao", "draft")).toBe("revisao");
  });
});
