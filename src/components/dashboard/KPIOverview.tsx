import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Users, MousePointer, Target, RefreshCw } from "lucide-react";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";

interface KPICardProps {
  title: string;
  value: string;
  previousValue?: string;
  trend?: "up" | "down" | "neutral";
  trendPercentage?: number;
  icon: React.ReactNode;
  loading?: boolean;
}

function KPICard({ title, value, previousValue, trend, trendPercentage, icon, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-7 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  const getTrendColor = (trend: "up" | "down" | "neutral" | undefined) => {
    switch (trend) {
      case "up": return "text-green-600 dark:text-green-400";
      case "down": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getTrendIcon = (trend: "up" | "down" | "neutral" | undefined) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-3 w-3" />;
      case "down": return <TrendingDown className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {trendPercentage !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${getTrendColor(trend)}`}>
            <span className={`flex items-center ${trend === 'up' ? 'bg-green-100 dark:bg-green-900/30' : trend === 'down' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'} px-1.5 py-0.5 rounded-full`}>
              {getTrendIcon(trend)}
              <span className="ml-1">{Math.abs(trendPercentage).toFixed(1)}%</span>
            </span>
            {previousValue && (
              <span className="text-muted-foreground ml-1">vs anterior</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

function calculateTrend(current: number, previous: number): {
  trend: "up" | "down" | "neutral";
  percentage: number;
} {
  if (previous === 0) {
    return { trend: current > 0 ? "up" : "neutral", percentage: current > 0 ? 100 : 0 };
  }

  const percentage = ((current - previous) / previous) * 100;
  return {
    trend: percentage > 2 ? "up" : percentage < -2 ? "down" : "neutral",
    percentage: Math.abs(percentage)
  };
}

interface KPIOverviewProps {
  days: number;
  workspaceId: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function KPIOverview({ days, workspaceId, onRefresh, refreshing }: KPIOverviewProps) {
  const { data: currentData, isLoading: currentLoading } = usePerformanceMetrics(workspaceId, days);
  const { data: previousData, isLoading: previousLoading } = usePerformanceMetrics(workspaceId, days, days);

  const isLoading = currentLoading || previousLoading || refreshing;

  if (!currentData && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            KPIs Principais
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-input hover:bg-accent hover:text-accent-foreground h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </CardTitle>
          <CardDescription>Resumo dos últimos {days} dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = currentData?.totals;
  const previous = previousData?.totals;

  const spendTrend = current && previous ? calculateTrend(current.spend, previous.spend) : undefined;
  const conversionsTrend = current && previous ? calculateTrend(current.conversions, previous.conversions) : undefined;
  const clicksTrend = current && previous ? calculateTrend(current.clicks, previous.clicks) : undefined;
  const roasTrend = current && previous ? calculateTrend(current.roas, previous.roas) : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            KPIs Principais
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-input hover:bg-accent hover:text-accent-foreground h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </CardTitle>
          <CardDescription>Resumo dos últimos {days} dias</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Investimento Total"
          value={current ? formatCurrency(current.spend) : "R$ 0,00"}
          trend={spendTrend?.trend}
          trendPercentage={spendTrend?.percentage}
          icon={<DollarSign className="h-4 w-4" />}
          loading={isLoading}
        />

        <KPICard
          title="Conversas Iniciadas"
          value={current ? formatNumber(current.conversions) : "0"}
          trend={conversionsTrend?.trend}
          trendPercentage={conversionsTrend?.percentage}
          icon={<Target className="h-4 w-4" />}
          loading={isLoading}
        />

        <KPICard
          title="Cliques"
          value={current ? formatNumber(current.clicks) : "0"}
          trend={clicksTrend?.trend}
          trendPercentage={clicksTrend?.percentage}
          icon={<MousePointer className="h-4 w-4" />}
          loading={isLoading}
        />

        <KPICard
          title={current && current.conversionValue > 0 ? "ROAS" : "Custo por Conversa"}
          value={current && current.conversionValue > 0 
            ? `${current.roas.toFixed(2)}x` 
            : current && current.conversions > 0 
              ? formatCurrency(current.spend / current.conversions)
              : "N/A"
          }
          trend={roasTrend?.trend}
          trendPercentage={roasTrend?.percentage}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {current && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {current.conversionValue > 0 ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                💰 Valor Total: {formatCurrency(current.conversionValue)}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                💬 {formatNumber(current.conversationsStarted)} conversas • {formatNumber(current.messagingConnections)} conexões
              </Badge>
            )}
            <Badge variant="outline">
              CPM: {current.spend > 0 && current.impressions > 0
                ? formatCurrency((current.spend / current.impressions) * 1000)
                : "N/A"}
            </Badge>
          </div>
          {current.conversionValue === 0 && (
            <div className="text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-3">
              💡 <strong>Dica:</strong> Configure o Pixel do Meta para trackear vendas e calcular ROAS real.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
