import type { LucideIcon } from "lucide-react";
import {
  Target,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Kanban,
  Folder,
  ShoppingBag,
  Package,
  Trophy,
  Warehouse,
  PenTool,
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
  {
    name: "Mercado Livre",
    href: "/",
    icon: ShoppingBag,
    children: [
      { name: "Analisador MLB", href: "/mercado-livre-analyzer", icon: Target, keywords: ["analisador", "mlb", "seo", "otimizacao", "mercado livre"] },
      // { name: "Análise de Mercado", href: "/mercado-livre-market-analysis", icon: ChartLine, keywords: ["analise", "mercado", "concorrencia", "tendencias", "mlb"] },
      { name: "Calc. de Preço ML", href: "/mercado-livre-price-calculator", icon: Trophy, keywords: ["preco", "fee", "margem", "mercado livre", "calculadora"] },
      { name: "Descrições ML", href: "/mercado-livre-descricoes", icon: PenTool, keywords: ["descricao", "anuncio", "copy", "mercado livre"] },
      { name: "Catálogo (Hub)", href: "/product-hub", icon: Package, keywords: ["produtos", "catalogo", "hub", "estoque", "marketplace"] },
      { name: "Anúncios", href: "/products", icon: Package, keywords: ["anuncios", "ml", "listings"] },
      { name: "Analytics Full", href: "/mercado-livre/full-analytics", icon: TrendingUp, keywords: ["full", "analytics", "classificacao", "abc", "ml"] },
      { name: "Estoque Full", href: "/fulfillment", icon: Warehouse, keywords: ["fulfillment", "estoque", "full", "planejamento", "envios", "armazém"] },
    ],
  },
  {
    name: "Projetos",
    href: "/projects",
    icon: Kanban,
    keywords: ["projetos", "tarefas", "kanban", "organização"],
    children: [
      { name: "Criativos Drive", href: "/projects/drive-creatives", icon: Folder, keywords: ["drive", "google drive", "criativos"] },
      { name: "Internal Chat", href: "/projects/internal-chat", icon: MessageSquare, keywords: ["chat", "mensagens", "conversas"] },
    ],
  },
  { name: "Gerador de Looks", href: "/gerador-looks", icon: Sparkles, keywords: ["ia", "looks", "virtual"] },
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

  if (pathname === "/mercado-livre") return "Mercado Livre";
  return undefined;
}
