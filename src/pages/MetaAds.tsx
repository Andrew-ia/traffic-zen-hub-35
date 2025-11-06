import { useState, useEffect } from "react";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";
import { TrendingUp, ShoppingCart, Target, DollarSign, Wallet } from "lucide-react";
import MetaSyncButton from "@/components/MetaSyncButton";
import { PlatformFilters } from "@/components/platform/PlatformFilters";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { MetricCard, MetricsGrid } from "@/components/platform/MetricCard";
import { PerformanceChart } from "@/components/platform/PerformanceChart";
import { DemographicCharts } from "@/components/platform/DemographicCharts";
import { FunnelCard } from "@/components/platform/FunnelCard";
import { ObjectiveKPICard, ObjectiveKPIGrid } from "@/components/platform/ObjectiveKPICard";
import { usePlatformMetrics, useTimeSeries, useDemographics, useMetricsByObjective } from "@/hooks/usePlatformMetrics";
import { useIntegrationOverview } from "@/hooks/useIntegrationOverview";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_SIZE = 10;

export default function MetaAds() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [accountFilter, setAccountFilter] = useState("a611cf99-40f1-41ad-854a-f74e28478599");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [chartMetric, setChartMetric] = useState<"spend" | "results" | "revenue">("spend");

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

  const { data, isLoading, error } = useCampaigns({
    status: statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
    platform: "meta",
    objective: objectiveFilter !== "all" ? objectiveFilter : undefined,
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

  // Calcular KPIs a partir de métricas ou campanhas
  const totalSpend = metrics?.totalSpend ?? campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0);
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
        <MetaSyncButton variant="default" size="sm" />
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

      {/* KPIs Compactos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
          title="Conversões"
          value={new Intl.NumberFormat("pt-BR").format(totalResults)}
          icon={Target}
          loading={metricsLoading}
        />
        <CompactKPICard
          title="ROAS"
          value={avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : "-"}
          icon={TrendingUp}
          trend={avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : undefined}
          trendUp={avgRoas > 1}
          loading={metricsLoading}
        />
        <CompactKPICard
          title="Custo/Resultado"
          value={avgCostPerResult > 0 ? new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(avgCostPerResult) : "-"}
          icon={ShoppingCart}
          loading={metricsLoading}
        />
        <CompactKPICard
          title="Campanhas"
          value={(metrics?.activeCampaigns ?? total).toString()}
          icon={Wallet}
          loading={metricsLoading || isLoading}
        />
      </div>

      {/* KPIs por Objetivo */}
      {metricsByObjective && metricsByObjective.length > 0 && objectiveFilter === "all" && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Desempenho por Objetivo
          </h2>
          <ObjectiveKPIGrid>
            {metricsByObjective.map((objective) => (
              <ObjectiveKPICard
                key={objective.objective}
                data={objective}
                loading={objectiveMetricsLoading}
              />
            ))}
          </ObjectiveKPIGrid>
        </div>
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

      {/* Layout Principal em 3 Colunas - Mostrar apenas se houver campanhas */}
      {!error && !isLoading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
          {/* Coluna Esquerda (40%) - Performance + Campanhas */}
          <div className="lg:col-span-4 space-y-3 min-h-0">
            {/* Gráfico de Performance Compacto */}
            <Card>
              <CardContent className="pt-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Performance</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setChartMetric("spend")}
                      className={`px-2 py-1 text-xs rounded transition ${
                        chartMetric === "spend"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      Invest
                    </button>
                    <button
                      onClick={() => setChartMetric("results")}
                      className={`px-2 py-1 text-xs rounded transition ${
                        chartMetric === "results"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      Result
                    </button>
                    <button
                      onClick={() => setChartMetric("revenue")}
                      className={`px-2 py-1 text-xs rounded transition ${
                        chartMetric === "revenue"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      Receita
                    </button>
                  </div>
                </div>
                <div className="h-[200px]">
                  <PerformanceChart
                    data={timeSeriesData ?? []}
                    metric={chartMetric}
                    title=""
                    description=""
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Campanhas Compacta */}
            <Card className="overflow-hidden">
              <div className="max-h-[450px] overflow-y-auto">
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

        {/* Coluna Central (30%) - Funil + Métricas */}
        <div className="lg:col-span-3 space-y-3">
          <FunnelCard
            title="Funil"
            steps={(() => {
              // Usar métricas filtradas em vez de traffic
              const impressions = metrics?.impressions ?? 0;
              const clicks = metrics?.clicks ?? 0;
              const results = metrics?.totalResults ?? 0;
              return [
                { label: "Impressões", value: impressions },
                { label: "Cliques", value: clicks },
                { label: "Conversões", value: results },
              ];
            })()}
            loading={metricsLoading}
          />

          {/* Métricas Rápidas */}
          <Card>
            <CardContent className="pt-4 pb-2">
              <h3 className="text-sm font-semibold mb-3">Métricas</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
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
        </div>

        {/* Coluna Direita (30%) - Demografia */}
        <div className="lg:col-span-3 space-y-3">
          {/* Gráficos de Demografia Compactos */}
          <DemographicCharts
            ageData={demographics?.ageData ?? []}
            genderData={demographics?.genderData ?? []}
            loading={demographicsLoading}
          />

          {/* ROI Card Destacado */}
          <Card className="overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-medium mb-2">Retorno Total sobre Investimento</div>
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 bg-clip-text text-transparent mb-2">
                  {avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : "-"}
                </div>
                <div className="text-xs text-muted-foreground">ROAS médio do período</div>
                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="text-2xl">🎯📈💰</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}
