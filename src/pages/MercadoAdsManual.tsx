import { useCallback, useMemo, useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useApplyMercadoAdsActions,
  useMercadoAdsActionPlan,
  useMercadoAdsAutomationRules,
  useMercadoAdsCampaigns,
  useMercadoAdsPreview,
  useMercadoAdsWeeklyReportSettings,
  useSendMercadoAdsWeeklyReport,
  useUpdateMercadoAdsAutomationRules,
  useUpdateMercadoAdsWeeklyReportSettings,
} from "@/hooks/useMercadoAds";
import { useSyncMercadoLivreAnalytics } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatters";
import { useNavigate } from "react-router-dom";
import {
  Info,
  AlertCircle,
  Copy,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Settings,
} from "lucide-react";

type Insight = {
  title: string;
  description: string;
  level: "critical" | "warning" | "info" | "success";
};

type AutomationRule = {
  id: string;
  rule_key: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, number>;
};

type PlannedAction = {
  id: string;
  productId: string;
  mlItemId: string;
  type: "pause_ad" | "move_curve";
  currentCurve: "A" | "B" | "C";
  targetCurve?: "A" | "B" | "C";
  reason: string;
  ruleKey: string;
};

export default function MercadoAdsManual() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;
  const { data: previewData, isLoading: isPreviewLoading, error: previewError } = useMercadoAdsPreview(workspaceId);
  const { data: campaignsData, isLoading: isCampaignsLoading, error: campaignsError } = useMercadoAdsCampaigns(workspaceId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const analyticsSyncMutation = useSyncMercadoLivreAnalytics();
  const { data: actionPlanData, isLoading: isActionPlanLoading, refetch: refetchActionPlan } = useMercadoAdsActionPlan(workspaceId);
  const { data: rulesData } = useMercadoAdsAutomationRules(workspaceId);
  const updateRulesMutation = useUpdateMercadoAdsAutomationRules();
  const applyActionsMutation = useApplyMercadoAdsActions();
  const { data: weeklySettingsData } = useMercadoAdsWeeklyReportSettings(workspaceId);
  const updateWeeklySettingsMutation = useUpdateMercadoAdsWeeklyReportSettings();
  const sendWeeklyReportMutation = useSendMercadoAdsWeeklyReport();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<AutomationRule[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLabel, setConfirmLabel] = useState("");
  const [pendingActions, setPendingActions] = useState<PlannedAction[]>([]);
  const [weeklySettingsDraft, setWeeklySettingsDraft] = useState({
    enabled: false,
    send_day: 1,
    send_hour: 9,
    channel: "telegram",
  });

  const items = useMemo(() => previewData?.items || [], [previewData?.items]);
  const summary = previewData?.summary || { A: 0, B: 0, C: 0 };
  const diagnostics = previewData?.diagnostics;
  const metrics = campaignsData?.metrics || null;
  const adsError = diagnostics?.adsMetricsError;
  const actionPlan = useMemo(() => actionPlanData?.actions || [], [actionPlanData?.actions]);
  const actionSummary = useMemo(
    () => actionPlanData?.summary || { pause: 0, promote: 0, demote: 0 },
    [actionPlanData?.summary],
  );

  useEffect(() => {
    if (rulesData?.rules) {
      setRulesDraft(rulesData.rules as AutomationRule[]);
    }
  }, [rulesData?.rules]);

  useEffect(() => {
    if (weeklySettingsData?.settings) {
      setWeeklySettingsDraft({
        enabled: Boolean(weeklySettingsData.settings.enabled),
        send_day: Number(weeklySettingsData.settings.send_day ?? 1),
        send_hour: Number(weeklySettingsData.settings.send_hour ?? 9),
        channel: String(weeklySettingsData.settings.channel || "telegram"),
      });
    }
  }, [weeklySettingsData?.settings]);

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

  const groupedItems = useMemo(() => ({
    A: items.filter((i) => i.curve === "A"),
    B: items.filter((i) => i.curve === "B"),
    C: items.filter((i) => i.curve === "C"),
  }), [items]);

  const hasCampaignMetrics = !!metrics;
  const hasItemMetrics = diagnostics?.adsMetricsAvailable ?? false;
  const demandMetricsAvailable = diagnostics?.demandMetricsAvailable ?? items.some((item) => item.visits30d !== null && item.visits30d !== undefined);
  const itemsWithDemand = diagnostics?.itemsWithDemand ?? 0;
  const fullClassificationCount = useMemo(() => items.filter((item) => (item.reason || "").toLowerCase().includes("classificação full")).length, [items]);
  const fallbackClassificationCount = Math.max(items.length - fullClassificationCount, 0);

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

  const pauseCandidates = useMemo(() => {
    return items
      .filter((item) => {
        if (item.curve !== "C") return false;
        if (item.hasAdsMetrics) {
          return item.action === "paused" || (getAdsClicks(item) >= 15 && getAdsSales(item) === 0);
        }
        if (item.visits30d !== null && item.visits30d !== undefined) {
          return getTotalSales(item) === 0 && getVisits30d(item) >= 50;
        }
        const ageDays = item.ageDays ?? 0;
        return getTotalSales(item) === 0 && ageDays >= 45;
      })
      .sort((a, b) => {
        const aScore = a.hasAdsMetrics ? getAdsClicks(a) : (a.visits30d ?? a.ageDays ?? 0);
        const bScore = b.hasAdsMetrics ? getAdsClicks(b) : (b.visits30d ?? b.ageDays ?? 0);
        return bScore - aScore;
      })
      .slice(0, 10);
  }, [items, getAdsClicks, getAdsSales, getTotalSales, getVisits30d]);

  const promoteCandidates = useMemo(() => {
    return items
      .filter((item) => {
        if (item.curve !== "B") return false;
        if (item.hasAdsMetrics) {
          return getAdsSales(item) >= 2 && (item.adsAcos || 0) <= 0.3;
        }
        const profitUnit = Number(item.profitUnit || 0);
        return getTotalSales(item) >= 5 && profitUnit > 0;
      })
      .sort((a, b) => {
        const aScore = a.hasAdsMetrics ? getAdsSales(a) : getTotalSales(a);
        const bScore = b.hasAdsMetrics ? getAdsSales(b) : getTotalSales(b);
        return bScore - aScore;
      })
      .slice(0, 10);
  }, [items, getAdsSales, getTotalSales]);

  const lowConversionItems = useMemo(() => {
    if (!demandMetricsAvailable) return [];
    return items
      .filter((item) => {
        if (item.visits30d === null || item.visits30d === undefined) return false;
        if (getVisits30d(item) < 100) return false;
        const conversion = getConversionRate30d(item);
        return conversion !== null && conversion < 0.01;
      })
      .sort((a, b) => getVisits30d(b) - getVisits30d(a))
      .slice(0, 10);
  }, [demandMetricsAvailable, getConversionRate30d, getVisits30d, items]);

  const highConversionItems = useMemo(() => {
    if (!demandMetricsAvailable) return [];
    return items
      .filter((item) => {
        if (item.visits30d === null || item.visits30d === undefined) return false;
        if (getVisits30d(item) > 50) return false;
        const conversion = getConversionRate30d(item);
        return conversion !== null && conversion >= 0.03 && getTotalSales(item) >= 1;
      })
      .sort((a, b) => (getConversionRate30d(b) || 0) - (getConversionRate30d(a) || 0))
      .slice(0, 10);
  }, [demandMetricsAvailable, getConversionRate30d, getTotalSales, getVisits30d, items]);

  const curveRank = useMemo(() => ({ C: 1, B: 2, A: 3 }), []);

  const pauseActions = useMemo(
    () => actionPlan.filter((action) => action.type === "pause_ad"),
    [actionPlan],
  );

  const promoteActions = useMemo(
    () =>
      actionPlan.filter((action) => {
        if (action.type !== "move_curve" || !action.targetCurve) return false;
        return curveRank[action.targetCurve] > curveRank[action.currentCurve];
      }),
    [actionPlan, curveRank],
  );

  const demoteActions = useMemo(
    () =>
      actionPlan.filter((action) => {
        if (action.type !== "move_curve" || !action.targetCurve) return false;
        return curveRank[action.targetCurve] < curveRank[action.currentCurve];
      }),
    [actionPlan, curveRank],
  );

  const highAcosItems = useMemo(() => {
    return items
      .filter((item) => item.hasAdsMetrics && getAdsCost(item) > 0 && (item.adsAcos || 0) > 0.4)
      .sort((a, b) => (b.adsAcos || 0) - (a.adsAcos || 0))
      .slice(0, 10);
  }, [items, getAdsCost]);

  const staleItems = useMemo(() => {
    return items
      .filter((item) => {
        const ageDays = item.ageDays ?? 0;
        return getTotalSales(item) === 0 && ageDays >= 60;
      })
      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
      .slice(0, 10);
  }, [items, getTotalSales]);

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

  const formatNumber = (value: number | null | undefined, digits = 0) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
  };
  const formatPercent = (value: number | null | undefined, digits = 1) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${formatNumber(value * 100, digits)}%`;
  };
  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR");
  };

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

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    if (!metrics) {
      list.push({
        level: "critical",
        title: "Sem métricas do Mercado Ads",
        description: "Não consegui carregar dados de Ads. Confirme a integração e as permissões de publicidade.",
      });
    }

    if (hasCampaignMetrics && !hasItemMetrics && items.length > 0) {
      list.push({
        level: "warning",
        title: "Sem métricas por produto",
        description: "As métricas gerais estão ok, mas o detalhe por item não está disponível. Usaremos vendas totais de 30d como base.",
      });
    }

    if (trend.hasTrend && trend.delta?.units !== null && trend.delta.units <= -0.25) {
      list.push({
        level: "critical",
        title: "Queda forte nas vendas via Ads",
        description: "As vendas dos últimos 7 dias caíram mais de 25%. Verifique status das campanhas, orçamento e lances.",
      });
    }

    if (trend.hasTrend && trend.delta?.prints !== null && trend.delta.prints <= -0.25) {
      list.push({
        level: "warning",
        title: "Alcance menor (impressões em queda)",
        description: "Impressões caíram bastante. Pode indicar budget baixo, campanhas pausadas ou perda de relevância.",
      });
    }

    if (trend.hasTrend && trend.delta?.ctr !== null && trend.delta.ctr <= -0.2) {
      list.push({
        level: "warning",
        title: "CTR caiu — revise criativos e títulos",
        description: "Quando o CTR cai, normalmente o anúncio perdeu atratividade. Atualize fotos e título dos produtos-chave.",
      });
    }

    if (trend.hasTrend && trend.delta?.conversion !== null && trend.delta.conversion <= -0.2) {
      list.push({
        level: "warning",
        title: "Conversão pior — preço/frete/estoque",
        description: "Cliques seguem, mas conversão caiu. Revise preço, prazo de entrega, reputação e estoque do anúncio.",
      });
    }

    if (demandMetricsAvailable && lowConversionItems.length > 0) {
      list.push({
        level: "warning",
        title: `Alta demanda com baixa conversão (${lowConversionItems.length})`,
        description: "Produtos com muitas visitas e pouca conversão precisam de ajustes no anúncio (título, foto, preço ou frete).",
      });
    }

    if (demandMetricsAvailable && highConversionItems.length > 0) {
      list.push({
        level: "info",
        title: `Boa conversão com pouco tráfego (${highConversionItems.length})`,
        description: "Itens com conversão alta e poucas visitas são bons candidatos para escalar Ads.",
      });
    }

    if (pauseCandidates.length > 0) {
      list.push({
        level: "info",
        title: `Pausar ${pauseCandidates.length} produtos sem venda`,
        description: "Itens com cliques sem venda (Ads) ou 45+ dias sem venda total.",
      });
    }

    if (staleItems.length > 0) {
      list.push({
        level: "warning",
        title: `Produtos parados há 60+ dias (${staleItems.length})`,
        description: "Itens antigos sem venda precisam de ajustes de preço, imagem ou revisão de catálogo.",
      });
    }

    if (highAcosItems.length > 0) {
      list.push({
        level: "warning",
        title: `ACOS alto em ${highAcosItems.length} produtos`,
        description: "Produtos com ACOS acima de 40% precisam de ajuste de lances ou migração de curva.",
      });
    }

    if (fallbackClassificationCount > 0 && fallbackClassificationCount >= Math.max(3, Math.floor(items.length * 0.5))) {
      list.push({
        level: "info",
        title: "Classificação sem Analytics Full",
        description: "Boa parte dos produtos não tem classificação completa. Sincronize o Analytics Full para decisões melhores.",
      });
    }

    if (!list.length) {
      list.push({
        level: "success",
        title: "Sem alertas críticos",
        description: "Os indicadores estão estáveis. Use a lista de produtos para ajustes finos de curva e orçamento.",
      });
    }

    return list.slice(0, 6);
  }, [demandMetricsAvailable, fallbackClassificationCount, hasCampaignMetrics, hasItemMetrics, highAcosItems.length, highConversionItems.length, items.length, lowConversionItems.length, metrics, pauseCandidates.length, staleItems.length, trend]);

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

  const openActionConfirmation = (label: string, actions: PlannedAction[]) => {
    setConfirmLabel(label);
    setPendingActions(actions);
    setConfirmOpen(true);
  };

  const handleApplyActions = async () => {
    if (!workspaceId || pendingActions.length === 0) return;
    try {
      const result = await applyActionsMutation.mutateAsync({ workspaceId, actions: pendingActions });
      toast({
        title: "Ações aplicadas",
        description: `Aplicadas: ${result?.applied || 0} • Ignoradas: ${result?.skipped || 0}`,
      });
    } catch (error) {
      toast({
        title: "Falha ao aplicar ações",
        description: (error as Error)?.message || "Não foi possível aplicar agora.",
        variant: "destructive",
      });
    } finally {
      setConfirmOpen(false);
      setPendingActions([]);
    }
  };

  const handleSaveRules = async () => {
    if (!workspaceId) return;
    try {
      const payload = rulesDraft.map((rule) => ({
        ruleKey: rule.rule_key,
        enabled: rule.enabled,
        config: rule.config,
      }));
      await updateRulesMutation.mutateAsync({ workspaceId, rules: payload });
      toast({ title: "Regras atualizadas", description: "Suas regras automáticas foram salvas." });
      setRulesOpen(false);
    } catch (error) {
      toast({
        title: "Falha ao salvar regras",
        description: (error as Error)?.message || "Não foi possível atualizar as regras.",
        variant: "destructive",
      });
    }
  };

  const handleSaveWeeklySettings = async () => {
    if (!workspaceId) return;
    try {
      await updateWeeklySettingsMutation.mutateAsync({
        workspaceId,
        settings: weeklySettingsDraft,
      });
      toast({ title: "Relatorio semanal atualizado", description: "Configuracoes salvas com sucesso." });
    } catch (error) {
      toast({
        title: "Falha ao salvar relatorio semanal",
        description: (error as Error)?.message || "Nao foi possivel atualizar agora.",
        variant: "destructive",
      });
    }
  };

  const handleSendWeeklyReport = async () => {
    if (!workspaceId) return;
    try {
      await sendWeeklyReportMutation.mutateAsync(workspaceId);
      toast({ title: "Relatorio enviado", description: "Relatorio semanal enviado para o canal configurado." });
    } catch (error) {
      toast({
        title: "Falha ao enviar relatorio",
        description: (error as Error)?.message || "Nao foi possivel enviar agora.",
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
              Diagnóstico rápido para entender queda de vendas e ajustes recomendados por curva.
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
          <TabsTrigger value="curvas">Produtos por Curva</TabsTrigger>
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

          <Card className="border-dashed">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Automacao com permissao</CardTitle>
                <CardDescription>
                  As regras geram um plano. Voce revisa e confirma antes de aplicar.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchActionPlan()}>
                  Recarregar plano
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRulesOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Editar regras
                </Button>
                <Button
                  size="sm"
                  onClick={() => openActionConfirmation("Aplicar plano completo", actionPlan)}
                  disabled={actionPlan.length === 0 || applyActionsMutation.isPending}
                >
                  {applyActionsMutation.isPending ? "Aplicando..." : `Aplicar plano (${actionPlan.length})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isActionPlanLoading ? (
                <div className="text-sm text-muted-foreground">Gerando plano automatico...</div>
              ) : actionPlan.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma acao automatica sugerida no momento.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs text-muted-foreground">Pausas sugeridas</div>
                    <div className="text-lg font-semibold">{formatNumber(actionSummary.pause)}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs text-muted-foreground">Promocoes de curva</div>
                    <div className="text-lg font-semibold">{formatNumber(actionSummary.promote)}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs text-muted-foreground">Reducoes de curva</div>
                    <div className="text-lg font-semibold">{formatNumber(actionSummary.demote)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Relatorio semanal</CardTitle>
                <CardDescription>
                  Envie um resumo automatico via Telegram no dia e horario definidos.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendWeeklyReport}
                disabled={sendWeeklyReportMutation.isPending || !weeklySettingsDraft.enabled}
              >
                {sendWeeklyReportMutation.isPending ? "Enviando..." : "Enviar agora"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Ativar relatorio</div>
                    <div className="text-sm">Requer Telegram configurado</div>
                  </div>
                  <Switch
                    checked={weeklySettingsDraft.enabled}
                    onCheckedChange={(checked) =>
                      setWeeklySettingsDraft((prev) => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Dia da semana</div>
                  <Select
                    value={String(weeklySettingsDraft.send_day)}
                    onValueChange={(value) =>
                      setWeeklySettingsDraft((prev) => ({ ...prev, send_day: Number(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Segunda</SelectItem>
                      <SelectItem value="2">Terca</SelectItem>
                      <SelectItem value="3">Quarta</SelectItem>
                      <SelectItem value="4">Quinta</SelectItem>
                      <SelectItem value="5">Sexta</SelectItem>
                      <SelectItem value="6">Sabado</SelectItem>
                      <SelectItem value="0">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Hora (0-23)</div>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={weeklySettingsDraft.send_hour}
                    onChange={(event) =>
                      setWeeklySettingsDraft((prev) => ({
                        ...prev,
                        send_hour: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button
                  onClick={handleSaveWeeklySettings}
                  disabled={updateWeeklySettingsMutation.isPending}
                >
                  {updateWeeklySettingsMutation.isPending ? "Salvando..." : "Salvar configuracoes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  Insights de IA
                </CardTitle>
                <CardDescription>Leitura automática dos sinais de performance.</CardDescription>
              </div>
              {trend.hasTrend && (
                <Badge variant="outline">
                  Últimos 7d vs 7d anteriores
                </Badge>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight, index) => (
                <Alert
                  key={`${insight.title}-${index}`}
                  className={
                    insight.level === "critical"
                      ? "border-red-200 bg-red-50"
                      : insight.level === "warning"
                        ? "border-amber-200 bg-amber-50"
                        : insight.level === "success"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-blue-200 bg-blue-50"
                  }
                >
                  {insight.level === "critical" && <TrendingDown className="h-4 w-4 text-red-600" />}
                  {insight.level === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  {insight.level === "info" && <TrendingUp className="h-4 w-4 text-blue-600" />}
                  {insight.level === "success" && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                  <AlertTitle className="text-sm">{insight.title}</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    {insight.description}
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-base">Produtos para pausar (Curva C)</CardTitle>
                    <CardDescription>
                      Itens com muitos cliques e zero vendas (ou visitas altas sem conversao quando nao ha Ads).
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openActionConfirmation("Aplicar pausas", pauseActions)}
                    disabled={pauseActions.length === 0 || applyActionsMutation.isPending}
                  >
                    Pausar ({pauseActions.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pauseCandidates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum candidato forte para pausa.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Sinal</TableHead>
                        <TableHead>Vendas</TableHead>
                        <TableHead>ID ML</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pauseCandidates.map((item) => (
                        <TableRow key={`pause-${item.productId}`}>
                          <TableCell className="font-medium max-w-[200px]">
                            <div className="truncate" title={item.title || ""}>{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell>
                            {item.hasAdsMetrics
                              ? `${formatNumber(getAdsClicks(item))} cliques`
                              : item.visits30d !== null && item.visits30d !== undefined
                                ? `${formatNumber(getVisits30d(item))} visitas`
                                : `${formatNumber(item.ageDays || 0)} dias`}
                          </TableCell>
                          <TableCell>
                            {item.hasAdsMetrics
                              ? formatNumber(getAdsSales(item))
                              : formatNumber(getTotalSales(item))}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => copyToClipboard(item.mlItemId)}>
                              <Copy className="h-3 w-3 mr-1" />
                              {item.mlItemId}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-base">Potenciais para escalar (Curva B)</CardTitle>
                    <CardDescription>
                      Itens com 2+ vendas e ACOS controlado (ou 5+ vendas totais e margem positiva).
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openActionConfirmation("Aplicar promocoes", promoteActions)}
                    disabled={promoteActions.length === 0 || applyActionsMutation.isPending}
                  >
                    Escalar ({promoteActions.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {promoteCandidates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum candidato claro para promoção.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Vendas</TableHead>
                        <TableHead>ACOS / Margem</TableHead>
                        <TableHead>ID ML</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promoteCandidates.map((item) => (
                        <TableRow key={`promote-${item.productId}`}>
                          <TableCell className="font-medium max-w-[200px]">
                            <div className="truncate" title={item.title || ""}>{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell>
                            {item.hasAdsMetrics
                              ? formatNumber(getAdsSales(item))
                              : formatNumber(getTotalSales(item))}
                          </TableCell>
                          <TableCell>
                            {item.hasAdsMetrics
                              ? (item.adsAcos !== undefined && item.adsAcos !== null ? formatPercent(item.adsAcos, 1) : "—")
                              : formatCurrency(Number(item.profitUnit || 0))}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => copyToClipboard(item.mlItemId)}>
                              <Copy className="h-3 w-3 mr-1" />
                              {item.mlItemId}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {demandMetricsAvailable && (lowConversionItems.length > 0 || highConversionItems.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {lowConversionItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Alta demanda, baixa conversão</CardTitle>
                    <CardDescription>
                      Produtos com muitas visitas e conversão baixa precisam de ajustes no anúncio.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Visitas</TableHead>
                          <TableHead>Conversão</TableHead>
                          <TableHead>Vendas</TableHead>
                          <TableHead>ID ML</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowConversionItems.map((item) => (
                          <TableRow key={`lowconv-${item.productId}`}>
                            <TableCell className="font-medium max-w-[200px]">
                              <div className="truncate" title={item.title || ""}>{item.title}</div>
                              <div className="text-xs text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell>{formatNumber(getVisits30d(item))}</TableCell>
                            <TableCell>{formatPercent(getConversionRate30d(item), 1)}</TableCell>
                            <TableCell>{formatNumber(getTotalSales(item))}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => copyToClipboard(item.mlItemId)}>
                                <Copy className="h-3 w-3 mr-1" />
                                {item.mlItemId}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {highConversionItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Boa conversão, pouco tráfego</CardTitle>
                    <CardDescription>
                      Itens com conversão alta e poucas visitas são bons candidatos para escalar Ads.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Visitas</TableHead>
                          <TableHead>Conversão</TableHead>
                          <TableHead>Vendas</TableHead>
                          <TableHead>ID ML</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {highConversionItems.map((item) => (
                          <TableRow key={`highconv-${item.productId}`}>
                            <TableCell className="font-medium max-w-[200px]">
                              <div className="truncate" title={item.title || ""}>{item.title}</div>
                              <div className="text-xs text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell>{formatNumber(getVisits30d(item))}</TableCell>
                            <TableCell>{formatPercent(getConversionRate30d(item), 1)}</TableCell>
                            <TableCell>{formatNumber(getTotalSales(item))}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => copyToClipboard(item.mlItemId)}>
                                <Copy className="h-3 w-3 mr-1" />
                                {item.mlItemId}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {highAcosItems.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-base">Produtos com ACOS alto</CardTitle>
                    <CardDescription>Requerem ajuste de lance ou mudanca de curva.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openActionConfirmation("Aplicar reducoes", demoteActions)}
                    disabled={demoteActions.length === 0 || applyActionsMutation.isPending}
                  >
                    Reduzir ({demoteActions.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>ACOS</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>ID ML</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {highAcosItems.map((item) => (
                      <TableRow key={`acos-${item.productId}`}>
                        <TableCell className="font-medium max-w-[240px]">
                          <div className="truncate" title={item.title || ""}>{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell>{item.adsAcos !== undefined && item.adsAcos !== null ? formatPercent(item.adsAcos, 1) : "—"}</TableCell>
                        <TableCell>{formatCurrency(item.adsCost30d || 0)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => copyToClipboard(item.mlItemId)}>
                            <Copy className="h-3 w-3 mr-1" />
                            {item.mlItemId}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {staleItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Produtos parados (60+ dias)</CardTitle>
                <CardDescription>Sem vendas recentes; revisar preço, fotos e título.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>ID ML</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staleItems.map((item) => (
                      <TableRow key={`stale-${item.productId}`}>
                        <TableCell className="font-medium max-w-[240px]">
                          <div className="truncate" title={item.title || ""}>{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell>{formatNumber(item.ageDays || 0)} dias</TableCell>
                        <TableCell>{formatNumber(item.stock || 0)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => copyToClipboard(item.mlItemId)}>
                            <Copy className="h-3 w-3 mr-1" />
                            {item.mlItemId}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="curvas" className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Como usar esta lista</AlertTitle>
            <AlertDescription className="text-blue-700">
              Utilize esta lista para mover produtos manualmente no painel do Mercado Livre Ads. Copie o ID do anúncio (MLB...) e busque no painel.
            </AlertDescription>
          </Alert>

          {["A", "B", "C"].map((curve) => {
            const products = groupedItems[curve as "A" | "B" | "C"];
            const count = summary[curve] || 0;

            if (products.length === 0) return null;

            return (
              <Card key={curve} className="border-l-4" style={{ borderLeftColor: curve === "A" ? "#10b981" : curve === "B" ? "#f59e0b" : "#3b82f6" }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Badge className={`text-base px-3 py-1 ${curveColor(curve)}`}>
                        Curva {curve}
                      </Badge>
                      <span className="text-muted-foreground text-sm font-normal">
                        {curve === "A" ? "Alta Performance (Rentabilidade)" : curve === "B" ? "Otimização (Crescimento)" : "Teste / Cauda Longa"}
                      </span>
                    </CardTitle>
                    <Badge variant="outline">{count} produtos</Badge>
                  </div>
                  <CardDescription>
                    Produtos com {curve === "A" ? "alto volume de vendas e bom ACOS" : curve === "B" ? "vendas moderadas e potencial de crescimento" : "poucas vendas ou em fase de teste"}.
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
                              Total vendido: {formatNumber(item.lifetimeSales || 0)}
                            </div>
                            {item.action === "paused" && (
                              <Badge variant="destructive" className="mt-2">Pausar</Badge>
                            )}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmLabel || "Confirmar aplicacao"}</AlertDialogTitle>
            <AlertDialogDescription>
              Voce esta prestes a aplicar {pendingActions.length} acao(oes) no Mercado Ads. Esta acao exige permissao explicita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyActions}>Confirmar e aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Regras automaticas</DialogTitle>
            <DialogDescription>
              Ajuste os limites e ative/desative cada regra. Isso impacta o plano automatico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rulesDraft.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhuma regra carregada.</div>
            )}
            {rulesDraft.map((rule, index) => (
              <div key={rule.id} className="rounded-md border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-xs text-muted-foreground">{rule.description}</div>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => {
                      setRulesDraft((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, enabled: checked } : r))
                      );
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(rule.config || {}).map(([key, value]) => (
                    <div key={`${rule.id}-${key}`} className="space-y-1">
                      <div className="text-xs text-muted-foreground">{key.replace(/_/g, " ")}</div>
                      <Input
                        type="number"
                        value={value}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setRulesDraft((prev) =>
                            prev.map((r, i) =>
                              i === index
                                ? { ...r, config: { ...r.config, [key]: Number.isFinite(next) ? next : 0 } }
                                : r
                            )
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRulesOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRules} disabled={updateRulesMutation.isPending}>
              {updateRulesMutation.isPending ? "Salvando..." : "Salvar regras"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
