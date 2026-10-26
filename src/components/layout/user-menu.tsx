"use client";

import { LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 pr-2.5 transition-colors hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="Menu do usuário"
        >
          <Avatar className="size-7">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-[11px] font-medium text-[var(--ink)] sm:block">
            {name}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Conta</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <p className="truncate text-xs font-medium text-[var(--ink)]">{name}</p>
          <p className="truncate text-[10px] text-[var(--muted)]">{email}</p>
          <p className="mt-1 inline-flex rounded-full bg-[var(--accent-subtle)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--accent-strong)]">
            {role}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracoes?tab=administration">
            <Settings2 />
            Administração
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <UserRound />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild destructive>
            <button type="submit" className="w-full">
              <LogOut />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
