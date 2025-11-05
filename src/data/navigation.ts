import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  Target,
  TrendingUp,
  Users,
  Plug,
  Sparkles,
  Facebook,
  Search,
  Brain,
  Lightbulb,
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
  { name: "Agentes de IA", href: "/agents", icon: Brain, keywords: ["ia", "agentes", "automação", "inteligencia"] },
  { name: "Insights", href: "/insights", icon: Lightbulb, keywords: ["insights", "recomendações", "sugestões"] },
  { name: "Análise de Tráfego", href: "/traffic-analysis", icon: BarChart3, keywords: ["trafego", "analytics"] },
  { name: "Campanhas", href: "/campaigns", icon: Target, keywords: ["ads", "campanhas"] },
  { name: "Meta Ads", href: "/meta-ads", icon: Facebook, keywords: ["facebook", "instagram", "meta"] },
  { name: "Google Ads", href: "/google-ads", icon: Search, keywords: ["google", "search", "display"] },
  { name: "Biblioteca de Campanhas", href: "/campaigns/library", icon: Target, keywords: ["biblioteca", "templates", "planejamento"] },
  { name: "Relatórios", href: "/reports", icon: TrendingUp, keywords: ["reports", "relatorio"] },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },
  { name: "Públicos", href: "/audiences", icon: Users, keywords: ["audiencias", "segmentos"] },
  { name: "GA4", href: "/ga4", icon: BarChart3, keywords: ["ga4", "gtm", "analytics"] },
  { name: "Rastreamento Digital", href: "/tracking", icon: Sparkles, keywords: ["tags", "gtm", "rastreamento"] },
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
