import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--ink)] text-[11px] font-semibold tracking-[-0.02em] text-[var(--bg)]",
        className,
      )}
      aria-hidden
    >
      JB
    </span>
  );
}
