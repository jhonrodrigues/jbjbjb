"use client";

import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import type { CommercialAiResult } from "@/lib/commercial-ai";
import type { Proposal } from "@/lib/deals";
import { Button } from "@/components/ui/button";

const FIELD = "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]";
const LABEL = "block space-y-1 text-[10px] font-semibold text-[var(--ink)]";

export function ProposalDraftForm({
  initial, aiConfigured, aiAction, saveAction,
}: {
  initial: Proposal | null;
  aiConfigured: boolean;
  aiAction: () => Promise<CommercialAiResult>;
  saveAction: (form: FormData) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "Site institucional profissional");
  const [scope, setScope] = useState(initial?.scope ??
    "Criação e personalização de landing page responsiva, com informações, serviços, canais de contato e revisão antes da publicação.");
  const [days, setDays] = useState(initial?.deliveryDays || 15);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setAiError(null);
    try {
      const result = await aiAction();
      if (result.ok && result.suggestion.kind === "proposal") {
        setTitle(result.suggestion.title);
        setScope(result.suggestion.scope);
        setDays(result.suggestion.deliveryDays);
      } else {
        setAiError(result.ok ? "A IA retornou um formato inesperado." : result.error);
      }
    } catch {
      setAiError("Falha ao preparar a proposta com IA.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <form action={saveAction} className="space-y-3">
      <Button type="button" variant="outline" size="sm" disabled={!aiConfigured || generating}
        onClick={generate} className="w-full">
        <Sparkles /> {generating ? "Gerando proposta..." : "Sugerir escopo com IA"}
      </Button>
      {!aiConfigured ? <p className="text-[10px] text-[var(--muted-2)]">Configure OPENAI_API_KEY no EasyPanel para habilitar a IA.</p> : null}
      {aiError ? <p className="text-[10px] text-[var(--danger)]">{aiError}</p> : null}
      <label className={LABEL}>Nome do projeto
        <input name="title" required minLength={5} maxLength={120} value={title}
          onChange={event => setTitle(event.target.value)} className={FIELD} />
      </label>
      <label className={LABEL}>Escopo e entregáveis
        <textarea name="scope" required minLength={30} maxLength={6000} rows={6} value={scope}
          onChange={event => setScope(event.target.value)} className={FIELD} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={LABEL}>Implantação (R$)
          <input name="price" required inputMode="decimal" defaultValue={initial?.price ?? ""}
            placeholder="1200.00" className={FIELD}/>
        </label>
        <label className={LABEL}>Mensalidade (R$)
          <input name="monthly" required inputMode="decimal" defaultValue={initial?.monthly ?? "0.00"}
            className={FIELD}/>
        </label>
      </div>
      <label className={LABEL}>Prazo em dias
        <input type="number" name="deliveryDays" min={1} max={365} required value={days}
          onChange={event => setDays(Number(event.target.value))} className={FIELD}/>
      </label>
      <p className="text-[10px] text-[var(--muted)]">A IA sugere escopo e prazo; os preços continuam sob sua responsabilidade. Revise antes de salvar.</p>
      <Button type="submit" variant="outline" size="sm" className="w-full"><FileText/> Salvar rascunho da proposta</Button>
    </form>
  );
}
