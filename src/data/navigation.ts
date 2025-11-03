import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  Image,
  Users,
  Link2,
  Plug,
  Sparkles,
} from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

export const mainNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "visão geral"] },
  { name: "Centro de Ações", href: "/action-center", icon: CheckSquare, keywords: ["ações", "prioridades"] },
  { name: "Análise de Tráfego", href: "/traffic-analysis", icon: BarChart3, keywords: ["trafego", "analytics"] },
  { name: "Campanhas", href: "/campaigns", icon: Target, keywords: ["ads", "campanhas"] },
  { name: "Relatórios", href: "/reports", icon: TrendingUp, keywords: ["reports", "relatorio"] },
  { name: "Orçamento", href: "/budget", icon: DollarSign, keywords: ["budget", "investimento"] },
  { name: "Calendário", href: "/calendar", icon: Calendar, keywords: ["agenda", "planejamento"] },
  { name: "Criativos", href: "/creatives", icon: Image, keywords: ["ads", "criativo"] },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },
  { name: "Públicos", href: "/audiences", icon: Users, keywords: ["audiencias", "segmentos"] },
  { name: "UTMs", href: "/utms", icon: Link2, keywords: ["utm", "tracking"] },
  { name: "Integrações", href: "/integrations", icon: Plug, keywords: ["config", "conexões"] },
];

export function findNavigationLabel(pathname: string): string | undefined {
  const exact = mainNavigation.find((item) => item.href === pathname);
  if (exact) return exact.name;

  if (pathname.startsWith("/campaigns/")) return "Detalhes da Campanha";
  if (pathname.startsWith("/ads/")) return "Detalhes do Anúncio";
  if (pathname.startsWith("/reports/")) return "Detalhes do Relatório";
  if (pathname.startsWith("/action-center")) return "Centro de Ações";

  return undefined;
}

