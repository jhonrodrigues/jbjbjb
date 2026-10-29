import { describe, expect, it } from "vitest";
import { validateCommercialAiOutput } from "@/lib/commercial-ai";

describe("Assistente IA comercial", () => {
  it("aceita apenas abordagem sem links e de tamanho seguro", () => {
    const msg = "Olá! Sou da JB Agent. Conheci o seu negócio e preparei uma ideia independente. Posso mostrar como ficou?";
    expect(validateCommercialAiOutput("outreach", { message: msg })).toEqual({ kind: "outreach", message: msg });
    expect(validateCommercialAiOutput("outreach", { message: "Confira https://exemplo.com" })).toBeNull();
    expect(validateCommercialAiOutput("outreach", { message: "oi" })).toBeNull();
  });

  it("aceita somente titulo, escopo e prazo, sem preços automaticos", () => {
    const scope = "Landing page responsiva com navegação, informações a validar, CTA e revisão final.";
    expect(validateCommercialAiOutput("proposal", {
      title: "Site institucional profissional",
      scope, deliveryDays: 15, price: 99999,
    })).toEqual({
      kind: "proposal", title: "Site institucional profissional", scope, deliveryDays: 15,
    });
    expect(validateCommercialAiOutput("proposal", {
      title: "Site institucional", scope, deliveryDays: 120,
    })).toBeNull();
    expect(validateCommercialAiOutput("proposal", {
      title: "Site institucional", scope, deliveryDays: "15",
    })).toBeNull();
  });

  it("rejeita objetos incompletos ou formatos inesperados", () => {
    expect(validateCommercialAiOutput("outreach", null)).toBeNull();
    expect(validateCommercialAiOutput("proposal", [] )).toBeNull();
    expect(validateCommercialAiOutput("proposal", { scope: "texto" })).toBeNull();
  });
});
