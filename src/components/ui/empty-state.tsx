import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  compact,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface-muted)]/40 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span className="mb-3 inline-flex size-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted-2)]">
        <Icon className="size-4" />
      </span>
      <p className="text-xs font-medium text-[var(--ink)]">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
