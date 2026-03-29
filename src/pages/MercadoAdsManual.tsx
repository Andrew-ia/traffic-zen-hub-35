import { useCallback, useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useMercadoAdsCampaigns,
  useMercadoAdsPreview,
} from "@/hooks/useMercadoAds";
import { useSyncMercadoLivreAnalytics } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatters";
import { useNavigate } from "react-router-dom";
import {
  Info,
  AlertCircle,
  Copy,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

type CampaignReadiness = "ready" | "caution" | "restock" | "hold";
type CampaignInventoryProduct = {
  productId: string | null;
  mlItemId: string | null;
  mlAdId: string | null;
  adStatus: string | null;
  title: string | null;
  sku: string | null;
  price: number | null;
  stock: number | null;
  totalSales30d: number;
  totalRevenue30d: number;
  visits30d: number | null;
  conversionRate30d: number | null;
  lifetimeSales: number;
  status: string | null;
  publishedAt: string | null;
  coverageDays: number | null;
};

type CampaignInventoryAnalysis = {
  id: string;
  name: string;
  curve: "A" | "B" | "C" | null;
  status: string;
  mlCampaignId: string | null;
  dailyBudget: number | null;
  totalProducts: number;
  activeProducts: number;
  products: CampaignInventoryProduct[];
  skuCount: number;
  totalStock: number;
  avgStockPerSku: number | null;
  outOfStockCount: number;
  shallowStockCount: number;
  deepStockCount: number;
  sellingSkuCount: number;
  recommendation: {
    label: string;
    description: string;
    className: string;
  };
  pressureScore: number;
};

export default function MercadoAdsManual() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;
  const { data: previewData, isLoading: isPreviewLoading, error: previewError } = useMercadoAdsPreview(workspaceId);
  const { data: campaignsData, isLoading: isCampaignsLoading, error: campaignsError } = useMercadoAdsCampaigns(workspaceId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const analyticsSyncMutation = useSyncMercadoLivreAnalytics();

  const items = useMemo(() => previewData?.items || [], [previewData?.items]);
  const summary = previewData?.summary || { A: 0, B: 0, C: 0 };
  const diagnostics = previewData?.diagnostics;
  const metrics = campaignsData?.metrics || null;
  const adsError = diagnostics?.adsMetricsError;

  const getTotalSales = useCallback((item: (typeof items)[number]) => Number(item.totalSales30d || 0), []);
  const getTotalRevenue = useCallback((item: (typeof items)[number]) => Number(item.totalRevenue30d || 0), []);
  const getAdsSales = useCallback((item: (typeof items)[number]) => Number(item.adsSales30d || 0), []);
  const getAdsRevenue = useCallback((item: (typeof items)[number]) => Number(item.adsRevenue30d || 0), []);
  const getAdsClicks = useCallback((item: (typeof items)[number]) => Number(item.adsClicks30d || 0), []);
  const getAdsCost = useCallback((item: (typeof items)[number]) => Number(item.adsCost30d || 0), []);
  const getVisits30d = useCallback((item: (typeof items)[number]) => Number(item.visits30d ?? 0), []);
  const getConversionRate30d = useCallback((item: (typeof items)[number]) => {
    if (item.conversionRate30d !== null && item.conversionRate30d !== undefined) return item.conversionRate30d;
    if (item.visits30d !== null && item.visits30d !== undefined) {
      const visits = Number(item.visits30d || 0);
      return visits > 0 ? getTotalSales(item) / visits : 0;
    }
    return null;
  }, [getTotalSales]);
  const getSalesVelocity30d = useCallback((item: (typeof items)[number]) => getTotalSales(item) / 30, [getTotalSales]);
  const getStockCoverageDays = useCallback((item: (typeof items)[number]) => {
    const stock = item.stock;
    if (stock === null || stock === undefined) return null;
    if (stock <= 0) return 0;
    const velocity = getSalesVelocity30d(item);
    if (velocity <= 0) return null;
    return stock / velocity;
  }, [getSalesVelocity30d]);
  const sortBySalesDescending = useCallback((a: (typeof items)[number], b: (typeof items)[number]) => {
    const salesDiff = getTotalSales(b) - getTotalSales(a);
    if (salesDiff !== 0) return salesDiff;
    return Number(b.stock ?? -1) - Number(a.stock ?? -1);
  }, [getTotalSales]);

  const groupedItems = useMemo(() => ({
    A: items.filter((i) => i.curve === "A").sort(sortBySalesDescending),
    B: items.filter((i) => i.curve === "B").sort(sortBySalesDescending),
    C: items.filter((i) => i.curve === "C").sort(sortBySalesDescending),
  }), [items, sortBySalesDescending]);

  const hasCampaignMetrics = !!metrics;
  const hasItemMetrics = diagnostics?.adsMetricsAvailable ?? false;
  const demandMetricsAvailable = diagnostics?.demandMetricsAvailable ?? items.some((item) => item.visits30d !== null && item.visits30d !== undefined);
  const itemsWithDemand = diagnostics?.itemsWithDemand ?? 0;

  const demandTotals = useMemo(() => {
    let sales = 0;
    let revenue = 0;
    let visits = 0;

    for (const item of items) {
      sales += Number(item.totalSales30d || 0);
      revenue += Number(item.totalRevenue30d || 0);
      if (item.visits30d !== null && item.visits30d !== undefined) {
        visits += Number(item.visits30d || 0);
      }
    }

    const conversion = visits > 0 ? sales / visits : 0;
    return { sales, revenue, visits, conversion };
  }, [items]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Código copiado para a área de transferência." });
  };
  const curveColor = (curve: string) => {
    const map: Record<string, string> = {
      A: "bg-emerald-100 text-emerald-800 border-emerald-200",
      B: "bg-amber-100 text-amber-800 border-amber-200",
      C: "bg-blue-100 text-blue-800 border-blue-200",
    };
    return map[curve] || "bg-gray-100 text-gray-800";
  };
  const getPriorityMeta = useCallback((curve: "A" | "B" | "C") => {
    if (curve === "A") {
      return {
        shortLabel: "Alta prioridade",
        title: "Alta prioridade",
        description: "Itens mais fortes para manter ativos e proteger com estoque.",
      };
    }
    if (curve === "B") {
      return {
        shortLabel: "Média prioridade",
        title: "Média prioridade",
        description: "Itens com bom potencial, mas que ainda pedem acompanhamento.",
      };
    }
    return {
      shortLabel: "Observação",
      title: "Observação",
      description: "Itens para teste controlado, ajuste ou revisão antes de ampliar verba.",
    };
  }, []);
  const formatNumber = useCallback((value: number | null | undefined, digits = 0) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
  }, []);
  const formatPercent = useCallback((value: number | null | undefined, digits = 1) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${formatNumber(value * 100, digits)}%`;
  }, [formatNumber]);
  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR");
  };
  const formatCoverageDays = useCallback((value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "—";
    if (value <= 0) return "0 dias";
    if (value < 45) return `~${formatNumber(value, 0)} dias`;
    if (value < 365) return `~${formatNumber(value / 30, 1)} meses`;
    return "12+ meses";
  }, [formatNumber]);
  const getStockStatusMeta = (item: (typeof items)[number]) => {
    const stock = item.stock;
    const coverageDays = getStockCoverageDays(item);

    if (stock === null || stock === undefined) {
      return {
        label: "Estoque não sincronizado",
        detail: "Atualize os dados do catálogo",
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
    }

    if (stock <= 0) {
      return {
        label: "Sem estoque",
        detail: getTotalSales(item) > 0 ? "Recomprar com fornecedor" : "Sem saldo disponível",
        className: "border-red-200 bg-red-100 text-red-700",
      };
    }

    if (coverageDays !== null && coverageDays < 7) {
      return {
        label: "Reposição urgente",
        detail: `${formatCoverageDays(coverageDays)} de cobertura`,
        className: "border-red-200 bg-red-100 text-red-700",
      };
    }

    if (coverageDays !== null && coverageDays < 14) {
      return {
        label: "Estoque curto",
        detail: `${formatCoverageDays(coverageDays)} de cobertura`,
        className: "border-amber-200 bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "Estoque ok",
      detail: coverageDays !== null ? `${formatCoverageDays(coverageDays)} de cobertura` : `${formatNumber(stock)} un.`,
      className: "border-emerald-200 bg-emerald-100 text-emerald-700",
    };
  };
  const getCampaignReadinessMeta = useCallback((item: (typeof items)[number]) => {
    const stock = Number(item.stock ?? 0);
    const coverageDays = getStockCoverageDays(item);
    const profitUnit = Number(item.profitUnit ?? 0);

    if (stock <= 0 || profitUnit <= 0) {
      return {
        status: "hold" as CampaignReadiness,
        label: "Não anunciar agora",
        detail: stock <= 0 ? "Sem estoque" : "Margem insuficiente",
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
    }

    if (stock < 7 || (coverageDays !== null && coverageDays < 14)) {
      return {
        status: "restock" as CampaignReadiness,
        label: "Repor antes",
        detail: stock < 7 ? `${formatNumber(stock)} un. no estoque` : `${formatCoverageDays(coverageDays)} de cobertura`,
        className: "border-red-200 bg-red-100 text-red-700",
      };
    }

    if (stock < 14 || (coverageDays !== null && coverageDays < 21)) {
      return {
        status: "caution" as CampaignReadiness,
        label: "Anunciar com cautela",
        detail: `${formatCoverageDays(coverageDays)} de cobertura`,
        className: "border-amber-200 bg-amber-100 text-amber-700",
      };
    }

    return {
      status: "ready" as CampaignReadiness,
      label: "Pronto para anunciar",
      detail: `${formatCoverageDays(coverageDays)} de cobertura`,
      className: "border-emerald-200 bg-emerald-100 text-emerald-700",
    };
  }, [formatCoverageDays, formatNumber, getStockCoverageDays]);
  const getCampaignProductCoverageDays = useCallback((product: CampaignInventoryProduct) => {
    if (product.coverageDays !== null && product.coverageDays !== undefined && Number.isFinite(product.coverageDays)) {
      return Number(product.coverageDays);
    }
    const stock = product.stock;
    if (stock === null || stock === undefined) return null;
    if (stock <= 0) return 0;
    const velocity = Number(product.totalSales30d || 0) / 30;
    if (velocity <= 0) return null;
    return stock / velocity;
  }, []);
  const getCampaignProductStockMeta = useCallback((product: CampaignInventoryProduct) => {
    const stock = product.stock;
    const coverageDays = getCampaignProductCoverageDays(product);

    if (stock === null || stock === undefined) {
      return {
        label: "Sem estoque sincronizado",
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
    }

    if (stock <= 0) {
      return {
        label: "Sem estoque",
        className: "border-red-200 bg-red-100 text-red-700",
      };
    }

    if (coverageDays !== null && coverageDays < 14) {
      return {
        label: "Estoque raso",
        className: "border-red-200 bg-red-100 text-red-700",
      };
    }

    if (coverageDays !== null && coverageDays < 30) {
      return {
        label: "Cobertura curta",
        className: "border-amber-200 bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "Profundidade boa",
      className: "border-emerald-200 bg-emerald-100 text-emerald-700",
    };
  }, [getCampaignProductCoverageDays]);
  const getCampaignProductRecommendation = useCallback((product: CampaignInventoryProduct) => {
    const stock = Number(product.stock ?? 0);
    const coverageDays = getCampaignProductCoverageDays(product);

    if (stock <= 0) return "Repor antes de manter verba";
    if (coverageDays !== null && coverageDays < 14) return "Segurar ou reduzir SKU";
    if (coverageDays !== null && coverageDays < 30) return "Monitorar reposição";
    return "Item com boa profundidade";
  }, [getCampaignProductCoverageDays]);
  const getPriorityScore = useCallback((item: (typeof items)[number]) => {
    const totalSales = getTotalSales(item);
    const stock = Number(item.stock ?? 0);
    const coverageDays = getStockCoverageDays(item);
    const profitUnit = Number(item.profitUnit ?? 0);
    const adsSales = getAdsSales(item);
    const readiness = getCampaignReadinessMeta(item).status;

    const salesScore = Math.min(45, totalSales * 1.2);
    const stockScore = Math.min(20, stock * 0.35);
    const coverageScore = Math.min(20, Math.max(0, coverageDays ?? 0) * 0.25);
    const profitScore = Math.min(10, Math.max(0, profitUnit));
    const adsScore = Math.min(10, adsSales * 2);
    const readinessAdjustment =
      readiness === "ready" ? 10
      : readiness === "caution" ? 4
      : readiness === "restock" ? -12
      : -30;

    return Math.round(salesScore + stockScore + coverageScore + profitScore + adsScore + readinessAdjustment);
  }, [getAdsSales, getCampaignReadinessMeta, getStockCoverageDays, getTotalSales]);
  const sortByDemandDescending = useCallback((a: (typeof items)[number], b: (typeof items)[number]) => {
    const salesDiff = getTotalSales(b) - getTotalSales(a);
    if (salesDiff !== 0) return salesDiff;
    const velocityDiff = getSalesVelocity30d(b) - getSalesVelocity30d(a);
    if (velocityDiff !== 0) return velocityDiff;
    const stockDiff = Number(b.stock ?? -1) - Number(a.stock ?? -1);
    if (stockDiff !== 0) return stockDiff;
    return getPriorityScore(b) - getPriorityScore(a);
  }, [getPriorityScore, getSalesVelocity30d, getTotalSales]);

  const bestSellerItems = useMemo(() => (
    items
      .filter((item) => getTotalSales(item) > 0)
      .sort(sortByDemandDescending)
  ), [getTotalSales, items, sortByDemandDescending]);

  const rankedCampaignCandidates = useMemo(() => (
    bestSellerItems
      .filter((item) => item.status === "active" && Number(item.stock ?? 0) > 0 && Number(item.profitUnit ?? 0) > 0)
      .sort(sortByDemandDescending)
  ), [bestSellerItems, sortByDemandDescending]);

  const readyForAdsItems = useMemo(() => (
    rankedCampaignCandidates
      .slice(0, 8)
  ), [rankedCampaignCandidates]);

  const deepStockItems = useMemo(() => (
    bestSellerItems
      .filter((item) => {
        if (Number(item.stock ?? 0) <= 0) return false;
        const coverageDays = getStockCoverageDays(item);
        return coverageDays === null || coverageDays >= 14;
      })
  ), [bestSellerItems, getStockCoverageDays]);

  const restockPriorityItems = useMemo(() => (
    bestSellerItems
      .filter((item) => {
        const stock = item.stock;
        const coverageDays = getStockCoverageDays(item);
        return stock === 0 || (Number(stock ?? 0) > 0 && coverageDays !== null && coverageDays < 14);
      })
      .sort((a, b) => {
        const aOut = Number(a.stock ?? 0) <= 0 ? 1 : 0;
        const bOut = Number(b.stock ?? 0) <= 0 ? 1 : 0;
        if (aOut !== bOut) return bOut - aOut;
        const aCoverage = getStockCoverageDays(a) ?? Number.POSITIVE_INFINITY;
        const bCoverage = getStockCoverageDays(b) ?? Number.POSITIVE_INFINITY;
        if (aCoverage !== bCoverage) return aCoverage - bCoverage;
        return getTotalSales(b) - getTotalSales(a);
      })
      .slice(0, 8)
  ), [bestSellerItems, getStockCoverageDays, getTotalSales]);

  const campaignsInventory = useMemo<CampaignInventoryAnalysis[]>(() => {
    return (campaignsData?.campaigns || [])
      .filter((campaign) => Boolean(campaign.ml_campaign_id) || (campaign.products?.length || 0) > 0)
      .map((campaign) => {
        const products = (campaign.products || []) as CampaignInventoryProduct[];
        const skuCount = products.length;
        const totalStock = products.reduce((sum, product) => sum + Math.max(0, Number(product.stock ?? 0)), 0);
        const avgStockPerSku = skuCount > 0 ? totalStock / skuCount : null;
        const outOfStockCount = products.filter((product) => Number(product.stock ?? 0) <= 0).length;
        const shallowStockCount = products.filter((product) => {
          const stock = Number(product.stock ?? 0);
          const coverageDays = getCampaignProductCoverageDays(product);
          return stock > 0 && coverageDays !== null && coverageDays < 14;
        }).length;
        const deepStockCount = products.filter((product) => {
          const stock = Number(product.stock ?? 0);
          const coverageDays = getCampaignProductCoverageDays(product);
          if (stock <= 0) return false;
          if (coverageDays !== null) return coverageDays >= 30;
          return stock >= 30;
        }).length;
        const sellingSkuCount = products.filter((product) => Number(product.totalSales30d || 0) > 0).length;

        let recommendation: CampaignInventoryAnalysis["recommendation"];
        if (skuCount === 0) {
          recommendation = {
            label: "Campanha sem produtos sincronizados",
            description: "A campanha existe, mas ainda não encontramos anúncios/produtos vinculados na sincronização.",
            className: "bg-slate-100 text-slate-800 border-slate-200",
          };
        } else if (outOfStockCount > 0) {
          recommendation = {
            label: "Reposição imediata",
            description: "Existem SKUs sem estoque dentro da campanha. Repor ou remover esses itens evita desperdiçar tráfego.",
            className: "bg-red-100 text-red-800 border-red-200",
          };
        } else if (skuCount >= 6 && (avgStockPerSku ?? 0) < 8) {
          recommendation = {
            label: "Campanha pulverizada",
            description: "Há muitos SKUs para pouco estoque médio. Vale reduzir variedade e concentrar verba nos produtos mais fundos.",
            className: "bg-red-100 text-red-800 border-red-200",
          };
        } else if (shallowStockCount >= Math.max(2, Math.ceil(skuCount / 2))) {
          recommendation = {
            label: "Profundidade insuficiente",
            description: "Metade ou mais dos itens está com cobertura curta. Reforce estoque antes de escalar a campanha.",
            className: "bg-amber-100 text-amber-800 border-amber-200",
          };
        } else if (skuCount <= 3 && (avgStockPerSku ?? 0) >= 12 && deepStockCount >= Math.max(1, Math.ceil(skuCount / 2))) {
          recommendation = {
            label: "Boa profundidade",
            description: "Campanha enxuta, com menos SKUs e bom estoque por item. Este é o desenho mais alinhado ao objetivo.",
            className: "bg-emerald-100 text-emerald-800 border-emerald-200",
          };
        } else {
          recommendation = {
            label: "Campanha intermediária",
            description: "A campanha já tem base, mas ainda pode ganhar foco reduzindo SKUs rasos e preservando os itens com melhor cobertura.",
            className: "bg-blue-100 text-blue-800 border-blue-200",
          };
        }

        const pressureScore =
          (outOfStockCount * 100)
          + (shallowStockCount * 35)
          + (Math.max(0, skuCount - 3) * 12)
          - (deepStockCount * 8)
          - Math.min(40, Math.max(0, avgStockPerSku ?? 0));

        return {
          id: campaign.id,
          name: campaign.name,
          curve: campaign.curve || null,
          status: campaign.status,
          mlCampaignId: campaign.ml_campaign_id || null,
          dailyBudget: campaign.daily_budget || null,
          totalProducts: Number(campaign.total_products || skuCount),
          activeProducts: Number(campaign.active_products || 0),
          products,
          skuCount,
          totalStock,
          avgStockPerSku,
          outOfStockCount,
          shallowStockCount,
          deepStockCount,
          sellingSkuCount,
          recommendation,
          pressureScore,
        };
      })
      .sort((a, b) => {
        if (b.pressureScore !== a.pressureScore) return b.pressureScore - a.pressureScore;
        return b.totalStock - a.totalStock;
      });
  }, [campaignsData?.campaigns, getCampaignProductCoverageDays]);

  const campaignInventorySummary = useMemo(() => {
    const totalCampaigns = campaignsInventory.length;
    const totalSku = campaignsInventory.reduce((sum, campaign) => sum + campaign.skuCount, 0);
    const totalStock = campaignsInventory.reduce((sum, campaign) => sum + campaign.totalStock, 0);
    const pulverizedCampaigns = campaignsInventory.filter((campaign) => campaign.recommendation.label === "Campanha pulverizada").length;
    const healthyDepthCampaigns = campaignsInventory.filter((campaign) => campaign.recommendation.label === "Boa profundidade").length;

    return {
      totalCampaigns,
      totalSku,
      totalStock,
      avgStockPerSku: totalSku > 0 ? totalStock / totalSku : null,
      pulverizedCampaigns,
      healthyDepthCampaigns,
    };
  }, [campaignsInventory]);

  const trend = useMemo(() => {
    if (!metrics?.daily?.length) {
      return {
        hasTrend: false,
        last7: null as null | Record<string, number>,
        prev7: null as null | Record<string, number>,
        delta: null as null | Record<string, number | null>,
      };
    }

    const daily = metrics.daily;
    const last14 = daily.slice(-14);
    const last7 = last14.slice(-7);
    const prev7 = last14.slice(0, Math.max(0, last14.length - 7));

    const sumBy = (rows: typeof daily, key: keyof (typeof daily)[number]) =>
      rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);

    const last7Totals = {
      clicks: sumBy(last7, "clicks"),
      prints: sumBy(last7, "prints"),
      cost: sumBy(last7, "cost"),
      revenue: sumBy(last7, "revenue"),
      units: sumBy(last7, "units"),
    };

    const prev7Totals = {
      clicks: sumBy(prev7, "clicks"),
      prints: sumBy(prev7, "prints"),
      cost: sumBy(prev7, "cost"),
      revenue: sumBy(prev7, "revenue"),
      units: sumBy(prev7, "units"),
    };

    const hasTrend = last7.length >= 3 && prev7.length >= 3;
    const calcDelta = (current: number, previous: number) => (hasTrend && previous > 0 ? (current - previous) / previous : null);

    const ctrLast7 = last7Totals.prints > 0 ? last7Totals.clicks / last7Totals.prints : 0;
    const ctrPrev7 = prev7Totals.prints > 0 ? prev7Totals.clicks / prev7Totals.prints : 0;
    const conversionLast7 = last7Totals.clicks > 0 ? last7Totals.units / last7Totals.clicks : 0;
    const conversionPrev7 = prev7Totals.clicks > 0 ? prev7Totals.units / prev7Totals.clicks : 0;
    const acosLast7 = last7Totals.revenue > 0 ? last7Totals.cost / last7Totals.revenue : 0;
    const acosPrev7 = prev7Totals.revenue > 0 ? prev7Totals.cost / prev7Totals.revenue : 0;
    const roasLast7 = last7Totals.cost > 0 ? last7Totals.revenue / last7Totals.cost : 0;
    const roasPrev7 = prev7Totals.cost > 0 ? prev7Totals.revenue / prev7Totals.cost : 0;

    return {
      hasTrend,
      last7: last7Totals,
      prev7: prev7Totals,
      delta: {
        clicks: calcDelta(last7Totals.clicks, prev7Totals.clicks),
        prints: calcDelta(last7Totals.prints, prev7Totals.prints),
        revenue: calcDelta(last7Totals.revenue, prev7Totals.revenue),
        cost: calcDelta(last7Totals.cost, prev7Totals.cost),
        units: calcDelta(last7Totals.units, prev7Totals.units),
        ctr: calcDelta(ctrLast7, ctrPrev7),
        conversion: calcDelta(conversionLast7, conversionPrev7),
        acos: calcDelta(acosLast7, acosPrev7),
        roas: calcDelta(roasLast7, roasPrev7),
      },
    };
  }, [metrics]);

  const summaryMetrics = metrics?.summary || null;
  const summaryAcos = summaryMetrics ? (summaryMetrics.revenue > 0 ? summaryMetrics.cost / summaryMetrics.revenue : 0) : 0;
  const summaryRoas = summaryMetrics ? (summaryMetrics.cost > 0 ? summaryMetrics.revenue / summaryMetrics.cost : 0) : 0;

  const formatDelta = (delta: number | null) => {
    if (delta === null) return "—";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${formatPercent(delta, 1)}`;
  };

  const deltaClass = (delta: number | null) => {
    if (delta === null) return "text-muted-foreground";
    return delta >= 0 ? "text-emerald-600" : "text-red-600";
  };
  const handleSyncAnalytics = async () => {
    if (!workspaceId) return;
    try {
      await analyticsSyncMutation.mutateAsync(workspaceId);
      toast({
        title: "Dados sincronizados",
        description: "Atualizamos vendas, visitas e conversão dos últimos 30 dias.",
      });
    } catch (error) {
      toast({
        title: "Falha ao sincronizar",
        description: (error as Error)?.message || "Não foi possível atualizar os dados agora.",
        variant: "destructive",
      });
    }
  };
  if (isPreviewLoading && isCampaignsLoading && !previewData && !campaignsData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Mercado Ads • Diagnóstico e Otimização</h1>
            <p className="text-muted-foreground">
              Diagnóstico rápido para entender queda de vendas e decidir o que manter, pausar, repor e escalar no Ads.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAnalytics}
            disabled={!workspaceId || analyticsSyncMutation.isPending}
          >
            {analyticsSyncMutation.isPending ? "Atualizando..." : "Atualizar dados 30d"}
          </Button>
        </div>
      </div>

      {previewError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar classificação</AlertTitle>
          <AlertDescription>
            {(previewError as Error)?.message}
          </AlertDescription>
        </Alert>
      )}

      {campaignsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar métricas de Ads</AlertTitle>
          <AlertDescription>
            {(campaignsError as Error)?.message}
          </AlertDescription>
        </Alert>
      )}

      {!hasCampaignMetrics && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-800">Dados de Ads indisponíveis</AlertTitle>
          <AlertDescription className="text-amber-700">
            Não encontramos métricas recentes de anúncios. Refaça a conexão do Mercado Livre Ads em Integrações.
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => navigate("/integrations")}>Abrir Integrações</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {hasCampaignMetrics && !hasItemMetrics && items.length > 0 && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Métricas por item indisponíveis</AlertTitle>
          <AlertDescription className="text-blue-700">
            A visão por produto não está disponível no momento. As métricas gerais estão ok, e vamos usar vendas totais (30d) como base.
            {diagnostics && (
              <div className="mt-2 text-xs text-blue-700">
                Cobertura Ads por item: {formatNumber(diagnostics.itemsWithMetrics || 0)} / {formatNumber(diagnostics.totalItems || 0)}
              </div>
            )}
            {adsError?.message && (
              <div className="mt-2 text-xs text-blue-700">
                Detalhe: {adsError.status ? `HTTP ${adsError.status} • ` : ""}{adsError.message}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!demandMetricsAvailable && items.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-800">Métricas de demanda indisponíveis</AlertTitle>
          <AlertDescription className="text-amber-700">
            Não encontramos visitas por produto para calcular conversão. Rode a sincronização de Analytics 30d para completar a análise.
            {diagnostics && (
              <div className="mt-2 text-xs text-amber-700">
                Cobertura de demanda: {formatNumber(itemsWithDemand)} / {formatNumber(diagnostics.totalItems || 0)}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="diagnostico" className="space-y-6">
        <TabsList>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          <TabsTrigger value="curvas">Prioridade Interna</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostico" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">Vendas Ads (30d)</CardTitle>
                <div className="text-2xl font-bold">
                  {summaryMetrics ? formatNumber(summaryMetrics.units) : "—"}
                </div>
                <div className={`text-xs ${deltaClass(trend.delta?.units ?? null)}`}>
                  {formatDelta(trend.delta?.units ?? null)} vs 7d anteriores
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">Receita Ads (30d)</CardTitle>
                <div className="text-2xl font-bold">
                  {summaryMetrics ? formatCurrency(summaryMetrics.revenue || 0) : "—"}
                </div>
                <div className={`text-xs ${deltaClass(trend.delta?.revenue ?? null)}`}>
                  {formatDelta(trend.delta?.revenue ?? null)} vs 7d anteriores
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">ROAS (30d)</CardTitle>
                <div className="text-2xl font-bold">
                  {summaryMetrics ? formatNumber(summaryRoas, 2) : "—"}
                </div>
                <div className={`text-xs ${deltaClass(trend.delta?.roas ?? null)}`}>
                  {formatDelta(trend.delta?.roas ?? null)} vs 7d anteriores
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">ACOS (30d)</CardTitle>
                <div className="text-2xl font-bold">
                  {summaryMetrics ? formatPercent(summaryAcos, 1) : "—"}
                </div>
                <div className={`text-xs ${deltaClass(trend.delta?.acos ?? null)}`}>
                  {formatDelta(trend.delta?.acos ?? null)} vs 7d anteriores
                </div>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">Vendas Totais (30d)</CardTitle>
                <div className="text-2xl font-bold">{formatNumber(demandTotals.sales)}</div>
                <div className="text-xs text-muted-foreground">Pedidos no Mercado Livre</div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">Receita Total (30d)</CardTitle>
                <div className="text-2xl font-bold">{formatCurrency(demandTotals.revenue)}</div>
                <div className="text-xs text-muted-foreground">Faturamento do período</div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">Visitas (30d)</CardTitle>
                <div className="text-2xl font-bold">
                  {demandMetricsAvailable ? formatNumber(demandTotals.visits) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Soma das visitas por produto</div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm text-muted-foreground">Conversão (30d)</CardTitle>
                <div className="text-2xl font-bold">
                  {demandMetricsAvailable ? formatPercent(demandTotals.conversion, 1) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Vendas ÷ visitas</div>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-emerald-200/70 bg-emerald-50/30">
            <CardHeader>
              <CardTitle className="text-base">Seleção de produtos para Ads</CardTitle>
              <CardDescription>
                Priorize itens já vendidos, com preço parecido e estoque suficiente para sustentar a campanha. Se o item vende bem e zerou, a ação correta é recomprar, não escalar anúncio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-emerald-200 bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Ativos elegíveis para campanha</div>
                  <div className="text-lg font-semibold">{formatNumber(readyForAdsItems.length)}</div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Estoque profundo</div>
                  <div className="text-lg font-semibold">{formatNumber(deepStockItems.length)}</div>
                  <div className="text-xs text-muted-foreground">14+ dias estimados</div>
                </div>
                <div className="rounded-md border border-amber-200 bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Reposição necessária</div>
                  <div className="text-lg font-semibold">{formatNumber(restockPriorityItems.length)}</div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-white/80 p-3">
                  <div className="text-xs text-muted-foreground">Campanhas sincronizadas</div>
                  <div className="text-lg font-semibold">{formatNumber(campaignInventorySummary.totalCampaigns)}</div>
                  <div className="text-xs text-muted-foreground">Leitura pronta por campanha</div>
                </div>
              </div>

              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Fluxo manual recomendado nesta conta</AlertTitle>
                <AlertDescription>
                  A API desta conta nao esta conseguindo criar campanha nem mover anuncios com seguranca. Use a leitura de campanhas abaixo para decidir onde reduzir SKU, reforcar estoque e concentrar verba.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Campanhas criadas e profundidade de estoque</CardTitle>
              <CardDescription>
                Leitura campanha a campanha para reduzir SKU pulverizado e concentrar investimento nos produtos com estoque mais profundo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs text-muted-foreground">Campanhas sincronizadas</div>
                  <div className="text-lg font-semibold">{formatNumber(campaignInventorySummary.totalCampaigns)}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs text-muted-foreground">SKUs em campanhas</div>
                  <div className="text-lg font-semibold">{formatNumber(campaignInventorySummary.totalSku)}</div>
                  <div className="text-xs text-muted-foreground">
                    média {formatNumber(campaignInventorySummary.avgStockPerSku, 1)} un. por SKU
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs text-muted-foreground">Estoque total em campanha</div>
                  <div className="text-lg font-semibold">{formatNumber(campaignInventorySummary.totalStock)}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs text-muted-foreground">Campanhas com boa profundidade</div>
                  <div className="text-lg font-semibold">{formatNumber(campaignInventorySummary.healthyDepthCampaigns)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(campaignInventorySummary.pulverizedCampaigns)} pulverizada(s)
                  </div>
                </div>
              </div>

              {campaignsInventory.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Nenhuma campanha sincronizada com produtos foi encontrada ainda.
                </div>
              ) : (
                <Accordion type="multiple" className="w-full space-y-3">
                  {campaignsInventory.map((campaign) => (
                    <AccordionItem
                      key={`campaign-stock-${campaign.id}`}
                      value={campaign.id}
                      className="rounded-md border border-slate-200 bg-white px-4"
                    >
                      <AccordionTrigger className="py-4 hover:no-underline">
                        <div className="flex w-full flex-col gap-3 pr-4 text-left md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{campaign.name}</div>
                              {campaign.curve && (
                                <Badge className={curveColor(campaign.curve)}>
                                  Curva {campaign.curve}
                                </Badge>
                              )}
                              <Badge variant="outline" className="capitalize">
                                {campaign.status}
                              </Badge>
                              <Badge className={campaign.recommendation.className}>
                                {campaign.recommendation.label}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {campaign.recommendation.description}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {campaign.mlCampaignId ? `ID Mercado Ads: ${campaign.mlCampaignId}` : "Campanha sem ID remoto"}{" • "}
                              orçamento diário {campaign.dailyBudget !== null ? formatCurrency(campaign.dailyBudget) : "—"}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs md:min-w-[300px]">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <div className="text-muted-foreground">SKUs</div>
                              <div className="font-semibold">{formatNumber(campaign.skuCount)}</div>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <div className="text-muted-foreground">Estoque total</div>
                              <div className="font-semibold">{formatNumber(campaign.totalStock)}</div>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <div className="text-muted-foreground">Média por SKU</div>
                              <div className="font-semibold">{formatNumber(campaign.avgStockPerSku, 1)}</div>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <div className="text-muted-foreground">Rasos / sem estoque</div>
                              <div className="font-semibold">
                                {formatNumber(campaign.shallowStockCount)} / {formatNumber(campaign.outOfStockCount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-muted-foreground">SKUs vendendo 30d</div>
                            <div className="text-lg font-semibold">{formatNumber(campaign.sellingSkuCount)}</div>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-muted-foreground">SKUs com profundidade boa</div>
                            <div className="text-lg font-semibold">{formatNumber(campaign.deepStockCount)}</div>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-muted-foreground">Produtos ativos detectados</div>
                            <div className="text-lg font-semibold">{formatNumber(campaign.activeProducts)}</div>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-muted-foreground">Produtos totais detectados</div>
                            <div className="text-lg font-semibold">{formatNumber(campaign.totalProducts)}</div>
                          </div>
                        </div>

                        {campaign.products.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            A campanha foi sincronizada, mas ainda não encontramos produtos associados nela.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>Preço</TableHead>
                                <TableHead>Vendas 30d</TableHead>
                                <TableHead>Estoque</TableHead>
                                <TableHead>Cobertura</TableHead>
                                <TableHead>Ação</TableHead>
                                <TableHead>ID ML</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {campaign.products.map((product, index) => {
                                const stockMeta = getCampaignProductStockMeta(product);
                                const coverageDays = getCampaignProductCoverageDays(product);

                                return (
                                  <TableRow
                                    key={`${campaign.id}:${product.productId || product.mlItemId || product.mlAdId || index}`}
                                  >
                                    <TableCell className="max-w-[280px] font-medium">
                                      <div className="truncate" title={product.title || ""}>
                                        {product.title || "Produto sem título sincronizado"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {product.sku || "SKU —"}
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        <Badge variant="outline" className={stockMeta.className}>
                                          {stockMeta.label}
                                        </Badge>
                                        {product.adStatus && (
                                          <Badge variant="outline" className="capitalize">
                                            anúncio {product.adStatus}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {product.price !== null && product.price !== undefined
                                        ? formatCurrency(product.price)
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{formatNumber(product.totalSales30d)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatCurrency(product.totalRevenue30d || 0)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{formatNumber(product.stock)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        Total vendido: {formatNumber(product.lifetimeSales)}
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatCoverageDays(coverageDays)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {getCampaignProductRecommendation(product)}
                                    </TableCell>
                                    <TableCell>
                                      {product.mlItemId ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8"
                                          onClick={() => copyToClipboard(product.mlItemId as string)}
                                        >
                                          <Copy className="mr-1 h-3 w-3" />
                                          {product.mlItemId}
                                        </Button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="curvas" className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Como ler esta classificação</AlertTitle>
            <AlertDescription className="text-blue-700">
              Esta aba mostra uma prioridade interna para orientar operação. Ela não representa campanhas reais do Mercado Ads. Use a aba Diagnóstico para montar campanhas e esta aba só para entender quais itens merecem mais atenção.
            </AlertDescription>
          </Alert>

          {["A", "B", "C"].map((curve) => {
            const products = groupedItems[curve as "A" | "B" | "C"];
            const count = summary[curve] || 0;
            const priority = getPriorityMeta(curve as "A" | "B" | "C");

            if (products.length === 0) return null;

            return (
              <Card key={curve} className="border-l-4" style={{ borderLeftColor: curve === "A" ? "#10b981" : curve === "B" ? "#f59e0b" : "#3b82f6" }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Badge className={`text-base px-3 py-1 ${curveColor(curve)}`}>
                        {priority.title}
                      </Badge>
                      <span className="text-muted-foreground text-sm font-normal">
                        {priority.description}
                      </span>
                    </CardTitle>
                    <Badge variant="outline">{count} produtos</Badge>
                  </div>
                  <CardDescription>
                    Classificação operacional interna para organizar revisão e prioridade do catálogo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Métricas (30d)</TableHead>
                        <TableHead>Demanda (30d)</TableHead>
                        <TableHead>ACOS</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="w-[120px]">ID ML</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium max-w-[300px]">
                            {(() => {
                              const stockMeta = getStockStatusMeta(item);
                              return (
                                <>
                                  <div className="truncate" title={item.title || ""}>{item.title}</div>
                                  <div className="text-xs text-muted-foreground">{item.sku}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Publicado {formatDate(item.publishedAt)}
                                    {" • "}
                                    {item.ageDays !== null && item.ageDays !== undefined ? `${formatNumber(item.ageDays)} dias` : "idade —"}
                                    {" • "}
                                    Estoque {item.stock !== null && item.stock !== undefined ? formatNumber(item.stock) : "—"}
                                    {" • "}
                                    {item.status || "status —"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Preço {item.price !== null && item.price !== undefined ? formatCurrency(item.price) : "—"}
                                    {" • "}
                                    Total vendido: {formatNumber(item.lifetimeSales || 0)}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge variant="outline" className={stockMeta.className}>{stockMeta.label}</Badge>
                                    {item.action === "paused" && (
                                      <Badge variant="destructive">Pausar</Badge>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="text-xs text-muted-foreground">
                                {item.hasAdsMetrics ? "Ads 30d" : "Total 30d"}
                              </div>
                              {item.hasAdsMetrics
                                ? `${formatNumber(getAdsSales(item))} vendas • ${formatCurrency(getAdsRevenue(item))}`
                                : `${formatNumber(getTotalSales(item))} vendas • ${formatCurrency(getTotalRevenue(item))}`}
                              <br />
                              {item.hasAdsMetrics
                                ? `${formatNumber(getAdsClicks(item))} cliques • ${formatCurrency(getAdsCost(item))}`
                                : "Total 30d (pedidos)"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.visits30d !== null && item.visits30d !== undefined ? (
                              <div className="text-sm">
                                <div className="text-xs text-muted-foreground">Visitas / Conversão</div>
                                {formatNumber(getVisits30d(item))} visitas • {formatPercent(getConversionRate30d(item), 1)}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.adsAcos && item.adsAcos > 0.3 ? "destructive" : "secondary"}>
                              {item.hasAdsMetrics && item.adsAcos !== undefined ? formatPercent(item.adsAcos, 1) : "—"}
                            </Badge>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Cobertura {formatCoverageDays(getStockCoverageDays(item))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {item.reason}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() => copyToClipboard(item.mlItemId)}
                            >
                              <Copy className="h-3 w-3" />
                              {item.mlItemId}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

    </div>
  );
}
