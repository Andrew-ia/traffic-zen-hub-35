import { useEffect, useState } from "react";
import { ObjectivePerformanceSection } from "@/components/dashboard/ObjectivePerformance";
import { KPIOverview } from "@/components/dashboard/KPIOverview";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLoadingSkeleton, ErrorDashboardState } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, createPageActions } from "@/components/ui/page-header";
import { ResponsiveContainer, ResponsiveGrid } from "@/components/ui/responsive-container";

export default function Dashboard() {
  const [periodDays, setPeriodDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: performance, isLoading: isLoadingMetrics, error } = usePerformanceMetrics(periodDays);

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

  const pageActions = createPageActions([
    {
      label: "Atualizar",
      onClick: handleRefresh,
      variant: "outline",
      icon: RefreshCw,
      loading: refreshing
    }
  ]);

  return (
    <ResponsiveContainer>
      <div className="space-y-4 sm:space-y-6">
        {/* Header Section - Using standardized PageHeader */}
        <PageHeader
          title="Dashboard"
          description="Visão geral das suas campanhas e performance"
          actions={
            <>
              {pageActions}
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
            </>
          }
        />

        {/* KPI Overview Section */}
        <KPIOverview
          days={periodDays}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {/* Objective Performance Section */}
        <ResponsiveGrid>
          <ObjectivePerformanceSection days={periodDays} />
        </ResponsiveGrid>
      </div>
    </ResponsiveContainer>
  );
}
