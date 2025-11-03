import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, differenceInCalendarDays, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, CalendarRange, Clock, Database, Network, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCampaignDetails } from "@/hooks/useCampaignDetails";
import { useCampaignMetrics } from "@/hooks/useCampaignMetrics";
import { useCampaignBreakdowns } from "@/hooks/useCampaignBreakdowns";
import { getResultLabel, computePrimaryKpi, calculateRoas } from "@/lib/kpiCalculations";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BREAKDOWN_OPTIONS = [
  { value: "publisher_platform", label: "Plataforma / Posicionamento" },
  { value: "device_platform", label: "Dispositivo" },
  { value: "country", label: "País" },
  { value: "age", label: "Idade" },
  { value: "gender", label: "Gênero" },
  { value: "age_gender", label: "Idade + Gênero" },
  { value: "impression_device", label: "Tipo de Impressão" },
];

const QUICK_RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function formatCurrency(value?: number | null, currency = "BRL") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: value > 999 ? 0 : 2,
    }).format(value);
  } catch {
    return value !== undefined && value !== null ? value.toFixed(2) : "—";
  }
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value?: number | null, maximumFractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(maximumFractionDigits)}%`;
}

function formatDimensionValues(values: Record<string, unknown> | undefined | null) {
  const entries = Object.entries(values ?? {});
  if (entries.length === 0) return "Desconhecido";
  return entries
    .map(([, value]) => {
      if (value === undefined || value === null || value === "") return "";
      return String(value);
    })
    .filter((value) => value.length > 0)
    .join(" • ") || "Desconhecido";
}

function formatStatus(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "Ativa";
    case "paused":
      return "Pausada";
    case "archived":
      return "Arquivada";
    case "completed":
      return "Concluída";
    case "draft":
      return "Rascunho";
    default:
      return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "active":
      return "default";
    case "paused":
      return "secondary";
    case "draft":
    case "archived":
    case "completed":
      return "outline";
    default:
      return "secondary";
  }
}

function budgetTypeLabel(type?: string | null) {
  if (!type) return null;
  switch (type.toLowerCase()) {
    case "daily":
      return "Diário";
    case "lifetime":
      return "Vitalício";
    case "campaign":
      return "Campanha (CBO)";
    default:
      return type;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function JsonPreview({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma configuração registrada.</p>;
  }

  return (
    <pre className="max-h-[280px] overflow-auto rounded-md bg-muted/40 p-4 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function CampaignDetails() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = subDays(new Date(to), 29);
    return { from, to };
  });
  const [breakdownKey, setBreakdownKey] = useState<string>(BREAKDOWN_OPTIONS[0]?.value ?? "publisher_platform");

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "Selecione o período";
    const sameDay = dateRange.from.toDateString() === dateRange.to.toDateString();
    const formattedFrom = format(dateRange.from, "dd/MMM/yy");
    const formattedTo = format(dateRange.to, "dd/MMM/yy");
    return sameDay ? formattedFrom : `${formattedFrom} - ${formattedTo}`;
  }, [dateRange]);
  const breakdownLabel = useMemo(
    () => BREAKDOWN_OPTIONS.find((option) => option.value === breakdownKey)?.label ?? "Breakdown",
    [breakdownKey],
  );

  const { data: details, isLoading, error } = useCampaignDetails(campaignId);
  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useCampaignMetrics({
    campaignId,
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    granularity: "day",
  });
  const {
    data: breakdownData,
    isLoading: isLoadingBreakdown,
    error: breakdownError,
  } = useCampaignBreakdowns({
    campaignId,
    breakdownKey,
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    granularity: "day",
  });

  const handleRangeSelect = (range?: DateRange) => {
    if (!range?.from) return;
    const to = new Date(range.to ?? range.from);
    to.setHours(0, 0, 0, 0);
    const from = new Date(range.from);
    from.setHours(0, 0, 0, 0);
    setDateRange({ from, to });
  };

  const applyQuickRange = (days: number) => {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = subDays(new Date(to), days - 1);
    setDateRange({ from, to });
  };

  const isQuickRangeActive = (days: number) => {
    if (!dateRange?.from || !dateRange?.to) return false;
    const diff = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    return diff === days;
  };

  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Carregando dados da campanha...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">
              Não foi possível carregar os detalhes da campanha. {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!details?.campaign) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground">Campanha não encontrada.</p>
            <Button variant="link" className="px-0" asChild>
              <Link to="/campaigns">Voltar para lista de campanhas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { campaign, adSets } = details;
  const currency = campaign.platformAccount?.currency ?? "BRL";
  const metricsTotals = metrics?.totals;

  // Calculate objective-based KPI
  const resultLabel = getResultLabel(campaign.objective, campaign.platformAccount?.platformKey);
  const resultValue = metricsTotals?.conversions ?? 0; // This will be updated when useCampaignMetrics is refactored
  const costPerResult = metricsTotals?.spend && resultValue > 0 ? metricsTotals.spend / resultValue : null;
  const roas = calculateRoas(metricsTotals?.conversionValue, metricsTotals?.spend ?? 0, campaign.objective);

  const performancePoints =
    metrics?.points.map((point) => ({
      date: point.date,
      impressions: point.impressions,
      clicks: point.clicks,
      conversions: point.conversions,
      spend: point.spend,
      conversionValue: point.conversionValue,
      roas: point.roas,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/campaigns">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Campanhas
            </Link>
          </Button>
          <span>/</span>
          <span>{campaign.externalId ?? campaign.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(campaign.status)}>{formatStatus(campaign.status)}</Badge>
          <Badge variant="outline">{campaign.source === "synced" ? "Sincronizada via API" : campaign.source}</Badge>
          {campaign.lastSyncedAt ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Última sincronização {formatDateTime(campaign.lastSyncedAt)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal sm:w-auto",
                  !dateRange?.from && "text-muted-foreground",
                )}
              >
                <CalendarRange className="mr-2 h-4 w-4" />
                {dateRangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                defaultMonth={dateRange?.from ?? new Date()}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            {QUICK_RANGES.map((range) => (
              <Button
                key={range.label}
                variant={isQuickRangeActive(range.days) ? "default" : "secondary"}
                size="sm"
                onClick={() => applyQuickRange(range.days)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">Detalhamento</span>
          <Select value={breakdownKey} onValueChange={setBreakdownKey}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione um breakdown" />
            </SelectTrigger>
            <SelectContent>
              {BREAKDOWN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        {campaign.objective ? (
          <p className="text-muted-foreground">Objetivo: {campaign.objective}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Investimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(metricsTotals?.spend ?? 0, currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Período: {dateRangeLabel}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{resultLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{formatNumber(resultValue)}</p>
            <p className="text-xs text-muted-foreground">
              Impressões: {formatNumber(metricsTotals?.impressions ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Cliques: {formatNumber(metricsTotals?.clicks ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Custo por {resultLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{costPerResult ? formatCurrency(costPerResult, currency) : "—"}</p>
            <p className="text-xs text-muted-foreground">
              CTR: {formatPercent(metricsTotals?.ctr ?? 0, 2)}
            </p>
            <p className="text-xs text-muted-foreground">
              CPC: {formatCurrency(metricsTotals?.cpc ?? 0, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {roas !== null ? "ROAS" : "Métricas Adicionais"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {roas !== null ? (
              <>
                <p className="text-2xl font-semibold">{roas.toFixed(2)}x</p>
                <p className="text-xs text-muted-foreground">
                  Receita: {formatCurrency(metricsTotals?.conversionValue ?? 0, currency)}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold">{formatNumber(metricsTotals?.impressions ?? 0)}</p>
                <p className="text-xs text-muted-foreground">
                  Impressões totais
                </p>
                <p className="text-xs text-muted-foreground">
                  Alcance: {formatNumber((metricsTotals as any)?.reach ?? 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações principais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Conta vinculada</p>
              <p className="font-medium">
                {campaign.platformAccount?.name ?? "—"}
              </p>
              {campaign.platformAccount?.externalId ? (
                <p className="text-xs text-muted-foreground">
                  ID externo: {campaign.platformAccount.externalId}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Moeda / Fuso</p>
              <p className="font-medium">
                {campaign.platformAccount?.currency ?? "BRL"} • {campaign.platformAccount?.timezone ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Orçamento diário</p>
              <p className="font-medium">{formatCurrency(campaign.dailyBudget, currency)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Orçamento vitalício</p>
              <p className="font-medium">{formatCurrency(campaign.lifetimeBudget, currency)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Período</p>
              <p className="font-medium flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Atualização</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {formatDateTime(campaign.updatedAt)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Identificadores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">ID interno</span>
              <span className="font-mono text-xs">{campaign.id}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">ID Meta</span>
              <span className="font-mono text-xs">{campaign.externalId ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Fonte</span>
              <span className="font-medium">{campaign.source}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Segmentação</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonPreview value={campaign.targeting} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Configurações Meta</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonPreview value={campaign.settings} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Conjuntos de Anúncio</h2>
        </div>
        {adSets.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                Nenhum conjunto de anúncios sincronizado para esta campanha.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {adSets.map((adSet) => (
              <Card key={adSet.id} className="flex flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{adSet.name}</CardTitle>
                    <Badge variant={statusVariant(adSet.status)}>{formatStatus(adSet.status)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <Database className="h-3 w-3" />
                    <span>ID: {adSet.externalId ?? adSet.id}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Período</p>
                      <p className="font-medium">
                        {formatDate(adSet.startDate)} - {formatDate(adSet.endDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estratégia de lance</p>
                      <p className="font-medium">{adSet.bidStrategy ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bid / CPC target</p>
                      <p className="font-medium">{formatCurrency(adSet.bidAmount, currency)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo de orçamento</p>
                      <div className="font-medium">
                        {budgetTypeLabel(adSet.budgetType) ?? "—"}
                        {adSet.budgetType === "campaign" ? (
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            Herda orçamento da campanha
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Orçamento diário</p>
                      <p className="font-medium">{formatCurrency(adSet.dailyBudget, currency)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Orçamento vitalício</p>
                      <p className="font-medium">{formatCurrency(adSet.lifetimeBudget, currency)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Evento de cobrança</p>
                      <p className="font-medium capitalize">
                        {adSet.billingEvent ? adSet.billingEvent.replace(/_/g, " ").toLowerCase() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Otimização</p>
                      <div className="font-medium capitalize">
                        {adSet.optimizationGoal ? adSet.optimizationGoal.replace(/_/g, " ").toLowerCase() : "—"}
                        {adSet.pacingType && adSet.pacingType.length > 0 ? (
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            Pacing: {adSet.pacingType.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Anúncios ({adSet.ads.length})</p>
                    {adSet.ads.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum anúncio sincronizado.</p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead className="text-right">Última sync</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adSet.ads.map((ad) => (
                              <TableRow
                                key={ad.id}
                                onClick={() => navigate(`/ads/${ad.id}`)}
                                className="cursor-pointer transition hover:bg-muted/50"
                              >
                                <TableCell className="font-medium">{ad.name}</TableCell>
                                <TableCell>
                                  <Badge variant={statusVariant(ad.status)}>{formatStatus(ad.status)}</Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{ad.externalId ?? ad.id}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {formatDateTime(ad.lastSyncedAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Desempenho no período</h2>
        </div>

        <PerformanceChart data={performancePoints} isLoading={isLoadingMetrics} />

        {metricsError ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-destructive">
                Não foi possível carregar as métricas da campanha. {metricsError.message}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Série diária</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Impressões</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>CPC</TableHead>
                    <TableHead>Conversões</TableHead>
                    <TableHead>Conexões</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead>Valor Conversão</TableHead>
                    <TableHead>ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.points.length ? (
                    metrics.points.map((point) => (
                      <TableRow key={point.date}>
                        <TableCell>{formatDate(point.date)}</TableCell>
                        <TableCell>{formatNumber(point.impressions)}</TableCell>
                        <TableCell>{formatNumber(point.clicks)}</TableCell>
                        <TableCell>{formatPercent(point.ctr, 2)}</TableCell>
                        <TableCell>{formatCurrency(point.spend, currency)}</TableCell>
                        <TableCell>{formatCurrency(point.cpc, currency)}</TableCell>
                        <TableCell>{formatNumber(point.conversions)}</TableCell>
                        <TableCell>{formatNumber(point.messagingConnections ?? 0)}</TableCell>
                        <TableCell>{formatCurrency(point.cpa, currency)}</TableCell>
                        <TableCell>{formatCurrency(point.conversionValue, currency)}</TableCell>
                        <TableCell>{point.roas.toFixed(2)}x</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                        Nenhuma métrica disponível no período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">{breakdownLabel}</h2>
        </div>
        {breakdownError ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-destructive">
                Não foi possível carregar o breakdown selecionado. {breakdownError.message}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por segmento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-6">
                <div>
                  <p className="text-xs text-muted-foreground">Impressões</p>
                  <p className="font-medium">
                    {formatNumber(breakdownData?.total.impressions ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliques</p>
                  <p className="font-medium">{formatNumber(breakdownData?.total.clicks ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conversões</p>
                  <p className="font-medium">{formatNumber(breakdownData?.total.conversions ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conexões</p>
                  <p className="font-medium">{formatNumber(breakdownData?.total.messagingConnections ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gasto</p>
                  <p className="font-medium">
                    {formatCurrency(breakdownData?.total.spend ?? 0, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor de conversão</p>
                  <p className="font-medium">
                    {formatCurrency(breakdownData?.total.conversionValue ?? 0, currency)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Impressões</TableHead>
                      <TableHead>Cliques</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>Gasto</TableHead>
                      <TableHead>CPC</TableHead>
                      <TableHead>Conversões</TableHead>
                      <TableHead>Conexões</TableHead>
                      <TableHead>CPA</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingBreakdown ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                          Carregando breakdown...
                        </TableCell>
                      </TableRow>
                    ) : breakdownData?.items.length ? (
                      breakdownData.items.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">{formatDimensionValues(item.dimensionValues)}</TableCell>
                          <TableCell>{formatNumber(item.impressions)}</TableCell>
                          <TableCell>{formatNumber(item.clicks)}</TableCell>
                          <TableCell>{formatPercent(item.ctr, 2)}</TableCell>
                          <TableCell>{formatCurrency(item.spend, currency)}</TableCell>
                          <TableCell>{formatCurrency(item.cpc, currency)}</TableCell>
                          <TableCell>{formatNumber(item.conversions)}</TableCell>
                          <TableCell>{formatNumber(item.messagingConnections ?? 0)}</TableCell>
                          <TableCell>{formatCurrency(item.cpa, currency)}</TableCell>
                          <TableCell>{formatCurrency(item.conversionValue, currency)}</TableCell>
                          <TableCell>{item.roas.toFixed(2)}x</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                          Nenhum dado disponível para o breakdown selecionado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
