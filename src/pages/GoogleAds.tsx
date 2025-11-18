import { useState, useEffect } from "react";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";
import { Target, DollarSign, Wallet } from "lucide-react";
import { PlatformFilters } from "@/components/platform/PlatformFilters";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { MetricCard } from "@/components/platform/MetricCard";
import { PerformanceChart } from "@/components/platform/PerformanceChart";
import { AgeChart, GenderChart } from "@/components/platform/DemographicCharts";
import { FunnelCard } from "@/components/platform/FunnelCard";
import { usePlatformMetrics, useTimeSeries, useDemographics, useMetricsByObjective } from "@/hooks/usePlatformMetrics";
import { useIntegrationOverview } from "@/hooks/useIntegrationOverview";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FullscreenLoader from "@/components/ui/fullscreen-loader";
import { resolveApiBase } from "@/lib/apiBase";

const PAGE_SIZE = 10;

export default function GoogleAds() {
  const API_BASE = resolveApiBase();
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [accountFilter, setAccountFilter] = useState("all");
  const [chartMetric, setChartMetric] = useState<"spend" | "results" | "revenue">("spend");
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const { toast } = useToast();
  const syncStages = [
    "Conectando com Google Ads API",
    "Buscando contas de anúncios",
    "Sincronizando campanhas",
    "Processando grupos e anúncios",
    "Coletando métricas de performance",
    "Finalizando sincronização",
  ];

  const { data: integrationOverview } = useIntegrationOverview();
  const googleAccounts = (integrationOverview?.platformAccounts ?? [])
    .filter((acc) => acc.platform_key === "google_ads")
    .map((acc) => ({ id: acc.id, name: acc.name ?? acc.id }));

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, accountFilter]);

  const handleGoogleSync = async () => {
    if (syncing) return;
    const workspaceId = import.meta.env.VITE_WORKSPACE_ID as string | undefined;
    const days = Number(dateRange) || 7;
    if (!workspaceId) {
      toast({
        title: "Configuração ausente",
        description: "Defina VITE_WORKSPACE_ID para usar a sincronização.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSyncing(true);
      setCurrentStage(0);
      setStatusMessage(`Preparando sincronização (${days} dias)...`);
      setProgress(0);

      let response: Response | null = null;
      try {
        const health = await fetch(`${API_BASE}/health`, { headers: { Accept: "application/json" } });
        if (!health.ok) throw new Error("API indisponível");

        response = await fetch(`${API_BASE}/api/integrations/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ workspaceId, platformKey: "google_ads", days, type: "all" }),
        });
      } catch (primaryError) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
        if (supabaseUrl && anonKey) {
          try {
            setCurrentStage(2);
            setStatusMessage("Usando Edge Function para sincronização...");
            setProgress(15);
            const ef = await fetch(`${supabaseUrl}/functions/v1/google-ads-sync`, {
              method: "POST",
              headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ days, sync_type: "all" }),
            });
            const efPayload = await ef.json().catch(() => ({}));
            if (!ef.ok || efPayload?.success === false) {
              throw new Error(efPayload?.error || "Falha na Edge Function");
            }
            toast({ title: "Sincronização iniciada (Edge Function)", description: `Campanhas em atualização nos últimos ${days} dias.` });
            setProgress(100);
            setCurrentStage(syncStages.length - 1);
            setTimeout(() => {
              setSyncing(false);
              setStatusMessage(null);
              setProgress(null);
              setCurrentStage(0);
            }, 1500);
            return;
          } catch {
            toast({ title: "API indisponível", description: "Falha ao usar Edge Function também. Verifique VITE_API_URL/VITE_SUPABASE_*", variant: "destructive" });
            setSyncing(false);
            return;
          }
        }
        toast({ title: "API indisponível", description: "Configure VITE_API_URL ou execute o backend para sincronizar Google Ads.", variant: "destructive" });
        setSyncing(false);
        return;
      }

      const payload = await response!.json().catch(() => ({}));
      if (!response!.ok) {
        const unsupported = String(payload?.error || "").toLowerCase().includes("unsupported platform");
        if (unsupported) {
          toast({ title: "Plataforma não suportada na API", description: "Use o comando do servidor: npm run sync:google", variant: "destructive" });
          setSyncing(false);
          return;
        }
        throw new Error(payload?.error || "Falha ao iniciar sincronização");
      }

      const jobId = payload?.data?.jobId;
      toast({ title: "Sincronização iniciada", description: `Buscando dados dos últimos ${days} dias.` });
      setCurrentStage(1);
      setStatusMessage("Conectando com Google Ads API...");
      setProgress(10);

      let attempts = 0;
      const maxAttempts = 120;
      const poll = window.setInterval(async () => {
        attempts += 1;
        try {
          const statusResponse = await fetch(`${API_BASE}/api/integrations/sync/${jobId}`);
          const statusPayload = await statusResponse.json().catch(() => ({}));
          if (statusResponse.ok) {
            const pct = statusPayload?.data?.progress;
            if (typeof pct === "number") {
              const pv = Math.max(0, Math.min(100, Math.round(pct)));
              setProgress(pv);
              const stageIndex = Math.floor((pv / 100) * (syncStages.length - 1));
              setCurrentStage(Math.min(stageIndex, syncStages.length - 1));
              if (pv < 20) setStatusMessage("Conectando com Google Ads API...");
              else if (pv < 40) setStatusMessage("Buscando contas de anúncios...");
              else if (pv < 60) setStatusMessage("Sincronizando campanhas...");
              else if (pv < 80) setStatusMessage("Processando grupos e anúncios...");
              else if (pv < 95) setStatusMessage("Coletando métricas de performance...");
              else setStatusMessage("Finalizando sincronização...");
            }
            const status = statusPayload?.data?.status;
            if (status === "completed") {
              window.clearInterval(poll);
              setCurrentStage(syncStages.length - 1);
              setStatusMessage("Sincronização concluída. Atualizando dashboards...");
              setProgress(100);
              toast({ title: "Sincronização concluída", description: "Os dados do Google Ads foram atualizados com sucesso." });
              setTimeout(() => {
                setSyncing(false);
                setStatusMessage(null);
                setProgress(null);
                setCurrentStage(0);
              }, 1200);
            } else if (status === "failed") {
              window.clearInterval(poll);
              setSyncing(false);
              setStatusMessage(null);
              setProgress(null);
              setCurrentStage(0);
              toast({ title: "Erro na sincronização", description: statusPayload?.data?.error_message || "Falha ao sincronizar dados.", variant: "destructive" });
            }
          }
        } catch {
          // ignore polling errors
        }
        if (attempts > maxAttempts) {
          window.clearInterval(poll);
          setSyncing(false);
          setStatusMessage(null);
          setProgress(null);
          setCurrentStage(0);
          toast({ title: "Tempo excedido", description: "A sincronização está demorando. Verifique novamente em alguns minutos.", variant: "destructive" });
        }
      }, 2000);
    } catch (error) {
      setSyncing(false);
      toast({ title: "Erro na sincronização", description: error instanceof Error ? error.message : "Não foi possível iniciar a sincronização.", variant: "destructive" });
    }
  };

  const { data, isLoading, error } = useCampaigns({
    status: statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
  });

  const { data: metrics, isLoading: metricsLoading } = usePlatformMetrics({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    status: statusFilter,
    objective: "all",
  });

  const { data: timeSeriesData } = useTimeSeries({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    metric: chartMetric,
    status: statusFilter,
    objective: "all",
  });

  const { data: demographics, isLoading: demographicsLoading } = useDemographics({
    platform: "meta",
    dateRange: Number(dateRange),
    accountId: accountFilter,
    objective: "all",
  });

  const { data: metricsByObjective } = useMetricsByObjective({
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
    linkClicks: metrics?.clicks ?? 0,
    landingPageViews: metrics?.totalResults ?? metrics?.clicks ?? 0,
    conversationsStarted: 0,
    addToCart: 0,
    checkouts: 0,
    purchases: 0,
    engagements: 0,
    saves: 0,
    shares: 0,
  };

  const totalSpend = (
    metricsByObjective && metricsByObjective.length > 0
      ? metricsByObjective.reduce((sum, o) => sum + (o.totalSpend ?? 0), 0)
      : metrics?.totalSpend ?? campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0)
  );
  const totalResults = metrics?.totalResults ?? campaigns.reduce((sum, c) => sum + (c.resultValue ?? 0), 0);
  const avgRoas = metrics?.avgRoas ?? 0;
  const avgCostPerResult = metrics?.avgCostPerResult ?? 0;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold">Google Ads</h1>
          <p className="text-xs text-muted-foreground">Dashboard campanhas Google</p>
        </div>
        <div className="flex-1">
          <PlatformFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            accountFilter={accountFilter}
            onAccountFilterChange={setAccountFilter}
            accounts={googleAccounts}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => setStatusFilter(v as CampaignStatusFilter)}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
        <div className="flex items-center">
          {syncing && (
            <FullscreenLoader
              title="Sincronizando Google Ads"
              subtitle={statusMessage ?? `Buscando últimos ${dateRange} dias`}
              progress={progress}
              stages={syncStages}
              currentStage={currentStage}
            />
          )}
          <Button variant="outline" size="sm" onClick={handleGoogleSync} disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar Google
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading && metricsLoading && (
        <div className="space-y-3">
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

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
            <div className="lg:col-span-4 space-y-3">
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-32 mb-4" />
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
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

            <div className="lg:col-span-3 space-y-3">
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

            <div className="lg:col-span-3 space-y-3">
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
                label="Cliques"
                value={metrics?.clicks ? new Intl.NumberFormat("pt-BR").format(metrics.clicks) : "-"}
                loading={metricsLoading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-destructive font-medium mb-2">Erro ao carregar campanhas</p>
              <p className="text-sm text-muted-foreground">Não foi possível carregar as campanhas. Verifique suas permissões no Supabase.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search ? `Não encontramos campanhas que correspondam a "${search}"` : "Não há campanhas Google Ads para exibir no momento"}
              </p>
              {search && (
                <button onClick={() => setSearch("")} className="text-sm text-primary hover:underline">Limpar busca</button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!error && !isLoading && campaigns.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <FunnelCard title="Funil" funnelType={"traffic"} metrics={funnelMetrics} loading={metricsLoading} />
            <AgeChart ageData={demographics?.ageData ?? []} loading={demographicsLoading} />
            <GenderChart genderData={demographics?.genderData ?? []} loading={demographicsLoading} />
          </div>

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

          <PerformanceChart
            data={(timeSeriesData ?? []).map((d) => ({ ...d, value: chartMetric === "spend" ? d.spend : chartMetric === "results" ? d.results : d.revenue })) as any}
            title={chartMetric === "spend" ? "Investimento" : chartMetric === "results" ? "Resultados" : "Receita"}
            description={"Série temporal do período selecionado"}
            loading={metricsLoading}
            metric={chartMetric}
          />

          <div className="flex gap-2">
            <button
              className={`px-3 py-1 text-xs rounded border ${chartMetric === "spend" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              onClick={() => setChartMetric("spend")}
            >
              Investimento
            </button>
            <button
              className={`px-3 py-1 text-xs rounded border ${chartMetric === "results" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              onClick={() => setChartMetric("results")}
            >
              Resultados
            </button>
            <button
              className={`px-3 py-1 text-xs rounded border ${chartMetric === "revenue" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              onClick={() => setChartMetric("revenue")}
            >
              Receita
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
