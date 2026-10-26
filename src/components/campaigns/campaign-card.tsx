import Link from "next/link";
import { ArrowUpRight, MapPin, RefreshCw, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONE, FREQUENCY_LABELS, labelFor } from "@/lib/labels";
import { formatNumber, relativeTime } from "@/lib/utils";
import type { CampaignListRow } from "@/lib/campaigns";

export function CampaignCard({ campaign }: { campaign: CampaignListRow }) {
  return (
    <Link
      href={`/campanhas/${campaign.id}`}
      className="group flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={CAMPAIGN_STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge>
            <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
              {labelFor(FREQUENCY_LABELS, campaign.frequency)}
            </span>
          </div>
          <h3 className="mt-2.5 truncate text-sm font-semibold tracking-tight text-[var(--ink)]">{campaign.name}</h3>
          <p className="mt-1 truncate text-[10px] text-[var(--muted)]">
            {[campaign.niche, campaign.city, campaign.state].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ArrowUpRight className="size-3.5 shrink-0 text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-4">
        <Stat icon={Users} label="Leads" value={formatNumber(campaign.leads)} />
        <Stat icon={Sparkles} label="Contatos" value={formatNumber(campaign.contactCount)} />
        <Stat icon={RefreshCw} label="Vendas" value={formatNumber(campaign.closed)} />
      </div>

      <div className="mt-4 flex items-center justify-between text-[9px] text-[var(--muted-2)]">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-2.5" />
          {campaign.city || campaign.region || campaign.country}
        </span>
        <span>{campaign.lastRunAt ? `Executada ${relativeTime(campaign.lastRunAt)}` : "Nunca executada"}</span>
      </div>
    </Link>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div>
      <Icon className="mb-1.5 size-3 text-[var(--muted-2)]" />
      <p className="font-mono text-[13px] font-medium text-[var(--ink)]">{value}</p>
      <p className="text-[9px] text-[var(--muted-2)]">{label}</p>
    </div>
  );
}
