"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ALL_NAV_ITEMS } from "./nav-config";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-[300px] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-left text-[11px] text-[var(--muted-2)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--muted)]"
      >
        <Search className="size-3.5" />
        <span className="flex-1 truncate">Buscar no painel...</span>
        <kbd className="hidden rounded border border-[var(--line)] bg-[var(--surface-muted)] px-1 py-0.5 font-mono text-[9px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Navegação rápida</DialogTitle>
          <Command loop className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-[var(--muted-2)]">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-4">
              <Search className="size-4 text-[var(--muted-2)]" />
              <Command.Input
                autoFocus
                placeholder="Ir para página ou buscar..."
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-2)]"
              />
            </div>
            <Command.List className="max-h-[340px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-xs text-[var(--muted)]">
                Nenhum resultado.
              </Command.Empty>
              <Command.Group heading="Navegação">
                {ALL_NAV_ITEMS.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${item.label} ${item.href}`}
                    onSelect={() => go(item.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-[var(--muted)] aria-selected:bg-[var(--surface-hover)] aria-selected:text-[var(--ink)]"
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="border-t border-[var(--line)] px-4 py-2 text-[9px] text-[var(--muted-2)]">
              Enter para abrir · Esc para fechar
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
