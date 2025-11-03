import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTrafficAnalysis } from "@/hooks/useTrafficAnalysis";
import { useLatestSyncInsights } from "@/hooks/useLatestSyncInsights";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  TrendingUp,
  DollarSign,
  MousePointer,
  Target,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const STATUS_COLORS = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  archived: "bg-gray-500",
} as const;

const STATUS_LABELS = {
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
} as const;

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Tráfego",
  LINK_CLICKS: "Cliques em Links",
  MESSAGES: "Mensagens",
  POST_ENGAGEMENT: "Engajamento em Posts",
  VIDEO_VIEWS: "Visualizações de Vídeo",
};

export default function TrafficAnalysis() {
  const [periodDays, setPeriodDays] = useState(30);
  const { data, isLoading } = useTrafficAnalysis(periodDays);
  const { data: latestInsights, isLoading: loadingInsights } = useLatestSyncInsights();

  const insights = latestInsights?.summary ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Carregando análise...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Nenhum dado disponível</p>
      </div>
    );
  }

  const bestCampaign = data.activeCampaigns[0];
  const worstCampaign = data.activeCampaigns[data.activeCampaigns.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Análise de Tráfego</h1>
          <p className="mt-1 text-muted-foreground">Métricas essenciais para gestão de campanhas</p>
        </div>
        <Select value={String(periodDays)} onValueChange={(value) => setPeriodDays(Number(value))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
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

      {/* Insights da última sincronização */}
      {!loadingInsights && insights && (
        <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lightbulb className="h-5 w-5" />
              Insights da última sincronização
            </CardTitle>
            <CardDescription>
              Período analisado: {insights.period.startDate || "—"} até {insights.period.endDate || "—"} • Última atualização {formatDateTime(latestInsights?.completedAt || insights.generatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border bg-background">
                <p className="text-xs uppercase text-muted-foreground font-medium mb-1">Investimento</p>
                <p className="text-xl font-semibold">{formatCurrency(insights.performance.totalSpend)}</p>
                <p className="text-xs text-muted-foreground">
                  ROAS {insights.performance.roas ? `${insights.performance.roas.toFixed(2)}x` : "—"}
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-background">
                <p className="text-xs uppercase text-muted-foreground font-medium mb-1">Resultados</p>
                <p className="text-xl font-semibold">{formatNumber(insights.performance.totalResults)}</p>
                <p className="text-xs text-muted-foreground">
                  CPL {insights.performance.costPerResult ? formatCurrency(insights.performance.costPerResult) : "—"}
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-background">
                <p className="text-xs uppercase text-muted-foreground font-medium mb-1">Recomendações</p>
                <p className="text-xl font-semibold">{insights.counts.totalRecommendations}</p>
                <p className="text-xs text-muted-foreground">
                  {insights.counts.opportunities} oportunidades • {insights.counts.risks} riscos
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">Oportunidades de escala</p>
                </div>
                <div className="space-y-2">
                  {insights.opportunities.length > 0 ? (
                    insights.opportunities.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-3 border rounded-lg bg-background">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.explanation}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                          <span>{item.account.name ?? item.account.id}</span>
                          {item.expectedGainPct !== null && (
                            <span className="font-semibold text-green-600 dark:text-green-300">
                              +{item.expectedGainPct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma oportunidade aberta no momento.</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Riscos e correções urgentes</p>
                </div>
                <div className="space-y-2">
                  {insights.risks.length > 0 ? (
                    insights.risks.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-3 border rounded-lg bg-background">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.explanation}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                          <span>{item.account.name ?? item.account.id}</span>
                          <span className="font-semibold text-orange-600 dark:text-orange-300 capitalize">
                            {item.severity}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum risco crítico identificado.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totals.spend)}</div>
            <p className="text-xs text-muted-foreground">
              {data.activeCampaigns.length} campanhas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPC Médio</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totals.cpc)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.totals.clicks)} cliques totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CTR Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(data.totals.ctr)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.totals.impressions)} impressões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas WhatsApp</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totals.conversationsStarted)}</div>
            <p className="text-xs text-muted-foreground">
              CPL: {formatCurrency(data.totals.conversationsStarted > 0 ? data.totals.spend / data.totals.conversationsStarted : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Objetivo */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Objetivo</CardTitle>
          <CardDescription>Investimento e resultados agrupados por objetivo de campanha</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(data.byObjective)
              .sort((a, b) => b[1].spend - a[1].spend)
              .map(([objective, stats]) => (
                <div key={objective} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {OBJECTIVE_LABELS[objective] || objective}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {stats.count} campanha{stats.count !== 1 ? 's' : ''} • {stats.conversions} conversões
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium">{formatCurrency(stats.spend)}</p>
                    {stats.conversions > 0 && (
                      <p className="text-xs text-muted-foreground">
                        CPL: {formatCurrency(stats.cpl)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <div className="grid gap-4 md:grid-cols-2">
        {bestCampaign && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpIcon className="h-5 w-5 text-green-500" />
                Melhor Campanha
              </CardTitle>
              <CardDescription>Maior investimento no período</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium text-lg">{bestCampaign.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className={STATUS_COLORS[bestCampaign.status as keyof typeof STATUS_COLORS]}>
                    {STATUS_LABELS[bestCampaign.status as keyof typeof STATUS_LABELS] || bestCampaign.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {OBJECTIVE_LABELS[bestCampaign.objective] || bestCampaign.objective}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Investimento</p>
                  <p className="font-semibold">{formatCurrency(bestCampaign.spend)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPC</p>
                  <p className="font-semibold">{formatCurrency(bestCampaign.cpc)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CTR</p>
                  <p className="font-semibold">{formatPercent(bestCampaign.ctr)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conversões</p>
                  <p className="font-semibold">{formatNumber(bestCampaign.conversationsStarted)}</p>
                </div>
              </div>
              {bestCampaign.conversationsStarted > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground">Custo por Lead (CPL)</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(bestCampaign.cpl)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {worstCampaign && bestCampaign !== worstCampaign && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownIcon className="h-5 w-5 text-yellow-500" />
                Atenção Necessária
              </CardTitle>
              <CardDescription>Menor investimento no período</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium text-lg">{worstCampaign.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className={STATUS_COLORS[worstCampaign.status as keyof typeof STATUS_COLORS]}>
                    {STATUS_LABELS[worstCampaign.status as keyof typeof STATUS_LABELS] || worstCampaign.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {OBJECTIVE_LABELS[worstCampaign.objective] || worstCampaign.objective}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Investimento</p>
                  <p className="font-semibold">{formatCurrency(worstCampaign.spend)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPC</p>
                  <p className="font-semibold">{formatCurrency(worstCampaign.cpc)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CTR</p>
                  <p className="font-semibold">{formatPercent(worstCampaign.ctr)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conversões</p>
                  <p className="font-semibold">{formatNumber(worstCampaign.conversationsStarted)}</p>
                </div>
              </div>
              {worstCampaign.conversationsStarted > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground">Custo por Lead (CPL)</p>
                  <p className="text-xl font-bold">{formatCurrency(worstCampaign.cpl)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Campanhas</CardTitle>
          <CardDescription>Desempenho detalhado de cada campanha ativa no período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm">
                  <th className="pb-3 font-medium">Campanha</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Investimento</th>
                  <th className="pb-3 font-medium text-right">Impressões</th>
                  <th className="pb-3 font-medium text-right">Cliques</th>
                  <th className="pb-3 font-medium text-right">CTR</th>
                  <th className="pb-3 font-medium text-right">CPC</th>
                  <th className="pb-3 font-medium text-right">Conversas</th>
                  <th className="pb-3 font-medium text-right">CPL</th>
                </tr>
              </thead>
              <tbody>
                {data.activeCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {OBJECTIVE_LABELS[campaign.objective] || campaign.objective}
                        </p>
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant="secondary"
                        className={STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}
                      >
                        {STATUS_LABELS[campaign.status as keyof typeof STATUS_LABELS] || campaign.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-medium">{formatCurrency(campaign.spend)}</td>
                    <td className="py-3 text-right">{formatNumber(campaign.impressions)}</td>
                    <td className="py-3 text-right">{formatNumber(campaign.clicks)}</td>
                    <td className="py-3 text-right">{formatPercent(campaign.ctr)}</td>
                    <td className="py-3 text-right">{formatCurrency(campaign.cpc)}</td>
                    <td className="py-3 text-right font-medium">{formatNumber(campaign.conversationsStarted)}</td>
                    <td className="py-3 text-right">
                      {campaign.conversationsStarted > 0 ? (
                        <span className="font-medium text-green-600">
                          {formatCurrency(campaign.cpl)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
