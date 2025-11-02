import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { OptimizationInsights } from "@/components/insights/OptimizationInsights";
import { useReportsData } from "@/hooks/useReportsData";
import type { PerformancePoint } from "@/hooks/usePerformanceMetrics";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercentDelta(value: number) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function computeDelta(current: number, previous: number) {
  if (!previous || previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

export default function Reports() {
  const {
    data: reports,
    isLoading,
    error,
  } = useReportsData();

  const chartData: PerformancePoint[] = useMemo(() => {
    if (!reports?.timeSeries) return [];
    return reports.timeSeries.map((point) => ({
      date: point.date,
      impressions: point.impressions,
      clicks: point.clicks,
      conversions: point.conversions,
      spend: point.spend,
      conversionValue: point.conversionValue,
      roas: point.roas,
    }));
  }, [reports]);

  const platformData = useMemo(
    () =>
      reports?.platformBreakdown.map((item) => ({
        name: item.name,
        spend: item.spend,
        conversions: item.conversions,
      })) ?? [],
    [reports],
  );

  const summary = reports?.summary;
  const spendDelta = summary ? computeDelta(summary.current.spend, summary.previous.spend) : 0;
  const ctrDelta = summary ? computeDelta(summary.current.ctr, summary.previous.ctr) : 0;
  const cpaDelta = summary ? computeDelta(summary.previous.cpa, summary.current.cpa) : 0; // redução de CPA é positiva
  const roasDelta = summary ? computeDelta(summary.current.roas, summary.previous.roas) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Análise detalhada do desempenho das campanhas</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="insights">Insights & Ações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <PerformanceChart data={chartData} isLoading={isLoading} />

        <Card>
          <CardHeader>
            <CardTitle>Gastos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : platformData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de gastos no período selecionado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={platformData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => formatCurrency(value).replace("R$", "").trim()}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Investimento (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{formatCurrency(summary?.current.spend ?? 0)}</div>
            )}
            <p className={`text-sm mt-2 ${spendDelta >= 0 ? "text-success" : "text-destructive"}`}>
              {formatPercentDelta(spendDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CTR</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{`${(summary?.current.ctr ?? 0).toFixed(2)}%`}</div>
            )}
            <p className={`text-sm mt-2 ${ctrDelta >= 0 ? "text-success" : "text-destructive"}`}>
              {formatPercentDelta(ctrDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CPA Médio</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{formatCurrency(summary?.current.cpa ?? 0)}</div>
            )}
            <p className={`text-sm mt-2 ${cpaDelta >= 0 ? "text-success" : "text-destructive"}`}>
              {formatPercentDelta(cpaDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>ROAS</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{(summary?.current.roas ?? 0).toFixed(2)}x</div>
            )}
            <p className={`text-sm mt-2 ${roasDelta >= 0 ? "text-success" : "text-destructive"}`}>
              {formatPercentDelta(roasDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversões (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-3xl font-bold">{(summary?.current.conversationsStarted ?? summary?.current.conversions ?? 0).toLocaleString("pt-BR")}</div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              Conexões de mensagem: {(summary?.current.messagingConnections ?? 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impressões (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{(summary?.current.impressions ?? 0).toLocaleString("pt-BR")}</div>
            )}
            <p className="text-sm text-muted-foreground mt-2">Total de impressões agregadas</p>
          </CardContent>
        </Card>
      </div>

          {error ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-destructive">Não foi possível carregar os dados de relatório. {error.message}</p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="insights">
          <OptimizationInsights />
        </TabsContent>
      </Tabs>
    </div>
  );
}
