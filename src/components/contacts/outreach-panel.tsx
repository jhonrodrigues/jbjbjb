"use client";

import { useState } from "react";
import { Check, ClipboardCopy, MessageSquare, Save, Send } from "lucide-react";
import { OUTREACH_CHANNELS } from "@/lib/outreach";
import { Button } from "@/components/ui/button";

type Props = {
  businessName: string;
  initialMessage: string;
  canContact: boolean;
  hasLp: boolean;
  lpStatus: string | null;
  saveAction: (formData: FormData) => Promise<void>;
  recordContactAction: (formData: FormData) => Promise<void>;
  recordReplyAction: (formData: FormData) => Promise<void>;
};

export function OutreachPanel({
  businessName, initialMessage, canContact, hasLp, lpStatus,
  saveAction, recordContactAction, recordReplyAction,
}: Props) {
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [channel, setChannel] = useState("instagram");

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return (
    <section id="central-contato" className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-[var(--accent-strong)]" />
          <h2 className="text-sm font-semibold">Central de contato</h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
          Prepare a abordagem de {businessName}, revise o texto e registre manualmente cada contato e resposta.
        </p>
      </div>

      {hasLp && !canContact ? (
        <div className="rounded-lg border border-[var(--warning)]/20 bg-[var(--warning-subtle)] px-3 py-2 text-[11px] text-[var(--warning)]">
          Demonstração {lpStatus === "draft" ? "em rascunho" : "ainda não aprovada"}.
          Você pode preparar e salvar o texto, mas o registro de envio ficará bloqueado até a aprovação da LP.
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/40 px-3 py-2 text-[10px] text-[var(--muted)]">
          Comunicação externa não é enviada pelo JB Agent. Envie somente pelo canal adequado,
          respeitando autorização, regras da plataforma e a decisão de não receber mensagens.
        </div>
      )}

      <form action={saveAction} className="space-y-2">
        <label htmlFor="outreach-draft" className="block text-[10px] font-semibold text-[var(--ink)]">
          Mensagem inicial — sugestão editável
        </label>
        <textarea
          id="outreach-draft"
          name="message"
          rows={9}
          maxLength={2200}
          minLength={15}
          required
          value={message}
          onChange={event => { setMessage(event.target.value); setCopied(false); }}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-[11px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" variant="outline"><Save /> Salvar rascunho</Button>
          <Button
            type="button" size="sm" variant="subtle"
            onClick={copyMessage} disabled={!canContact || message.trim().length < 15}
          >
            {copied ? <Check /> : <ClipboardCopy />} {copied ? "Copiado" : "Copiar mensagem"}
          </Button>
          <span className="text-[9px] text-[var(--muted-2)]">Nenhum envio automático</span>
        </div>
        {copyError ? <p className="text-[10px] text-[var(--danger)]">Não foi possível copiar. Selecione o texto manualmente.</p> : null}
      </form>

      <div className="grid gap-4 border-t border-[var(--line)] pt-4 lg:grid-cols-2">
        <form action={recordContactAction} className="space-y-3">
          <div>
            <p className="text-xs font-semibold">Registrar contato realizado</p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">Somente depois de entrar em contato fora do painel.</p>
          </div>
          <label className="block space-y-1 text-[10px] font-medium">
            Canal utilizado
            <select
              name="channel"
              value={channel}
              onChange={event => setChannel(event.target.value)}
              disabled={!canContact}
              className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]"
            >
              {OUTREACH_CHANNELS.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
          </label>
          {channel === "whatsapp" ? (
            <label className="flex items-start gap-2 text-[10px] leading-relaxed text-[var(--muted)]">
              <input type="checkbox" name="consentConfirmed" className="mt-0.5" disabled={!canContact} required />
              Confirmo que existe autorização prévia para contato comercial por WhatsApp.
            </label>
          ) : null}
          <label className="block space-y-1 text-[10px] font-medium">
            Mensagem realmente enviada (opcional)
            <textarea
              name="actualMessage" rows={3} maxLength={2200} disabled={!canContact}
              placeholder="Registre o texto efetivamente enviado, caso seja diferente do rascunho."
              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-[11px]"
            />
          </label>
          <label className="block space-y-1 text-[10px] font-medium">
            Observações (opcional)
            <textarea
              name="notes" rows={2} maxLength={2000} disabled={!canContact}
              placeholder="Ex.: primeiro contato pelo perfil oficial da empresa."
              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-[11px]"
            />
          </label>
          <Button type="submit" variant="outline" size="sm" disabled={!canContact} className="w-full">
            <Send /> Confirmar contato realizado
          </Button>
        </form>
        <form action={recordReplyAction} className="space-y-3">
          <div>
            <p className="text-xs font-semibold">Registrar resposta do lead</p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              Anote a resposta recebida para atualizar a oportunidade e o histórico.
            </p>
          </div>
          <label className="block space-y-1 text-[10px] font-medium">
            O que o lead respondeu?
            <textarea
              name="notes" rows={5} minLength={3} maxLength={4000} required
              placeholder="Ex.: gostou da ideia e pediu para conhecer a demonstração."
              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-[11px]"
            />
          </label>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            <MessageSquare /> Salvar resposta recebida
          </Button>
        </form>
      </div>
    </section>
  );
}
