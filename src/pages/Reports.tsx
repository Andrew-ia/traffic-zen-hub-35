import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizationInsights } from "@/components/insights/OptimizationInsights";
import { useReportsData } from "@/hooks/useReportsData";
import { getResultLabel } from "@/lib/kpiCalculations";

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercentDelta(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("pt-BR");
}

function computeDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function getDeltaTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-muted-foreground";
  return value >= 0 ? "text-success" : "text-destructive";
}

function getSeverityVariant(severity: "low" | "medium" | "high") {
  switch (severity) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

export default function Reports() {
  const [days, setDays] = useState<7 | 15 | 30>(30);
  const {
    data: reports,
    isLoading,
    error,
  } = useReportsData(days);

  const periodLabel = `${days} dias`;

  const summary = reports?.summary;
  const spendDelta = summary ? computeDelta(summary.current.spend, summary.previous.spend) : null;
  const ctrDelta = summary ? computeDelta(summary.current.ctr, summary.previous.ctr) : null;
  const cpaDelta = summary ? computeDelta(summary.previous.cpa, summary.current.cpa) : null; // redução de CPA é positiva
  const roasDelta = summary ? computeDelta(summary.current.roas, summary.previous.roas) : null;

  const channelComparison = reports?.channelComparison ?? [];
  const objectiveBreakdown = reports?.objectiveBreakdown ?? [];
  const topCampaigns = reports?.topCampaigns ?? [];
  const topAdSets = reports?.topAdSets ?? [];
  const topAds = reports?.topAds ?? [];
  const topCreatives = reports?.topCreatives ?? [];
  const dataQuality = reports?.dataQuality ?? [];

  const renderRankingCard = (title: string, items: typeof topCampaigns) => (
    <Card key={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período.</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {items.map((item, index) => {
              // For rankings, we show messaging-focused metrics as this is the primary focus
              // In the future, this should rank by objective-specific result_value from v_campaign_kpi
              const resultCount = item.conversations || item.conversions || 0;
              const costPerResult = resultCount > 0 ? item.spend / resultCount : 0;

              return (
                <li key={item.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">{index + 1}.</div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold leading-tight truncate text-sm">{item.name}</p>
                    {item.parentName ? (
                      <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wide truncate">
                        {item.parentName}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                      <span>{formatNumber(resultCount)} resultados</span>
                      <span>·</span>
                      <span>{formatCurrency(costPerResult)}/resultado</span>
                    </div>
                  </div>
                  <div className="text-right leading-tight">
                    <p className="font-semibold text-sm">{formatCurrency(item.spend)}</p>
                    <p className="text-[0.65rem] text-muted-foreground">{formatNumber(item.impressions)} imp</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Análise detalhada do desempenho das campanhas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(value) => {
              if (!value) return;
              const parsed = Number(value) as 7 | 15 | 30;
              setDays(parsed);
            }}
            className="bg-muted/50 rounded-md p-1"
          >
            <ToggleGroupItem value="7" className="px-3 py-1 text-sm">
              7 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="15" className="px-3 py-1 text-sm">
              15 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="30" className="px-3 py-1 text-sm">
              30 dias
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={() => window.print()}>
            Gerar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Investimento ({periodLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{formatCurrency(summary?.current.spend ?? 0)}</div>
            )}
            <p className={`text-sm mt-2 ${getDeltaTone(spendDelta)}`}>
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
            <p className={`text-sm mt-2 ${getDeltaTone(ctrDelta)}`}>
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
            <p className={`text-sm mt-2 ${getDeltaTone(cpaDelta)}`}>
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
            <p className={`text-sm mt-2 ${getDeltaTone(roasDelta)}`}>
              {formatPercentDelta(roasDelta)} vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados ({periodLabel})</CardTitle>
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
            <CardTitle>Impressões ({periodLabel})</CardTitle>
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

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Investimento por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : channelComparison.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado consolidado para o período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Resultados</TableHead>
                    <TableHead className="text-right">Conexões</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead className="text-right">Custo/Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelComparison.map((item) => (
                    <TableRow key={item.channelKey}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.spend)}</TableCell>
                      <TableCell className="text-right hidden xl:table-cell">{formatNumber(item.clicks)}</TableCell>
                      <TableCell className="text-right hidden xl:table-cell">{formatNumber(item.conversions)}</TableCell>
                      <TableCell className="text-right hidden xl:table-cell">{formatNumber(item.conversations)}</TableCell>
                      <TableCell className="text-right">{formatPercent(item.ctr)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cpc)}</TableCell>
                      <TableCell className="text-right hidden xl:table-cell">{formatCurrency(item.cpa)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta por Objetivo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : objectiveBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum objetivo com gasto no período analisado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objetivo</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Resultados</TableHead>
                    <TableHead className="text-right">Conexões</TableHead>
                    <TableHead className="text-right">Custo/Resultado</TableHead>
                    <TableHead className="text-right">Custo/Conversa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objectiveBreakdown.map((item) => (
                    <TableRow key={item.objective}>
                      <TableCell className="font-medium">{item.objective}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.spend)}</TableCell>
                      <TableCell className="text-right hidden xl:table-cell">{formatNumber(item.conversions)}</TableCell>
                      <TableCell className="text-right hidden xl:table-cell">{formatNumber(item.conversations)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cpa)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.costPerConversation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {renderRankingCard("Top Campanhas Meta", topCampaigns)}
        {renderRankingCard("Top Conjuntos Meta", topAdSets)}
        {renderRankingCard("Top Anúncios Meta", topAds)}
        {renderRankingCard("Top Criativos Meta", topCreatives)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Qualidade dos Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : dataQuality.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta encontrado para o período.</p>
          ) : (
            dataQuality.map((item) => (
              <div key={item.issue} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={getSeverityVariant(item.severity)} className="uppercase">
                    {item.severity}
                  </Badge>
                  <p className="font-medium">{item.issue}</p>
                </div>
                <p className="text-sm text-muted-foreground">{item.impact}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Recomendação:</span> {item.recommendation}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Insights & Ações</h2>
        <OptimizationInsights />
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">Não foi possível carregar os dados de relatório. {error.message}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
