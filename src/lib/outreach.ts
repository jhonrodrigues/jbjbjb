export type OutreachChannel = "instagram" | "email" | "whatsapp" | "telefone" | "outro";

export const OUTREACH_CHANNELS: { value: OutreachChannel; label: string }[] = [
  { value: "instagram", label: "Instagram (manual)" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp (com consentimento)" },
  { value: "telefone", label: "Telefone" },
  { value: "outro", label: "Outro canal" },
];

export function prepareOutreachMessage(
  name: string | null | undefined,
  city: string | null | undefined,
  hasDemonstration: boolean,
): string {
  const business = name?.trim().slice(0, 120) || "a empresa";
  const location = city?.trim().slice(0, 100);
  const where = location ? ` em ${location}` : "";
  if (hasDemonstration) {
    return `Olá, tudo bem?

Sou da JB Agent e trabalho com soluções digitais para negócios locais.

Conheci a ${business}${where} e preparei uma ideia de como o negócio poderia ser apresentado em um site.

É apenas uma demonstração independente, sem compromisso.

Posso te mostrar como ficou?`;
  }
  return `Olá, tudo bem?

Sou da JB Agent e trabalho com sites para negócios locais.

Conheci a ${business}${where} e gostaria de saber se faz sentido conversar sobre uma presença digital para o negócio.

Posso te explicar a ideia rapidamente?`;
}

export function nextOutreachStage(
  current: string,
  interaction: "contato" | "resposta",
): string {
  if (interaction === "contato") {
    return ["identificado", "qualificado", "demonstracao_preparada", "aguardando_aprovacao", "pronto_para_contato"].includes(current)
      ? "contatado" : current;
  }
  return ["identificado", "qualificado", "demonstracao_preparada", "aguardando_aprovacao", "pronto_para_contato", "contatado"].includes(current)
    ? "respondeu" : current;
}
