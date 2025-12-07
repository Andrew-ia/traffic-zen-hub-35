import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Plug,
  Sparkles,
  Facebook,
  MessageSquare,
  Kanban,
  ChartLine,
  Folder,
  ShoppingBag,
  Package,
  Trophy,
  Warehouse,
  Bell,
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
  { name: "Criativos Drive", href: "/drive-creatives", icon: Folder, keywords: ["drive", "google drive", "criativos"] },
  { name: "Google Analytics", href: "/google-analytics", icon: ChartLine, keywords: ["ga4", "google analytics", "analytics"] },
  { name: "Mercado Livre", href: "/mercado-livre", icon: ShoppingBag, keywords: ["mercado livre", "ecommerce", "vendas", "marketplace"] },
  { name: "Analisador MLB", href: "/mercado-livre-analyzer", icon: Target, keywords: ["analisador", "mlb", "seo", "otimizacao", "mercado livre"] },
  { name: "Inteligência de Catálogo", href: "/catalog-intelligence", icon: Trophy, keywords: ["catalogo", "ranking", "posicao", "competidores", "vencedor", "mercado livre"] },
  { name: "Produtos", href: "/products", icon: Package, keywords: ["produtos", "catalogo", "estoque", "ml"] },
  { name: "Estoque Full", href: "/fulfillment", icon: Warehouse, keywords: ["fulfillment", "estoque", "full", "planejamento", "envios", "armazém"] },
  { name: "Relatórios", href: "/reports", icon: TrendingUp, keywords: ["reports", "relatorio"] },
  { name: "Internal Chat", href: "/internal-chat", icon: MessageSquare, keywords: ["chat", "mensagens", "conversas"] },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },
  { name: "Notificações", href: "/notifications", icon: Bell, keywords: ["notificações", "telegram", "alertas", "avisos"] },
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
