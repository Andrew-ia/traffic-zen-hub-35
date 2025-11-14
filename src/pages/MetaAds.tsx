import { useState, useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;

export default function MetaAds() {
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
    objectiveFilter !== "all" ? getFunnelTypeFromObjective(objectiveFilter) : "traffic"
  );

  // Carregar contas da integração (dashboard) para alinhar com filtro de contas
  const { data: integrationOverview } = useIntegrationOverview();
  const metaAccounts = (integrationOverview?.platformAccounts ?? [])
    .filter((acc) => acc.platform_key === "meta")
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

  const { data, isLoading, error } = useCampaigns({
    status: statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
    platform: "meta",
    objective: objectiveFilter !== "all" ? objectiveFilter : undefined,
    dateRange: Number(dateRange),
    accountId: accountFilter,
  });

  // Buscar métricas agregadas
  const { data: metrics, isLoading: metricsLoading } = usePlatformMetrics({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    status: statusFilter,
    objective: objectiveFilter !== "all" ? objectiveFilter : undefined,
  });

  // Buscar dados de série temporal
  const { data: timeSeriesData } = useTimeSeries({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    metric: chartMetric,
    status: statusFilter,
    objective: objectiveFilter !== "all" ? objectiveFilter : undefined,
  });

  // Buscar dados demográficos
  const { data: demographics, isLoading: demographicsLoading } = useDemographics({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    objective: objectiveFilter !== "all" ? objectiveFilter : undefined,
  });

  // Buscar métricas por objetivo (só quando filtro = "all")
  const { data: metricsByObjective, isLoading: objectiveMetricsLoading } = useMetricsByObjective({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    status: statusFilter,
  });

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? campaigns.length;

  const funnelMetrics = {
    impressions: metrics?.impressions ?? 0,
    clicks: metrics?.clicks ?? 0,
    linkClicks: metrics?.linkClicks ?? metrics?.clicks ?? 0,
    landingPageViews: metrics?.landingPageViews ?? 0,
    conversationsStarted: metrics?.conversationsStarted ?? metrics?.totalResults ?? 0,
    engagements: metrics?.engagements ?? metrics?.totalResults ?? 0,
    saves: metrics?.saves ?? 0,
    shares: metrics?.shares ?? 0,
    buttonClicks: metrics?.buttonClicks ?? metrics?.linkClicks ?? metrics?.clicks ?? 0,
    addToCart: metrics?.addToCart ?? 0,
    checkouts: metrics?.checkouts ?? 0,
    purchases: metrics?.purchases ?? metrics?.totalResults ?? 0,
  };

  // Calcular KPIs a partir de métricas ou campanhas
  const totalSpend = (
    objectiveFilter === "all" && metricsByObjective && metricsByObjective.length > 0
      ? metricsByObjective.reduce((sum, o) => sum + (o.totalSpend ?? 0), 0)
      : metrics?.totalSpend ?? campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0)
  );
  const totalResults = metrics?.totalResults ?? campaigns.reduce((sum, c) => sum + (c.resultValue ?? 0), 0);
  const avgRoas = metrics?.avgRoas ?? 0;
  const avgCostPerResult = metrics?.avgCostPerResult ?? 0;

  return (
    <div className="space-y-3 pb-4">
      {/* Header Compacto */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold">Meta Ads</h1>
          <p className="text-xs text-muted-foreground">
            Dashboard Facebook e Instagram
          </p>
        </div>
        <div className="flex-1">
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
              ],
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => setStatusFilter(v as CampaignStatusFilter)}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
        <div className="flex items-center">
          <MetaSyncButton size="sm" />
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
        <div className="space-y-3">
          {/* KPIs Skeleton */}
          <div className="grid grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
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
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
            {/* Coluna Esquerda (40%) */}
            <div className="lg:col-span-4 space-y-3">
              {/* Performance Chart Skeleton */}
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-32 mb-4" />
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>

              {/* Campanhas Table Skeleton */}
              <Card>
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
            <div className="lg:col-span-3 space-y-3">
              {/* Demographics Skeleton */}
              <Card>
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
            <div className="lg:col-span-3 space-y-3">
              {/* Funnel Skeleton */}
              <Card>
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
              <Card>
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
      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
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
        <Card>
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold mb-2">Métricas</h3>
            <div className="grid grid-cols-6 gap-2">
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
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-destructive font-medium mb-2">
                Erro ao carregar campanhas
              </p>
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar as campanhas. Verifique suas permissões no Supabase.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado Vazio */}
      {!isLoading && !error && campaigns.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search
                  ? `Não encontramos campanhas que correspondam a "${search}"`
                  : "Não há campanhas Meta Ads para exibir no momento"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-sm text-primary hover:underline"
                >
                  Limpar busca
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layout Principal - Mostrar apenas se houver campanhas */}
      {!error && !isLoading && campaigns.length > 0 && (
        <div className="space-y-3">
          {/* Linha 1: Funil, Demografia (Faixa Etária) e Gênero - 3 cards horizontais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Funil */}
            <FunnelCard
              title="Funil"
              funnelType={funnelType}
              metrics={funnelMetrics}
              onTypeChange={handleFunnelTypeChange}
              loading={metricsLoading}
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
          <Card className="overflow-hidden">
            <div className="max-h-[650px] overflow-y-auto">
              <CampaignsTable
                title="Campanhas"
                campaigns={campaigns}
                isLoading={isLoading}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                showCreateButton={false}
              />
            </div>
          </Card>
        </div>
      )}
      </>
      )}
    </div>
  );
}
  const handleFunnelTypeChange = (type: FunnelType) => {
    setFunnelType(type);
    const mappedObjective = funnelTypeObjectiveMap[type];
    if (mappedObjective) {
      setObjectiveFilter(mappedObjective);
    }
  };
