import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { LoginForm } from "./login-form";
import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--bg)] px-5 py-10">
      <div className="pointer-events-none absolute inset-0 muted-grid opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-subtle)] blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[var(--ink)] p-10 text-[var(--bg)] lg:flex">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2.5">
              <LogoMark className="border-white/20 bg-white/10 text-white" />
              <span className="text-sm font-semibold tracking-tight">JB Agent Autopilot</span>
            </div>
            <p className="mt-20 max-w-sm text-3xl font-medium leading-[1.12] tracking-[-0.03em]">
              Da prospecção à demonstração.
              <br />
              <span className="text-white/45">Uma operação inteira em um só lugar.</span>
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-[11px] text-white/55">
            <div>
              <p className="font-mono text-lg text-white">01</p>
              <p className="mt-1 leading-relaxed">Encontre empresas por nicho e região.</p>
            </div>
            <div>
              <p className="font-mono text-lg text-white">02</p>
              <p className="mt-1 leading-relaxed">Qualifique e gere demonstrações.</p>
            </div>
            <div>
              <p className="font-mono text-lg text-white">03</p>
              <p className="mt-1 leading-relaxed">Acompanhe cada contato e venda.</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center p-7 sm:p-10">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex items-center gap-2.5">
              <LogoMark />
              <span className="text-sm font-semibold tracking-tight">JB Agent Autopilot</span>
            </div>
          </div>
          <div className="mb-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Acesso restrito
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Entrar no painel</h1>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Use o usuário administrador criado no servidor. Novas contas são gerenciadas em Configurações.
            </p>
          </div>
          <LoginForm />
          <p className="mt-6 text-[10px] leading-relaxed text-[var(--muted-2)]">
            Sessão protegida por cookie httpOnly. Nenhuma credencial é armazenada no navegador.
          </p>
        </section>
      </div>
    </main>
  );
}
