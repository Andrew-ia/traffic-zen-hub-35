import { useEffect, useState } from "react";
import { ObjectivePerformanceSection } from "@/components/dashboard/ObjectivePerformance";
import { KPIOverview } from "@/components/dashboard/KPIOverview";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLoadingSkeleton, ErrorDashboardState } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function Dashboard() {
  const [periodDays, setPeriodDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: performance, isLoading: isLoadingMetrics, error } = usePerformanceMetrics(workspaceId, periodDays);

  if (!workspaceId) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Selecione um workspace no topo para ver os dados do cliente.</p>
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["meta", "performance-metrics"] });
      await queryClient.invalidateQueries({ queryKey: ["objective-performance-summary"] });
    } finally {
      setRefreshing(false);
    }
  };

  // Show loading skeleton on initial load
  if (isLoadingMetrics && !performance) {
    return <DashboardLoadingSkeleton />;
  }

  // Show error state
  if (error && !performance) {
    return <ErrorDashboardState error={error} onRefresh={handleRefresh} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section - Responsive */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight h-20 flex items-center">Dashboard</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-sm sm:text-base text-muted-foreground">
              Visão geral das suas campanhas e performance
            </p>
            {performance && (
              <div className="text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded">
                📊 {performance.points?.length || 0} dias com dados
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Select value={periodDays.toString()} onValueChange={(value) => setPeriodDays(Number(value))}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Últimos 7 dias
                </div>
              </SelectItem>
              <SelectItem value="14">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Últimos 14 dias
                </div>
              </SelectItem>
              <SelectItem value="30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Últimos 30 dias
                </div>
              </SelectItem>
              <SelectItem value="60">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  Últimos 60 dias
                </div>
              </SelectItem>
              <SelectItem value="90">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Últimos 90 dias
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Overview Section */}
      <KPIOverview 
        days={periodDays} 
        workspaceId={workspaceId}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Objective Performance Section */}
      <ObjectivePerformanceSection workspaceId={workspaceId} days={periodDays} />
    </div>
  );
}
