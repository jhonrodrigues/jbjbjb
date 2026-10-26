"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveSettingsAction } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_ACTION_STATE } from "@/lib/forms";
import type { PlatformSettings } from "@/lib/settings";
import { LP_TEMPLATES } from "@/lib/lp-templates";

const SELECT =
  "flex h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, EMPTY_ACTION_STATE);

  return (
    <form action={action} className="space-y-4">
      <Card id="scoring" title="Qualificação" description="Limiares usados para derivar prioridade quando não há override manual.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Score para prioridade alta" htmlFor="highThreshold">
            <Input id="highThreshold" name="highThreshold" type="number" min={1} max={100} defaultValue={settings.scoring.highThreshold} />
          </Field>
          <Field label="Score para prioridade média" htmlFor="mediumThreshold">
            <Input id="mediumThreshold" name="mediumThreshold" type="number" min={0} max={99} defaultValue={settings.scoring.mediumThreshold} />
          </Field>
          <Field label="Valores de oportunidade" htmlFor="opportunityValues" className="sm:col-span-2">
            <Input
              id="opportunityValues"
              name="opportunityValues"
              defaultValue={settings.scoring.opportunityValues.join(", ")}
              placeholder="sim, true, qualificado, quente"
            />
          </Field>
        </div>
      </Card>

      <Card id="limits" title="Limites operacionais" description="Quotas de novos jobs admitidos por dia. Retries não entram na quota; valores monetários são informativos.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Novos jobs por dia" htmlFor="maxJobsPerDay">
            <Input id="maxJobsPerDay" name="maxJobsPerDay" type="number" min={1} defaultValue={settings.limits.maxJobsPerDay} />
          </Field>
          <Field label="Novos jobs de LP por dia" htmlFor="maxLpGenerationsPerDay">
            <Input id="maxLpGenerationsPerDay" name="maxLpGenerationsPerDay" type="number" min={0} defaultValue={settings.limits.maxLpGenerationsPerDay} />
          </Field>
          <Field label="Custo estimado por LP" htmlFor="estimatedLpCost">
            <Input id="estimatedLpCost" name="estimatedLpCost" type="number" step="0.01" min={0} defaultValue={settings.limits.estimatedLpCost} />
          </Field>
          <Field label="Orçamento mensal (informativo, não bloqueia gastos)" htmlFor="monthlyBudget">
            <Input id="monthlyBudget" name="monthlyBudget" type="number" step="0.01" min={0} defaultValue={settings.limits.monthlyBudget} />
          </Field>
        </div>
      </Card>

      <Card id="lp" title="Padrões de landing page" description="Usados quando o brand profile não define cores ou tipografia.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template padrão" htmlFor="template">
            <select id="template" name="template" defaultValue={settings.lpDefaults.template} className={SELECT}>
              {LP_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipografia" htmlFor="typography">
            <Input id="typography" name="typography" defaultValue={settings.lpDefaults.typography} />
          </Field>
          <Field label="Cor primária" htmlFor="primaryColor">
            <div className="flex gap-2">
              <Input id="primaryColor" name="primaryColor" defaultValue={settings.lpDefaults.primaryColor} />
              <input type="color" defaultValue={settings.lpDefaults.primaryColor} className="h-9 w-10 rounded border border-[var(--line)] bg-transparent" aria-label="Selecionar cor primária" />
            </div>
          </Field>
          <Field label="Cor secundária" htmlFor="secondaryColor">
            <div className="flex gap-2">
              <Input id="secondaryColor" name="secondaryColor" defaultValue={settings.lpDefaults.secondaryColor} />
              <input type="color" defaultValue={settings.lpDefaults.secondaryColor} className="h-9 w-10 rounded border border-[var(--line)] bg-transparent" aria-label="Selecionar cor secundária" />
            </div>
          </Field>
          <Field label="Cor de destaque" htmlFor="accentColor">
            <div className="flex gap-2">
              <Input id="accentColor" name="accentColor" defaultValue={settings.lpDefaults.accentColor} />
              <input type="color" defaultValue={settings.lpDefaults.accentColor} className="h-9 w-10 rounded border border-[var(--line)] bg-transparent" aria-label="Selecionar cor de destaque" />
            </div>
          </Field>
        </div>
      </Card>

      <Card id="ai" title="Inteligência artificial" description="Provedor compatível com OpenAI usado pelos agentes. A chave permanece apenas no ambiente.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provedor" htmlFor="aiProvider">
            <Input id="aiProvider" name="aiProvider" defaultValue={settings.ai.provider} />
          </Field>
          <Field label="Modelo" htmlFor="aiModel">
            <Input id="aiModel" name="aiModel" defaultValue={settings.ai.model} placeholder="Ex.: gpt-5-mini" />
          </Field>
        </div>
        <p className="mt-3 rounded-lg bg-[var(--surface-muted)]/60 px-3 py-2 text-[10px] text-[var(--muted)]">
          Status atual: {settings.ai.configured ? "credencial configurada" : "credencial não configurada"}. O painel não expõe chaves de API.
        </p>
      </Card>

      {state.error ? <p className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">{state.success}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar configurações
        </Button>
      </div>
    </form>
  );
}

function Card({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
