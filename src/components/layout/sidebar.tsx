"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDot, PanelLeftClose } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { NAV_GROUPS } from "./nav-config";
import { cn } from "@/lib/utils";

type SidebarProps = {
  databaseConfigured: boolean;
  n8nConfigured: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
};

export function Sidebar({ databaseConfigured, n8nConfigured, onNavigate, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)]">
      <div className="flex h-[var(--topbar-height)] items-center justify-between px-4">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[13px] font-semibold tracking-[-0.02em]">JB Agent</span>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] lg:hidden"
            aria-label="Fechar menu"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mx-3 mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">Workspace</p>
        <p className="mt-1 truncate text-xs font-medium text-[var(--ink)]">Operação JB Agent</p>
        <p className="mt-0.5 text-[10px] text-[var(--muted)]">Autopilot · produção</p>
      </div>

      <nav className="flex-1 space-y-5 px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-2)]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[12px] font-medium transition-colors",
                      active
                        ? "bg-[var(--ink)] text-[var(--bg)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-3.5",
                        active ? "text-[var(--bg)]" : "text-[var(--muted-2)] group-hover:text-[var(--muted)]",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--line)] p-3">
        <div className="space-y-1.5 rounded-lg bg-[var(--surface)] px-2.5 py-2 text-[10px]">
          <StatusLine label="PostgreSQL" ok={databaseConfigured} />
          <StatusLine label="n8n" ok={n8nConfigured} />
        </div>
        <p className="mt-3 px-1 text-[9px] leading-relaxed text-[var(--muted-2)]">
          v0.1 · links de LP privados por padrão
        </p>
      </div>
    </div>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={cn("inline-flex items-center gap-1 font-medium", ok ? "text-[var(--success)]" : "text-[var(--warning)]")}>
        <CircleDot className="size-2.5" />
        {ok ? "Configurado" : "Não configurado"}
      </span>
    </div>
  );
}
