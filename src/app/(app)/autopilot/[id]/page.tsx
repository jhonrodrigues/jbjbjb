import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, Bot, Hand, ShieldBan } from "lucide-react";
import { isAdmin, requireUser } from "@/lib/auth-helpers";
import { getSalesThread, listSalesMessages } from "@/lib/sales-store";
import { optOutSalesThreadAction, setSalesThreadModeAction } from "@/actions/sales-autopilot";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversa comercial" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> };
export default async function SalesConversationPage({ params,searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { ok } = await searchParams;
  const [thread,messages] = await Promise.all([getSalesThread(id),listSalesMessages(id)]);
  if (!thread) notFound();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Autopilot" title="Histórico da conversa"
        actions={<Button asChild size="sm" variant="outline"><Link href="/autopilot"><ArrowLeft/> Conversas</Link></Button>}/>
      {ok ? <p className="rounded-md border border-[var(--success)]/30 p-3 text-xs text-[var(--success)]">{ok}</p> : null}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-xs font-medium">
          {thread.opted_out ? "Contato bloqueado (opt-out)" : thread.mode === "human" ? "Atendimento humano" : "Atendimento por IA"}
        </p>
        <p className="mt-1 text-[10px] text-[var(--muted)]">Último inbound: {formatDateTime(thread.last_inbound_at)}</p>
        {isAdmin(user) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={setSalesThreadModeAction.bind(null,id)}>
              <input type="hidden" name="mode" value={thread.mode === "ai" ? "human" : "ai"}/>
              <Button size="sm" variant="outline" disabled={thread.opted_out}>
                {thread.mode === "ai" ? <Hand/> : <Bot/>} {thread.mode === "ai" ? "Assumir atendimento" : "Devolver para IA"}
              </Button>
            </form>
            {!thread.opted_out ? (
              <form action={optOutSalesThreadAction.bind(null,id)}>
                <Button type="submit" size="sm" variant="danger"><ShieldBan/> Não contatar</Button>
              </form>
            ) : null}
            <Button asChild variant="ghost" size="sm"><Link href={`/comercial/${id}`}>Abrir CRM</Link></Button>
          </div>
        ) : null}
      </div>
      <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        {messages.length === 0 ? <p className="text-xs text-[var(--muted)]">Nenhuma mensagem registrada.</p> : messages.map(m => (
          <div key={m.id} className={`max-w-[90%] rounded-lg border border-[var(--line)] p-3 ${m.direction === "outbound" ? "ml-auto bg-[var(--surface-muted)]" : ""}`}>
            <p className="text-[10px] font-semibold">
              {m.direction === "outbound" ? "Assistente JB Agent" : "Lead"} · {m.channel} · {m.status}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{m.content}</p>
            <p className="mt-2 text-[9px] text-[var(--muted-2)]">{formatDateTime(m.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
