import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  total,
  makeHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-[10px] text-[var(--muted)]">
      <span>
        Página {page} de {pageCount} · {total.toLocaleString("pt-BR")} registros
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={makeHref(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2 hover:bg-[var(--surface-hover)]",
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          <ChevronLeft className="size-3" /> Anterior
        </Link>
        <Link
          href={makeHref(Math.min(pageCount, page + 1))}
          aria-disabled={page >= pageCount}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2 hover:bg-[var(--surface-hover)]",
            page >= pageCount && "pointer-events-none opacity-40",
          )}
        >
          Próxima <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
