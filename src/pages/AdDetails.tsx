import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { differenceInCalendarDays, format, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, CalendarRange, Clock, MonitorPlay, PieChart, Sparkles, SquareStack } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdDetails } from "@/hooks/useAdDetails";
import { useAdMetrics } from "@/hooks/useAdMetrics";
import { useAdBreakdowns } from "@/hooks/useAdBreakdowns";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";

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

function formatStatus(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "Ativo";
    case "paused":
      return "Pausado";
    case "archived":
      return "Arquivado";
    case "completed":
      return "Concluído";
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

function formatDate(value?: string | null | Date) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
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

function formatDimensionValues(values: Record<string, unknown> | undefined | null) {
  const entries = Object.entries(values ?? {});
  if (entries.length === 0) return "Desconhecido";
  return (
    entries
      .map(([, value]) => {
        if (value === undefined || value === null || value === "") return "";
        return String(value);
      })
      .filter((value) => value.length > 0)
      .join(" • ") || "Desconhecido"
  );
}

function JsonPreview({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma informação registrada.</p>;
  }

  return (
    <pre className="max-h-[280px] overflow-auto rounded-md bg-muted/40 p-4 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdDetails() {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
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

  const { data: details, isLoading, error } = useAdDetails(adId);
  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useAdMetrics({
    adId,
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    granularity: "day",
  });
  const {
    data: breakdownData,
    isLoading: isLoadingBreakdown,
    error: breakdownError,
  } = useAdBreakdowns({
    adId,
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

  const ad = details?.ad ?? null;
  const creativeMetadata = (ad?.creative?.metadata ?? {}) as Record<string, unknown>;
  const objectStorySpec = (creativeMetadata.object_story_spec ?? {}) as Record<string, unknown>;
  const videoData = (objectStorySpec.video_data ?? null) as Record<string, unknown> | null;
  const imageData = (objectStorySpec.image_data ?? null) as Record<string, unknown> | null;
  const carouselData = (objectStorySpec.carousel_data ?? null) as Record<string, unknown> | null;

  const previewImage = useMemo(() => {
    if (!ad) return null;
    if (typeof ad.creative?.thumbnailUrl === "string" && ad.creative.thumbnailUrl) return ad.creative.thumbnailUrl;
    if (typeof ad.creative?.storageUrl === "string" && ad.creative.storageUrl && ad.creative.type !== "video") {
      return ad.creative.storageUrl;
    }
    const imageDataUrl = (imageData as { image_url?: string } | null)?.image_url;
    if (typeof imageDataUrl === "string" && imageDataUrl) return imageDataUrl;
    const videoImageUrl = (videoData as { image_url?: string } | null)?.image_url;
    if (typeof videoImageUrl === "string" && videoImageUrl) return videoImageUrl;
    if (carouselData && Array.isArray((carouselData as { cards?: unknown[] } | null)?.cards)) {
      const cards = (carouselData as { cards?: Array<Record<string, unknown>> }).cards ?? [];
      const firstCard = cards[0];
      const cardImage = (firstCard as { image_url?: string } | undefined)?.image_url;
      if (typeof cardImage === "string" && cardImage) return cardImage;
    }
    return null;
  }, [ad, carouselData, imageData, videoData]);

  const previewVideo = useMemo(() => {
    if (!ad) return null;
    if (typeof ad.creative?.storageUrl === "string" && ad.creative.type === "video" && ad.creative.storageUrl) {
      return ad.creative.storageUrl;
    }
    const videoUrl = (videoData as { video_url?: string } | null)?.video_url;
    if (typeof videoUrl === "string" && videoUrl) {
      return videoUrl;
    }
    return null;
  }, [ad, videoData]);

  const creativeMetadataCleaned = useMemo(() => {
    if (!ad?.creative?.metadata) return null;
    return ad.creative.metadata;
  }, [ad?.creative?.metadata]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Carregando dados do anúncio...
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
              Não foi possível carregar os detalhes do anúncio. {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground">Anúncio não encontrado.</p>
            <Button variant="link" className="px-0" asChild>
              <Link to="/campaigns">Voltar para campanhas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = ad.platformAccount?.currency ?? "BRL";
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

  const handleBack = () => {
    if (ad.campaign?.id) {
      navigate(`/campaigns/${ad.campaign.id}`);
    } else {
      navigate("/campaigns");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {ad.campaign ? ad.campaign.name : "Campanhas"}
          </Button>
          <span>/</span>
          <span>{ad.externalId ?? ad.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(ad.status)}>{formatStatus(ad.status)}</Badge>
          {ad.lastSyncedAt ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Última sincronização {formatDateTime(ad.lastSyncedAt)}
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
        <h1 className="text-3xl font-bold">{ad.name}</h1>
        <p className="text-muted-foreground">
          {ad.adSet ? `Conjunto: ${ad.adSet.name}` : "Conjunto de anúncios não informado"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Gasto no período</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(metrics?.totals.spend ?? 0, currency)}</p>
            <p className="text-xs text-muted-foreground">Período: {dateRangeLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(metrics?.totals.conversions ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              Valor: {formatCurrency(metrics?.totals.conversionValue ?? 0, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">CTR / CPC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{formatPercent(metrics?.totals.ctr ?? 0, 2)}</p>
            <p className="text-xs text-muted-foreground">
              CPC médio {formatCurrency(metrics?.totals.cpc ?? 0, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">ROAS / CPA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{(metrics?.totals.roas ?? 0).toFixed(2)}x</p>
            <p className="text-xs text-muted-foreground">
              CPA médio {formatCurrency(metrics?.totals.cpa ?? 0, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contexto do Anúncio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Campanha</p>
              {ad.campaign ? (
                <Button variant="link" className="px-0" onClick={() => navigate(`/campaigns/${ad.campaign?.id}`)}>
                  {ad.campaign.name}
                </Button>
              ) : (
                <p className="font-medium">—</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Conjunto de Anúncios</p>
              <p className="font-medium">{ad.adSet?.name ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Conta de Anúncios</p>
              <p className="font-medium">{ad.platformAccount?.name ?? ad.platformAccount?.id ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Moeda / Fuso</p>
              <p className="font-medium">
                {ad.platformAccount?.currency ?? "BRL"} • {ad.platformAccount?.timezone ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Atualizado em</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {formatDateTime(ad.updatedAt)}
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
              <span className="font-mono text-xs">{ad.id}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">ID Meta</span>
              <span className="font-mono text-xs">{ad.externalId ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorPlay className="h-4 w-4 text-muted-foreground" />
              Criativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ad.creative ? (
              <>
                {previewVideo ? (
                  <video
                    controls
                    poster={previewImage ?? undefined}
                    src={previewVideo}
                    className="w-full rounded-md border"
                  />
                ) : previewImage ? (
                  <img src={previewImage} alt={ad.creative.name} className="w-full rounded-md border object-cover" />
                ) : null}
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Nome</p>
                    <p className="font-medium">{ad.creative.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Tipo</p>
                    <p className="font-medium capitalize">{ad.creative.type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Aspect Ratio</p>
                    <p className="font-medium">{ad.creative.aspectRatio ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Duração</p>
                    <p className="font-medium">
                      {ad.creative.durationSeconds ? `${ad.creative.durationSeconds}s` : "—"}
                    </p>
                  </div>
                </div>
                {ad.creative.textContent ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Texto</p>
                    <p className="rounded-md bg-muted/40 p-3 text-sm">{ad.creative.textContent}</p>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Metadata</p>
                  <JsonPreview value={creativeMetadataCleaned} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum criativo vinculado a este anúncio. Verifique se o worker de sincronização já mapeia os assets.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Metadata do Anúncio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JsonPreview value={ad.metadata} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <SquareStack className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Desempenho no período</h2>
        </div>

        <PerformanceChart data={performancePoints} isLoading={isLoadingMetrics} />

        {metricsError ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-destructive">
                Não foi possível carregar as métricas do anúncio. {metricsError.message}
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
                        <TableCell>{formatCurrency(point.cpa, currency)}</TableCell>
                        <TableCell>{formatCurrency(point.conversionValue, currency)}</TableCell>
                        <TableCell>{point.roas.toFixed(2)}x</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
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
              <div className="grid gap-3 sm:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Impressões</p>
                  <p className="font-medium">{formatNumber(breakdownData?.total.impressions ?? 0)}</p>
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
                      <TableHead>CPA</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingBreakdown ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
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
                          <TableCell>{formatCurrency(item.cpa, currency)}</TableCell>
                          <TableCell>{formatCurrency(item.conversionValue, currency)}</TableCell>
                          <TableCell>{item.roas.toFixed(2)}x</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
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
