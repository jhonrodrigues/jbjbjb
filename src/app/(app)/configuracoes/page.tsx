import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, ShieldCheck, Users } from "lucide-react";
import { getDb, hasDatabaseUrl } from "@/db/client";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import { isAdmin, requireUser } from "@/lib/auth-helpers";
import { getPlatformSettings } from "@/lib/settings";
import { getWebhookSettingsSummary, isWebhookConfigured } from "@/lib/n8n-webhook";
import { updateUserAction } from "@/actions/users";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { CreateUserForm } from "@/components/settings/create-user-form";
import { WebhookSettingsForm } from "@/components/settings/webhook-settings-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [user, settings] = await Promise.all([requireUser(), getPlatformSettings()]);
  const admin = isAdmin(user);
  const webhook = admin ? await getWebhookSettingsSummary() : null;
  const n8nConfigured = Boolean(process.env.N8N_BASE_URL || (admin
    ? webhook?.url && webhook.secretConfigured
    : await isWebhookConfigured().catch(() => false)));
  const userRows = admin && hasDatabaseUrl()
    ? await getDb().select().from(users).orderBy(asc(users.name)).catch(() => [])
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Parâmetros da operação, limites de custo e administração de acesso."
      />

      {params.ok ? <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-subtle)] px-3 py-2 text-[11px] text-[var(--success)]">Alterações salvas.</div> : null}
      {params.error ? (
        <div className="flex gap-2 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-[11px] text-[var(--danger)]">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {params.error}
        </div>
      ) : null}

      {!admin ? (
        <div className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-subtle)] p-4">
          <p className="text-[11px] font-medium text-[var(--warning)]">Acesso somente leitura</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
            Apenas administradores podem alterar configurações ou gerenciar usuários. Solicite acesso ao responsável pela conta.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <nav className="sticky top-20 space-y-1 text-[10px]">
            {[
              ["scoring", "Qualificação"],
              ["limits", "Limites"],
              ["lp", "Landing pages"],
              ["ai", "IA"],
              ...(admin ? [["n8n", "Webhook n8n"], ["users", "Administração"]] : []),
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-4">
          {admin ? (
            <SettingsForm settings={settings} />
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-semibold tracking-tight">Resumo da configuração</h2>
              <dl className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2">
                <ReadOnly label="Prioridade alta" value={`score ≥ ${settings.scoring.highThreshold}`} />
                <ReadOnly label="Prioridade média" value={`score ≥ ${settings.scoring.mediumThreshold}`} />
                <ReadOnly label="Tarefas por dia" value={String(settings.limits.maxJobsPerDay)} />
                <ReadOnly label="LPs por dia" value={String(settings.limits.maxLpGenerationsPerDay)} />
                <ReadOnly label="Template padrão" value={settings.lpDefaults.template} />
                <ReadOnly label="Modelo de IA" value={settings.ai.model || "Não definido"} />
              </dl>
            </div>
          )}

          {admin && webhook ? <WebhookSettingsForm settings={webhook} /> : null}

          {admin ? (
            <section id="users" className="scroll-mt-20 space-y-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-[var(--muted-2)]" />
                      <h2 className="text-sm font-semibold tracking-tight">Usuários</h2>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">Não há cadastro público. Crie acessos manualmente.</p>
                  </div>
                  <Badge variant="outline">{userRows.length} contas</Badge>
                </div>

                <div className="mt-4 divide-y divide-[var(--line)]">
                  {userRows.map((row) => (
                    <form key={row.id} action={updateUserAction.bind(null, row.id)} className="grid gap-2 py-3 first:pt-0 last:pb-0 lg:grid-cols-[1.2fr_0.7fr_0.55fr_0.9fr_auto] lg:items-end">
                      <div>
                        <p className="truncate text-[11px] font-medium">{row.name}</p>
                        <p className="truncate text-[9px] text-[var(--muted-2)]">{row.email}</p>
                        <p className="mt-0.5 text-[8px] text-[var(--muted-2)]">
                          {row.lastLoginAt ? `Último acesso ${formatDateTime(row.lastLoginAt)}` : "Nunca acessou"}
                        </p>
                      </div>
                      <input type="hidden" name="name" value={row.name} />
                      <label className="space-y-1">
                        <span className="block text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Papel</span>
                        <select name="role" defaultValue={row.role} className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]">
                          <option value="member">Membro</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>
                      <label className="flex h-8 items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <input type="checkbox" name="active" defaultChecked={row.active} className="size-3.5 accent-[var(--accent)]" />
                        Ativo
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Nova senha</span>
                        <input
                          type="password"
                          name="password"
                          minLength={10}
                          placeholder="Opcional"
                          className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px]"
                        />
                      </label>
                      <Button type="submit" variant="outline" size="sm">
                        Salvar
                      </Button>
                    </form>
                  ))}
                </div>

                {userRows.length === 0 ? (
                  <p className="mt-3 rounded-lg bg-[var(--surface-muted)]/60 px-3 py-2 text-[10px] text-[var(--muted)]">
                    Nenhum usuário encontrado. Use <code className="font-mono">npm run admin:create</code> no servidor.
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-[var(--muted-2)]" />
                  <h2 className="text-sm font-semibold tracking-tight">Novo usuário</h2>
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted)]">Senha mínima de 10 caracteres. Compartilhe por canal seguro.</p>
                <div className="mt-4">
                  <CreateUserForm />
                </div>
              </div>
            </section>
          ) : null}

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/40 p-4 text-[10px] leading-relaxed text-[var(--muted)]">
            <p className="font-medium text-[var(--ink)]">Ambiente</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={hasDatabaseUrl() ? "success" : "warning"}>
                PostgreSQL {hasDatabaseUrl() ? "configurado" : "não configurado"}
              </Badge>
              <Badge variant={n8nConfigured ? "success" : "outline"}>
                n8n {n8nConfigured ? "configurado" : "não configurado"}
              </Badge>
              <Badge variant={process.env.AI_API_KEY || process.env.OPENAI_API_KEY ? "success" : "outline"}>
                IA {process.env.AI_API_KEY || process.env.OPENAI_API_KEY ? "configurada" : "não configurada"}
              </Badge>
            </div>
            <p className="mt-2">
              Consulte <Link href="/agentes" className="text-[var(--accent)] hover:underline">Agentes</Link> para a fila e os endpoints de integração.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--ink)]">{value}</dd>
    </div>
  );
}
