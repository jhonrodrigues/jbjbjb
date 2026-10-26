import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { getPublicConfig } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [user, config] = await Promise.all([requireUser(), Promise.resolve(getPublicConfig())]);

  return (
    <AppShell
      user={{
        name: user.name || user.email || "Usuário",
        email: user.email || "",
        role: user.role === "admin" ? "Administrador" : "Membro",
      }}
      databaseConfigured={config.databaseConfigured}
      n8nConfigured={config.n8nConfigured}
    >
      {children}
    </AppShell>
  );
}
