import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";
import { TrendingUp, ShoppingCart, Target, DollarSign, Wallet } from "lucide-react";
import MetaSyncButton from "@/components/MetaSyncButton";
import { PlatformFilters } from "@/components/platform/PlatformFilters";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { MetricCard, MetricsGrid } from "@/components/platform/MetricCard";
import { PerformanceChart } from "@/components/platform/PerformanceChart";
import { DemographicCharts, AgeChart, GenderChart } from "@/components/platform/DemographicCharts";
import { FunnelCard, type FunnelType } from "@/components/platform/FunnelCard";
import { ObjectiveKPICard, ObjectiveKPIGrid } from "@/components/platform/ObjectiveKPICard";
import { usePlatformMetrics, useTimeSeries, useDemographics, useMetricsByObjective } from "@/hooks/usePlatformMetrics";
import { useIntegrationOverview } from "@/hooks/useIntegrationOverview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";

const PAGE_SIZE = 10;

export default function MetaAds() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [accountFilter, setAccountFilter] = useState("all");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [chartMetric, setChartMetric] = useState<"spend" | "results" | "revenue">("spend");
  // Mapear objetivo para tipo de funil automaticamente
  const getFunnelTypeFromObjective = (objective: string): FunnelType => {
    const mapping: Record<string, FunnelType> = {
      "OUTCOME_LEADS": "leads",
      "LEAD_GENERATION": "leads",
      "OUTCOME_SALES": "sales",
      "SALES": "sales",
      "CONVERSIONS": "sales",
      "PURCHASE": "sales",
      "OUTCOME_ENGAGEMENT": "engagement",
      "MESSAGES": "messages",
      "OUTCOME_MESSAGES": "messages",
      "OUTCOME_TRAFFIC": "traffic",
      "TRAFFIC": "traffic",
      "LINK_CLICKS": "traffic",
      "OUTCOME_AWARENESS": "engagement",
      "AWARENESS": "engagement",
      "BRAND_AWARENESS": "engagement",
      "REACH": "engagement",
    };
    return mapping[objective] || "traffic";
  };

  const funnelTypeObjectiveMap: Record<FunnelType, string> = {
    traffic: "LINK_CLICKS",
    leads: "OUTCOME_LEADS",
    sales: "OUTCOME_SALES",
    engagement: "OUTCOME_ENGAGEMENT",
    messages: "MESSAGES",
  };

  const [funnelType, setFunnelType] = useState<FunnelType>(
    objectiveFilter !== "all" ? getFunnelTypeFromObjective(objectiveFilter) : "leads"
  );

  // Carregar contas da integração (dashboard) para alinhar com filtro de contas
  const { data: integrationOverview } = useIntegrationOverview(workspaceId);
  const metaAccounts = (integrationOverview?.platformAccounts ?? [])
    .filter((acc) => acc.platform_key === "meta" && !/\bdemo\b/i.test(String(acc.name || "")))
    .map((acc) => ({ id: acc.id, name: acc.name ?? acc.id }));

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, accountFilter, objectiveFilter]);

  // Atualizar tipo de funil automaticamente quando o filtro de objetivo mudar
  useEffect(() => {
    if (objectiveFilter !== "all") {
      setFunnelType(getFunnelTypeFromObjective(objectiveFilter));
    }
  }, [objectiveFilter]);

  // Calculate effective objective filter based on funnel type
  const effectiveObjectiveFilter =
    objectiveFilter === "all" ? funnelTypeObjectiveMap[funnelType] : objectiveFilter;

  const { data, isLoading, error } = useCampaigns(workspaceId, {
    status: statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
    platform: "meta",
    objective: objectiveFilter,
    dateRange: Number(dateRange),
    accountId: accountFilter,
  });

  // Buscar métricas agregadas
  const { data: metrics, isLoading: metricsLoading } = usePlatformMetrics(workspaceId, {
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    status: statusFilter,
    objective: objectiveFilter === "all" ? "all" : effectiveObjectiveFilter,
  });

  // Buscar dados de série temporal
  const { data: timeSeriesData } = useTimeSeries(workspaceId, {
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    metric: chartMetric,
    status: statusFilter,
    objective: objectiveFilter === "all" ? "all" : effectiveObjectiveFilter,
  });

  // Buscar dados demográficos
  const { data: demographics, isLoading: demographicsLoading } = useDemographics(workspaceId, {
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    objective: objectiveFilter === "all" ? "all" : effectiveObjectiveFilter,
  });

  // Buscar métricas por objetivo (só quando filtro = "all")
  const { data: metricsByObjective, isLoading: objectiveMetricsLoading } = useMetricsByObjective(workspaceId, {
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    status: statusFilter,
  });

  if (!workspaceId) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Meta Ads</h1>
        <p className="text-muted-foreground">Selecione um workspace no topo para ver os dados.</p>
      </div>
    );
  }

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? campaigns.length;

  // Construir métricas específicas do funil baseado no objetivo selecionado
  const getMetricByObjective = (metricType: string) => {
    // Se está no modo "all", usar dados agregados ou de acordo com o funil selecionado
    if (objectiveFilter === "all") {
      // Usar métricas diretas quando disponíveis para visão geral
      switch (metricType) {
        case 'conversationsStarted':
          return metrics?.conversationsStarted ?? 0;
        case 'purchases':
          return metrics?.purchases ?? 0;
        case 'landingPageViews':
          return metrics?.landingPageViews ?? 0;
        case 'engagements':
          return metrics?.engagements ?? 0;
        default:
          return 0;
      }
    }

    // Para filtros específicos, mapear totalResults para a métrica correta
    switch (funnelType) {
      case 'leads':
        return metricType === 'conversationsStarted' ? metrics?.totalResults ?? 0 : 0;
      case 'sales':
        return metricType === 'purchases' ? metrics?.totalResults ?? 0 : 0;
      case 'messages':
        return metricType === 'conversationsStarted' ? metrics?.totalResults ?? 0 : 0;
      case 'traffic':
        return metricType === 'landingPageViews' ? metrics?.totalResults ?? 0 : 0;
      case 'engagement':
        return metricType === 'engagements' ? metrics?.totalResults ?? 0 : 0;
      default:
        return 0;
    }
  };

  const funnelMetrics = {
    // Métricas base (sempre disponíveis)
    impressions: metrics?.impressions ?? 0,
    clicks: metrics?.clicks ?? 0,
    linkClicks: metrics?.linkClicks ?? metrics?.clicks ?? 0,

    // Métricas específicas por tipo de funil
    landingPageViews: getMetricByObjective('landingPageViews'),
    conversationsStarted: getMetricByObjective('conversationsStarted'),
    addToCart: metrics?.addToCart ?? 0,
    checkouts: metrics?.checkouts ?? 0,
    purchases: getMetricByObjective('purchases'),
    engagements: getMetricByObjective('engagements'),
    saves: metrics?.saves ?? 0,
    shares: metrics?.shares ?? 0,
  };

  // Calcular KPIs a partir de métricas ou campanhas
  const totalSpend = metrics?.totalSpend ?? campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0);
  const totalResults = metrics?.totalResults ?? campaigns.reduce((sum, c) => sum + (c.resultValue ?? 0), 0);
  const avgRoas = metrics?.avgRoas ?? 0;
  const avgCostPerResult = metrics?.avgCostPerResult ?? 0;

  return (
    <div className="space-y-6 pb-4">
      {/* Header Compacto */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center">Meta Ads</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Dashboard Facebook e Instagram
          </p>
        </div>
        <div className="flex-1 lg:max-w-4xl">
          <PlatformFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            accountFilter={accountFilter}
            onAccountFilterChange={setAccountFilter}
            accounts={metaAccounts}
            additionalFilter={{
              value: objectiveFilter,
              onChange: setObjectiveFilter,
              placeholder: "Objetivo",
              options: [
                { value: "all", label: "Todos os Objetivos" },
                { value: "OUTCOME_LEADS", label: "Leads" },
                { value: "OUTCOME_ENGAGEMENT", label: "Engajamentos" },
                { value: "MESSAGES", label: "Conversas" },
                { value: "LINK_CLICKS", label: "Cliques/Tráfego" },
                { value: "OUTCOME_SALES", label: "Vendas" },
                { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
              ],
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => setStatusFilter(v as CampaignStatusFilter)}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
        <div className="flex items-center">
          <MetaSyncButton size="sm" days={Number(dateRange)} />
        </div>
      </div>

      {/* Indicador de filtro ativo */}
      {objectiveFilter !== "all" && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-900 dark:text-blue-100">
            Filtrando por: <strong>{(() => {
              const opt = [
                { value: "OUTCOME_LEADS", label: "Leads" },
                { value: "OUTCOME_ENGAGEMENT", label: "Engajamentos" },
                { value: "MESSAGES", label: "Conversas" },
                { value: "LINK_CLICKS", label: "Cliques/Tráfego" },
                { value: "OUTCOME_SALES", label: "Vendas" },
                { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
              ].find(o => o.value === objectiveFilter);
              return opt?.label || objectiveFilter;
            })()}</strong>
          </span>
          <button
            onClick={() => setObjectiveFilter("all")}
            className="ml-auto text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Loading State - Skeleton Animado */}
      {isLoading && metricsLoading && (
        <div className="space-y-6">
          {/* KPIs Skeleton */}
          <div className="grid grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-6 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Objectives Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="border-border/50 shadow-sm">
                  <CardContent className="p-3">
                    <Skeleton className="h-3 w-16 mb-2" />
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-2 w-full mb-1" />
                    <Skeleton className="h-2 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Layout 3 Colunas Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Coluna Esquerda (40%) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Performance Chart Skeleton */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-32 mb-4" />
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>

              {/* Campanhas Table Skeleton */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-24 mb-4" />
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Central (35%) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Demographics Skeleton */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-32 mb-4" />
                  <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita (25%) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Funnel Skeleton */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Grid Skeleton */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* KPIs Compactos */}
      {!(isLoading && metricsLoading) && (
        <div className="grid grid-cols-2 gap-6">
          <CompactKPICard
            title="Investimento"
            value={new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            }).format(totalSpend)}
            icon={DollarSign}
            loading={metricsLoading}
          />
          <CompactKPICard
            title="Campanhas"
            value={(metrics?.activeCampaigns ?? total).toString()}
            icon={Wallet}
            loading={metricsLoading || isLoading}
          />
        </div>
      )}

      {/* KPIs por Objetivo */}
      {!(isLoading && metricsLoading) && (
        <>
          {metricsByObjective && metricsByObjective.length > 0 && objectiveFilter === "all" && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Desempenho por Objetivo
              </h2>
              <ObjectiveKPIGrid>
                {metricsByObjective
                  .filter((objective) => objective.objective !== 'UNKNOWN' && objective.resultLabel !== 'Resultados' && objective.campaignCount > 0)
                  .map((objective) => (
                    <ObjectiveKPICard
                      key={objective.objective}
                      data={objective}
                      loading={objectiveMetricsLoading}
                    />
                  ))}
              </ObjectiveKPIGrid>
            </div>
          )}

          {/* Métricas Rápidas - 6 cards horizontais */}
          {!(isLoading && metricsLoading) && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold">Métricas Gerais</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MetricCard
                    label="CTR"
                    value={(() => {
                      const v = metrics?.ctr ?? 0;
                      return v ? `${v.toFixed(2)}%` : "-";
                    })()}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="CPC"
                    value={(() => {
                      const v = metrics?.cpc ?? 0;
                      return v
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
                        : "-";
                    })()}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="CPM"
                    value={(() => {
                      const v = metrics?.cpm ?? 0;
                      return v
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
                        : "-";
                    })()}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="Impressões"
                    value={metrics?.impressions ? new Intl.NumberFormat("pt-BR").format(metrics.impressions) : "-"}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="Alcance"
                    value={metrics?.reach ? new Intl.NumberFormat("pt-BR").format(metrics.reach) : "-"}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="Cliques"
                    value={metrics?.clicks ? new Intl.NumberFormat("pt-BR").format(metrics.clicks) : "-"}
                    loading={metricsLoading}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erro */}
          {error && (
            <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-destructive font-semibold mb-2 text-lg">
                    Erro ao carregar campanhas
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Não foi possível carregar as campanhas. Verifique suas permissões no Supabase ou tente novamente mais tarde.
                  </p>
                  <Button variant="outline" className="mt-4 border-destructive/30 hover:bg-destructive/10" onClick={() => window.location.reload()}>
                    Tentar novamente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Estado Vazio */}
          {!isLoading && !error && campaigns.length === 0 && (
            <Card className="border-border/50 shadow-sm border-dashed">
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Nenhuma campanha encontrada</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {search
                      ? `Não encontramos campanhas que correspondam a "${search}"`
                      : "Não há campanhas Meta Ads para exibir no momento. Crie sua primeira campanha para começar."}
                  </p>
                  {search ? (
                    <Button
                      variant="outline"
                      onClick={() => setSearch("")}
                    >
                      Limpar busca
                    </Button>
                  ) : (
                    <Button onClick={() => navigate("/campaigns/new/meta")} className="shadow-md hover:shadow-lg transition-all">
                      Criar Campanha
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Layout Principal - Mostrar apenas se houver campanhas */}
          {!error && !isLoading && campaigns.length > 0 && (
            <div className="space-y-6">
              {/* Linha 1: Funil, Demografia (Faixa Etária) e Gênero - 3 cards horizontais */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funil */}
                <FunnelCard
                  title="Funil"
                  funnelType={funnelType}
                  metrics={funnelMetrics}
                  loading={metricsLoading}
                  subtitle={objectiveFilter !== "all" ? `Baseado em: ${(() => {
                    const opt = [
                      { value: "OUTCOME_LEADS", label: "Leads" },
                      { value: "OUTCOME_ENGAGEMENT", label: "Engajamentos" },
                      { value: "MESSAGES", label: "Conversas" },
                      { value: "LINK_CLICKS", label: "Cliques/Tráfego" },
                      { value: "OUTCOME_SALES", label: "Vendas" },
                    ].find(o => o.value === objectiveFilter);
                    return opt?.label || objectiveFilter;
                  })()}` : undefined}
                />

                {/* Demografia - Faixa Etária */}
                <AgeChart
                  ageData={demographics?.ageData ?? []}
                  loading={demographicsLoading}
                />

                {/* Gênero */}
                <GenderChart
                  genderData={demographics?.genderData ?? []}
                  loading={demographicsLoading}
                />
              </div>

              {/* Linha 2: Tabela de Campanhas - largura total */}
              <CampaignsTable
                title="Campanhas"
                campaigns={campaigns}
                isLoading={isLoading}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                showCreateButton={false}
                headerActions={<Button onClick={() => navigate("/campaigns/new/meta")} className="shadow-sm">Nova Campanha</Button>}
              />
            </div>
          )}
        </>
      )}
      <Outlet />
    </div>
  );
}
