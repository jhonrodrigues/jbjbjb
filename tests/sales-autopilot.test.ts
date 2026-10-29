import { describe, expect, it } from "vitest";
import { isOptOut, validateSalesDecision, canAutoReply } from "@/lib/sales-policy";

const now = new Date("2026-10-29T18:00:00.000Z");
const base = {
  workerEnabled: true,paused: false,mode: "ai" as const,
  optedOut: false,lastInboundAt: new Date("2026-10-29T17:30:00.000Z"),now,
};

describe("Motor Comercial — guardrails", () => {
  it("prioriza pedidos para parar, independentemente da IA", () => {
    expect(isOptOut("Pare de me mandar mensagens, por favor")).toBe(true);
    expect(isOptOut("Não me contate")).toBe(true);
    expect(isOptOut("STOP")).toBe(true);
    expect(isOptOut("Pode me mostrar a proposta?")).toBe(false);
  });
  it("nunca responde automaticamente sem habilitação, janela ou autorização", () => {
    expect(canAutoReply(base)).toBe(true);
    expect(canAutoReply({...base, paused: true})).toBe(false);
    expect(canAutoReply({...base, workerEnabled: false})).toBe(false);
    expect(canAutoReply({...base, mode: "human"})).toBe(false);
    expect(canAutoReply({...base, optedOut: true})).toBe(false);
    expect(canAutoReply({...base, lastInboundAt: null})).toBe(false);
    expect(canAutoReply({...base, lastInboundAt: new Date("2026-10-27T12:00:00Z")})).toBe(false);
    expect(canAutoReply({...base, lastInboundAt: new Date("2026-11-01T12:00:00Z")})).toBe(false);
  });
  it("valida saída estruturada, limite e proibição de links não autorizados", () => {
    expect(validateSalesDecision({reply:"Olá! Sou o assistente virtual da JB Agent.",handoff:false,optOut:false}))
      .toEqual({reply:"Olá! Sou o assistente virtual da JB Agent.",handoff:false,optOut:false});
    expect(validateSalesDecision({reply:"Confira https://example.com",handoff:false,optOut:false})).toBeNull();
    expect(validateSalesDecision({reply:"",handoff:false,optOut:false})).toBeNull();
    expect(validateSalesDecision({reply:"",handoff:false,optOut:true})).toEqual({reply:"",handoff:false,optOut:true});
    expect(validateSalesDecision({reply:123,handoff:false,optOut:false})).toBeNull();
  });
});
