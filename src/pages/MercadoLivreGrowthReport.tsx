import { useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreGrowthReport } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Download, TrendingDown, TrendingUp } from "lucide-react";

const formatPct = (value: number | null, digits = 1) => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function MercadoLivreGrowthReport() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data, isLoading, error, refetch, isFetching } = useMercadoLivreGrowthReport(workspaceId, {
    periods: [7, 30, 90],
    topN: 10,
  });

  const summary = data?.executiveSummary?.metrics;
  const skuPlans = data?.skuPlans || [];
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const togglePlan = (planId: string) =>
    setExpandedPlans((prev) => ({ ...prev, [planId]: !prev[planId] }));
  const collapsedActions = 2;

  const downloadUrl = (format: "json" | "md" | "html") => {
    if (!workspaceId) return "#";
    const params = new URLSearchParams({
      workspaceId,
      format,
      download: "1",
      periods: "7,30,90",
      topN: "10",
    });
    return `/api/integrations/mercadolivre/growth-report?${params.toString()}`;
  };

  const actionBadges = useMemo(() => {
    return (data?.actions || []).map((action, idx) => (
      <li key={`${action.title}-${idx}`} className="flex items-start gap-2">
        <Badge variant="outline">{action.impact}/{action.effort}</Badge>
        <span className="text-sm">{action.title}</span>
      </li>
    ));
  }, [data?.actions]);

  if (!workspaceId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Relatório Executivo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Selecione um workspace para carregar o relatório.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatório Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Queda de vendas, causas prováveis e ações priorizadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isFetching ? "Atualizando..." : "Atualizar"}
          </Button>
          <Button asChild variant="outline">
            <a href={downloadUrl("md")}>
              <Download className="mr-2 h-4 w-4" />
              Markdown
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={downloadUrl("html")}>
              <Download className="mr-2 h-4 w-4" />
              HTML
            </a>
          </Button>
          <Button asChild>
            <a href={downloadUrl("json")}>
              <Download className="mr-2 h-4 w-4" />
              JSON
            </a>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Falha ao carregar relatório</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && summary && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita</CardTitle>
                <div className="text-2xl font-semibold">{formatCurrency(summary.revenue.current)}</div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
                {summary.revenue.deltaPct !== null && summary.revenue.deltaPct < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                {formatPct(summary.revenue.deltaPct)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos</CardTitle>
                <div className="text-2xl font-semibold">{summary.orders.current}</div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
                {summary.orders.deltaPct !== null && summary.orders.deltaPct < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                {formatPct(summary.orders.deltaPct)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Visitas</CardTitle>
                <div className="text-2xl font-semibold">{summary.visits.current}</div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
                {summary.visits.deltaPct !== null && summary.visits.deltaPct < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                {formatPct(summary.visits.deltaPct)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Conversão</CardTitle>
                <div className="text-2xl font-semibold">{formatPct(summary.conversion.current, 2)}</div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
                {summary.conversion.deltaPct !== null && summary.conversion.deltaPct < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                {formatPct(summary.conversion.deltaPct)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo executivo</CardTitle>
              <p className="text-sm text-muted-foreground">{data.executiveSummary.headline}</p>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.executiveSummary.mainCauses.map((cause, idx) => (
                  <li key={`${cause}-${idx}`}>{cause}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {data.periods.map((period) => (
            <div key={period.days} className="space-y-4">
              <h2 className="text-lg font-semibold">
                Últimos {period.days} dias ({period.range.from} a {period.range.to})
              </h2>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 10 queda de visitas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Visitas</TableHead>
                        <TableHead>Prev</TableHead>
                        <TableHead>Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.topVisitDrop.map((item) => (
                        <TableRow key={item.ml_item_id}>
                          <TableCell>{item.sku || "-"}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{item.title || item.ml_item_id}</TableCell>
                          <TableCell>{item.visits}</TableCell>
                          <TableCell>{item.prevVisits || 0}</TableCell>
                          <TableCell>{item.visits - (item.prevVisits || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 10 queda de conversão</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Conv</TableHead>
                        <TableHead>Prev</TableHead>
                        <TableHead>Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.topConversionDrop.map((item) => {
                        const current = item.conversion || 0;
                        const prev = item.prevConversion || 0;
                        return (
                          <TableRow key={item.ml_item_id}>
                            <TableCell>{item.sku || "-"}</TableCell>
                            <TableCell className="max-w-[280px] truncate">{item.title || item.ml_item_id}</TableCell>
                            <TableCell>{formatPct(current, 2)}</TableCell>
                            <TableCell>{formatPct(prev, 2)}</TableCell>
                            <TableCell>{formatPct(current - prev, 2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Maior oportunidade (visitas altas + conversão baixa)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Visitas</TableHead>
                        <TableHead>Conv</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.opportunities.map((item) => (
                        <TableRow key={item.ml_item_id}>
                          <TableCell>{item.sku || "-"}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{item.title || item.ml_item_id}</TableCell>
                          <TableCell>{item.visits}</TableCell>
                          <TableCell>{formatPct(item.conversion || 0, 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Plano por SKU (Full, sem vendas)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Foco em itens Full com estoque e zero vendas nos últimos 30 dias.
              </p>
              <p className="text-xs text-muted-foreground">
                Filtro: Full + estoque &gt; 0 + 0 vendas. Se vazio, mostramos itens com estoque.
              </p>
              {skuPlans.length > 30 ? (
                <p className="text-xs text-muted-foreground">
                  Mostrando 30 de {skuPlans.length} itens (exporte JSON/Markdown para lista completa).
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              {skuPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados suficientes para plano por SKU.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Diagnóstico</TableHead>
                      <TableHead>Ações</TableHead>
                      <TableHead>Preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skuPlans.slice(0, 30).map((plan) => {
                      const isExpanded = Boolean(expandedPlans[plan.ml_item_id]);
                      const visibleActions = isExpanded ? plan.actions : plan.actions.slice(0, collapsedActions);
                      return (
                        <TableRow key={plan.ml_item_id}>
                          <TableCell>
                            <Badge variant="outline">{plan.priority}</Badge>
                          </TableCell>
                          <TableCell>{plan.sku || "-"}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{plan.title || plan.ml_item_id}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{plan.diagnosis}</TableCell>
                          <TableCell>
                            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                              {visibleActions.map((action, idx) => (
                                <li key={`${plan.ml_item_id}-action-${idx}`}>{action}</li>
                              ))}
                            </ul>
                            {plan.actions.length > collapsedActions ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-6 px-2 text-xs"
                                onClick={() => togglePlan(plan.ml_item_id)}
                              >
                                {isExpanded ? "Fechar checklist" : "Abrir checklist"}
                              </Button>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {plan.priceTests
                              ? `${plan.priceTests.current.toFixed(2)} → T1 ${plan.priceTests.t1.toFixed(2)} → T2 ${plan.priceTests.t2.toFixed(2)} → T3 ${plan.priceTests.t3.toFixed(2)}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {data.ads?.periods?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Ads: o que piorou</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {data.ads.periods.map((ads) => (
                  <div key={ads.days} className="rounded-md border border-border/50 p-3">
                    <div className="font-medium text-foreground">
                      {ads.days} dias ({ads.range.from} a {ads.range.to})
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>Custo: {formatPct(ads.summary.cost?.deltaPct)}</div>
                      <div>ACOS: {formatPct(ads.summary.acos?.deltaPct)}</div>
                      <div>Receita Ads: {formatPct(ads.summary.revenue?.deltaPct)}</div>
                      <div>ROAS: {formatPct(ads.summary.roas?.deltaPct)}</div>
                    </div>
                  </div>
                ))}
                {data.ads.leaks?.length ? (
                  <div>
                    <div className="font-medium text-foreground">Vazamento de verba</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {data.ads.leaks.map((item) => (
                        <li key={item.ml_item_id}>{item.title || item.ml_item_id} (custo {formatCurrency(item.cost)})</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Ações priorizadas (impacto x esforço)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">{actionBadges}</ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist do que fazer hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.checklist.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {data.notes?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {data.notes.map((note, idx) => (
                  <p key={`${note}-${idx}`}>{note}</p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
