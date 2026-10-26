import type { LucideIcon } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  currency,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: number;
  currency?: boolean;
  icon: LucideIcon;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]",
        accent && "border-[var(--accent)]/20",
      )}
    >
      {accent ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
        <Icon className={cn("size-3.5 shrink-0", accent ? "text-[var(--accent)]" : "text-[var(--muted-2)]")} />
      </div>
      <p className="metric-value mt-3 text-[26px] font-semibold leading-none text-[var(--ink)]">
        {currency ? formatCurrency(value) : formatNumber(value)}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-2)]">{hint ?? "No período selecionado"}</p>
    </div>
  );
}
