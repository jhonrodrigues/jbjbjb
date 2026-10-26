"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveWebhookSettingsAction } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_ACTION_STATE } from "@/lib/forms";
import type { WebhookSettingsSummary } from "@/lib/n8n-webhook";

export function WebhookSettingsForm({ settings }: { settings: WebhookSettingsSummary }) {
  const [state, action, pending] = useActionState(saveWebhookSettingsAction, EMPTY_ACTION_STATE);
  return (
    <section id="n8n" className="scroll-mt-20 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold tracking-tight">Execução imediata via n8n</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
        Ao executar uma campanha, o painel enfileira a tarefa e envia um sinal POST ao webhook.
        O Schedule de 5 minutos continua como fallback; o worker busca a pendência mais antiga, não necessariamente a campanha clicada.
      </p>
      <form action={action} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="webhookUrl">URL completa do webhook de produção</Label>
          <Input id="webhookUrl" name="url" type="url" maxLength={2048} defaultValue={settings.url} placeholder="https://n8n.seudominio.com/webhook/jb-agent-executar" aria-describedby="webhookUrlHelp" />
          <p id="webhookUrlHelp" className="text-[10px] leading-relaxed text-[var(--muted)]">
            Use destino confiável e HTTPS fora da rede privada. Sem credenciais ou parâmetros na URL. URL vazia desativa o sinal; não altera o Schedule.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="webhookHeader">Nome do cabeçalho Header Auth</Label>
            <Input id="webhookHeader" name="headerName" maxLength={128} required defaultValue={settings.headerName} placeholder="X-JB-Webhook-Secret" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhookSecret">Novo segredo do cabeçalho</Label>
            <Input id="webhookSecret" name="secret" type="password" minLength={16} maxLength={4096} autoComplete="new-password" aria-describedby="webhookSecretHelp" />
            <p id="webhookSecretHelp" className="text-[10px] leading-relaxed text-[var(--muted)]">
              Segredo {settings.secretConfigured ? "configurado" : "não configurado"}. Deixe vazio para preservar. Armazenado criptografado; nunca exibido novamente.
            </p>
          </div>
        </div>
        <label className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--muted)]">
          <input name="clearSecret" type="checkbox" className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]" />
          Remover explicitamente o segredo salvo e desativar o sinal até configurar outro. Não preencha novo segredo ao remover.
        </label>
        {state.error ? <p role="alert" className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">{state.error}</p> : null}
        {state.success ? <p role="status" className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">{state.success}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar webhook
          </Button>
        </div>
      </form>
    </section>
  );
}
