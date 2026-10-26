"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { CommandMenu } from "./command-menu";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "../ui/theme-toggle";

type AppShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
  databaseConfigured: boolean;
  n8nConfigured: boolean;
};

export function AppShell({ children, user, databaseConfigured, n8nConfigured }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-[var(--line)] lg:block">
        <Sidebar databaseConfigured={databaseConfigured} n8nConfigured={n8nConfigured} />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-[280px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0">
          <DialogTitle className="sr-only">Navegação</DialogTitle>
          <Sidebar
            databaseConfigured={databaseConfigured}
            n8nConfigured={n8nConfigured}
            onNavigate={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-2 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] px-3 backdrop-blur-xl sm:px-5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
          <CommandMenu />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} role={user.role} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="animate-page-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
