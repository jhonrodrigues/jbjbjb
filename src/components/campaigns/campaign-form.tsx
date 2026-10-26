"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveCampaignAction } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_ACTION_STATE } from "@/lib/forms";
import type { campaigns } from "@/db/schema";
import { cn } from "@/lib/utils";

type Campaign = typeof campaigns.$inferSelect;

const NATIVE_SELECT =
  "flex h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const [state, action, pending] = useActionState(saveCampaignAction, EMPTY_ACTION_STATE);
  const fieldError = (key: string) => state.fieldErrors?.[key]?.[0];

  return (
    <form action={action} className="space-y-5">
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Identificação</h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Nome e contexto usados pelos agentes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da campanha" htmlFor="name" error={fieldError("name")} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={campaign?.name ?? ""} placeholder="Ex.: Clínicas de estética — Campinas" required />
          </Field>
          <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={campaign?.description ?? ""}
              placeholder="Objetivo da campanha, público e observações para o time."
              rows={3}
            />
          </Field>
          <Field label="Nicho" htmlFor="niche" error={fieldError("niche")}>
            <Input id="niche" name="niche" defaultValue={campaign?.niche ?? ""} placeholder="Ex.: clínica de estética" required />
          </Field>
          <Field label="Subnicho" htmlFor="subNiche">
            <Input id="subNiche" name="subNiche" defaultValue={campaign?.subNiche ?? ""} placeholder="Opcional" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Localização</h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Área de busca da prospecção.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="País" htmlFor="country">
            <Input id="country" name="country" defaultValue={campaign?.country ?? "Brasil"} />
          </Field>
          <Field label="Estado" htmlFor="state">
            <Input id="state" name="state" defaultValue={campaign?.state ?? ""} placeholder="SP" />
          </Field>
          <Field label="Cidade" htmlFor="city">
            <Input id="city" name="city" defaultValue={campaign?.city ?? ""} placeholder="Campinas" />
          </Field>
          <Field label="Região/bairro" htmlFor="region">
            <Input id="region" name="region" defaultValue={campaign?.region ?? ""} placeholder="Opcional" />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" htmlFor="latitude">
            <Input id="latitude" name="latitude" type="number" step="0.0000001" defaultValue={campaign?.latitude ?? ""} placeholder="Opcional" />
          </Field>
          <Field label="Longitude" htmlFor="longitude">
            <Input id="longitude" name="longitude" type="number" step="0.0000001" defaultValue={campaign?.longitude ?? ""} placeholder="Opcional" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Execução</h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Limites, frequência e automações permitidas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Máximo de leads" htmlFor="maxLeads" error={fieldError("maxLeads")}>
            <Input id="maxLeads" name="maxLeads" type="number" min={1} max={100000} defaultValue={campaign?.maxLeads ?? 100} />
          </Field>
          <Field label="Máximo por execução" htmlFor="maxPerRun" error={fieldError("maxPerRun")}>
            <Input id="maxPerRun" name="maxPerRun" type="number" min={1} max={1000} defaultValue={campaign?.maxPerRun ?? 25} />
          </Field>
          <Field label="Frequência" htmlFor="frequency">
            <select id="frequency" name="frequency" defaultValue={campaign?.frequency ?? "manual"} className={NATIVE_SELECT}>
              <option value="manual">Manual</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={campaign?.status ?? "draft"} className={NATIVE_SELECT}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativa</option>
              <option value="paused">Pausada</option>
              <option value="archived">Arquivada</option>
            </select>
          </Field>
          <Field label="Fonte de prospecção" htmlFor="prospectSource">
            <Input id="prospectSource" name="prospectSource" defaultValue={campaign?.prospectSource ?? "openstreetmap"} />
          </Field>
          <Field label="Provedor de busca" htmlFor="searchProvider">
            <Input id="searchProvider" name="searchProvider" defaultValue={campaign?.searchProvider ?? "overpass"} />
          </Field>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Toggle name="autoAnalyze" label="Analisar leads automaticamente" description="Enfileira análise após encontrar empresas." defaultChecked={campaign?.autoAnalyze ?? false} />
          <Toggle name="autoLp" label="Gerar LPs automaticamente" description="Cria demonstrações após qualificação." defaultChecked={campaign?.autoLp ?? false} />
          <Toggle name="requireHuman" label="Exigir aprovação humana" description="Pausa antes de publicar ou contatar." defaultChecked={campaign?.requireHuman ?? true} />
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {campaign ? "Salvar alterações" : "Criar campanha"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-[10px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/50 p-3 transition-colors hover:bg-[var(--surface-hover)]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-3.5 rounded border-[var(--line-strong)] accent-[var(--accent)]"
      />
      <span>
        <span className="block text-[11px] font-medium text-[var(--ink)]">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--muted)]">{description}</span>
      </span>
    </label>
  );
}
