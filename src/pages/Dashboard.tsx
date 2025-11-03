import { useEffect, useMemo, useState } from "react";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { ObjectivePerformanceSection } from "@/components/dashboard/ObjectivePerformance";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [periodDays, setPeriodDays] = useState(30);
  const pageSize = 6;

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const {
    data: filteredCampaignData,
    isLoading: isLoadingCampaigns,
  } = useCampaigns({ status: statusFilter, search: debouncedSearch, page, pageSize });

  const tableCampaigns = filteredCampaignData?.campaigns ?? [];
  const totalFiltered = filteredCampaignData?.total ?? tableCampaigns.length;

  const { data: performance, isLoading: isLoadingMetrics } = usePerformanceMetrics(periodDays);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section - Responsive */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Visão geral das suas campanhas e performance
          </p>
        </div>

        <Select value={periodDays.toString()} onValueChange={(value) => setPeriodDays(Number(value))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="w-full sm:w-64 lg:w-72">
              <Input
                placeholder="Buscar campanhas..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CampaignStatusFilter)}>
              <SelectTrigger className="w-full sm:w-48 h-9">
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

      <ObjectivePerformanceSection days={periodDays} />
    </div>
  );
}
