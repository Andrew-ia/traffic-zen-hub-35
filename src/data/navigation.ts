import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BarChart3,
  Target,
  TrendingUp,
  Plug,
  Sparkles,
  Facebook,
  Search,
  MessageSquare,
  Wallet,
  Kanban,
  ChartLine,
  Folder,
} from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

export const mainNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "visão geral"] },

  { name: "Projetos", href: "/projects", icon: Kanban, keywords: ["projetos", "tarefas", "kanban", "organização"] },
  { name: "Meta Ads", href: "/meta-ads", icon: Facebook, keywords: ["facebook", "meta"] },
  { name: "Análise de Criativos", href: "/creative-analysis/meta", icon: Sparkles, keywords: ["meta", "criativos", "analise", "ia"] },

  { name: "Criativos Drive", href: "/drive-creatives", icon: Folder, keywords: ["drive", "google drive", "criativos"] },
  { name: "Google Analytics", href: "/google-analytics", icon: ChartLine, keywords: ["ga4", "google analytics", "analytics"] },

  { name: "Relatórios", href: "/reports", icon: TrendingUp, keywords: ["reports", "relatorio"] },
  { name: "Internal Chat", href: "/internal-chat", icon: MessageSquare, keywords: ["chat", "mensagens", "conversas"] },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },

  { name: "Rastreamento Digital", href: "/tracking", icon: Sparkles, keywords: ["tags", "gtm", "rastreamento"] },
  { name: "Integrações", href: "/integrations", icon: Plug, keywords: ["config", "conexões"] },
  { name: "Usuários", href: "/admin/users", icon: Plug, keywords: ["admin", "usuários", "acesso"] },
];

export function findNavigationLabel(pathname: string): string | undefined {
  const exact = mainNavigation.find((item) => item.href === pathname);
  if (exact) return exact.name;

  if (pathname.startsWith("/campaigns/")) return "Detalhes da Campanha";
  if (pathname.startsWith("/ads/")) return "Detalhes do Anúncio";
  if (pathname.startsWith("/reports/")) return "Detalhes do Relatório";
  return undefined;
}
