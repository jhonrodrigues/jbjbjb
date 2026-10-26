import type { LucideIcon } from "lucide-react";

export function CampaignStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{label}</p>
        <Icon className="size-3.5 text-[var(--muted-2)]" />
      </div>
      <p className="metric-value mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
