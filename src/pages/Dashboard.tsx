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
import { useMercadoLivreMetrics } from "@/hooks/useMercadoLivre";
import { CompactKPICard } from "@/components/platform/CompactKPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, Eye, TrendingUp, Package, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [periodDays, setPeriodDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: performance, isLoading: isLoadingMetrics, error } = usePerformanceMetrics(workspaceId, periodDays);
  const { data: mlMetrics, isLoading: mlLoading } = useMercadoLivreMetrics(workspaceId, periodDays);

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

      {/* Mercado Livre KPIs */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Mercado Livre
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CompactKPICard
            title="Vendas brutas"
            value={new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            }).format(mlMetrics?.totalRevenue ?? 0)}
            icon={DollarSign}
            loading={mlLoading}
          />
          <CompactKPICard
            title="Unidades vendidas"
            value={new Intl.NumberFormat("pt-BR").format(mlMetrics?.totalSales ?? 0)}
            icon={ShoppingBag}
            loading={mlLoading}
          />
          <CompactKPICard
            title="Visitas"
            value={new Intl.NumberFormat("pt-BR").format(mlMetrics?.totalVisits ?? 0)}
            icon={Eye}
            loading={mlLoading}
          />
          <CompactKPICard
            title="Conversão"
            value={
              mlMetrics?.conversionRate !== undefined
                ? `${(mlMetrics.conversionRate ?? 0).toFixed(2)}%`
                : "-"
            }
            icon={TrendingUp}
            loading={mlLoading}
          />
        </div>

        {!mlLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactKPICard
              title="Preço médio por unidade"
              value={new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 2,
              }).format(mlMetrics?.averageUnitPrice ?? 0)}
              icon={DollarSign}
              loading={mlLoading}
            />
            <CompactKPICard
              title="Preço médio por venda"
              value={new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 2,
              }).format(mlMetrics?.averageOrderPrice ?? 0)}
              icon={DollarSign}
              loading={mlLoading}
            />
            <CompactKPICard
              title="Quantidade de vendas"
              value={new Intl.NumberFormat("pt-BR").format(mlMetrics?.totalOrders ?? 0)}
              icon={Package}
              loading={mlLoading}
            />
            <CompactKPICard
              title="Vendas canceladas"
              value={new Intl.NumberFormat("pt-BR").format(mlMetrics?.canceledOrders ?? 0)}
              icon={AlertCircle}
              loading={mlLoading}
            />
          </div>
        )}
      </div>

      {/* Objective Performance Section */}
      <ObjectivePerformanceSection workspaceId={workspaceId} days={periodDays} />
    </div>
  );
}
