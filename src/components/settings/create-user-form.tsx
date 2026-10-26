"use client";

import { useActionState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { createUserAction } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_ACTION_STATE } from "@/lib/forms";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="new-name">Nome</Label>
        <Input id="new-name" name="name" required placeholder="Nome completo" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-email">E-mail</Label>
        <Input id="new-email" name="email" type="email" required placeholder="pessoa@empresa.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Senha inicial</Label>
        <Input id="new-password" name="password" type="password" required minLength={10} placeholder="Mínimo de 10 caracteres" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-role">Papel</Label>
        <select
          id="new-role"
          name="role"
          className="flex h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs"
          defaultValue="member"
        >
          <option value="member">Membro</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      {state.error ? <p className="sm:col-span-2 text-[10px] text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="sm:col-span-2 text-[10px] text-[var(--success)]">{state.success}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Criar usuário
        </Button>
      </div>
    </form>
  );
}
