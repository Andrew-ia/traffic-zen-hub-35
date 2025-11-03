import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  TrendingUp,
  Target,
  Rocket,
  CheckCircle2,
  Activity,
} from "lucide-react";
import type { SyncInsightsSummary, RecommendationInsight } from "@/types/sync";
import { cn } from "@/lib/utils";

interface SyncInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insights: SyncInsightsSummary | null;
  onReload?: () => void;
}

const severityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-100",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-100",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100",
  low: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-100",
};

const actionLabels: Record<string, string> = {
  budget_increase: "Aumentar orçamento",
  budget_decrease: "Reduzir orçamento",
  pause_ad: "Pausar anúncio",
  rotate_creative: "Trocar criativo",
  expand_audience: "Expandir público",
  duplicate_best: "Duplicar melhor ad set",
  merge_adsets: "Mesclar conjuntos",
  bid_cap: "Ajustar lance",
};

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(value);

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number | null | undefined, options: { sign?: boolean } = {}) => {
  if (value === null || value === undefined) return "—";
  return `${options.sign ? (value >= 0 ? "+" : "−") : ""}${Math.abs(value).toFixed(1)}%`;
};

const formatDate = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";

function renderRecommendation(item: RecommendationInsight, variant: "opportunity" | "risk") {
  const actionLabel = actionLabels[item.actionKind] ?? item.actionKind;
  const expected = item.expectedGainPct !== null && item.expectedGainPct !== undefined
    ? `${item.expectedGainPct.toFixed(0)}%`
    : null;

  return (
    <Card key={item.id} className="border border-muted shadow-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge className={cn("capitalize", severityStyles[item.severity] ?? severityStyles.medium)}>
            {item.severity}
          </Badge>
          {expected && (
            <Badge variant={variant === "opportunity" ? "default" : "outline"} className="text-xs">
              Potencial: {expected}
            </Badge>
          )}
        </div>
        <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {item.explanation}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant="secondary">{actionLabel}</Badge>
          {item.entities.campaign?.name && (
            <Badge variant="outline">Campanha: {item.entities.campaign.name}</Badge>
          )}
          {item.entities.adset?.name && (
            <Badge variant="outline">Conjunto: {item.entities.adset.name}</Badge>
          )}
          {item.entities.ad?.name && (
            <Badge variant="outline">Anúncio: {item.entities.ad.name}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            Conta:{" "}
            <strong>{item.account.name ?? item.account.id}</strong>
          </span>
          <span>Data-base: {formatDate(item.date)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SyncInsightsDialog({
  open,
  onOpenChange,
  insights,
  onReload,
}: SyncInsightsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
            Resultados da última sincronização
          </DialogTitle>
          <DialogDescription className="text-sm">
            Resumo automático com indicadores-chave e recomendações priorizadas para o período sincronizado.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          {insights ? (
            <div className="space-y-6 pb-4">
              <section className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Resumo do período</CardTitle>
                    <CardDescription>
                      {formatDate(insights.period.startDate)} — {formatDate(insights.period.endDate)} •{" "}
                      {insights.period.daysCovered || insights.period.requestedDays} dias analisados
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gasto total</span>
                      <span className="font-semibold">{formatCurrency(insights.performance.totalSpend)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Resultados (conversões)</span>
                      <span className="font-semibold">{formatNumber(insights.performance.totalResults)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Custo por resultado</span>
                      <span className="font-semibold">{formatCurrency(insights.performance.costPerResult)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">ROAS</span>
                      <span className="font-semibold">
                        {insights.performance.roas !== null && insights.performance.roas !== undefined
                          ? insights.performance.roas.toFixed(2) + "x"
                          : "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Saúde média do inventário</span>
                      <span className="font-semibold">
                        {insights.performance.avgHealthScore !== null &&
                        insights.performance.avgHealthScore !== undefined
                          ? `${insights.performance.avgHealthScore.toFixed(0)} / 100`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Média diária de investimento</span>
                      <span className="font-semibold">
                        {formatCurrency(insights.performance.avgDailySpend)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Tendência recente
                    </CardTitle>
                    <CardDescription>
                      Comparação entre os últimos {insights.performance.trend?.recentWindowDays ?? 0} dias e o período anterior
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {insights.performance.trend ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Gasto</p>
                            <p className="text-xl font-semibold">
                              {formatCurrency(insights.performance.trend.recentSpend)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              (insights.performance.trend.spendDeltaPct ?? 0) >= 0 ? "default" : "outline"
                            }
                          >
                            {formatPercent(insights.performance.trend.spendDeltaPct, { sign: true })}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Resultados</p>
                            <p className="text-xl font-semibold">
                              {formatNumber(insights.performance.trend.recentResults)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              (insights.performance.trend.resultsDeltaPct ?? 0) >= 0 ? "default" : "outline"
                            }
                          >
                            {formatPercent(insights.performance.trend.resultsDeltaPct, { sign: true })}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Ainda não há histórico suficiente para analisar a tendência.
                      </p>
                    )}
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">TOP 3 campanhas por resultado</p>
                      <div className="space-y-1">
                        {insights.performance.topCampaigns.length > 0 ? (
                          insights.performance.topCampaigns.map((item) => (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                              <span>{item.name}</span>
                              <span className="font-semibold">
                                {formatNumber(item.results)} • {formatCurrency(item.costPerResult)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem campanhas com dados recentes.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-green-600" />
                      Oportunidades de escala
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Priorize ações que podem gerar crescimento rápido com base nos últimos dados.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {insights.counts.opportunities} recomendaç{insights.counts.opportunities === 1 ? "ão" : "ões"}
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {insights.opportunities.length > 0 ? (
                    insights.opportunities.map((item) => renderRecommendation(item, "opportunity"))
                  ) : (
                    <Card>
                      <CardContent className="py-6 text-center text-sm text-muted-foreground">
                        Nenhuma oportunidade de escala identificada neste período.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Riscos e correções urgentes
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Itens que precisam de atenção imediata para evitar desperdício de orçamento ou queda de performance.
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {insights.counts.risks} risco{insights.counts.risks === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {insights.risks.length > 0 ? (
                    insights.risks.map((item) => renderRecommendation(item, "risk"))
                  ) : (
                    <Card>
                      <CardContent className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum risco crítico identificado. Continue monitorando a performance.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </section>

              {insights.notes.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Observações
                  </h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    {insights.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Resultados da sincronização indisponíveis.
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between gap-3">
          {insights && insights.counts.bySeverity && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(insights.counts.bySeverity).map(([severity, count]) => (
                <Badge key={severity} className={cn(severityStyles[severity] ?? severityStyles.medium)}>
                  {count}x {severity}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {onReload && (
              <Button variant="outline" onClick={() => onReload()}>
                Atualizar dashboards
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

