import type { LucideIcon } from "lucide-react";
import {
  Target,
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  Package,
  Warehouse,
  FileText,
  Flame,
  AlertCircle,
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
      { name: "Operações", href: "/mercado-livre/operacoes", icon: AlertCircle, keywords: ["operacoes", "acoes", "pendencias", "dia"] },
      { name: "Anúncios", href: "/products", icon: Package, keywords: ["anuncios", "ml", "listings"] },
      { name: "Oportunidades de Volume", href: "/mercado-livre/oportunidades-volume", icon: Flame, keywords: ["volume", "oportunidades", "growth", "ml"] },
      { name: "Mercado Ads", href: "/mercado-ads/manual", icon: Target, keywords: ["ads", "campanhas", "curvas", "abc", "mercado ads"] },
      { name: "Estoque Full", href: "/fulfillment", icon: Warehouse, keywords: ["fulfillment", "estoque", "full", "planejamento", "envios", "armazém"] },
      { name: "Catálogo (Hub)", href: "/product-hub", icon: Package, keywords: ["produtos", "catalogo", "hub", "estoque", "marketplace"] },
      { name: "Analytics Full", href: "/mercado-livre/full-analytics", icon: TrendingUp, keywords: ["full", "analytics", "classificacao", "abc", "ml"] },
      { name: "Relatório Executivo", href: "/mercado-livre/relatorio-executivo", icon: FileText, keywords: ["relatorio", "executivo", "queda", "growth", "ml"] },
      { name: "Integrações", href: "/integrations", icon: ShoppingBag, keywords: ["integracoes", "conexoes", "mercado livre", "shopee"] },
    ],
  },
  {
    name: "Shopee Agora",
    href: "/shopee-agora",
    icon: ShoppingCart,
    keywords: ["shopee", "marketplace", "agora", "integracao", "catalogo"],
  },
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
