import { describe, expect, it } from "vitest";
import { canApproachLead, nextOutreachStage, prepareOutreachMessage } from "@/lib/outreach";

describe("Central de Contato", () => {
  it("produz uma sugestao personalizada sem inventar contato nem mandar links", () => {
    const msg = prepareOutreachMessage("Nei Cabelereiro", "São Paulo", true);
    expect(msg).toContain("Nei Cabelereiro");
    expect(msg).toContain("São Paulo");
    expect(msg).toContain("demonstração independente");
    expect(msg).toContain("Posso te mostrar");
    expect(msg).not.toMatch(/https?:\/\//);
  });

  it("diferencia lead com LP e sem LP", () => {
    expect(prepareOutreachMessage("Empresa X", null, false)).not.toContain("preparei uma ideia");
    expect(prepareOutreachMessage(null, null, true)).toContain("a empresa");
  });

  it("bloqueia abordagem em LP nao aprovada", () => {
    expect(canApproachLead("6", "draft")).toBe(false);
    expect(canApproachLead("6", null)).toBe(false);
    expect(canApproachLead("6", "archived")).toBe(false);
    expect(canApproachLead("6", "approved")).toBe(true);
    expect(canApproachLead("6", "published")).toBe(true);
    expect(canApproachLead(null, null)).toBe(true);
  });

  it("registra contato e resposta sem regressao de negociacao ou venda", () => {
    expect(nextOutreachStage("pronto_para_contato", "contato")).toBe("contatado");
    expect(nextOutreachStage("contatado", "resposta")).toBe("respondeu");
    expect(nextOutreachStage("respondeu", "contato")).toBe("respondeu");
    expect(nextOutreachStage("em_negociacao", "resposta")).toBe("em_negociacao");
    expect(nextOutreachStage("fechado", "contato")).toBe("fechado");
  });
});
