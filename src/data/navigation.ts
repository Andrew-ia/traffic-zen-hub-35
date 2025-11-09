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
  Instagram,
  MessageSquare,
  Wallet,
} from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

export const mainNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "visão geral"] },
  { name: "AI Chat", href: "/chat", icon: MessageSquare, keywords: ["chat", "ai", "assistente", "perguntas"] },
  { name: "Análise de Tráfego", href: "/traffic-analysis", icon: BarChart3, keywords: ["trafego", "analytics"] },
  { name: "Campanhas", href: "/campaigns", icon: Target, keywords: ["ads", "campanhas"] },
  { name: "Meta Ads", href: "/meta-ads", icon: Facebook, keywords: ["facebook", "meta"] },
  { name: "Instagram", href: "/instagram", icon: Instagram, keywords: ["instagram", "insights", "ig"] },
  { name: "Google Ads", href: "/google-ads", icon: Search, keywords: ["google", "search", "display"] },
  { name: "Fluxo de Caixa", href: "/cashflow", icon: Wallet, keywords: ["financeiro", "caixa", "fluxo"] },
  { name: "Biblioteca de Criativos", href: "/creatives", icon: Sparkles, keywords: ["criativos", "biblioteca", "assets"] },
  { name: "Relatórios", href: "/reports", icon: TrendingUp, keywords: ["reports", "relatorio"] },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },
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
  return undefined;
}
