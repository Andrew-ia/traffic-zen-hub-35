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
  PenTool,
  Search,
} from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}
export interface NavigationGroup {
  name: string;
  href: string;
  icon: LucideIcon;
  children: NavigationItem[];
}
export type NavigationEntry = NavigationItem | NavigationGroup;

export const mainNavigation: NavigationEntry[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "visão geral"] },
  { name: "Projetos", href: "/projects", icon: Kanban, keywords: ["projetos", "tarefas", "kanban", "organização"] },
  { name: "Meta Ads", href: "/meta-ads", icon: Facebook, keywords: ["facebook", "meta"] },
  { name: "Criativos Drive", href: "/drive-creatives", icon: Folder, keywords: ["drive", "google drive", "criativos"] },
  { name: "Google Analytics", href: "/google-analytics", icon: ChartLine, keywords: ["ga4", "google analytics", "analytics"] },
  {
    name: "Mercado Livre",
    href: "/mercado-livre",
    icon: ShoppingBag,
    children: [
      { name: "Analisador MLB", href: "/mercado-livre-analyzer", icon: Target, keywords: ["analisador", "mlb", "seo", "otimizacao", "mercado livre"] },
      { name: "Calc. de Preço ML", href: "/mercado-livre-price-calculator", icon: Trophy, keywords: ["preco", "fee", "margem", "mercado livre", "calculadora"] },
      { name: "Descrições ML", href: "/mercado-livre-descricoes", icon: PenTool, keywords: ["descricao", "anuncio", "copy", "mercado livre"] },
      { name: "Busca Avançada ML", href: "/mercado-livre-busca-avancada", icon: Search, keywords: ["busca", "pesquisa", "competição", "ml"] },
      { name: "Produtos", href: "/products", icon: Package, keywords: ["produtos", "catalogo", "estoque", "ml"] },
      { name: "Estoque Full", href: "/fulfillment", icon: Warehouse, keywords: ["fulfillment", "estoque", "full", "planejamento", "envios", "armazém"] },
    ],
  },
  { name: "Relatórios", href: "/reports", icon: TrendingUp, keywords: ["reports", "relatorio"] },
  { name: "Internal Chat", href: "/internal-chat", icon: MessageSquare, keywords: ["chat", "mensagens", "conversas"] },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },
  { name: "Notificações", href: "/notifications", icon: Bell, keywords: ["notificações", "telegram", "alertas", "avisos"] },
  { name: "Usuários", href: "/admin/users", icon: Plug, keywords: ["admin", "usuários", "acesso"] },
];

export function flattenNavigation(entries: NavigationEntry[]): NavigationItem[] {
  const out: NavigationItem[] = [];
  for (const entry of entries) {
    if ("children" in entry) {
      out.push({ name: entry.name, href: entry.href, icon: entry.icon, keywords: ["mercado livre", "categoria"] });
      out.push(...entry.children);
    } else {
      out.push(entry);
    }
  }
  return out;
}

export function findNavigationLabel(pathname: string): string | undefined {
  const flat = flattenNavigation(mainNavigation);
  const exact = flat.find((item) => item.href === pathname);
  if (exact) return exact.name;

  if (pathname.startsWith("/campaigns/")) return "Detalhes da Campanha";
  if (pathname.startsWith("/ads/")) return "Detalhes do Anúncio";
  if (pathname.startsWith("/reports/")) return "Detalhes do Relatório";
  return undefined;
}
