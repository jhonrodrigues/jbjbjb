import Link from "next/link";
import { ExternalLink, MapPin, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/labels";
import type { LegacyLead } from "@/lib/legacy";
import { cn, formatNumber, relativeTime } from "@/lib/utils";

export function LeadTable({ leads, compact }: { leads: LegacyLead[]; compact?: boolean }) {
  if (leads.length === 0) {
    return (
      <div className="p-4">
        <EmptyState compact title="Nenhuma empresa encontrada" description="Os resultados dos agentes aparecerão aqui." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-[var(--line)] text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
            <th className="px-4 py-2.5 font-medium">Empresa</th>
            <th className="px-3 py-2.5 font-medium">Nicho / região</th>
            <th className="px-3 py-2.5 font-medium">Prioridade</th>
            {!compact ? <th className="px-3 py-2.5 font-medium">Status</th> : null}
            <th className="px-3 py-2.5 text-right font-medium">Pontuação</th>
            <th className="px-3 py-2.5 font-medium">LPs</th>
            <th className="px-4 py-2.5 text-right font-medium">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover)]">
              <td className="max-w-[280px] px-4 py-3">
                <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-[var(--ink)] hover:underline">
                  {lead.empresa}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[var(--muted-2)]">
                  {lead.telefone ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Phone className="size-2.5" /> {lead.telefone}
                    </span>
                  ) : null}
                  {lead.instagram ? (
                    <span className="inline-flex items-center gap-0.5">
                      <MessageCircle className="size-2.5" /> {lead.instagram}
                    </span>
                  ) : null}
                  {lead.site ? (
                    <a href={lead.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-[var(--ink)]">
                      <ExternalLink className="size-2.5" /> site
                    </a>
                  ) : null}
                </div>
              </td>
              <td className="max-w-[200px] px-3 py-3">
                <p className="truncate text-[var(--muted)]">{lead.nicho ?? "—"}</p>
                <p className="mt-0.5 flex items-center gap-0.5 truncate text-[9px] text-[var(--muted-2)]">
                  <MapPin className="size-2.5" /> {lead.cidade ?? "—"}
                </p>
              </td>
              <td className="px-3 py-3">
                <Badge variant={PRIORITY_TONE[lead.priority] ?? "outline"}>{PRIORITY_LABELS[lead.priority] ?? lead.priority}</Badge>
              </td>
              {!compact ? (
                <td className="px-3 py-3">
                  <span className="text-[10px] text-[var(--muted)]">{lead.status ?? "—"}</span>
                </td>
              ) : null}
              <td className={cn("px-3 py-3 text-right font-mono", lead.pontuacao !== null ? "text-[var(--ink)]" : "text-[var(--muted-2)]")}>
                {lead.pontuacao !== null ? formatNumber(lead.pontuacao) : "—"}
              </td>
              <td className="px-3 py-3">
                {lead.lpCount > 0 ? <Badge variant="accent">{lead.lpCount}</Badge> : <span className="text-[var(--muted-2)]">—</span>}
              </td>
              <td className="px-4 py-3 text-right text-[9px] text-[var(--muted-2)]">{relativeTime(lead.atualizadoEm ?? lead.criadoEm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
