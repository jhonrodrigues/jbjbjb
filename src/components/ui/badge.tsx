import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted)]",
        accent: "border-transparent bg-[var(--accent-subtle)] text-[var(--accent-strong)]",
        success: "border-transparent bg-[var(--success-subtle)] text-[var(--success)]",
        warning: "border-transparent bg-[var(--warning-subtle)] text-[var(--warning)]",
        danger: "border-transparent bg-[var(--danger-subtle)] text-[var(--danger)]",
        outline: "border-[var(--line-strong)] bg-transparent text-[var(--ink)]",
        dark: "border-transparent bg-[var(--ink)] text-[var(--bg)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
