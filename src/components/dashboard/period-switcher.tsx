"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
] as const;

export function PeriodSwitcher({ current, label }: { current: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const setPeriod = (key: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("period", key);
    next.delete("from");
    next.delete("to");
    router.push(`${pathname}?${next.toString()}`);
  };

  const applyCustom = (formData: FormData) => {
    const from = String(formData.get("from") || "");
    const to = String(formData.get("to") || "");
    if (!from || !to) return;
    const next = new URLSearchParams(params.toString());
    next.set("period", "custom");
    next.set("from", from);
    next.set("to", to);
    setOpen(false);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden text-[10px] text-[var(--muted)] sm:inline">{label}</span>
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[10px] font-medium transition-colors",
                current === option.key
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <CalendarDays />
          Personalizado
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Período personalizado</DialogTitle>
            <DialogDescription>Escolha a data inicial e final para os indicadores.</DialogDescription>
          </DialogHeader>
          <form action={applyCustom} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">De</Label>
                <Input id="from" name="from" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">Até</Label>
                <Input id="to" name="to" type="date" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent">
                Aplicar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
