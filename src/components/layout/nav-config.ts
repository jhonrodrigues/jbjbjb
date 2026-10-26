import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  ChartNoAxesCombined,
  KanbanSquare,
  LayoutDashboard,
  Settings2,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/", label: "Visão geral", icon: LayoutDashboard },
      { href: "/campanhas", label: "Campanhas", icon: ChartNoAxesCombined },
      { href: "/leads", label: "Leads", icon: Building2 },
      { href: "/landing-pages", label: "Landing pages", icon: Sparkles },
      { href: "/comercial", label: "Comercial", icon: KanbanSquare },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/agentes", label: "Agentes", icon: Bot },
      { href: "/configuracoes", label: "Configurações", icon: Settings2 },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
