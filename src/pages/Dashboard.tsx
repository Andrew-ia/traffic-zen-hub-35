import { useEffect, useMemo, useState } from "react";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, MousePointer, TrendingUp, DollarSign } from "lucide-react";

function formatCompactNumber(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const { data: allCampaignData } = useCampaigns();
  const allCampaigns = allCampaignData?.campaigns ?? [];

  const {
    data: filteredCampaignData,
    isLoading: isLoadingCampaigns,
  } = useCampaigns({ status: statusFilter, search: debouncedSearch, page, pageSize });

  const tableCampaigns = filteredCampaignData?.campaigns ?? [];
  const totalFiltered = filteredCampaignData?.total ?? tableCampaigns.length;

  const { data: performance, isLoading: isLoadingMetrics } = usePerformanceMetrics();

  const activeCampaigns = useMemo(
    () => allCampaigns.filter((campaign) => campaign.status?.toLowerCase() === "active"),
    [allCampaigns],
  );
  const pausedCampaigns = useMemo(
    () => allCampaigns.filter((campaign) => campaign.status?.toLowerCase() === "paused"),
    [allCampaigns],
  );
  const archivedCampaigns = useMemo(
    () => allCampaigns.filter((campaign) => campaign.status?.toLowerCase() === "archived"),
    [allCampaigns],
  );

  const totals = performance?.totals ?? {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    conversionValue: 0,
    roas: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Visão consolidada do desempenho e saúde das suas campanhas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Impressões (30d)"
          value={formatCompactNumber(totals.impressions)}
          change={`${activeCampaigns.length} campanhas ativas`}
          icon={Eye}
          trend={totals.impressions >= 0 ? "up" : "down"}
        />
        <MetricCard
          title="Cliques (30d)"
          value={formatCompactNumber(totals.clicks)}
          change={`${pausedCampaigns.length} pausadas`}
          icon={MousePointer}
          trend={totals.clicks >= 0 ? "up" : "down"}
        />
        <MetricCard
          title="Conversões (30d)"
          value={formatCompactNumber(totals.conversions)}
          change={`${archivedCampaigns.length} arquivadas`}
          icon={TrendingUp}
          trend={totals.conversions >= 0 ? "up" : "down"}
        />
        <MetricCard
          title="ROAS Médio"
          value={`${totals.roas.toFixed(2)}x`}
          change={
            totals.spend
              ? `${formatCurrency(totals.conversionValue)} retorno / ${formatCurrency(totals.spend)} gasto`
              : "Sem gastos registrados"
          }
          icon={DollarSign}
          trend={totals.roas >= 1 ? "up" : "down"}
        />
      </div>

      <PerformanceChart data={performance?.points ?? []} isLoading={isLoadingMetrics} />

      <CampaignsTable
        campaigns={tableCampaigns}
        isLoading={isLoadingCampaigns}
        page={page}
        pageSize={pageSize}
        total={totalFiltered}
        onPageChange={setPage}
        showCreateButton={false}
        headerActions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="w-full sm:w-60">
              <Input
                placeholder="Buscar campanhas..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CampaignStatusFilter)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="archived">Arquivadas</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
